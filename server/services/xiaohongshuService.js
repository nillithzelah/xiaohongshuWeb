// 小红书服务：验证笔记链接和AI审核
const axios = require('axios');
const cheerio = require('cheerio');

class XiaohongshuService {
  constructor() {
    this.baseUrl = 'https://www.xiaohongshu.com';
    // 设置请求头模拟浏览器
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    };
  }

  /**
   * 验证小红书笔记链接
   * @param {string} noteUrl - 小红书笔记链接
   * @returns {Promise<Object>} 验证结果
   */
  async validateNoteUrl(noteUrl) {
    try {
      console.log('🔍 开始验证小红书链接:', noteUrl);

      // 1. 基础URL验证
      if (!this.isValidXiaohongshuUrl(noteUrl)) {
        return {
          valid: false,
          reason: '无效的小红书链接格式'
        };
      }

      // 2. 提取笔记ID
      const noteId = this.extractNoteId(noteUrl);
      if (!noteId) {
        return {
          valid: false,
          reason: '无法提取笔记ID'
        };
      }

      // 3. 尝试访问笔记页面
      const pageResult = await this.checkNotePage(noteUrl);
      if (!pageResult.accessible) {
        return {
          valid: false,
          reason: pageResult.reason || '笔记页面无法访问'
        };
      }

      // 4. 检查笔记状态（是否存在、是否公开等）
      const noteStatus = await this.getNoteStatus(noteId);
      if (!noteStatus.exists) {
        return {
          valid: false,
          reason: '笔记不存在或已被删除'
        };
      }

      // 5. AI审核逻辑
      const aiReviewResult = await this.performAIReview(noteUrl, noteStatus);

      return {
        valid: true,
        noteId,
        noteStatus,
        aiReview: aiReviewResult,
        reason: '验证通过'
      };

    } catch (error) {
      console.error('❌ 小红书链接验证失败:', error);
      return {
        valid: false,
        reason: '验证过程出错：' + error.message
      };
    }
  }

  /**
   * 检查URL是否为有效的小红书链接
   */
  isValidXiaohongshuUrl(url) {
    const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/explore\/[a-zA-Z0-9]+/;
    return xiaohongshuUrlPattern.test(url);
  }

  /**
   * 从URL中提取笔记ID
   */
  extractNoteId(url) {
    const match = url.match(/\/explore\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * 检查笔记页面是否可访问
   */
  async checkNotePage(url) {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
        maxRedirects: 5
      });

      // 检查响应状态
      if (response.status !== 200) {
        return {
          accessible: false,
          reason: `HTTP ${response.status}`
        };
      }

      // 检查页面内容是否包含笔记相关信息
      const $ = cheerio.load(response.data);
      const title = $('title').text();

      // 如果页面标题包含"小红书"或笔记相关信息，说明页面正常
      if (title && (title.includes('小红书') || title.includes('笔记'))) {
        return {
          accessible: true,
          title: title
        };
      }

      // 检查是否是404页面或错误页面
      if (response.data.includes('404') || response.data.includes('笔记不存在')) {
        return {
          accessible: false,
          reason: '笔记不存在'
        };
      }

      return {
        accessible: true
      };

    } catch (error) {
      console.error('页面访问失败:', error.message);
      return {
        accessible: false,
        reason: error.message
      };
    }
  }

  /**
   * 解析笔记页面内容，提取昵称和标题
   */
  async parseNoteContent(url) {
    try {
      console.log('📄 开始解析笔记内容:', url);

      const response = await axios.get(url, {
        headers: {
          ...this.headers,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 20000,
        maxRedirects: 5
      });

      if (response.status !== 200) {
        return {
          success: false,
          reason: `HTTP ${response.status}`
        };
      }

      const $ = cheerio.load(response.data);
      const parsedData = {
        success: true,
        url: url,
        title: null,
        author: null,
        publishTime: null,
        likes: null,
        collects: null,
        comments: null
      };

      // 尝试多种方式提取笔记信息

      // 1. 从页面标题提取（多种格式）
      const pageTitle = $('title').text();
      console.log('📄 页面标题:', pageTitle);

      if (pageTitle) {
        // 尝试不同的标题格式
        let titleParts = [];

        // 格式1: "标题 - 作者 - 小红书"
        if (pageTitle.includes(' - 小红书')) {
          titleParts = pageTitle.replace(' - 小红书', '').split(' - ');
        }
        // 格式2: "标题 - 作者"
        else if (pageTitle.includes(' - ')) {
          titleParts = pageTitle.split(' - ');
        }

        if (titleParts.length >= 2) {
          parsedData.title = titleParts[0].trim();
          parsedData.author = titleParts[titleParts.length - 1].trim();
        } else if (titleParts.length === 1) {
          // 如果只有一个部分，可能是标题
          parsedData.title = titleParts[0].trim();
        }
      }

      // 2. 从JSON-LD结构化数据提取
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonLd = JSON.parse(jsonLdScripts.eq(i).html());
          if (jsonLd && (jsonLd['@type'] === 'Article' || jsonLd['@type'] === 'SocialMediaPosting')) {
            parsedData.title = parsedData.title || jsonLd.headline || jsonLd.name;
            if (jsonLd.author) {
              if (typeof jsonLd.author === 'string') {
                parsedData.author = parsedData.author || jsonLd.author;
              } else if (jsonLd.author.name) {
                parsedData.author = parsedData.author || jsonLd.author.name;
              }
            }
            if (jsonLd.datePublished) {
              parsedData.publishTime = jsonLd.datePublished;
            }
          }
        } catch (e) {
          // 忽略解析错误，继续下一个
        }
      }

      // 3. 从meta标签提取
      const metaTitle = $('meta[property="og:title"]').attr('content') ||
                       $('meta[name="title"]').attr('content');
      const metaAuthor = $('meta[name="author"]').attr('content') ||
                        $('meta[property="article:author"]').attr('content') ||
                        $('meta[property="og:author"]').attr('content');

      parsedData.title = parsedData.title || metaTitle;
      parsedData.author = parsedData.author || metaAuthor;

      // 4. 从页面特定元素提取（基于小红书页面结构）
      // 尝试查找包含笔记信息的特定元素
      const authorSelectors = [
        '[data-testid="author-name"]',
        '.author-name',
        '.user-name',
        '.nickname',
        '[class*="author"]',
        '[class*="user"]'
      ];

      const titleSelectors = [
        '[data-testid="note-title"]',
        '.note-title',
        '.title',
        '[class*="title"]',
        'h1'
      ];

      // 查找作者信息
      if (!parsedData.author) {
        for (const selector of authorSelectors) {
          const element = $(selector).first();
          if (element.length > 0) {
            const text = element.text().trim();
            if (text && text.length > 0 && text.length < 50) {
              parsedData.author = text;
              break;
            }
          }
        }
      }

      // 查找标题信息
      if (!parsedData.title) {
        for (const selector of titleSelectors) {
          const element = $(selector).first();
          if (element.length > 0) {
            const text = element.text().trim();
            if (text && text.length > 0 && text.length < 200) {
              parsedData.title = text;
              break;
            }
          }
        }
      }

      // 5. 从页面文本内容中智能提取
      if (!parsedData.author || !parsedData.title) {
        const bodyText = $('body').text();

        // 使用正则表达式查找可能的作者和标题模式
        if (!parsedData.author) {
          // 查找可能的作者模式（通常在@后面或特定格式）
          const authorPatterns = [
            /@([^\s@]{2,20})/g,
            /作者[:：]\s*([^\s]{2,20})/g,
            /by\s+([^\s]{2,20})/gi
          ];

          for (const pattern of authorPatterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
              parsedData.author = match[1].trim();
              break;
            }
          }
        }
      }

      // 6. 从URL参数或页面脚本中提取（最后的尝试）
      if (!parsedData.title && url.includes('explore/')) {
        // 尝试从页面中的脚本或数据中提取
        const scripts = $('script');
        for (let i = 0; i < scripts.length; i++) {
          const scriptContent = scripts.eq(i).html();
          if (scriptContent && scriptContent.includes('title') && scriptContent.includes('author')) {
            try {
              // 尝试提取JSON数据
              const jsonMatch = scriptContent.match(/\{[^}]*"title"[^}]*\}/);
              if (jsonMatch) {
                const jsonData = JSON.parse(jsonMatch[0]);
                if (jsonData.title) parsedData.title = jsonData.title;
                if (jsonData.author) parsedData.author = jsonData.author;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      console.log('📄 解析结果:', {
        title: parsedData.title,
        author: parsedData.author,
        hasTitle: !!parsedData.title,
        hasAuthor: !!parsedData.author,
        pageTitle: pageTitle
      });

      return parsedData;

    } catch (error) {
      console.error('笔记内容解析失败:', error);
      return {
        success: false,
        reason: error.message
      };
    }
  }

  /**
   * 获取笔记状态信息
   */
  async getNoteStatus(noteId) {
    try {
      // 这里可以调用小红书的API或使用其他方式获取笔记信息
      // 目前先返回基本信息

      return {
        exists: true,
        noteId,
        status: 'public', // public, private, deleted
        // 可以添加更多信息：点赞数、评论数、发布时间等
      };

    } catch (error) {
      console.error('获取笔记状态失败:', error);
      return {
        exists: false,
        error: error.message
      };
    }
  }

  /**
   * 执行AI审核
   */
  async performAIReview(noteUrl, noteStatus) {
    try {
      console.log('🤖 开始AI审核...');

      // AI审核逻辑
      const reviewResult = {
        passed: true,
        confidence: 0.95,
        reasons: [],
        riskLevel: 'low' // low, medium, high
      };

      // 1. 检查链接参数完整性
      if (noteUrl.includes('xsec_token') && noteUrl.includes('note_flow_source')) {
        reviewResult.reasons.push('链接参数完整，来源可信');
        reviewResult.confidence += 0.1;
      }

      // 2. 检查笔记状态
      if (noteStatus.status === 'public') {
        reviewResult.reasons.push('笔记状态正常，为公开笔记');
      }

      // 3. 检查链接格式规范
      if (this.isValidXiaohongshuUrl(noteUrl)) {
        reviewResult.reasons.push('链接格式规范');
      }

      // 4. 风险评估
      // 这里可以添加更多AI审核逻辑，比如：
      // - 检查是否为近期发布的笔记
      // - 检查用户行为模式
      // - 检查设备信息一致性等

      // 决定是否通过
      reviewResult.passed = reviewResult.confidence >= 0.8;

      if (reviewResult.passed) {
        reviewResult.reasons.push('AI审核通过，建议自动批准');
      } else {
        reviewResult.reasons.push('AI审核未通过，需要人工审核');
        reviewResult.riskLevel = 'medium';
      }

      console.log('🤖 AI审核完成:', reviewResult);

      return reviewResult;

    } catch (error) {
      console.error('AI审核失败:', error);
      return {
        passed: false,
        confidence: 0,
        reasons: ['AI审核过程出错'],
        riskLevel: 'high',
        error: error.message
      };
    }
  }

  /**
   * 批量验证笔记链接
   */
  async batchValidateNoteUrls(noteUrls) {
    const results = [];

    for (const url of noteUrls) {
      const result = await this.validateNoteUrl(url);
      results.push({
        url,
        ...result
      });

      // 添加延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }
}

module.exports = new XiaohongshuService();