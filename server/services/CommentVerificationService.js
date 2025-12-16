const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用stealth插件避免被检测
puppeteer.use(StealthPlugin());

class CommentVerificationService {
  constructor() {
    this.browser = null;
    this.launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };
    this.maxConcurrentTasks = 3; // 最大并发任务数
    this.activeTasks = 0;
  }

  /**
   * 验证评论是否存在于目标笔记中
   * @param {string} noteUrl - 小红书笔记链接
   * @param {string} commentContent - 用户提交的评论内容
   * @param {string} commentAuthor - 评论者昵称
   * @param {string} cookieString - 小红书登录Cookie字符串（可选）
   * @returns {Promise<Object>} 验证结果
   */
  async verifyCommentExists(noteUrl, commentContent, commentAuthor, cookieString = null) {
    // 检查并发限制
    if (this.activeTasks >= this.maxConcurrentTasks) {
      return {
        exists: false,
        confidence: 0,
        reason: '评论验证服务繁忙，请稍后重试',
        error: 'concurrent_limit_exceeded'
      };
    }

    this.activeTasks++;
    let browser;
    try {
      console.log('🔍 开始验证评论存在性:', {
        url: noteUrl,
        author: commentAuthor,
        content: commentContent.substring(0, 50) + '...',
        hasCookie: !!cookieString
      });

      browser = await puppeteer.launch(this.launchOptions);
      const page = await browser.newPage();

      // 🔥 关键步骤：注入Cookie（如果提供）
      if (cookieString) {
        const cookies = this.parseCookieString(cookieString);
        await page.setCookie(...cookies);
        console.log('✅ Cookie注入完成，已设置登录状态');
      }

      // 设置浏览器标识，模拟真实用户
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // 设置视窗大小
      await page.setViewport({ width: 1920, height: 1080 });

      // 访问笔记页面
      console.log('📄 正在访问笔记页面...');
      await page.goto(noteUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 等待页面加载完成
      await this.waitForPageLoad(page);

      // 🖱️ 自动滚动触发评论加载（小红书评论是懒加载的）
      console.log('⬇️ 开始滚动页面以加载评论...');
      await this.autoScroll(page);

      // 查找评论
      console.log('🔍 正在查找评论...');
      const commentResult = await this.findCommentInPage(page, commentContent, commentAuthor);

      await browser.close();

      return {
        exists: commentResult.found,
        confidence: commentResult.confidence,
        reason: commentResult.reason,
        foundComments: commentResult.foundComments || [],
        pageComments: commentResult.pageComments || [], // 添加页面评论列表
        pageCommentCount: commentResult.pageCommentCount || 0, // 添加页面评论总数
        scannedComments: commentResult.scannedComments || 0, // 添加扫描的评论数
        error: null
      };

    } catch (error) {
      console.error('❌ 评论验证失败:', error);
      if (browser) await browser.close();

      return {
        exists: false,
        confidence: 0,
        reason: '验证过程出错: ' + error.message,
        error: error.message
      };
    } finally {
      this.activeTasks--;
    }
  }

  /**
   * 解析Cookie字符串为Puppeteer格式
   * @param {string} cookieString - Cookie字符串
   * @returns {Array} Cookie对象数组
   */
  parseCookieString(cookieString) {
    return cookieString.split('; ').map(pair => {
      const [name, value] = pair.split('=');
      return {
        name: name.trim(),
        value: value.trim(),
        domain: '.xiaohongshu.com'
      };
    });
  }

  /**
   * 自动滚动页面以触发懒加载
   * @param {Page} page - Puppeteer页面对象
   */
  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        var totalHeight = 0;
        var distance = 200; // 每次滚动的距离
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          // 稍微滚两下就行了，不用滚到底
          // 这里设置滚到 2000px 或者滚不动了就停
          if (totalHeight >= 2000 || totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200); // 滚动间隔
      });
    });

    // 滚动完成后额外等待，确保评论加载完成
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(page) {
    try {
      // 等待主要元素加载
      await page.waitForSelector('body', { timeout: 10000 });

      // 等待网络空闲
      await page.waitForNetworkIdle({ timeout: 5000 });

      // 额外等待时间确保动态内容加载
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log('⚠️ 页面加载等待超时，继续执行:', error.message);
    }
  }

  /**
   * 加载页面评论（通过滚动触发懒加载）
   */
  async loadComments(page) {
    let previousHeight = 0;
    let scrollCount = 0;
    const maxScrolls = 10;

    while (scrollCount < maxScrolls) {
      try {
        // 滚动到页面底部
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });

        // 等待新内容加载
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 检查是否还有新内容
        const currentHeight = await page.evaluate(() => {
          return document.body.scrollHeight;
        });

        if (currentHeight === previousHeight) {
          // 没有新内容加载，停止滚动
          break;
        }

        previousHeight = currentHeight;
        scrollCount++;
        
        console.log(`📜 滚动 ${scrollCount}/${maxScrolls}, 页面高度: ${currentHeight}`);
      } catch (error) {
        console.log('⚠️ 滚动过程中出错:', error.message);
        break;
      }
    }

    // 最后再等待一下确保所有内容加载完成
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * 在页面中查找评论（简化版：直接字符串匹配）
   */
  async findCommentInPage(page, commentContent, commentAuthor) {
    try {
      // 获取页面完整文本内容
      const pageText = await page.evaluate(() => {
        return document.body.innerText || document.body.textContent || '';
      });

      console.log(`📄 获取页面文本内容，长度: ${pageText.length}`);

      // 清理和准备搜索内容
      const searchContent = commentContent.trim();
      const searchAuthor = commentAuthor ? commentAuthor.trim() : '';

      console.log(`🔍 搜索条件: 内容="${searchContent}", 作者="${searchAuthor}"`);

      // 1. 首先检查评论内容是否存在
      const contentIndex = pageText.indexOf(searchContent);
      if (contentIndex === -1) {
        console.log('❌ 评论内容在页面中不存在');
        return {
          found: false,
          confidence: 0.1,
          reason: '评论内容在页面中不存在',
          foundComments: []
        };
      }

      console.log(`✅ 找到评论内容在位置: ${contentIndex}`);

      // 2. 如果提供了作者，检查内容前是否有该作者
      if (searchAuthor) {
        // 获取评论内容前的一段文本（约200字符），查找作者
        const contextStart = Math.max(0, contentIndex - 200);
        const contextText = pageText.substring(contextStart, contentIndex);
        console.log(`📝 评论内容前上下文: "${contextText.substring(Math.max(0, contextText.length - 100))}..."`);

        // 检查作者是否存在于上下文中的合理位置
        const authorIndex = contextText.lastIndexOf(searchAuthor);
        if (authorIndex !== -1) {
          // 检查作者和内容之间是否有合理的分隔符（时间、标点等）
          const textBetween = contextText.substring(authorIndex + searchAuthor.length, contextText.length);
          const hasReasonableSeparator = /\d+[分钟小时天前]|昨天|今天|[,，。！？；：、]/.test(textBetween);

          if (hasReasonableSeparator || textBetween.length < 50) { // 作者离内容不远
            console.log(`✅ 找到匹配的作者 "${searchAuthor}" 在评论内容前`);

            return {
              found: true,
              confidence: 0.95,
              reason: `找到评论内容和匹配的作者`,
              foundComments: [{
                text: searchContent,
                author: searchAuthor,
                contentMatch: 100,
                authorMatch: 100,
                exactMatch: true
              }]
            };
          } else {
            console.log(`⚠️ 找到作者但分隔不合理: "${textBetween}"`);
          }
        } else {
          console.log(`❌ 未找到作者 "${searchAuthor}" 在评论内容前`);
        }

        // 如果严格匹配失败，但内容存在，给较低置信度
        return {
          found: false,
          confidence: 0.4,
          reason: '评论内容存在但作者匹配不准确',
          foundComments: [{
            text: searchContent,
            author: null,
            contentMatch: 100,
            authorMatch: 0,
            exactMatch: true
          }]
        };
      } else {
        // 没有提供作者，只要内容存在就通过
        console.log('✅ 评论内容存在（未提供作者验证）');

        return {
          found: true,
          confidence: 0.9,
          reason: '找到评论内容',
          foundComments: [{
            text: searchContent,
            author: null,
            contentMatch: 100,
            authorMatch: 0,
            exactMatch: true
          }]
        };
      }

    } catch (error) {
      console.error('查找评论时出错:', error);
      return {
        found: false,
        confidence: 0,
        reason: '查找评论过程出错: ' + error.message,
        error: error.message
      };
    }
  }

  /**
   * 计算两个字符串的相似度
   */
  calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 检查两个字符串是否有共同的词汇
   */
  hasCommonWords(str1, str2) {
    if (!str1 || !str2) return false;

    // 分词（简单按空格和中文标点分割）
    const words1 = str1.split(/[\s\u3000\uff0c\uff1f\uff01\uff0e\u3001\u3002]+/).filter(w => w.length > 1);
    const words2 = str2.split(/[\s\u3000\uff0c\uff1f\uff01\uff0e\u3001\u3002]+/).filter(w => w.length > 1);

    // 检查是否有共同词汇
    const commonWords = words1.filter(word => words2.some(w2 => w2.includes(word) || word.includes(w2)));

    return commonWords.length >= 2; // 至少有2个共同词汇
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      activeTasks: this.activeTasks,
      maxConcurrentTasks: this.maxConcurrentTasks,
      isAvailable: this.activeTasks < this.maxConcurrentTasks
    };
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = CommentVerificationService;