/**
 * AI审核服务 - 内容提取模块
 * 负责从小红书页面提取标题和内容
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { withRetry } = require('../../utils/apiRetry');

/**
 * 提取小红书页面内容
 * @param {string} noteUrl - 笔记链接
 * @param {string} [cookieString] - 可选的Cookie字符串
 * @returns {Promise<Object>} 页面标题和内容 { title, content }
 */
async function extractPageContent(noteUrl, cookieString = '') {
  try {
    console.log('📄 开始提取页面内容...', noteUrl);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    if (cookieString) {
      headers['Cookie'] = cookieString;
    }

    // 使用重试机制包装页面内容提取
    const response = await withRetry(async () => {
      return await axios.get(noteUrl, {
        headers,
        timeout: 15000,
        maxRedirects: 5
      });
    }, {
      maxRetries: 2,
      delay: 1000,
      backoffMultiplier: 1.5,
      shouldRetry: (error) => {
        // 只对网络错误重试，不对4xx重试
        return !error.response || error.response.status >= 500;
      }
    }).catch(err => {
      // 如果重试后仍失败，尝试不使用Cookie
      console.log('⚠️ 使用Cookie请求失败，尝试不使用Cookie...');
      const headersWithoutCookie = { ...headers };
      delete headersWithoutCookie['Cookie'];
      return withRetry(async () => {
        return await axios.get(noteUrl, {
          headers: headersWithoutCookie,
          timeout: 15000,
          maxRedirects: 5
        });
      }, {
        maxRetries: 1,
        delay: 1000
      });
    });

    const $ = cheerio.load(response.data);

    // 提取标题
    let title = '';
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
      title = ogTitle;
    } else {
      title = $('title').text() || '';
    }

    // 提取正文内容（使用多个选择器尝试）
    let content = '';
    let source = '';

    const selectors = [
      '.note-text',           // 原始选择器
      '.desc',                // 备用选择器1
      '.content',             // 备用选择器2
      '[class*="note"]',      // 包含note的class
      '[class*="content"]',   // 包含content的class
      'article',              // article标签
      '.rich-text'            // 富文本选择器
    ];

    for (const selector of selectors) {
      const text = $(selector).first().text();
      if (text && text.length > 20) {
        content = text;
        source = selector;
        break;
      }
    }

    // 如果正文内容不足，尝试提取标签（hashtags）作为补充
    if (!content || content.length < 10) {
      const tags = [];
      $('a[href*="/topic/"], a[href*="/tag/"], .tags a, .tag-list a').each((i, elem) => {
        const tagText = $(elem).text().trim();
        if (tagText && tagText.length > 0) {
          const formattedTag = tagText.startsWith('#') ? tagText : `#${tagText}`;
          tags.push(formattedTag);
        }
      });

      if (tags.length > 0) {
        content = tags.join(' ');
        source = 'hashtags';
        console.log(`🏷️ [标签提取] 找到 ${tags.length} 个标签: ${tags.join(', ')}`);
      }
    }

    // 如果仍然没有内容，使用meta描述
    if (!content) {
      const metaDesc = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') || '';
      if (metaDesc && metaDesc.length > 5) {
        content = metaDesc;
        source = 'meta';
      }
    }

    // 限制内容长度
    if (content && content.length > 2000) {
      content = content.substring(0, 2000);
    }

    console.log(`📄 提取完成 - 标题: ${title?.substring(0, 50)}...}, 内容来源: ${source || '(无)'}, 内容长度: ${content?.length || 0}`);

    return { title: title || '', content: content || '' };
  } catch (error) {
    console.error('❌ 提取页面内容出错:', error.message);
    return { title: '', content: '' };
  }
}

/**
 * 进行关键词检查
 * @param {string} title - 页面标题
 * @param {string} content - 页面内容
 * @param {Object} xiaohongshuService - 小红书服务实例
 * @returns {Promise<Object>} 检查结果
 */
async function performKeywordCheck(title, content, xiaohongshuService) {
  try {
    console.log('🔑 开始关键词检查...');

    // 检查内容是否为空
    if (!content || content.trim() === '') {
      console.log('⚠️ 页面内容为空，无法进行关键词检查（标题为空是允许的）');
      return { passed: false, reason: '页面内容为空', score: 0 };
    }

    // 构建模拟HTML用于关键词检查
    const html = `<title>${title || '(无标题)'}</title><meta name="description" content="${content.substring(0, 200)}"><body>${content}</body>`;
    const $ = cheerio.load(html);

    // 调用关键词检查
    const result = await xiaohongshuService.checkContentKeywords($, title);

    console.log(`🔑 关键词检查结果: ${result.passed ? '✅ 找到维权关键词' : '❌ 未找到维权关键词'}, 分数: ${result.score}`);

    return result;
  } catch (error) {
    console.error('❌ 关键词检查出错:', error);
    return { passed: false, reason: '关键词检查异常: ' + error.message, score: 0 };
  }
}

/**
 * 进行AI文意审核
 * @param {string} content - 页面内容
 * @param {Object} aiContentAnalysisService - AI内容分析服务实例
 * @returns {Promise<Object>} 审核结果
 */
async function performAiContentAnalysis(content, aiContentAnalysisService) {
  try {
    console.log('🤖 开始AI文意审核...');

    // 设置15秒超时
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ skip: true, reason: 'AI审核超时，跳过' }), 15000);
    });

    // 竞速：AI审核 vs 超时
    const result = await Promise.race([
      aiContentAnalysisService.analyzeVictimPost(content, '维权内容'),
      timeoutPromise
    ]);

    if (result.skip) {
      console.log('⏱️ AI审核跳过:', result.reason);
    } else {
      console.log(`🤖 AI审核结果: ${result.is_genuine_victim_post ? '✅ 通过' : '❌ 不通过'}, 置信度: ${result.confidence_score}`);
    }

    return result;
  } catch (error) {
    console.log('⚠️ AI审核失败，跳过:', error.message);
    return { skip: true, reason: 'AI审核异常: ' + error.message };
  }
}

module.exports = {
  extractPageContent,
  performKeywordCheck,
  performAiContentAnalysis
};
