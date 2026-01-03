const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用stealth插件避免被检测
puppeteer.use(StealthPlugin());

class CommentVerificationService {
  constructor() {
    this.browser = null;
    this.launchOptions = {
      headless: true,
      executablePath: '/usr/bin/google-chrome-stable', // 指定Chrome路径
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
    * 在页面中查找评论（要求内容完全一致，使用精确CSS选择器）
    */
   async findCommentInPage(page, commentContent, commentAuthors) {
     try {
       // 使用CSS选择器获取评论内容（更精确的方法）
       const commentData = await page.evaluate(() => {
         const comments = [];

         // 尝试多种CSS选择器获取评论内容
         const selectors = [
           '.note-text', // 用户建议的选择器
           '[class*="comment"] [class*="text"]',
           '[class*="comment"] [class*="content"]',
           '[data-testid*="comment"] [class*="text"]',
           '.comment-item .content',
           '.comment-text',
           '.comment-content'
         ];

         // 遍历所有可能的选择器
         for (const selector of selectors) {
           const elements = document.querySelectorAll(selector);
           elements.forEach(element => {
             const text = element.textContent?.trim();
             if (text && text.length > 0) {
               comments.push({
                 text: text,
                 element: element.outerHTML.substring(0, 100) + '...' // 记录元素信息用于调试
               });
             }
           });
         }

         // 如果没找到，使用更通用的方法
         if (comments.length === 0) {
           // 查找所有包含文本的元素
           const allTextElements = document.querySelectorAll('div, span, p');
           allTextElements.forEach(element => {
             const text = element.textContent?.trim();
             if (text && text.length > 10 && text.length < 500) { // 合理的评论长度
               comments.push({
                 text: text,
                 element: element.tagName + (element.className ? '.' + element.className.split(' ').join('.') : '')
               });
             }
           });
         }

         return comments;
       });

       console.log(`📄 使用CSS选择器获取到 ${commentData.length} 个可能的评论文本`);

       // 清理和准备搜索内容（保持原始格式，包括标点符号）
       const searchContent = commentContent.trim();

       // 处理作者参数：支持字符串或数组
       let authorList = [];
       if (Array.isArray(commentAuthors)) {
         authorList = commentAuthors.filter(author => author && typeof author === 'string' && author.trim()).map(author => author.trim());
       } else if (commentAuthors && typeof commentAuthors === 'string') {
         authorList = [commentAuthors.trim()];
       }

       console.log(`🔍 搜索条件（要求完全一致）: 内容="${searchContent}", 作者列表=${JSON.stringify(authorList)}`);

       // 在获取的评论文本中精确匹配
       let foundExactMatch = false;
       let matchedComment = null;

       for (const comment of commentData) {
         // 完全匹配检查
         if (comment.text === searchContent) {
           console.log(`✅ 找到完全匹配的评论内容: "${searchContent}"`);
           console.log(`📝 评论元素信息: ${comment.element}`);
           foundExactMatch = true;
           matchedComment = comment;
           break;
         }

         // 如果完全匹配失败，尝试去除多余空格后的匹配
         const normalizedComment = comment.text.replace(/\s+/g, ' ').trim();
         const normalizedSearch = searchContent.replace(/\s+/g, ' ').trim();
         if (normalizedComment === normalizedSearch) {
           console.log(`✅ 找到规范化匹配的评论内容: "${normalizedComment}"`);
           console.log(`📝 评论元素信息: ${comment.element}`);
           foundExactMatch = true;
           matchedComment = comment;
           break;
         }
       }

       if (!foundExactMatch) {
         console.log(`❌ 评论内容完全匹配失败: "${searchContent}" 在页面评论中不存在`);
         console.log(`📋 页面中的评论文本预览:`, commentData.slice(0, 5).map(c => `"${c.text.substring(0, 50)}..."`));
         return {
           found: false,
           confidence: 0.1,
           reason: '评论内容在页面评论中不存在，无法确认完全一致',
           foundComments: [],
           pageComments: commentData
         };
       }

       // 如果提供了作者列表，验证作者匹配
       if (authorList.length > 0) {
         // 尝试在评论附近查找作者信息
         const authorData = await page.evaluate(() => {
           const authors = [];

           // 查找可能的作者选择器
           const authorSelectors = [
             '.author-name',
             '.nickname',
             '.user-name',
             '[class*="author"]',
             '[class*="user"]',
             '[data-testid*="author"]'
           ];

           for (const selector of authorSelectors) {
             const elements = document.querySelectorAll(selector);
             elements.forEach(element => {
               const text = element.textContent?.trim();
               if (text && text.length > 0 && text.length < 50) {
                 authors.push(text);
               }
             });
           }

           return authors;
         });

         console.log(`👤 页面中的作者信息:`, authorData);

         // 检查是否有匹配的作者
         let matchedAuthor = null;
         for (const author of authorList) {
           if (authorData.includes(author)) {
             matchedAuthor = author;
             console.log(`✅ 找到匹配的作者 "${author}"`);
             break;
           }
         }

         if (matchedAuthor) {
           return {
             found: true,
             confidence: 0.95,
             reason: `找到评论内容和匹配的作者，完全一致验证通过`,
             foundComments: [{
               text: searchContent,
               author: matchedAuthor,
               contentMatch: 100,
               authorMatch: 100,
               exactMatch: true
             }],
             pageComments: commentData
           };
         } else {
           console.log(`❌当前评论区无法匹配你的昵称`);
           console.log(`👤 期望的作者列表: ${JSON.stringify(authorList)}`);
           console.log(`👤 页面中的作者列表: ${JSON.stringify(authorData)}`);

           // 由于要求内容完全一致，如果作者不匹配，必须拒绝
           return {
             found: false,
             confidence: 0.1,
             reason: '当前评论区无法匹配你的昵称',
             foundComments: [{
               text: searchContent,
               author: null,
               contentMatch: 100,
               authorMatch: 0,
               exactMatch: true
             }],
             pageComments: commentData
           };
         }
       } else {
         // 没有提供作者，只要内容完全匹配就通过
         console.log('✅ 评论内容完全匹配（未提供作者验证）');

         return {
           found: true,
           confidence: 0.9,
           reason: '找到评论内容，完全一致验证通过',
           foundComments: [{
             text: searchContent,
             author: null,
             contentMatch: 100,
             authorMatch: 0,
             exactMatch: true
           }],
           pageComments: commentData
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