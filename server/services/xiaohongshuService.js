// 小红书服务：验证笔记链接和AI审核
const axios = require('axios');
const cheerio = require('cheerio');
const CommentVerificationService = require('./CommentVerificationService');

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
    
    // 初始化评论验证服务
    this.commentVerifier = new CommentVerificationService();
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

      // 5. 基础审核通过
      return {
        valid: true,
        noteId,
        noteStatus,
        reason: '链接验证通过'
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
   * 执行评论AI审核（增强版）
   * @param {string} noteUrl - 小红书笔记链接
   * @param {string} commentContent - 用户提交的评论内容
   * @param {string[]} authorNicknames - 评论者昵称数组（支持多个账号比对）
   * @param {string} cookieString - 小红书登录Cookie字符串（可选）
   * @returns {Promise<Object>} 审核结果
   */
  async performCommentAIReview(noteUrl, commentContent, authorNicknames, cookieString = null) {
    try {
      console.log('🤖 开始评论AI审核...');

      const reviewResult = {
        passed: true,
        confidence: 0.8,
        reasons: [],
        riskLevel: 'low'
      };

      // 1. 链接验证
      const linkValidation = await this.validateNoteUrl(noteUrl);
      if (!linkValidation.valid) {
        return {
          passed: false,
          confidence: 0.1,
          reasons: ['链接不对'],
          riskLevel: 'high'
        };
      }


      // 3. **新增**: 真实评论验证（通过浏览器自动化）- 要求内容完全一致才可以通过
      console.log('🔍 开始验证评论是否真实存在（要求内容完全一致）...');
      const commentVerification = await this.commentVerifier.verifyCommentExists(
        noteUrl,
        commentContent,
        authorNicknames,
        cookieString // 传递Cookie字符串用于登录状态
      );

      if (commentVerification.error) {
        // 验证服务出错，由于要求内容完全一致，服务不可用时必须拒绝审核
        reviewResult.passed = false;
        reviewResult.confidence = 0.1;
        reviewResult.reasons.push('当前帖子评论区无法检测到你的评论（请用其他号观察）');
        reviewResult.riskLevel = 'high';
      } else if (commentVerification.exists) {
        // 评论验证通过，确认真实存在且内容完全一致
        reviewResult.confidence += 0.2;
        reviewResult.reasons.push('评论验证通过，确认真实存在且内容完全一致');
      } else {
        // 评论验证失败，由于要求内容完全一致，必须拒绝审核
        reviewResult.passed = false;
        reviewResult.confidence = 0.1;
        // 根据验证失败的具体原因，设置标准化的审核失败原因
        if (commentVerification.reason && commentVerification.reason.includes('当前帖子评论区无法检测到你的评论（请用其他号观察）')) {
          reviewResult.reasons.push('当前帖子评论区无法检测到你的评论（请用其他号观察）');
        } else if (commentVerification.reason && commentVerification.reason.includes('当前评论区无法匹配你的昵称')) {
          reviewResult.reasons.push('当前评论区无法匹配你的昵称');
        } else {
          reviewResult.reasons.push('当前帖子评论区无法检测到你的评论（请用其他号观察）');
        }
        reviewResult.riskLevel = 'high';
      }

      // 4. 其他质量检查
      const qualityChecks = this.performQualityChecks(commentContent, authorNicknames);
      reviewResult.confidence += qualityChecks.confidenceDelta;
      reviewResult.reasons.push(...qualityChecks.reasons);

      // 决定最终结果
      reviewResult.passed = reviewResult.passed && reviewResult.confidence >= 0.7;

      if (!reviewResult.passed) {
        reviewResult.reasons.push('综合审核未通过');
        if (reviewResult.riskLevel === 'low') {
          reviewResult.riskLevel = 'medium';
        }
      }

      console.log('🤖 评论AI审核完成:', reviewResult);
      return {
        ...reviewResult,
        commentVerification: {
          exists: commentVerification.exists,
          confidence: commentVerification.confidence,
          reason: commentVerification.reason,
          pageCommentCount: commentVerification.pageCommentCount || 0,
          scannedComments: commentVerification.scannedComments || 0,
          foundComments: commentVerification.foundComments || [],
          pageComments: commentVerification.pageComments || []
        }
      };

    } catch (error) {
      console.error('评论AI审核失败:', error);
      return {
        passed: false,
        confidence: 0,
        reasons: ['评论审核过程出错'],
        riskLevel: 'high',
        error: error.message
      };
    }
  }

  /**
   * 质量检查
   * @param {string} commentContent - 评论内容
   * @param {string[]} authorNicknames - 评论者昵称数组
   * @returns {Object} 检查结果
   */
  performQualityChecks(commentContent, authorNicknames) {
    let confidenceDelta = 0;
    const reasons = [];

    // 长度检查
    if (commentContent.length > 20) {
      confidenceDelta += 0.05;
      reasons.push('评论长度适中');
    }

    // 昵称数组合理性检查
    if (authorNicknames && Array.isArray(authorNicknames) && authorNicknames.length > 0) {
      const validNicknames = authorNicknames.filter(name =>
        name && typeof name === 'string' && name.length >= 2 && name.length <= 20
      );

      if (validNicknames.length > 0) {
        const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9_\-]+$/;
        const hasValidFormat = validNicknames.some(name => validPattern.test(name));

        if (hasValidFormat) {
          confidenceDelta += 0.02;
          reasons.push(`绑定了${validNicknames.length}个有效昵称`);
        } else {
          confidenceDelta -= 0.05;
          reasons.push('昵称格式异常');
        }
      } else {
        confidenceDelta -= 0.1;
        reasons.push('未绑定有效昵称');
      }
    } else {
      confidenceDelta -= 0.1;
      reasons.push('未提供昵称信息');
    }

    // 检查重复字符
    const repeatPattern = /(.)\1{4,}/;
    if (repeatPattern.test(commentContent)) {
      confidenceDelta -= 0.1;
      reasons.push('包含重复字符');
    }

    return {
      confidenceDelta,
      reasons
    };
  }

  /**
   * 检查URL是否为有效的小红书链接
   */
  isValidXiaohongshuUrl(url) {
    // 支持多种小红书链接格式：
    // 1. https://xiaohongshu.com/explore/xxxxx
    // 2. https://www.xiaohongshu.com/explore/xxxxx
    // 3. https://xhslink.com/explore/xxxxx
    // 4. https://xhslink.com/o/xxxxx (新的短链接格式)
    // 5. https://xhslink.com/a/xxxxx (文章链接格式)
    // 6. https://xhslink.com/m/xxxxx (移动端短链接格式)
    // 7. https://www.xiaohongshu.com/discovery/item/xxxxx (发现页链接格式)
    // 支持查询参数（如 ?xsec_token=...&xsec_source=...）
    const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/(explore|o|a|m|discovery\/item)\/[a-zA-Z0-9]+(\?.*)?$/;
    return xiaohongshuUrlPattern.test(url);
  }

  /**
   * 从URL中提取笔记ID
   */
  extractNoteId(url) {
    // 支持多种路径格式：/explore/xxxxx, /o/xxxxx, /a/xxxxx, /m/xxxxx, /discovery/item/xxxxx
    const match = url.match(/\/(explore|o|a|m|discovery\/item)\/([a-zA-Z0-9]+)/);
    return match ? match[2] : null;
  }

  /**
   * 检查笔记页面是否可访问
   */
  async checkNotePage(url) {
    try {
      // 构建请求头，如果有cookie则添加
      const requestHeaders = { ...this.headers };
      if (process.env.XIAOHONGSHU_COOKIE) {
        requestHeaders.Cookie = process.env.XIAOHONGSHU_COOKIE;
      }

      const response = await axios.get(url, {
        headers: requestHeaders,
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

      // 构建请求头，如果有cookie则添加
      const requestHeaders = {
        ...this.headers,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };

      if (process.env.XIAOHONGSHU_COOKIE) {
        requestHeaders.Cookie = process.env.XIAOHONGSHU_COOKIE;
      }

      const response = await axios.get(url, {
        headers: requestHeaders,
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
  let author = titleParts[titleParts.length - 1].trim();
  // 删除最后的"关注"两个字
  if (author.endsWith('关注')) {
    author = author.slice(0, -2).trim();
  }
  parsedData.author = author;
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

      // 【新增】关键词检查 - 在返回结果前进行
      const keywordCheck = this.checkContentKeywords($, pageTitle);
      parsedData.keywordCheck = keywordCheck;

      console.log('📄 解析结果:', {
        title: parsedData.title,
        author: parsedData.author,
        hasTitle: !!parsedData.title,
        hasAuthor: !!parsedData.author,
        pageTitle: pageTitle,
        keywordCheck: keywordCheck
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
   * 获取评论验证服务状态
   */
  getCommentVerifierStatus() {
    return this.commentVerifier.getStatus();
  }

  /**
   * 清理资源
   */
  async cleanup() {
    if (this.commentVerifier) {
      await this.commentVerifier.close();
    }
  }

  /**
   * 增强版关键词检查算法
   * @param {Object} $ - cheerio实例
   * @param {string} pageTitle - 页面标题
   * @returns {Object} 关键词检查结果
   */
  checkContentKeywords($, pageTitle) {
    // 定义关键词配置，包含权重和变体
    const keywordConfigs = [
      {
        keywords: ['减肥被骗', '减肥被骗经历', '减肥受骗', '减肥诈骗'],
        weight: 1.0,
        category: '减肥诈骗'
      },
      {
        keywords: ['护肤被骗', '护肤受骗', '护肤诈骗', '护肤被骗经历'],
        weight: 1.0,
        category: '护肤诈骗'
      },
      {
        keywords: ['祛斑被骗', '祛斑受骗', '祛斑诈骗', '祛斑被骗经历'],
        weight: 1.0,
        category: '祛斑诈骗'
      },
      {
        keywords: ['丰胸被骗', '丰胸受骗', '丰胸诈骗', '丰胸被骗经历'],
        weight: 1.0,
        category: '丰胸诈骗'
      },
      {
        keywords: ['医美被骗', '医美受骗', '医美诈骗', '医美被骗经历'],
        weight: 1.0,
        category: '医美诈骗'
      },
      {
        keywords: ['白发转黑被骗', '白发转黑受骗', '白发转黑诈骗', '白发变黑被骗'],
        weight: 1.0,
        category: '白发转黑诈骗'
      },
      {
        keywords: ['手镯定制被骗', '手镯定制受骗', '手镯定制诈骗', '定制手镯被骗'],
        weight: 1.0,
        category: '手镯定制诈骗'
      }
    ];

    const sources = {
      title: { text: pageTitle || '', weight: 3.0 }, // 标题权重最高
      content: { text: $('body').text().substring(0, 2000), weight: 1.0 }, // 内容权重正常
      meta: {
        text: ($('meta[name="description"]').attr('content') ||
               $('meta[property="og:description"]').attr('content') || ''),
        weight: 2.0
      } // meta描述权重较高
    };

    let bestMatch = {
      score: 0,
      matchedKeyword: null,
      source: null,
      category: null,
      matches: []
    };

    // 检查每个来源
    for (const [sourceName, sourceData] of Object.entries(sources)) {
      if (!sourceData.text) continue;

      const sourceText = sourceData.text.toLowerCase();

      // 检查每个关键词配置
      for (const config of keywordConfigs) {
        for (const keyword of config.keywords) {
          const keywordLower = keyword.toLowerCase();

          // 精确匹配
          if (sourceText.includes(keywordLower)) {
            const score = config.weight * sourceData.weight * 1.0; // 精确匹配基础分数
            if (score > bestMatch.score) {
              bestMatch = {
                score,
                matchedKeyword: keyword,
                source: sourceName,
                category: config.category,
                matches: [{ keyword, type: 'exact', source: sourceName, score }]
              };
            }
            continue;
          }

          // 模糊匹配：关键词的部分匹配
          const words = keywordLower.split('');
          let matchCount = 0;
          for (const word of words) {
            if (sourceText.includes(word)) {
              matchCount++;
            }
          }

          if (matchCount >= Math.max(2, words.length * 0.6)) { // 至少匹配60%的词
            const fuzzyScore = config.weight * sourceData.weight * (matchCount / words.length) * 0.7; // 模糊匹配分数较低
            if (fuzzyScore > bestMatch.score) {
              bestMatch = {
                score: fuzzyScore,
                matchedKeyword: keyword,
                source: sourceName,
                category: config.category,
                matches: [{ keyword, type: 'fuzzy', source: sourceName, score: fuzzyScore, matchRatio: matchCount / words.length }]
              };
            }
          }
        }
      }
    }

    // 根据匹配分数决定是否通过
    const passThreshold = 1.5; // 通过阈值

    if (bestMatch.score >= passThreshold) {
      return {
        passed: true,
        matchedKeyword: bestMatch.matchedKeyword,
        category: bestMatch.category,
        source: bestMatch.source,
        score: bestMatch.score,
        confidence: Math.min(bestMatch.score / 3.0, 1.0), // 置信度基于分数
        message: `在${this.getSourceDisplayName(bestMatch.source)}中找到匹配关键词"${bestMatch.matchedKeyword}" (分数: ${bestMatch.score.toFixed(2)})`,
        matches: bestMatch.matches
      };
    }

    return {
      passed: false,
      score: bestMatch.score,
      reason: `未找到足够匹配的关键词 (最高分数: ${bestMatch.score.toFixed(2)}, 需要: ${passThreshold})`,
      checkedSources: Object.keys(sources),
      bestMatch: bestMatch.score > 0 ? bestMatch : null
    };
  }

  /**
   * 获取来源显示名称
   */
  getSourceDisplayName(source) {
    const names = {
      title: '页面标题',
      content: '页面内容',
      meta: '页面描述'
    };
    return names[source] || source;
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