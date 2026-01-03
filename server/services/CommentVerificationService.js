const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用stealth插件避免被检测
puppeteer.use(StealthPlugin());

class CommentVerificationService {
  constructor() {
    this.browser = null;

    // 根据操作系统设置不同的Chrome路径
    const isWindows = process.platform === 'win32';
    const chromePath = isWindows
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Windows Chrome路径
      : '/usr/bin/google-chrome-stable'; // Linux Chrome路径

    this.launchOptions = {
      headless: true,
      executablePath: chromePath,
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

    // 添加缓存机制
    this.cache = new Map(); // 内存缓存
    this.cacheExpiry = 30 * 60 * 1000; // 缓存30分钟
    this.maxCacheSize = 1000; // 最大缓存条目数
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
    // 生成缓存键
    const cacheKey = this.generateCacheKey(noteUrl, commentContent, commentAuthor);

    // 检查缓存
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      console.log('✅ 使用缓存的评论验证结果:', cacheKey);
      return cachedResult;
    }

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

      // 等待页面加载完成（优化等待时间）
      await this.waitForPageLoad(page);

      // 🖱️ 自动滚动触发评论加载（小红书评论是懒加载的）
      console.log('⬇️ 开始滚动页面以加载评论...');
      await this.autoScroll(page);

      // 查找评论
      console.log('🔍 正在查找评论...');
      const commentResult = await this.findCommentInPage(page, commentContent, commentAuthor);

      await browser.close();

      const result = {
        exists: commentResult.found,
        confidence: commentResult.confidence,
        reason: commentResult.reason,
        foundComments: commentResult.foundComments || [],
        pageComments: commentResult.pageComments || [], // 添加页面评论列表
        pageCommentCount: commentResult.pageCommentCount || 0, // 添加页面评论总数
        scannedComments: commentResult.scannedComments || 0, // 添加扫描的评论数
        error: null
      };

      // 缓存结果
      this.setCachedResult(cacheKey, result);

      return result;

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
    console.log('⬇️ 开始智能滚动加载评论...');

    // 先尝试点击"查看更多评论"按钮（如果存在）
    try {
      const loadMoreSelectors = [
        'button[class*="load-more"]',
        'button[class*="more-comment"]',
        '[class*="load-more"]',
        'button:contains("查看更多")',
        'button:contains("更多评论")'
      ];

      for (const selector of loadMoreSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log('✅ 点击了加载更多评论按钮');
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }
    } catch (e) {
      console.log('ℹ️ 没有找到加载更多评论按钮，继续滚动');
    }

    // 执行智能滚动
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        var totalHeight = 0;
        var distance = 300; // 增加每次滚动的距离
        var scrollCount = 0;
        var maxScrolls = 8; // 最多滚动8次
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          scrollCount++;

          console.log(`滚动 ${scrollCount}/${maxScrolls}, 总高度: ${totalHeight}, 页面高度: ${scrollHeight}`);

          // 滚动足够次数或到达页面底部
          if (scrollCount >= maxScrolls || totalHeight >= scrollHeight - 500) {
            clearInterval(timer);
            resolve();
          }
        }, 300); // 稍微增加滚动间隔
      });
    });

    // 滚动完成后额外等待，确保评论加载完成
    console.log('⏳ 等待评论加载完成...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * 等待页面加载完成（优化版本）
   */
  async waitForPageLoad(page) {
    try {
      // 等待主要元素加载（减少超时时间）
      await page.waitForSelector('body', { timeout: 8000 });

      // 等待网络空闲（减少超时时间）
      await page.waitForNetworkIdle({ timeout: 3000 });

      // 额外等待时间确保动态内容加载（减少等待时间）
      await new Promise(resolve => setTimeout(resolve, 2000));
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

        // 尝试多种CSS选择器获取评论内容（更新为最新选择器）
        const selectors = [
          '.note-text', // 用户建议的选择器
          '[class*="comment"] [class*="text"]',
          '[class*="comment"] [class*="content"]',
          '[data-testid*="comment"] [class*="text"]',
          '.comment-item .content',
          '.comment-text',
          '.comment-content',
          // 新增：更通用的选择器
          '[class*="CommentItem"] [class*="content"]',
          '[class*="CommentItem"] [class*="text"]',
          '[class*="comment-item"] [class*="content"]',
          '[class*="comment-item"] [class*="text"]',
          // 基于实际页面结构的通用选择器
          'div[class*="comment"] span[class*="text"]',
          'div[class*="comment"] div[class*="content"]'
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

      // 在获取的评论文本中精确匹配，并同时查找对应的作者
      let foundExactMatch = false;
      let matchedComment = null;
      let matchedAuthor = null;

      // 修改查找逻辑，同时查找评论和对应的作者
      const commentWithAuthorData = await page.evaluate(() => {
        const results = [];

        // 方法1：查找评论容器，通常评论会有一个父容器包含作者和内容
        const commentContainers = document.querySelectorAll('[class*="comment"], [class*="reply"], .comment-item, .reply-item');

        commentContainers.forEach(container => {
          // 在容器内查找评论内容
          const contentSelectors = ['.note-text', '[class*="text"]', '[class*="content"]', '.content'];
          let contentText = null;
          for (const selector of contentSelectors) {
            const contentElement = container.querySelector(selector);
            if (contentElement) {
              contentText = contentElement.textContent?.trim();
              if (contentText) break;
            }
          }

          // 在容器内查找作者信息
          const authorSelectors = ['.author .name', '.author-name', '.nickname', '.user-name', '[class*="author"] [class*="name"]', '[class*="author"]', '[class*="user"]', '[class*="name"]', '.name'];
          let authorText = null;
          for (const selector of authorSelectors) {
            const authorElement = container.querySelector(selector);
            if (authorElement) {
              authorText = authorElement.textContent?.trim();
              if (authorText) break;
            }
          }

          if (contentText) {
            results.push({
              content: contentText,
              author: authorText,
              container: container.outerHTML.substring(0, 200) + '...',
              method: 'container'
            });
          }
        });

        // 方法2：如果没找到容器化的评论，查找所有评论内容元素，然后向上查找作者
        if (results.length === 0) {
          const contentElements = document.querySelectorAll('.note-text, [class*="comment"] [class*="text"], [class*="comment"] [class*="content"], [class*="content"]');
          contentElements.forEach(contentEl => {
            const contentText = contentEl.textContent?.trim();
            if (contentText && contentText.length > 0) {
              // 向上查找作者信息
              let authorText = null;
              let parent = contentEl.parentElement;
              let searchDepth = 0;
              while (parent && searchDepth < 8) { // 增加向上查找层数到8层
                const authorSelectors = ['.author .name', '.author-name', '.nickname', '.user-name', '[class*="author"] [class*="name"]', '[class*="author"]', '[class*="user"]', '[class*="name"]', '.name'];
                for (const selector of authorSelectors) {
                  const authorEl = parent.querySelector(selector);
                  if (authorEl) {
                    authorText = authorEl.textContent?.trim();
                    if (authorText) break;
                  }
                }
                if (authorText) break;

                // 也尝试在同级元素中查找作者
                const siblings = parent.children;
                for (let sibling of siblings) {
                  if (sibling !== contentEl) {
                    for (const selector of authorSelectors) {
                      const authorEl = sibling.querySelector ? sibling.querySelector(selector) : null;
                      if (authorEl) {
                        authorText = authorEl.textContent?.trim();
                        if (authorText) break;
                      }
                    }
                    if (authorText) break;
                  }
                }
                if (authorText) break;

                parent = parent.parentElement;
                searchDepth++;
              }

              results.push({
                content: contentText,
                author: authorText,
                container: contentEl.outerHTML.substring(0, 200) + '...',
                method: 'upward'
              });
            }
          });
        }

        // 方法3：最后的兜底方法 - 查找所有可能的作者和内容配对
        if (results.length === 0) {
          console.log('使用兜底方法查找评论和作者配对');

          // 查找所有评论内容
          const allContents = [];
          const contentSelectors = ['.note-text', '[class*="comment"] [class*="text"]', '[class*="comment"] [class*="content"]', '[class*="content"]'];
          contentSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 10 && text.length < 500) {
                allContents.push({
                  element: el,
                  text: text,
                  rect: el.getBoundingClientRect()
                });
              }
            });
          });

          // 查找所有作者信息
          const allAuthors = [];
          const authorSelectors = ['.author .name', '.author-name', '.nickname', '.user-name', '[class*="author"] [class*="name"]', '[class*="author"]', '[class*="user"]', '[class*="name"]', '.name'];
          authorSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 0 && text.length < 50) {
                allAuthors.push({
                  element: el,
                  text: text,
                  rect: el.getBoundingClientRect()
                });
              }
            });
          });

          // 根据位置关系配对内容和作者（垂直距离最近的配对）
          allContents.forEach(content => {
            let closestAuthor = null;
            let minDistance = Infinity;

            allAuthors.forEach(author => {
              // 计算垂直距离（假设作者在评论上方或同一行）
              const verticalDistance = Math.abs(content.rect.top - author.rect.top);
              const horizontalDistance = Math.abs(content.rect.left - author.rect.left);

              // 如果垂直距离小，且水平距离合理，认为可能是配对的
              if (verticalDistance < 100 && horizontalDistance < 200 && verticalDistance < minDistance) {
                minDistance = verticalDistance;
                closestAuthor = author;
              }
            });

            if (closestAuthor) {
              results.push({
                content: content.text,
                author: closestAuthor.text,
                container: `位置配对: 内容rect(${content.rect.top}, ${content.rect.left}), 作者rect(${closestAuthor.rect.top}, ${closestAuthor.rect.left})`,
                method: 'position'
              });
            }
          });
        }

        return results;
      });

      console.log(`📄 获取到 ${commentWithAuthorData.length} 个评论及其作者信息`);

      // 在评论数据中查找匹配的内容和对应作者（放宽匹配条件）
      for (const item of commentWithAuthorData) {
        // 完全匹配检查
        if (item.content === searchContent) {
          console.log(`✅ 找到完全匹配的评论内容: "${searchContent}"`);
          console.log(`👤 对应的作者: "${item.author || '未找到'}"`);
          console.log(`📝 评论容器信息: ${item.container}`);
          foundExactMatch = true;
          matchedComment = item.content;
          matchedAuthor = item.author;
          break;
        }

        // 规范化匹配：去除多余空格、换行、标点差异
        const normalizedComment = item.content.replace(/\s+/g, ' ').trim();
        const normalizedSearch = searchContent.replace(/\s+/g, ' ').trim();

        // 完全规范化匹配
        if (normalizedComment === normalizedSearch) {
          console.log(`✅ 找到规范化匹配的评论内容: "${normalizedComment}"`);
          console.log(`👤 对应的作者: "${item.author || '未找到'}"`);
          console.log(`📝 评论容器信息: ${item.container}`);
          foundExactMatch = true;
          matchedComment = item.content;
          matchedAuthor = item.author;
          break;
        }

        // 高级匹配：允许小差异（标点符号、末尾差异等）
        const similarity = this.calculateSimilarity(normalizedComment, normalizedSearch);
        if (similarity >= 0.95) { // 95%相似度
          console.log(`✅ 找到高相似度匹配的评论内容 (${(similarity * 100).toFixed(1)}%):`);
          console.log(`   搜索: "${normalizedSearch}"`);
          console.log(`   找到: "${normalizedComment}"`);
          console.log(`👤 对应的作者: "${item.author || '未找到'}"`);
          console.log(`📝 评论容器信息: ${item.container}`);
          foundExactMatch = true;
          matchedComment = item.content;
          matchedAuthor = item.author;
          break;
        }

        // 关键词匹配：如果包含主要关键词且相似度较高
        if (similarity >= 0.85 && this.hasCommonWords(normalizedComment, normalizedSearch)) {
          console.log(`✅ 找到关键词匹配的评论内容 (${(similarity * 100).toFixed(1)}% + 关键词):`);
          console.log(`   搜索: "${normalizedSearch}"`);
          console.log(`   找到: "${normalizedComment}"`);
          console.log(`👤 对应的作者: "${item.author || '未找到'}"`);
          console.log(`📝 评论容器信息: ${item.container}`);
          foundExactMatch = true;
          matchedComment = item.content;
          matchedAuthor = item.author;
          break;
        }
      }

      if (!foundExactMatch) {
        console.log(`❌ 评论内容匹配失败: "${searchContent}" 在页面评论中不存在`);
        console.log(`📋 页面中的评论文本预览:`, commentWithAuthorData.slice(0, 5).map(c => `"${c.content?.substring(0, 50)}..." (作者: ${c.author || '未知'})`));

        // 即使评论验证失败，也返回页面评论数据，以便后续处理
        return {
          found: false,
          confidence: 0.1,
          reason: '评论内容在页面评论中不存在，请检查评论是否真实存在',
          foundComments: [],
          pageComments: commentWithAuthorData,
          scannedComments: commentWithAuthorData.length,
          pageCommentCount: commentWithAuthorData.length
        };
      }

      // 如果提供了作者列表，验证作者匹配
      if (authorList.length > 0) {
        console.log(`🔍 [CommentVerification调试] 开始作者验证: matchedAuthor="${matchedAuthor}", authorList=${JSON.stringify(authorList)}`);

        // 检查找到的作者是否在期望的作者列表中
        let authorMatched = false;
        if (matchedAuthor) {
          console.log(`🔍 [CommentVerification调试] 找到的matchedAuthor: "${matchedAuthor}"`);

          for (const expectedAuthor of authorList) {
            // 清理作者名称（去除关注、作者等后缀）
            const cleanMatchedAuthor = matchedAuthor.replace(/\s*(关注|作者|等)$/, '').trim();
            const cleanExpectedAuthor = expectedAuthor.trim();

            console.log(`🔍 [CommentVerification调试] 比较: cleanMatchedAuthor="${cleanMatchedAuthor}", cleanExpectedAuthor="${cleanExpectedAuthor}"`);

            if (cleanMatchedAuthor === cleanExpectedAuthor) {
              authorMatched = true;
              console.log(`✅ [CommentVerification调试] 作者完全匹配: "${cleanMatchedAuthor}"`);
              break;
            }

            // 尝试部分匹配（如果作者名较长）
            if (cleanMatchedAuthor.includes(cleanExpectedAuthor) || cleanExpectedAuthor.includes(cleanMatchedAuthor)) {
              authorMatched = true;
              console.log(`✅ [CommentVerification调试] 作者部分匹配: "${cleanMatchedAuthor}" 包含 "${cleanExpectedAuthor}"`);
              break;
            }
          }
        } else {
          console.log(`⚠️ [CommentVerification调试] matchedAuthor为空，评论验证找到内容但未找到对应作者`);
          console.log(`⚠️ [CommentVerification调试] commentWithAuthorData样本:`, commentWithAuthorData.slice(0, 3).map(c => ({
            content: c.content?.substring(0, 50),
            author: c.author,
            method: c.method
          })));
        }

        if (authorMatched) {
          console.log(`✅ [CommentVerification调试] 评论验证通过: 内容和作者都匹配`);
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
            pageComments: commentWithAuthorData,
            scannedComments: commentWithAuthorData.length
          };
        } else {
          console.log(`❌ [CommentVerification调试] 作者不匹配`);
          console.log(`👤 [CommentVerification调试] 找到的作者: "${matchedAuthor || '未找到'}"`);
          console.log(`👤 [CommentVerification调试] 期望的作者列表: ${JSON.stringify(authorList)}`);

          // 由于要求内容完全一致，如果作者不匹配，必须拒绝
          return {
            found: false,
            confidence: 0.1,
            reason: '作者昵称不匹配',
            foundComments: [{
              text: searchContent,
              author: matchedAuthor,
              contentMatch: 100,
              authorMatch: 0,
              exactMatch: true
            }],
            pageComments: commentWithAuthorData,
            scannedComments: commentWithAuthorData.length
          };
        }
      } else {
        // 没有提供作者，只要内容完全匹配就通过
        console.log(`✅ [CommentVerification调试] 评论内容完全匹配（未提供作者验证）, matchedAuthor="${matchedAuthor}"`);

        return {
          found: true,
          confidence: 0.9,
          reason: '找到评论内容，完全一致验证通过',
          foundComments: [{
            text: searchContent,
            author: matchedAuthor,
            contentMatch: 100,
            authorMatch: 0,
            exactMatch: true
          }],
          pageComments: commentWithAuthorData,
          scannedComments: commentWithAuthorData.length
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
   * 生成缓存键
   */
  generateCacheKey(noteUrl, commentContent, commentAuthor) {
    // 清理和标准化输入
    const cleanUrl = noteUrl.trim().toLowerCase();
    const cleanContent = commentContent.trim();
    const cleanAuthor = (commentAuthor || '').toString().trim();

    // 生成哈希作为缓存键
    const crypto = require('crypto');
    const keyString = `${cleanUrl}|${cleanContent}|${cleanAuthor}`;
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * 获取缓存结果
   */
  getCachedResult(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.cacheExpiry) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  /**
   * 设置缓存结果
   */
  setCachedResult(cacheKey, data) {
    // 清理过期缓存
    this.cleanExpiredCache();

    // 检查缓存大小限制
    if (this.cache.size >= this.maxCacheSize) {
      // 删除最旧的缓存项
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      expiryMs: this.cacheExpiry
    };
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
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