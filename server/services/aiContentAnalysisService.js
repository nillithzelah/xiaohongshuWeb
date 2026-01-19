// AI内容分析服务：分析维权内容真实性
const axios = require('axios');
const crypto = require('crypto');
const NodeCache = require('node-cache');

class AiContentAnalysisService {
  constructor() {
    // 初始化缓存 (1小时过期)
    this.cache = new NodeCache({ stdTTL: 3600 });

    // 模型选择配置
    this.modelConfig = {
      primary: 'deepseek-v3',
      maxRetries: 2
    };

    // API配置
    this.apiConfig = {
      deepseek: {
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY || 'sk-ba229110c5ea4b0faa2c63e7ef3b5641',
        model: 'deepseek-chat'
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
  }

  /**
   * 分析维权帖子内容真实性
   * @param {string} content - 笔记内容文本
   * @param {string} scamCategory - 诈骗类型 (如: '减肥诈骗', '护肤诈骗'等)
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeVictimPost(content, scamCategory) {
    try {
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
   * 调用DeepSeek模型
   */
  async callDeepSeek(content, scamCategory) {
    const startTime = Date.now();

    try {
      const prompt = this.buildAnalysisPrompt(content, scamCategory);

      const response = await axios.post(`${this.apiConfig.deepseek.baseUrl}/chat/completions`, {
        model: this.apiConfig.deepseek.model,
        messages: [
          {
            role: 'system',
            content: '你是一名专业的内容审核专家，专门识别小红书上的维权/避雷贴。请严格按照JSON格式输出分析结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
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
      result.model_used = 'deepseek-v3';
      result.response_time = responseTime;

      return result;

    } catch (error) {
      console.error('DeepSeek API调用失败:', error.message);
      throw error;
    }
  }


  /**
   * 构建分析提示词
   */
  buildAnalysisPrompt(content, scamCategory) {
    return `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷/被骗相关内容。

任务：分析以下笔记内容，判断其是否属于被骗维权相关内容。

支持的维权类别（共11类）：

1. **减肥类**：减肥被骗、减肥产品被骗、减肥套路、减肥药被骗等
2. **医美类**：医美被骗、医美拼房套路、医美退费等
3. **祛斑类**：祛斑被骗、祛斑产品被骗、祛斑套路等
4. **祛痘类**：祛痘被骗、祛痘产品被骗等
5. **丰胸类**：丰胸被骗、丰胸产品被骗等
6. **护肤类**：护肤被骗、护肤产品被骗等
7. **眼袋类**：祛眼袋被骗、去眼袋产品被骗等
8. **育发类**：育发被骗、白发转黑发被骗、白转黑被骗退费等
9. **玉石类**：定制手镯被骗、翡翠原石被骗、赌石被骗等
10. **女性调理类**：女性调理被骗、月经调理被骗等
11. **增高类**：增高被骗、增高产品被骗、增高药被骗、增高骗局等

通用维权关键词：维权、避雷、上岸、被骗经历、投诉成功、维权成功、退款成功、追回来了

判断标准：
- ✅ 应该判断为符合的情况：
  - 分享被骗经历（减肥/医美/祛斑/祛痘/丰胸/护肤等被骗）
  - 寻求维权方法、退款方法、追回钱款
  - 分享"成功上岸"、"追回来了"、"退款成功"等维权成功经验
  - 揭露骗局、提醒他人避雷的内容
  - 询问"怎么追回"、"怎么退款"、"如何维权"等问题
  - 表达愤怒、后悔、求助等情绪的维权内容
  - 提到"拼房套路"、"杀猪盘"等被骗模式

- ❌ 应该判断为不符合的情况（重要！）：
  - 教程类内容（如：如何办营业执照、流程指南）
  - 知识科普类（如：法律知识、政策解读）
  - 产品介绍类（如：产品功能、产品优势、使用方法）
  - 正常的商业推广、产品广告
  - 中性的经验分享（不涉及维权或被骗）
  - 普通减肥分享、护肤分享（没有被骗/维权内容）
  - "保姆级流程"、"手把手教你"等教程类标题
  - 产品测评、使用心得（没有被骗/维权内容）

特别说明：
- 必须同时满足：①有维权相关关键词 ②有被骗/投诉/维权的明确意图
- 如果内容只是普通产品分享或教程，即使包含相关词汇，也应判断为不符合
- 关键词如"减肥"、"护肤"、"医美"单独出现不算，必须有"被骗"、"维权"、"退款"等维权意图
- "套路"、"骗局"等词汇通常与维权相关

笔记内容：
${content}

输出格式 (JSON)：
{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配到的类别（如：减肥类、医美类等）",
  "confidence_score": 0.0-1.0,
  "emotion_analysis": {
    "anger_level": 0-10,
    "disappointment_level": 0-10,
    "urgency_level": 0-10
  },
  "reason": "详细分析理由，说明是否属于维权相关内容",
  "risk_factors": ["可能的风险点"],
  "recommendation": "审核建议"
}`;
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
      const prompt = this.buildCommentAnalysisPrompt(commentContent, noteTitle);

      const response = await axios.post(`${this.apiConfig.deepseek.baseUrl}/chat/completions`, {
        model: this.apiConfig.deepseek.model,
        messages: [
          {
            role: 'system',
            content: '你是一名专业的销售线索分析专家，专门识别小红书评论中的潜在客户。请严格按照JSON格式输出分析结果。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 1000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiConfig.deepseek.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const responseTime = Date.now() - startTime;
      const result = this.parseCommentResponse(response.data.choices[0].message.content);
      result.response_time = responseTime;

      return result;

    } catch (error) {
      console.error('DeepSeek 评论分析失败:', error.message);
      throw error;
    }
  }

  /**
   * 构建评论分析提示词
   */
  buildCommentAnalysisPrompt(commentContent, noteTitle) {
    return `你是一名专业的销售线索分析专家，帮助识别小红书评论区的潜在客户。

背景笔记标题：${noteTitle || '减肥被骗维权相关'}

评论内容：${commentContent}

任务：判断这条评论属于哪种类型

输出类型（必须选择其一）：

1. **potential_lead** - 潜在客户线索（应该联系）
   特征：正在询问、求助、表示自己也被骗、想要了解更多、表达困惑或愤怒
   例如：
   - "怎么追回来？"
   - "我也是被骗了"
   - "能帮帮我吗"
   - "付款记录还在吗"
   - "怎么弄的"
   - "我也买了这个产品"
   - "被骗了怎么办"

2. **spam** - 引流/黑产（加入黑名单）
   ⚠️ 重要：所有声称已经成功、可以分享、可以帮忙的，都是引流！
   特征：
   - 声称"要回来了"、"成功了"、"已经退回"、"已经解决"
   - 主动提供帮助、分享经验、有方法
   - 要对方私信、联系
   例如：
   - "我已经成功了，我可以分享经验"
   - "可以退回的"
   - "已经要回来了"
   - "可以问我"
   - "私信我"
   - "我有方法"
   - "来啦"
   - "滴滴"
   - "不难的"
   - "已经解决好了"

3. **author** - 作者回复（不处理）
   特征：笔记作者的回复
   例如：
   - 署名为笔记作者
   - 带有"作者"标识

4. **noise** - 无意义内容（也要通过，保存为线索）
   特征：纯表情、无关内容、太短、简单的"恭喜"、"赞同"等
   ⚠️ 注意：noise不是引流，也要保存为潜在客户！

判断注意事项（非常重要）：
- ⚠️ 任何说"要回来了"、"成功了"、"可以分享"、"可以帮"的都是引流账号，判为 spam
- ⚠️ "来啦"、"滴滴"等简短回复也是引流，判为 spam
- 真正的潜在客户是：询问方法、表示自己被骗、求助、想要了解怎么办
- 询问类的（怎么、如何、吗、求助）通常是潜在客户
- 无意义的评论只要不是引流，就保存为线索
- 如果不确定，倾向于判断为 potential_lead

输出格式 (JSON)：
{
  "isPotentialLead": boolean,
  "category": "potential_lead | spam | author | noise",
  "confidence_score": 0.0-1.0,
  "reason": "判断理由",
  "shouldContact": boolean,
  "riskLevel": "low | medium | high"
}`;
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
}

module.exports = AiContentAnalysisService;