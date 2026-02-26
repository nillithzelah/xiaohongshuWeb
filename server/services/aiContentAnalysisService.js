// AI内容分析服务：分析维权内容真实性
const axios = require('axios');
const crypto = require('crypto');
const NodeCache = require('node-cache');
const AiPrompt = require('../models/AiPrompt');

class AiContentAnalysisService {
  constructor() {
    // 初始化缓存 (1小时过期)
    this.cache = new NodeCache({ stdTTL: 3600 });

    // 模型选择配置
    this.modelConfig = {
      primary: process.env.AI_PROVIDER || 'deepseek',  // 'deepseek' 或 'zai'
      maxRetries: 2
    };

    // API配置
    this.apiConfig = {
      deepseek: {
        baseUrl: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat'
      },
      zai: {
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: process.env.ZAI_API_KEY || '',
        model: 'glm-4.7'  // 最新旗舰版，可选: glm-4-flash, glm-4.6, glm-4.5
      }
    };

    // 错误处理配置
    this.errorConfig = {
      maxRetries: 3,
      retryDelay: [1000, 2000, 5000], // 指数退避
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 300000 // 5分钟
      }
    };

    // 监控指标
    this.metrics = {
      ai_call_count: 0,
      ai_success_rate: 0,
      ai_average_response_time: 0,
      cache_hit_rate: 0,
      model_switch_count: 0,
      false_positive_rate: 0,
      false_negative_rate: 0
    };

    // 数据库提示词缓存
    this.dbPrompts = {
      note_audit: null,
      comment_classification: null,
      lastLoadTime: null
    };

    // 是否已初始化（从数据库加载提示词）
    this.initialized = false;

    // 余额监控配置
    this.balanceConfig = {
      lowBalanceThreshold: parseFloat(process.env.AI_LOW_BALANCE_THRESHOLD || '5'),  // 低于此值切换
      checkInterval: 60 * 60 * 1000,  // 每小时检查一次
      autoSwitch: process.env.AI_AUTO_SWITCH === 'true',  // 是否自动切换
      lastCheckTime: null,
      currentProvider: process.env.AI_PROVIDER || 'deepseek'
    };
  }

  /**
   * 初始化服务 - 从数据库加载提示词
   */
  async initialize() {
    if (this.initialized) return;

    try {
      console.log('🔄 [AI提示词] 从数据库加载提示词...');
      await this.loadPromptsFromDatabase();
      this.initialized = true;
      console.log('✅ [AI提示词] 提示词加载完成');

      // 启动余额监控定时任务
      this.startBalanceMonitoring();
    } catch (error) {
      console.error('❌ [AI提示词] 加载失败，将使用硬编码提示词:', error.message);
      // 加载失败不影响服务启动，使用硬编码提示词作为兜底
      this.initialized = true;
      // 仍然启动余额监控
      this.startBalanceMonitoring();
    }
  }

  /**
   * 启动余额监控定时任务
   */
  startBalanceMonitoring() {
    // 立即检查一次
    this.checkBalanceAndSwitch();

    // 定时检查
    setInterval(async () => {
      await this.checkBalanceAndSwitch();
    }, this.balanceConfig.checkInterval);

    console.log(`💰 [余额监控] 已启动，检查间隔: ${this.balanceConfig.checkInterval / 60000} 小时，切换阈值: ¥${this.balanceConfig.lowBalanceThreshold}`);
  }

  /**
   * 检查余额并在需要时切换 AI 提供商
   */
  async checkBalanceAndSwitch() {
    const now = Date.now();

    // 避免频繁检查
    if (this.balanceConfig.lastCheckTime && (now - this.balanceConfig.lastCheckTime < this.balanceConfig.checkInterval)) {
      return;
    }
    this.balanceConfig.lastCheckTime = now;

    try {
      // 只检查当前使用 deepseek 的情况
      if (this.balanceConfig.currentProvider !== 'deepseek') {
        console.log(`💰 [余额监控] 当前使用 ${this.balanceConfig.currentProvider}，跳过 DeepSeek 余额检查`);
        return;
      }

      const balance = await this.getDeepSeekBalance();

      if (balance === null) {
        console.warn('⚠️ [余额监控] 无法获取 DeepSeek 余额');
        return;
      }

      console.log(`💰 [余额监控] DeepSeek 余额: ¥${balance.toFixed(2)}`);

      // 检查是否低于阈值
      if (balance < this.balanceConfig.lowBalanceThreshold) {
        console.warn(`⚠️ [余额监控] DeepSeek 余额低于 ¥${this.balanceConfig.lowBalanceThreshold}，当前: ¥${balance.toFixed(2)}`);

        if (this.balanceConfig.autoSwitch && this.apiConfig.zai.apiKey) {
          await this.switchProvider('zai');
        } else {
          console.log('ℹ️ [余额监控] 自动切换未启用，请手动配置 AI_AUTO_SWITCH=true 或切换到 z.ai');
        }
      }
    } catch (error) {
      console.error('❌ [余额监控] 检查失败:', error.message);
    }
  }

  /**
   * 获取 DeepSeek 余额
   */
  async getDeepSeekBalance() {
    try {
      const response = await axios.get(`${this.apiConfig.deepseek.baseUrl}/user/balance`, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data && response.data.balance_infos && response.data.balance_infos.length > 0) {
        const balanceInfo = response.data.balance_infos[0];
        return parseFloat(balanceInfo.total_balance || 0);
      }

      return null;
    } catch (error) {
      console.error('DeepSeek 余额查询失败:', error.message);
      return null;
    }
  }

  /**
   * 切换 AI 提供商
   */
  async switchProvider(newProvider) {
    if (newProvider === this.balanceConfig.currentProvider) {
      console.log(`💰 [AI切换] 已经是 ${newProvider}，无需切换`);
      return;
    }

    const oldProvider = this.balanceConfig.currentProvider;
    this.balanceConfig.currentProvider = newProvider;
    this.modelConfig.primary = newProvider;

    console.log(`🔄 [AI切换] ${oldProvider.toUpperCase()} → ${newProvider.toUpperCase()}`);
    console.log(`💰 [AI切换] 余额低于阈值，已自动切换到 ${newProvider.toUpperCase()}`);

    // 记录切换次数
    this.metrics.model_switch_count++;
  }

  /**
   * 从数据库加载提示词
   */
  async loadPromptsFromDatabase() {
    try {
      const prompts = await AiPrompt.find({ enabled: true });

      for (const prompt of prompts) {
        if (prompt.type === 'note_audit') {
          this.dbPrompts.note_audit = {
            name: prompt.name,
            displayName: prompt.displayName,
            systemPrompt: prompt.systemPrompt,
            userPromptTemplate: prompt.userPromptTemplate,
            apiConfig: prompt.apiConfig,
            outputFormat: prompt.outputFormat,
            version: prompt.version
          };
          console.log(`  ✓ 加载笔记审核提示词: ${prompt.displayName} (${prompt.version})`);
        } else if (prompt.type === 'comment_classification') {
          this.dbPrompts.comment_classification = {
            name: prompt.name,
            displayName: prompt.displayName,
            systemPrompt: prompt.systemPrompt,
            userPromptTemplate: prompt.userPromptTemplate,
            apiConfig: prompt.apiConfig,
            outputFormat: prompt.outputFormat,
            version: prompt.version
          };
          console.log(`  ✓ 加载评论分类提示词: ${prompt.displayName} (${prompt.version})`);
        }
      }

      this.dbPrompts.lastLoadTime = new Date();
    } catch (error) {
      console.error('❌ [AI提示词] 从数据库加载失败:', error.message);
      throw error;
    }
  }

  /**
   * 重新加载提示词（用于更新后热加载）
   */
  async reloadPrompts() {
    console.log('🔄 [AI提示词] 重新加载提示词...');
    try {
      await this.loadPromptsFromDatabase();
      console.log('✅ [AI提示词] 重新加载完成');
      return { success: true, message: '提示词重新加载成功' };
    } catch (error) {
      console.error('❌ [AI提示词] 重新加载失败:', error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取笔记审核提示词（优先使用数据库）
   */
  getNoteAuditPrompt() {
    if (this.dbPrompts.note_audit) {
      return this.dbPrompts.note_audit;
    }
    // 返回 null 表示使用硬编码提示词
    return null;
  }

  /**
   * 获取评论分类提示词（优先使用数据库）
   */
  getCommentClassificationPrompt() {
    if (this.dbPrompts.comment_classification) {
      return this.dbPrompts.comment_classification;
    }
    // 返回 null 表示使用硬编码提示词
    return null;
  }

  /**
   * 替换模板变量
   * @param {string} template - 模板字符串，使用 ${变量名} 语法
   * @param {object} variables - 变量对象
   */
  replaceTemplateVariables(template, variables = {}) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      // $ 在正则中有特殊含义，需要转义为 \$
      const placeholder = `\\$\\{${key}\\}`;
      // 使用函数形式的replace来避免$被当作替换模式的特殊字符
      const regex = new RegExp(placeholder, 'g');
      result = result.replace(regex, () => String(value));
    }
    return result;
  }

  /**
   * 分析维权帖子内容真实性
   * @param {string} content - 笔记内容文本
   * @param {string} scamCategory - 诈骗类型 (如: '减肥诈骗', '护肤诈骗'等)
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeVictimPost(content, scamCategory) {
    try {
      // 确保已初始化（从数据库加载提示词）
      if (!this.initialized) {
        await this.initialize();
      }

      console.log('🤖 开始AI内容分析...');

      // 1. 缓存检查
      const cacheKey = this.generateCacheKey(content, scamCategory);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('✅ 缓存命中，直接返回结果');
        this.metrics.cache_hit_rate = (this.metrics.cache_hit_rate + 1) / 2; // 简单移动平均
        return cached;
      }

      // 2. 主模型调用
      let result = await this.callDeepSeek(content, scamCategory);

      // 3. 缓存结果
      this.cache.set(cacheKey, result);

      // 4. 更新监控指标
      this.updateMetrics(result);

      console.log('✅ AI内容分析完成:', {
        is_genuine: result.is_genuine_victim_post,
        confidence: result.confidence_score,
        category: result.scam_category,
        reason: result.reason.substring(0, 100) + '...'
      });

      return result;

    } catch (error) {
      console.error('❌ AI内容分析失败:', error.message);

      // 判断错误类型并返回友好的错误信息
      let errorReason = 'AI分析服务异常';
      if (error.code === 'ECONNABORTED' || error.message === 'aborted') {
        errorReason = 'AI请求超时（超过60秒）';
      } else if (error.code === 'ECONNRESET') {
        errorReason = 'AI连接被重置';
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorReason = 'AI服务无法访问';
      } else if (error.response) {
        errorReason = `AI API错误: ${error.response.status}`;
      }

      return {
        is_genuine_victim_post: false,
        scam_category: scamCategory,
        confidence_score: 0.0,
        emotion_analysis: {
          anger_level: 0,
          disappointment_level: 0,
          urgency_level: 0
        },
        reason: errorReason,
        risk_factors: ['AI服务不可用'],
        recommendation: '建议人工审核',
        error: error.message,
        error_code: error.code
      };
    }
  }

  /**
   * 调用DeepSeek模型（笔记审核）
   */
  async callDeepSeek(content, scamCategory) {
    const startTime = Date.now();

    try {
      // 必须使用数据库提示词
      const dbPrompt = this.getNoteAuditPrompt();
      if (!dbPrompt) {
        throw new Error('数据库中未配置笔记审核提示词，请先在 AI提示词管理中配置 note_audit 类型的提示词');
      }

      console.log(`📋 [AI提示词] 使用数据库提示词: ${dbPrompt.displayName} v${dbPrompt.version}`);

      const systemPrompt = dbPrompt.systemPrompt || '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。';
      // 替换模板变量
      const userPrompt = this.replaceTemplateVariables(dbPrompt.userPromptTemplate, {
        content: content,
        scamCategory: scamCategory || '未知'
      });
      const apiConfig = dbPrompt.apiConfig || {};

      const response = await axios.post(`${this.apiConfig.deepseek.baseUrl}/chat/completions`, {
        model: apiConfig.model || this.apiConfig.deepseek.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: apiConfig.temperature ?? 0.3,
        max_tokens: apiConfig.maxTokens || 2000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000  // 60秒超时（DeepSeek API有时响应较慢）
      });

      const responseTime = Date.now() - startTime;
      this.metrics.ai_average_response_time = (this.metrics.ai_average_response_time + responseTime) / 2;

      const result = this.parseAIResponse(response.data.choices[0].message.content);
      result.model_used = apiConfig.model || 'deepseek-chat';
      result.prompt_used = dbPrompt.name;
      result.prompt_version = dbPrompt.version;  // 记录提示词版本
      result.response_time = responseTime;

      // 在 reason 前添加版本号
      if (result.reason && dbPrompt.version) {
        result.reason = `【v${dbPrompt.version}】${result.reason}`;
      }

      return result;

    } catch (error) {
      console.error('DeepSeek API调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 调用z.ai模型（笔记审核）
   */
  async callZai(content, scamCategory) {
    const startTime = Date.now();

    try {
      // 必须使用数据库提示词
      const dbPrompt = this.getNoteAuditPrompt();
      if (!dbPrompt) {
        throw new Error('数据库中未配置笔记审核提示词，请先在 AI提示词管理中配置 note_audit 类型的提示词');
      }

      console.log(`📋 [AI提示词] 使用数据库提示词: ${dbPrompt.displayName} v${dbPrompt.version}`);

      const systemPrompt = dbPrompt.systemPrompt || '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。';
      // 替换模板变量
      const userPrompt = this.replaceTemplateVariables(dbPrompt.userPromptTemplate, {
        content: content,
        scamCategory: scamCategory || '未知'
      });
      const apiConfig = dbPrompt.apiConfig || {};

      const response = await axios.post(`${this.apiConfig.zai.baseUrl}/chat/completions`, {
        model: apiConfig.model || this.apiConfig.zai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: apiConfig.temperature ?? 0.3,
        max_tokens: apiConfig.maxTokens || 2000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.zai.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const responseTime = Date.now() - startTime;
      this.metrics.ai_average_response_time = (this.metrics.ai_average_response_time + responseTime) / 2;

      const result = this.parseAIResponse(response.data.choices[0].message.content);
      result.model_used = apiConfig.model || 'glm-4-flash';
      result.prompt_used = dbPrompt.name;
      result.prompt_version = dbPrompt.version;  // 记录提示词版本
      result.response_time = responseTime;

      // 在 reason 前添加版本号
      if (result.reason && dbPrompt.version) {
        result.reason = `【v${dbPrompt.version}】${result.reason}`;
      }

      return result;

    } catch (error) {
      console.error('z.ai API调用失败:', error.message);
      throw error;
    }
  }

  /**
   * 通用的AI调用方法 - 根据配置选择使用哪个AI服务
   */
  async callAI(content, scamCategory) {
    const provider = this.modelConfig.primary;

    console.log(`🤖 [AI Provider] 使用: ${provider.toUpperCase()}`);

    if (provider === 'zai') {
      if (!this.apiConfig.zai.apiKey) {
        console.warn('⚠️ z.ai API key未配置，回退到DeepSeek');
        return this.callDeepSeek(content, scamCategory);
      }
      return this.callZai(content, scamCategory);
    } else {
      return this.callDeepSeek(content, scamCategory);
    }
  }


  /**
   * 解析AI响应
   */
  parseAIResponse(responseText) {
    try {
      // 清理响应文本，移除可能的markdown代码块标记
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // 修复常见的JSON格式错误：数组中的单引号替换为双引号
      cleanText = cleanText.replace(/\[([^\]]*'[^']*'[^]]*)\]/g, (match) => {
        return match.replace(/'/g, '"');
      });

      const result = JSON.parse(cleanText);

      // 验证必需字段
      if (typeof result.is_genuine_victim_post !== 'boolean') {
        throw new Error('缺少必需字段: is_genuine_victim_post');
      }
      if (typeof result.confidence_score !== 'number') {
        throw new Error('缺少必需字段: confidence_score');
      }
      if (!result.reason) {
        throw new Error('缺少必需字段: reason');
      }

      // 确保数值范围正确
      result.confidence_score = Math.max(0, Math.min(1, result.confidence_score));

      // 确保emotion_analysis存在
      if (!result.emotion_analysis) {
        result.emotion_analysis = {
          anger_level: 0,
          disappointment_level: 0,
          urgency_level: 0
        };
      }

      // 确保数组字段存在
      if (!Array.isArray(result.risk_factors)) {
        result.risk_factors = [];
      }

      return result;

    } catch (error) {
      console.error('解析AI响应失败:', error, '原始响应:', responseText);
      // 返回默认的失败结果
      return {
        is_genuine_victim_post: false,
        scam_category: 'unknown',
        confidence_score: 0.0,
        emotion_analysis: {
          anger_level: 0,
          disappointment_level: 0,
          urgency_level: 0
        },
	      reason: `AI分析服务异常: ${error.message}`,
        risk_factors: ['AI响应格式错误'],
        recommendation: '建议人工审核'
      };
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(content, scamCategory) {
    const hash = crypto.createHash('md5');
    hash.update(content.substring(0, 1000) + scamCategory);
    return hash.digest('hex');
  }

  /**
   * 更新监控指标
   */
  updateMetrics(result) {
    this.metrics.ai_call_count++;

    // 计算成功率 (简单移动平均)
    const success = result.confidence_score > 0.5 ? 1 : 0;
    this.metrics.ai_success_rate = (this.metrics.ai_success_rate + success) / 2;
  }

  /**
   * 获取监控指标
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.flushAll();
    console.log('🧹 AI分析缓存已清理');
  }

  /**
   * 分析评论是否为潜在客户线索
   * @param {string} commentContent - 评论内容
   * @param {string} noteTitle - 笔记标题（用于上下文）
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeComment(commentContent, noteTitle = '') {
    try {
      console.log('🤖 [评论AI分析] 开始分析评论...');

      // 1. 缓存检查
      const cacheKey = this.generateCacheKey('comment_' + commentContent, 'lead_analysis');
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('✅ [评论AI分析] 缓存命中');
        return cached;
      }

      // 2. 调用 DeepSeek
      const result = await this.callDeepSeekForComment(commentContent, noteTitle);

      // 3. 缓存结果
      this.cache.set(cacheKey, result);

      console.log(`✅ [评论AI分析] 完成: ${result.category} (${result.confidence_score})`);
      return result;

    } catch (error) {
      console.error('❌ [评论AI分析] 失败:', error.message);

      // 失败时返回保守的默认结果
      return {
        isPotentialLead: true,      // 默认保留，避免漏掉
        category: 'uncertain',
        confidence_score: 0.3,
        reason: 'AI分析失败，默认保留',
        shouldContact: true,
        riskLevel: 'low'
      };
    }
  }

  /**
   * 调用 DeepSeek 分析评论
   */
  async callDeepSeekForComment(commentContent, noteTitle) {
    const startTime = Date.now();

    try {
      // 必须使用数据库提示词
      const dbPrompt = this.getCommentClassificationPrompt();
      if (!dbPrompt) {
        throw new Error('数据库中未配置评论分类提示词，请先在 AI提示词管理中配置 comment_classification 类型的提示词');
      }

      console.log(`📋 [AI提示词] 使用数据库提示词: ${dbPrompt.displayName} v${dbPrompt.version}`);

      const systemPrompt = dbPrompt.systemPrompt || '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。';
      // 替换模板变量
      const userPrompt = this.replaceTemplateVariables(dbPrompt.userPromptTemplate, {
        commentContent: commentContent,
        noteTitle: noteTitle || '减肥被骗维权相关'
      });
      const apiConfig = dbPrompt.apiConfig || {};

      const response = await axios.post(`${this.apiConfig.deepseek.baseUrl}/chat/completions`, {
        model: apiConfig.model || this.apiConfig.deepseek.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: apiConfig.temperature ?? 0.2,
        max_tokens: apiConfig.maxTokens || 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const responseTime = Date.now() - startTime;
      const result = this.parseCommentResponse(response.data.choices[0].message.content);
      result.prompt_used = dbPrompt.name;
      result.response_time = responseTime;

      return result;

    } catch (error) {
      console.error('DeepSeek 评论分析失败:', error.message);
      throw error;
    }
  }

  /**
   * 解析评论分析响应
   */
  parseCommentResponse(responseText) {
    try {
      let cleanText = responseText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanText);

      // 验证并设置默认值
      if (typeof result.isPotentialLead !== 'boolean') {
        // 根据 category 推断
        result.isPotentialLead = result.category === 'potential_lead';
      }
      if (typeof result.shouldContact !== 'boolean') {
        result.shouldContact = result.isPotentialLead;
      }
      if (typeof result.confidence_score !== 'number') {
        result.confidence_score = 0.7;
      }
      if (!result.category) {
        result.category = 'uncertain';
      }
      if (!result.reason) {
        result.reason = 'AI分析未提供详细理由';
      }
      if (!result.riskLevel) {
        result.riskLevel = 'low';
      }

      return result;

    } catch (error) {
      console.error('解析评论AI响应失败:', error, '原始响应:', responseText);
      return {
        isPotentialLead: true,
        category: 'uncertain',
        confidence_score: 0.3,
        reason: '解析失败，默认保留',
        shouldContact: true,
        riskLevel: 'low'
      };
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: true, // AI服务始终运行
      stats: this.metrics,
      cache: {
        size: this.cache.keys().length,
        ttl: this.cache.options.stdTTL
      },
      performance: {
        averageResponseTime: this.metrics.ai_average_response_time,
        successRate: this.metrics.ai_success_rate,
        callCount: this.metrics.ai_call_count
      },
      errorRecovery: {
        circuitBreaker: false, // AI服务没有熔断器
        consecutiveFailures: 0
      }
    };
  }

  /**
   * 测试自定义提示词
   * @param {string} systemPrompt - 系统提示词
   * @param {string} userPrompt - 用户提示词
   * @param {object} apiConfig - API 配置
   * @returns {Promise<object>} AI 响应结果
   */
  async testPrompt(systemPrompt, userPrompt, apiConfig = {}) {
    const config = {
      model: apiConfig.model || 'deepseek-chat',
      temperature: apiConfig.temperature || 0.3,
      maxTokens: apiConfig.maxTokens || 1000
    };

    try {
      const response = await axios.post(
        `${this.apiConfig.deepseek.baseUrl}/chat/completions`,
        {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiConfig.deepseek.apiKey}`
          },
          timeout: 30000
        }
      );

      const content = response.data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        content: content,
        usage: response.data.usage || {}
      };
    } catch (error) {
      console.error('测试提示词失败:', error.message);
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }

  /**
   * 静态方法：测试自定义提示词（兼容旧代码）
   * @param {string} systemPrompt - 系统提示词
   * @param {string} userPrompt - 用户提示词
   * @param {object} apiConfig - API 配置
   * @returns {Promise<object>} AI 响应结果
   */
  static async testPromptStatic(systemPrompt, userPrompt, apiConfig = {}) {
    const config = {
      model: apiConfig.model || 'deepseek-chat',
      temperature: apiConfig.temperature || 0.3,
      maxTokens: apiConfig.maxTokens || 1000
    };

    const apiBaseUrl = 'https://api.deepseek.com';
    const apiKey = process.env.DEEPSEEK_API_KEY;

    try {
      const response = await axios.post(
        `${apiBaseUrl}/chat/completions`,
        {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        }
      );

      const content = response.data.choices?.[0]?.message?.content || '';

      return {
        success: true,
        content: content,
        usage: response.data.usage || {}
      };
    } catch (error) {
      console.error('测试提示词失败:', error.message);
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }
}

// 导出单例实例
const instance = new AiContentAnalysisService();

// 兼容旧代码：同时导出类和实例
module.exports = instance;
// 同时在实例上挂载类，以便创建新实例
instance.Class = AiContentAnalysisService;