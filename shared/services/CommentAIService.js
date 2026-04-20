/**
 * 评论AI分析服务 - 检测评论是否为引流/广告内容
 *
 * 功能：
 * 1. 分析评论内容判断是否为引流/广告
 * 2. 分类引流类型：引流、同行、帮助者、广告、正常
 * 3. 调用DeepSeek API进行语义分析
 */

const https = require('https');

/**
 * 引流关键词配置（客户端预过滤）
 */
const SPAM_KEYWORDS = [
  // 联系方式类
  '加我', '+v', '微我', '私信', '联系我', '咨询', '私聊',
  // 商业推广类
  '代购', '招代理', '招代理', '诚招代理', '招加盟', '招代理加盟',
  '回收', '高价回收', '回收二手', '收闲置',
  '出闲置', '转闲置', '闲鱼', '转卖', '二手交易',
  // 互粉类
  '互关', '互粉', '互赞', '互撩', '关注我', '关注+',
  // 微信/QQ类
  'wx:', 'wechat:', 'WeChat:', '威心', '威幸',
  'QQ:', 'q:', 'qq:', '扣扣',
  // 其他
  '群聊', '拉群', '进群', '有群', '群里见'
];

class CommentAIService {
  constructor(config = {}) {
    this.config = config;
    this.deepseekConfig = config.deepseek || {};
  }

  /**
   * 关键词预检查（快速判断）
   * @param {String} content - 评论内容
   * @returns {Object} { isSpam, matchedKeywords }
   */
  checkKeywords(content) {
    if (!content) return { isSpam: false, matchedKeywords: [] };

    const contentLower = content.toLowerCase();
    const matched = [];

    for (const keyword of SPAM_KEYWORDS) {
      if (contentLower.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      }
    }

    return {
      isSpam: matched.length > 0,
      matchedKeywords: matched
    };
  }

  /**
   * 分析评论是否为引流/广告
   * @param {String} commentContent - 评论内容
   * @param {String} noteTitle - 笔记标题（上下文参考）
   * @returns {Promise<Object>} AI分析结果
   */
  async analyzeComment(commentContent, noteTitle = '') {
    if (!commentContent || commentContent.length < 2) {
      return {
        is_spam: false,
        confidence_score: 0,
        category: '正常',
        reason: '内容为空或过短'
      };
    }

    // 先进行关键词预检查
    const keywordCheck = this.checkKeywords(commentContent);
    if (keywordCheck.isSpam) {
      console.log(`🔑 [关键词] 检测到引流关键词: ${keywordCheck.matchedKeywords.join(', ')}`);
    }

    // 调用AI进行深度分析
    try {
      console.log('🤖 [AI分析] 正在分析评论内容...');
      const prompt = this.buildCommentAnalysisPrompt(commentContent, noteTitle);
      const result = await this.callDeepSeekAPI(prompt);

      if (result && result.is_spam !== undefined) {
        // 如果关键词检测到了，提高AI判定的权重
        if (keywordCheck.isSpam && !result.is_spam) {
          console.log('⚠️  [AI分析] 关键词检测到引流，但AI判定为正常，采用关键词结果');
          return {
            is_spam: true,
            confidence_score: 0.7,
            category: '引流',
            reason: `包含引流关键词: ${keywordCheck.matchedKeywords.join(', ')}`
          };
        }

        console.log(`✅ [AI分析] ${result.is_spam ? '引流' : '正常'} (置信度: ${result.confidence_score}, 分类: ${result.category})`);
        return result;
      } else {
        console.warn('⚠️  [AI分析] 解析失败，使用关键词检测结果');
        // AI解析失败，回退到关键词检测
        return {
          is_spam: keywordCheck.isSpam,
          confidence_score: keywordCheck.isSpam ? 0.7 : 0.3,
          category: keywordCheck.isSpam ? '引流' : '正常',
          reason: keywordCheck.isSpam
            ? `包含引流关键词: ${keywordCheck.matchedKeywords.join(', ')}`
            : 'AI分析解析失败，暂无引流特征',
          fallback: true
        };
      }

    } catch (error) {
      console.error('❌ [AI分析] 请求失败:', error.message || error);
      // AI失败时回退到关键词检测
      if (keywordCheck.isSpam) {
        return {
          is_spam: true,
          confidence_score: 0.7,
          category: '引流',
          reason: `AI服务不可用，但包含引流关键词: ${keywordCheck.matchedKeywords.join(', ')}`,
          fallback: true
        };
      }
      // 既没有关键词，AI也失败了，暂时放行
      return {
        is_spam: false,
        confidence_score: 0.5,
        category: '正常',
        reason: 'AI分析服务不可用，暂无引流特征',
        fallback: true
      };
    }
  }

  /**
   * 构建评论分析提示词
   */
  buildCommentAnalysisPrompt(content, noteTitle = '') {
    return `你是一名专业的销售线索分析专家，帮助识别小红书评论区的潜在客户。

背景笔记标题：${noteTitle || '减肥被骗维权相关'}

评论内容：${content}

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
   ⚠️ 重要：所有主动联系、说"回你了"、"私信你了"的，都是引流！
   特征：
   - 声称"要回来了"、"成功了"、"已经退回"、"已经解决"
   - 主动提供帮助、分享经验、有方法
   - 要对方私信、联系
   - 说"回你了"、"已回"、"私信你了"、"已联系"、"滴滴你"
   - 简短回复如"来啦"、"滴滴"、"在的"等
   例如：
   - "我已经成功了，我可以分享经验"
   - "可以退回的"
   - "已经要回来了"
   - "可以问我"
   - "私信我"
   - "我有方法"
   - "来啦"
   - "滴滴"
   - "回你了姐妹"
   - "已回"
   - "私信你了"
   - "已联系"
   - "滴滴你"
   - "不难的"
   - "已经解决好了"
   - "在的"
   - "可以"

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
- ⚠️ 任何说"回你了"、"已回"、"私信你了"、"已联系"、"滴滴你"、"在的"、"可以"的都是引流，判为 spam
- ⚠️ "来啦"、"滴滴"等简短回复也是引流，判为 spam
- ⚠️ 主动表示已经回复、已经联系、可以提供的，都是引流，判为 spam
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
   * 调用DeepSeek API
   */
  callDeepSeekAPI(prompt) {
    return new Promise((resolve, reject) => {
      // 检查配置
      if (!this.deepseekConfig.apiKey) {
        reject(new Error('DeepSeek API Key 未配置'));
        return;
      }

      const requestData = {
        model: this.deepseekConfig.model || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      };

      const postData = JSON.stringify(requestData);

      const options = {
        hostname: 'api.deepseek.com',
        port: 443,
        path: '/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deepseekConfig.apiKey}`
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

      // 新格式适配：category 可能是 potential_lead | spam | author | noise
      // 转换为 is_spam 格式
      const category = result.category || '';
      const isSpam = category === 'spam' || category === 'author';

      // 构建统一返回格式
      return {
        is_spam: isSpam,
        isPotentialLead: result.isPotentialLead ?? !isSpam,
        category: category === 'spam' ? '引流' :
                  category === 'author' ? '作者' :
                  category === 'potential_lead' ? '潜在客户' :
                  category === 'noise' ? '无意义' : '正常',
        confidence_score: typeof result.confidence_score === 'number' ? result.confidence_score : (isSpam ? 0.8 : 0.5),
        reason: result.reason || (isSpam ? `检测到${category === 'author' ? '作者回复' : '引流'}特征` : '正常评论'),
        shouldContact: result.shouldContact ?? !isSpam,
        riskLevel: result.riskLevel || 'low'
      };
    } catch (e) {
      console.error('解析AI响应失败:', e.message);
      throw e;
    }
  }
}

module.exports = CommentAIService;
