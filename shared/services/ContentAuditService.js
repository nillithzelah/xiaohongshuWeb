// 内容审核服务 - 关键词检查和AI文意审核
const https = require('https');

/**
 * 维权关键词配置
 */
const KEYWORD_CONFIGS = [
  {
    keywords: [
      '减肥', '瘦身', '减肥被骗', '减肥被骗钱怎么追回', '减肥被骗了怎么办', '减肥被骗维权', '减肥被骗退款',
      '买减肥产品被骗怎么追回钱', '微信减肥产品被骗如何追回', '减肥药被骗怎么追回', '减肥被骗案例',
      '广州健康管理中心减肥被骗', '减肥产品被骗', '减肥产品被骗如何追回', '减肥产品被骗如何追回全款',
      '减肥产品被骗怎么退钱', '减肥产品被骗套路', '减肥产品被骗怎么办', '减肥产品被骗退费',
      '线上减肥产品被骗', '网购减肥产品被骗', '减肥产品退款', '减肥产品被骗如何退款',
      '减肥产品不退款怎么处理', '减肥产品无效退款', '减肥产品收到拆开怎么退款', '减肥产品退费怎么追回来',
      '减肥产品被骗退费', '减肥产品被骗怎么退钱', '减肥套路诈骗', '减肥套路退费怎么处理',
      '减肥套路话术', '减肥产品被骗套路', '排黑油便减肥套路', '小红书减肥中药套路', '健康管理中心减肥套路', '减肥被套路',
      '健康管理', '减肥中心', '减肥机构', '减肥被骗了'
    ],
    weight: 1.0,
    category: '减肥诈骗'
  },
  {
    keywords: [
      '护肤', '护肤产品被骗', '买护肤品被骗怎么追回', '护肤产品被骗怎么追回', '买护肤产品被骗怎么追回钱',
      '护肤品被骗怎么追回', '护肤品被骗的钱怎么追回', '护肤被骗维权', '护肤被骗怎么办', '护肤被骗', '护肤品被骗',
      '护肤中心', '护肤机构', '护肤被骗了', '护肤管理中心', '护肤产品', '美容护肤', '护肤'
    ],
    weight: 1.0,
    category: '护肤诈骗'
  },
  {
    keywords: [
      '祛斑', '祛痘', '祛斑被骗', '祛斑被骗的钱怎么追回', '祛斑被骗的钱怎么退款', '祛斑被骗了怎么办',
      '祛斑被骗案例', '祛斑产品被骗怎么追回', '祛痘祛斑被骗怎么追', '祛斑被骗怎么退钱', '祛斑产品被骗后续',
      '网购祛斑产品被骗', '祛斑祛痘产品被骗', '白凤祛斑产品被骗', '祛斑产品被骗怎么退钱',
      '祛斑产品被骗的钱怎么追回', '祛斑产品被骗退费怎么追回', '买祛斑从被骗怎么追回钱', '祛斑骗子的产品是真的吗',
      '祛痘被骗', '祛痘被骗的钱怎么追回', '祛痘被骗真实案例', '祛痘被骗怎么追回', '祛痘被骗怎么办',
      '祛痘被骗怎么退款', '祛痘产品被骗怎么追回', '祛痘祛斑被骗怎么追回', '祛斑祛痘被骗', '祛痘产品被骗',
      '祛斑祛痘产品被骗', '祛痘产品被骗', '微商祛痘产品被骗怎么追回', '祛痘产品被坑怎么追回', '祛痘产品诈骗套路',
      '袪眼袋被骗', '去眼袋被骗', '袪眼袋被骗如何追回损失', '去眼袋产品被骗怎么追回', '去眼袋的款产品可信吗',
      '袪眼袋产品被骗', '去眼袋产品被骗怎么追回', '抖音祛眼袋被骗了怎么办', '美白淡斑产品祛斑被骗怎么追回',
      '祛斑套路', '祛斑套路被骗', '祛斑套路有哪些', '祛斑套路揭秘', '祛斑骗人套路', '私人定制祛斑骗人套路',
      '微信祛斑骗人套路', '398元祛斑套路',
      '祛斑产品', '祛痘产品', '祛斑中心', '祛痘中心', '祛斑机构', '祛痘机构', '祛斑被骗了', '祛痘被骗了'
    ],
    weight: 1.0,
    category: '祛斑诈骗'
  },
  {
    keywords: [
      '丰胸被骗', '买丰胸产品被骗怎么追回钱', '丰胸产品被骗怎么退钱', '丰胸被骗怎么自己给钱追回',
      '丰胸被骗怎么做', '丰胸产品被骗怎么办', '买丰胸产品被骗怎么追回来', '丰胸产品被骗怎么办',
      '买丰胸产品被骗如何追回损失', '网购丰胸被骗如何一招退款',
      '丰胸产品', '丰胸中心', '丰胸机构', '丰胸被骗了'
    ],
    weight: 1.0,
    category: '丰胸诈骗'
  },
  {
    keywords: [
      '医美', '医美被骗怎么追回钱', '医美被骗维权', '医美被骗了怎么追回', '医美被骗了如何退费',
      '医美被骗后如何维权退款', '医美被骗5W', '医美被骗怎么处理', '医美被骗套路', '医美被骗是找律师还是自己谈',
      '医美拼房套路', '医美拼房套路怎么追回', '医美拼房杀猪盘', '医美拼房套路属于诈骗吗',
      '医美拼房退费', '医美被骗',
      '美容院', '美容院被骗', '美容院强制消费', '美容院诈骗', '美容院套路', '美容院退款',
      '院线', '院线经理', '美容机构', '医美机构', '整形机构', '医美中心',
      '强制消费', '诱导消费', '被骗消费', '美容被骗', '整形被骗', '注射', '针剂',
      '要回钱', '拿回钱', '退款成功', '追回', '退费', '退回来'
    ],
    weight: 1.0,
    category: '医美诈骗'
  },
  {
    keywords: [
      '白发转黑', '育发', '白转黑被骗退费', '白发转黑发被骗', '育发被骗能追回吗',
      '白发转黑中心', '育发中心', '白发转黑机构'
    ],
    weight: 1.0,
    category: '白发转黑诈骗'
  },
  {
    keywords: [
      '增高', '长高', '增高被骗', '增高被骗钱怎么追回', '增高被骗了怎么办', '增高被骗维权', '增高被骗退款',
      '买增高产品被骗怎么追回钱', '微信增高产品被骗如何追回', '增高药被骗怎么追回', '增高被骗案例',
      '广州健康管理中心增高被骗', '增高产品被骗', '增高产品被骗如何追回', '增高产品被骗如何追回全款',
      '增高产品被骗怎么退钱', '增高产品被骗套路', '增高产品被骗怎么办', '增高产品被骗退费',
      '线上增高产品被骗', '网购增高产品被骗', '增高产品退款', '增高产品被骗如何退款',
      '增高产品不退款怎么处理', '增高产品无效退款', '增高产品收到拆开怎么退款', '增高产品退费怎么追回来',
      '增高产品被骗退费', '增高产品被骗怎么退钱', '增高套路诈骗', '增高套路退费怎么处理',
      '增高套路话术', '增高产品被骗套路', '增高套路', '小红书增高中药套路', '健康管理中心增高套路', '增高被套路',
      '增高中心', '增高机构', '增高产品', '增高被骗了'
    ],
    weight: 1.0,
    category: '增高诈骗'
  },
  {
    keywords: [
      '定制手镯', '毛坯定制玉手镯被骗案例', '定制手镯被骗怎么追回', '手镯定制被骗如何退款',
      '定制手镯如何维权', '定制非常手镯能退吗', '翡翠原石被骗', '翡翠原石被骗了怎么追回',
      '翡翠原石被骗怎么维权', '赌石被骗案例', '翡翠定制被骗',
      '手镯', '翡翠', '玉器', '珠宝', '赌石'
    ],
    weight: 1.0,
    category: '手镯定制诈骗'
  },
  {
    keywords: [
      '女性调理', '月经调理', '女性调理被骗', '月经调理产品被骗怎么追回', '调理月经被骗怎么退钱',
      '金美集调理月经被骗', '月经调理被骗', '女性调理被骗如何追回',
      '调理中心', '调理机构', '女性调理中心', '月经调理中心'
    ],
    weight: 1.0,
    category: '女性调理诈骗'
  },
  // 通用维权关键词
  {
    keywords: [
      '维权', '维权成功', '维权退款', '维权退费', '维权追回',
      '被骗', '受骗', '诈骗', '骗局', '被坑', '上当', '举报', '投诉',
      '追回来了', '退回来了', '退款成功', '退费成功', '要回来',
      '追回了', '退了', '退掉', '成功上岸', '追回钱款',
      '求助', '避雷', '避坑', '套路', '骗局揭秘', '骗子',
      '怎么追回', '如何维权', '怎么维权', '如何退款', '怎么退款',
      '如何退费', '怎么退费', '报警', '法律', '律师', '法院'
    ],
    weight: 0.8,
    category: '通用维权'
  }
];

class ContentAuditService {
  constructor(config = {}) {
    this.config = config;
    this.serverUrl = config.server?.baseUrl || 'http://localhost:5000';
  }

  /**
   * 关键词检查
   * @param {String} title - 笔记标题
   * @param {String} content - 笔记内容
   * @returns {Object} 检查结果 { passed, score, reason, category }
   */
  checkKeywords(title, content) {
    const titleLower = (title || '').toLowerCase();
    const contentLower = (content || '').toLowerCase();
    const fullText = titleLower + ' ' + contentLower;

    let bestMatch = {
      score: 0,
      matchedKeyword: null,
      category: null,
      source: null
    };

    // 检查每个关键词配置
    for (const config of KEYWORD_CONFIGS) {
      for (const keyword of config.keywords) {
        const keywordLower = keyword.toLowerCase();

        // 精确匹配
        if (fullText.includes(keywordLower)) {
          // 标题权重最高
          let score = config.weight;
          if (titleLower.includes(keywordLower)) {
            score *= 3; // 标题匹配权重3倍
          }

          if (score > bestMatch.score) {
            bestMatch = {
              score,
              matchedKeyword: keyword,
              category: config.category,
              source: titleLower.includes(keywordLower) ? 'title' : 'content'
            };
          }
        }
      }
    }

    // 通过阈值
    const passThreshold = 1.0;
    const passed = bestMatch.score >= passThreshold;

    return {
      passed,
      score: bestMatch.score,
      matchedKeyword: bestMatch.matchedKeyword,
      category: bestMatch.category,
      source: bestMatch.source,
      reason: passed
        ? `检测到关键词：${bestMatch.matchedKeyword}（${bestMatch.category}）`
        : `未检测到关键词`
    };
  }

  /**
   * 执行完整的内容审核流程
   * @param {String} title - 笔记标题
   * @param {String} content - 笔记内容
   * @returns {Promise<Object>} 审核结果
   */
  async performAudit(title, content) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [内容审核] 开始审核流程');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 标题: ${title?.substring(0, 50)}...`);
    console.log(`📄 正文长度: ${content?.length || 0} 字符`);

    // 1. 关键词检查
    console.log('');
    console.log('🔑 [步骤1] 关键词检查...');
    const keywordResult = this.checkKeywords(title, content);
    if (!keywordResult.passed) {
      console.log(`❌ [关键词检查] ${keywordResult.reason}`);
      // 关键词检查失败，返回失败结果（不继续执行AI审核）
      return {
        success: false,
        step: 'keyword_check',
        reason: keywordResult.reason,
        keywordResult: keywordResult,
        aiResult: null  // AI审核未执行
      };
    }
    console.log(`✅ [关键词检查] ${keywordResult.reason}`);

    // 2. AI文意审核
    console.log('');
    console.log('🤖 [步骤2] AI文意审核...');
    const aiResult = await this.analyzeWithAI(content);
    if (!aiResult.is_genuine_victim_post) {
      console.log(`❌ [AI审核] ${aiResult.reason || 'AI判断内容不符合'}`);
      // AI审核失败，返回失败结果
      return {
        success: false,
        step: 'ai_analysis',
        reason: aiResult.reason || 'AI判断内容不符合',
        keywordResult: keywordResult,
        aiResult: aiResult
      };
    }
    console.log(`✅ [AI审核] 通过 (${aiResult.reason || '确认为目标内容'})`);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [内容审核] 全部通过');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 全部通过
    return {
      success: true,
      step: 'content_audit_passed',
      reason: '内容审核通过',
      keywordResult: keywordResult,
      aiResult: aiResult
    };
  }

  /**
   * AI文意审核（直接调用DeepSeek API）
   * @param {String} content - 笔记内容
   * @returns {Promise<Object>} AI分析结果
   */
  async analyzeWithAI(content) {
    if (!content || content.length < 10) {
      return {
        is_genuine_victim_post: false,
        confidence_score: 0,
        reason: '内容为空或过短，无法进行AI分析'
      };
    }

    try {
      console.log('🤖 [AI审核] 正在分析内容...');

      const prompt = this.buildAnalysisPrompt(content);
      const result = await this.callDeepSeekAPI(prompt);

      if (result && result.is_genuine_victim_post !== undefined) {
        console.log(`✅ [AI审核] 分析完成: ${result.is_genuine_victim_post ? '符合要求' : '不符合要求'} (置信度: ${result.confidence_score})`);
        return result;
      } else {
        console.warn('⚠️  [AI审核] 解析失败，使用默认通过策略');
        return {
          is_genuine_victim_post: true,
          confidence_score: 0.5,
          reason: 'AI分析解析失败，自动通过',
          fallback: true
        };
      }

    } catch (error) {
      console.error('❌ [AI审核] 请求失败:', error.message || error);
      // AI失败时返回默认通过
      return {
        is_genuine_victim_post: true,
        confidence_score: 0.5,
        reason: 'AI分析服务不可用，自动通过',
        fallback: true
      };
    }
  }

  /**
   * 调用DeepSeek API
   */
  async callDeepSeekAPI(prompt) {
    // 检查配置
    if (!this.config.deepseek || !this.config.deepseek.apiKey) {
      throw new Error('DeepSeek API Key 未配置');
    }

    const requestData = {
      model: this.config.deepseek.model,
      messages: [
        { role: 'system', content: '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000
    };

    const postData = JSON.stringify(requestData);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.deepseek.com',
        port: 443,
        path: '/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.deepseek.apiKey}`
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          // 检查 HTTP 状态码
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            return;
          }

          try {
            const json = JSON.parse(responseData);

            if (json.error) {
              reject(new Error(json.error.message || 'DeepSeek API错误'));
              return;
            }

            const content = json.choices?.[0]?.message?.content || '';
            const result = this.parseAIResponse(content);
            resolve(result);
          } catch (e) {
            reject(new Error('解析响应失败: ' + e.message + ', 响应: ' + responseData.substring(0, 200)));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`网络请求失败: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('请求超时 (30秒)'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 构建分析提示词
   */
  buildAnalysisPrompt(content) {
    return `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷贴。

任务：分析以下抓取到的笔记内容，判断其是否属于维权相关内容。

重要要求：
- 只有真正与维权、避雷、被骗、投诉等话题相关的内容，才应该判断为符合
- 必须有明确的维权意图或被骗经历，不能仅凭个别关键词判断
- 重点关注内容的真实意图，而非简单的关键词匹配

判定维度：
1. 话题相关性：内容是否涉及维权、避雷、被骗、投诉、退款等相关话题？
2. 维权特征：是否包含"避雷"、"维权"、"举报"、"投诉"、"退款"、"上当"、"被骗"、"成功上岸"、"追回来了"等语义或相关讨论？
3. 内容形式：可以是提问、讨论、分享经历、寻求共鸣、询问建议、分享成功经验等多种形式
4. 真实性：文字是否看起来像真人的真实表达，而不是机器生成的垃圾广告？
5. 情感特征：是否包含疑问、担忧、愤怒、失望、无奈、后悔、高兴（维权成功）等真实情绪表达？
6. 关键词匹配：是否包含减肥、护肤、祛斑、丰胸、医美、增高、手镯定制、女性调理等相关的关键词或话题？

判断标准：
- ✅ 应该判断为符合的情况：
  - 分享被骗经历、寻求维权方法
  - 询问"如何维权"、"怎么退款"等问题
  - 分享"成功上岸"、"追回来了"等维权成功经验
  - 揭露骗局、提醒他人避雷的内容
  - 表达愤怒、后悔、求助等情绪的维权内容

- ❌ 应该判断为不符合的情况（重要！）：
  - 教程类内容（如：如何办营业执照、如何注册公司、流程指南）
  - 知识科普类（如：法律知识、政策解读、办事指南）
  - 产品介绍类（如：产品功能、产品优势、产品使用方法）
  - 正常的商业推广、产品广告
  - 中性的经验分享（不涉及维权或被骗）
  - 仅仅包含"流程"、"步骤"、"方法"、"指南"等教学词汇
  - "保姆级流程"、"手把手教你"、"零基础入门"等教程类标题
  - "营业执照"、"注册公司"、"办理流程"等办事指南内容

特别说明：
- "教程"、"流程"、"指南"、"方法"等词汇通常表示教学内容，不是维权内容
- "营业执照"、"注册"、"办理"、"备案"等词汇通常表示正常办事流程
- 必须同时满足：①有维权相关关键词 ②有被骗/投诉/维权的明确意图
- 如果内容只是普通教程或知识分享，即使包含部分关键词，也应该判断为不符合

笔记内容：
${content}

输出格式 (JSON，只返回JSON，不要其他文字):
{
  "is_genuine_victim_post": boolean,
  "confidence_score": 0.0-1.0,
  "reason": "详细分析理由，说明是否属于维权相关内容"
}`;
  }

  /**
   * 解析AI响应
   */
  parseAIResponse(responseText) {
    try {
      let cleanText = responseText.trim();

      // 移除可能的markdown代码块标记
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanText);

      if (typeof result.is_genuine_victim_post !== 'boolean') {
        throw new Error('缺少必需字段: is_genuine_victim_post');
      }
      if (typeof result.confidence_score !== 'number') {
        // 如果没有confidence_score，设置默认值
        result.confidence_score = result.is_genuine_victim_post ? 0.8 : 0.2;
      }

      return result;
    } catch (e) {
      console.error('解析AI响应失败:', e.message);
      throw e;
    }
  }
}

module.exports = ContentAuditService;
