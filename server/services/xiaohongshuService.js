// 小红书服务：验证笔记链接和AI审核
const axios = require('axios');
const cheerio = require('cheerio');
const CommentVerificationService = require('./CommentVerificationService');
const cookiePoolService = require('./CookiePoolService');
const rateLimiter = require('./RateLimiter');
const { KEYWORD_CONFIGS } = require('../config/keywords');
// 注意：不能在顶部导入asyncAiReviewService，否则会形成循环依赖
// 在需要时使用延迟导入

class XiaohongshuService {
  constructor() {
    this.baseUrl = 'https://www.xiaohongshu.com';
    // 设置请求头模拟浏览器（2025年最新Chrome配置）
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Connection': 'keep-alive'
    };

    // 初始化评论验证服务
    this.commentVerifier = new CommentVerificationService();
  }

  /**
   * 获取Cookie（从Cookie池轮询）
   */
  async getCookie() {
    try {
      // 优先使用Cookie池，如果没有则使用环境变量
      const cookieFromPool = await cookiePoolService.getNextCookie();
      if (cookieFromPool && cookieFromPool.cookie) {
        return cookieFromPool.cookie;
      }
      return process.env.XIAOHONGSHU_COOKIE || '';
    } catch (error) {
      console.error('获取Cookie失败:', error);
      return process.env.XIAOHONGSHU_COOKIE || '';
    }
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
      const noteStatus = await this.getNoteStatus(noteId, noteUrl);
      if (!noteStatus.exists) {
        // 如果是Cookie失效导致的问题，返回特殊标记让持续检查可以重试
        if (noteStatus.status === 'login_required') {
          return {
            valid: false,
            reason: noteStatus.reason || 'Cookie可能已失效',
            noteStatus: noteStatus,
            cookieExpired: true, // 标记为Cookie失效，可重试
            retryable: true
          };
        }
        return {
          valid: false,
          reason: noteStatus.reason || '笔记不存在或已被删除',
          noteStatus: noteStatus
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

      // 🔥 数据一致性验证：检查是否存在 exists=true 但 foundComments 为空的不一致数据
      if (commentVerification.exists === true && (!commentVerification.foundComments || commentVerification.foundComments.length === 0)) {
        console.error('❌ [数据验证] verifyCommentExists 返回了不一致的数据: exists=true 但 foundComments 为空');
        console.error('   noteUrl:', noteUrl);
        console.error('   commentContent:', commentContent);
        console.error('   authorNicknames:', authorNicknames);

        // 强制修正：如果 foundComments 为空，exists 应该为 false
        commentVerification.exists = false;
        console.warn('⚠️ [数据修正] 自动将 commentVerification.exists 设为 false');
      }

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
          pageComments: commentVerification.pageComments || [],
          deviceNicknames: authorNicknames // 添加设备昵称，用于评论限制记录
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
   * 优化：先不带Cookie访问（公开笔记不需要），失败后再带Cookie重试
   */
  async checkNotePage(url) {
    try {
      // 检查请求限流
      const rateLimiter = require('./RateLimiter');
      const limitResult = await rateLimiter.checkLimit();
      if (!limitResult.allowed) {
        console.log('⚠️ [请求限流] 全局限流触发:', limitResult.reason);
        return {
          accessible: false,
          reason: limitResult.reason || '请求过于频繁，请稍后重试'
        };
      }

      // 第一次尝试：不带Cookie访问（公开笔记和短链接不需要Cookie）
      let response = await this._tryAccessPage(url, false);

      // 如果不带Cookie访问失败，且是因为需要登录，则带Cookie重试
      if (!response.accessible && response.requiresLogin) {
        console.log('🔄 [笔记访问] 不带Cookie访问需要登录，尝试带Cookie访问');
        response = await this._tryAccessPage(url, true);
      }

      return response;

    } catch (error) {
      console.error('页面访问失败:', error.message);
      return {
        accessible: false,
        reason: error.message
      };
    }
  }

  /**
   * 尝试访问页面（可选择是否带Cookie）
   */
  async _tryAccessPage(url, withCookie) {
    try {
      const requestHeaders = { ...this.headers };

      if (withCookie) {
        const cookie = await this.getCookie();
        if (cookie) {
          requestHeaders.Cookie = cookie;
        }
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
      const pageData = response.data.toLowerCase();

      // 检测是否是登录页面
      const loginPatterns = ['登录后推荐', '扫码登录', '请先登录', '登录后即可查看'];
      const hasLoginPattern = loginPatterns.some(p => pageData.includes(p.toLowerCase()));

      if (hasLoginPattern && !withCookie) {
        // 不带Cookie时检测到登录页面，标记需要重试
        return {
          accessible: false,
          requiresLogin: true
        };
      }

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
      // 网络错误，可能是需要Cookie
      if (error.response && error.response.status === 403 && !withCookie) {
        return {
          accessible: false,
          requiresLogin: true
        };
      }
      return {
        accessible: false,
        reason: error.message
      };
    }
  }

  /**
   * 手动跟随重定向，确保Cookie不被丢失
   * axios自动跟随跨域重定向时会丢失某些headers
   */
  async _followRedirectsWithCookie(url, cookie) {
    const maxRedirects = 5;
    let currentUrl = url;
    let redirectCount = 0;

    const requestHeaders = {
      ...this.headers,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    if (cookie) {
      requestHeaders.Cookie = cookie;
    }

    while (redirectCount < maxRedirects) {
      const response = await axios.get(currentUrl, {
        headers: requestHeaders,
        maxRedirects: 0, // 手动处理重定向
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: 10000
      });

      // 检查是否重定向
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers['location'] || response.headers['Location'];
        if (!location) {
          break;
        }
        // 处理相对路径
        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
        redirectCount++;
        console.log(`🔄 [重定向] ${redirectCount}/${maxRedirects}: ${currentUrl.substring(0, 80)}...`);
      } else {
        // 返回最终响应
        return response;
      }
    }

    throw new Error('超过最大重定向次数');
  }

  /**
   * 解析笔记页面内容，提取昵称和标题
   */
  async parseNoteContent(url) {
    try {
      console.log('📄 开始解析笔记内容:', url);

      // 从Cookie池获取Cookie
      const cookie = await this.getCookie();
      console.log('🔍 [诊断] Cookie状态检查:', {
        hasCookie: !!cookie,
        cookieLength: cookie?.length || 0,
        cookiePreview: cookie ? cookie.substring(0, 50) + '...' : '未设置'
      });

      // 检查请求限流
      const rateLimiter = require('./RateLimiter');
      const limitResult = await rateLimiter.checkLimit();
      if (!limitResult.allowed) {
        console.log('⚠️ [请求限流] 全局限流触发:', limitResult.reason);
        return {
          success: false,
          reason: limitResult.reason || '请求过于频繁，请稍后重试'
        };
      }

      // 使用手动重定向方法，确保Cookie不被丢失
      const response = await this._followRedirectsWithCookie(url, cookie);

      // 【诊断日志】检查响应状态和内容
      console.log('🔍 [诊断] HTTP响应:', {
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers['content-type'],
        contentLength: response.data?.length || 0
      });

      if (response.status !== 200) {
        console.log('❌ [诊断] HTTP状态码非200:', response.status);
        return {
          success: false,
          reason: `HTTP ${response.status}`
        };
      }

      // 【诊断日志】检查页面内容特征（严谨版）
      const html = response.data;

      // 【第一步】检查404页面状态（Cookie无关）
      const has404 = html.includes('404') || html.includes('笔记不存在') || html.includes('内容已删除');

      // 【第二步】新Cookie失效检测：检查完整登录界面
      // 检测页面是否同时包含所有登录相关文本
      const loginTexts = [
        '登录后推荐更懂你的笔记',
        '可用小红书或微信扫码',
        '手机号登录',
        '我已阅读并同意',
        '新用户可直接登录'
      ];

      // 检查是否所有登录文本都存在
      const hasAllLoginTexts = loginTexts.every(text => html.includes(text));
      const hasLoginRequired = hasAllLoginTexts && !has404;

      console.log('🔍 [诊断] 页面内容分析:', {
        hasAllLoginTexts,
        hasLoginRequired,
        has404,
        htmlLength: html.length,
        loginTextsFound: loginTexts.filter(t => html.includes(t)).length + '/' + loginTexts.length
      });

      if (has404) {
        console.log('🚫 [诊断] 检测到404页面 - 笔记不存在或已删除（与Cookie无关）');
      }
      if (hasLoginRequired) {
        console.log('🚫 [诊断] 检测到完整登录界面 - Cookie已失效');
        // 【Cookie过期处理】标记Cookie为失效
        console.log('⚠️ [Cookie管理] Cookie已失效，标记为expired');
        try {
          await cookiePoolService.markCookieExpired(cookie);
        } catch (error) {
          console.error('标记Cookie失效失败:', error);
        }
      }

      const $ = cheerio.load(html);
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
      console.log('🔍 [诊断] 标题解析:', {
        hasTitle: !!pageTitle,
        titleLength: pageTitle?.length || 0,
        titlePreview: pageTitle?.substring(0, 100) || '无标题'
      });

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
      console.log('🔍 [诊断] JSON-LD脚本数量:', jsonLdScripts.length);
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonLd = JSON.parse(jsonLdScripts.eq(i).html());
          console.log('🔍 [诊断] JSON-LD解析:', {
            index: i,
            hasData: !!jsonLd,
            type: jsonLd?.['@type'],
            hasHeadline: !!jsonLd?.headline,
            hasName: !!jsonLd?.name,
            hasAuthor: !!jsonLd?.author
          });
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
            console.log('✅ [诊断] JSON-LD提取成功:', {
              title: parsedData.title,
              author: parsedData.author
            });
          }
        } catch (e) {
          console.log('⚠️ [诊断] JSON-LD解析失败:', e.message);
          // 忽略解析错误，继续下一个
        }
      }

      // 3. 从meta标签提取
      const metaTitle = $('meta[property="og:title"]').attr('content') ||
                       $('meta[name="title"]').attr('content');
      const metaAuthor = $('meta[name="author"]').attr('content') ||
                       $('meta[property="article:author"]').attr('content') ||
                       $('meta[property="og:author"]').attr('content');

      console.log('🔍 [诊断] Meta标签提取:', {
        hasMetaTitle: !!metaTitle,
        metaTitlePreview: metaTitle?.substring(0, 50) || '无',
        hasMetaAuthor: !!metaAuthor,
        metaAuthorPreview: metaAuthor?.substring(0, 30) || '无'
      });

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
      const keywordCheck = await this.checkContentKeywords($, pageTitle);
      parsedData.keywordCheck = keywordCheck;

      console.log('📄 解析结果:', {
        title: parsedData.title,
        author: parsedData.author,
        hasTitle: !!parsedData.title,
        hasAuthor: !!parsedData.author,
        pageTitle: pageTitle,
        keywordCheck: keywordCheck
      });

      // 【诊断】总结解析失败原因
      if (!parsedData.title && !parsedData.author) {
        console.log('❌ [诊断] 解析完全失败 - 无法提取标题和作者');
        console.log('🔍 [诊断] 可能原因:');
        console.log('  1. 页面结构已改变，所有选择器失效');
        console.log('  2. Cookie已过期，返回的是登录页面');
        console.log('  3. 被反爬虫机制拦截');
        console.log('  4. 页面使用JavaScript动态渲染，需要等待加载');
      } else if (!parsedData.title) {
        console.log('⚠️ [诊断] 标题解析失败');
      } else if (!parsedData.author) {
        console.log('⚠️ [诊断] 作者解析失败');
      }

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
   * 获取笔记状态信息（检查页面内容判断笔记是否真实存在）
   * @param {String} noteId - 笔记ID
   * @param {String} noteUrl - 笔记完整URL（用于页面内容检查）
   */
  async getNoteStatus(noteId, noteUrl = null) {
    try {
      // 如果没有提供URL，尝试构建
      if (!noteUrl) {
        noteUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
      }

      const requestHeaders = { ...this.headers };
      const cookie = await this.getCookie();
      if (cookie) {
        requestHeaders.Cookie = cookie;
      }

      const response = await axios.get(noteUrl, {
        headers: requestHeaders,
        timeout: 10000,
        maxRedirects: 5
      });

      // HTTP状态非200，笔记可能不存在
      if (response.status !== 200) {
        return {
          exists: false,
          noteId,
          status: 'deleted',
          httpStatus: response.status,
          reason: `HTTP状态码: ${response.status}`
        };
      }

      // 检查页面内容判断笔记是否真实存在
      const pageData = response.data;
      const $ = cheerio.load(pageData);
      const title = $('title').text();

      // 先检查是否是登录页面（Cookie失效）
      const loginPatterns = ['登录后推荐', '扫码登录', '请先登录', '登录后即可查看'];
      const pageText = pageData.toLowerCase() + title.toLowerCase();
      const hasLoginPattern = loginPatterns.some(pattern =>
        pageText.includes(pattern.toLowerCase())
      );

      if (hasLoginPattern) {
        // 检测到登录页面，Cookie可能失效
        // 返回错误状态，让调用者重试，而不是判定笔记不存在
        console.log(`⚠️ [笔记状态] 检测到登录页面，Cookie可能失效: ${noteId}`);
        return {
          exists: false,
          noteId,
          status: 'login_required',
          reason: '需要登录，Cookie可能已失效',
          retryable: true // 标记为可重试
        };
      }

      // 检测笔记明确不存在的情况（不包括登录相关）
      const notExistPatterns = [
        '笔记不存在',
        '内容已删除',
        '内容违规',
        '该内容已被作者删除',
        '该内容暂不可见',
        '该内容暂时无法查看',
        '404',
        '页面不存在',
        '抱歉，你访问的内容不见了',
        '当前笔记暂时无法浏览'
      ];

      const hasNotExistPattern = notExistPatterns.some(pattern =>
        pageText.includes(pattern.toLowerCase())
      );

      if (hasNotExistPattern) {
        return {
          exists: false,
          noteId,
          status: 'deleted',
          reason: '页面显示笔记不存在或已被删除'
        };
      }

      // 检查页面是否有实际的笔记内容
      const hasNoteContent = pageData.includes('note-text') ||
                             pageData.includes('content') ||
                             pageData.includes('desc') ||
                             (title.includes('小红书') && !title.includes('登录'));

      if (!hasNoteContent && pageData.length < 5000) {
        // 页面内容过短且没有笔记内容，可能是错误页面
        return {
          exists: false,
          noteId,
          status: 'invalid',
          reason: '页面内容异常，可能笔记不存在'
        };
      }

      // 笔记存在
      return {
        exists: true,
        noteId,
        status: 'public',
        title: title,
        pageLength: pageData.length
      };

    } catch (error) {
      console.error('获取笔记状态失败:', error);
      // 网络错误不直接判定为笔记不存在
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return {
          exists: true, // 超时不确定，假设存在
          noteId,
          status: 'unknown',
          error: 'timeout',
          reason: '请求超时，无法确定笔记状态'
        };
      }
      return {
        exists: false,
        noteId,
        status: 'error',
        error: error.message,
        reason: `检查失败: ${error.message}`
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
  async checkContentKeywords($, pageTitle) {
    // 使用统一的关键词配置（从 config/keywords.js 导入）
    const keywordConfigs = KEYWORD_CONFIGS;

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

          // 模糊匹配：关键词的连续词组匹配（改进版）
          // 将关键词按词分割（假设词之间有空格或特定分隔符）
          const keywordWords = keywordLower.split(/\s+/);
          let wordMatchCount = 0;

          for (const kwWord of keywordWords) {
            // 检查关键词中的词是否在文本中出现
            if (sourceText.includes(kwWord)) {
              wordMatchCount++;
            }
          }

          if (wordMatchCount >= Math.max(1, keywordWords.length * 0.7)) { // 至少匹配70%的词
            const fuzzyScore = config.weight * sourceData.weight * (wordMatchCount / keywordWords.length) * 0.8; // 模糊匹配分数
            if (fuzzyScore > bestMatch.score) {
              bestMatch = {
                score: fuzzyScore,
                matchedKeyword: keyword,
                source: sourceName,
                category: config.category,
                matches: [{ keyword, type: 'fuzzy', source: sourceName, score: fuzzyScore, matchRatio: wordMatchCount / keywordWords.length }]
              };
            }
          }
        }
      }
    }

    // 根据匹配分数决定是否通过
    const passThreshold = 1.0; // 通过阈值（降低阈值以增加覆盖率）

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