// 浏览器自动化服务 - 使用可见浏览器验证评论
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { URL } = require('url');

puppeteer.use(StealthPlugin());

class BrowserAutomation {
  constructor(config = {}) {
    this.browser = null;
    this.page = null;
    this.config = config.browser || {};

    // 浏览器配置
    this.headless = this.config.headless !== undefined ? this.config.headless : false;
    this.viewport = this.config.viewport || { width: 1920, height: 1080 };
    this.slowdown = this.config.slowdown || 100;
    this.scrollSpeed = this.config.scrollSpeed || 500;

    // 浏览器路径检测（Edge > Chrome > 内置 Chromium）
    this.executablePath = this.findBrowserPath();
    this.browserType = this.detectBrowserType();
  }

  /**
   * 查找浏览器可执行文件路径
   * 优先使用 Edge (Windows 自带)，然后 Chrome，最后让 Puppeteer 使用内置 Chromium
   */
  findBrowserPath() {
    const platform = process.platform;
    const fs = require('fs');

    const paths = {
      win32: [
        // Edge (Windows 自带，优先使用)
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env.PROGRAMFILES + '\\Microsoft\\Edge\\Application\\msedge.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe',
        // Chrome
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
      ],
      darwin: [
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      ],
      linux: [
        '/usr/bin/microsoft-edge',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser'
      ]
    };

    const platformPaths = paths[platform] || [];

    for (const path of platformPaths) {
      if (path && fs.existsSync(path)) {
        return path;
      }
    }

    return undefined; // 让 Puppeteer 使用内置 Chromium
  }

  /**
   * 检测浏览器类型
   */
  detectBrowserType() {
    if (!this.executablePath) return 'Chromium (内置)';
    if (this.executablePath.includes('msedge')) return 'Edge';
    if (this.executablePath.includes('chrome')) return 'Chrome';
    return 'Unknown';
  }

  /**
   * 启动浏览器（可见模式）
   */
  async launch() {
    console.log('🚀 [浏览器] 启动浏览器...');

    const launchOptions = {
      headless: this.headless,
      executablePath: this.executablePath,
      defaultViewport: this.viewport,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        `--window-size=${this.viewport.width},${this.viewport.height}`
      ]
    };

    try {
      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      // 设置 User-Agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // 注入反检测脚本
      await this.injectAntiDetection();

      // 注入评论跳转脚本
      await this.injectCommentJumper();

      console.log('✅ [浏览器] 浏览器启动成功');
      console.log(`🌐 [浏览器] 使用浏览器: ${this.browserType}`);
      console.log(`📺 [浏览器] 显示模式: ${this.headless ? '无头' : '可见'}`);

      return true;

    } catch (error) {
      console.error('❌ [浏览器] 启动失败:', error.message);
      throw error;
    }
  }

  /**
   * 注入反检测脚本
   */
  async injectAntiDetection() {
    await this.page.evaluateOnNewDocument(() => {
      // 覆盖 navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // 覆盖 Chrome 检测
      window.chrome = {
        runtime: {}
      };

      // 覆盖 permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );

      // 覆盖 plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // 覆盖 languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en']
      });
    });
  }

  /**
   * 注入评论跳转脚本
   */
  async injectCommentJumper() {
    await this.page.evaluateOnNewDocument(() => {
      // 评论跳转功能
      console.log('📌 [评论跳转] 脚本已加载');

      function findScrollParent(element) {
        let parent = element.parentElement;
        while (parent) {
          const overflow = window.getComputedStyle(parent).overflow;
          const overflowY = window.getComputedStyle(parent).overflowY;
          if ((overflow === 'auto' || overflow === 'scroll' || overflowY === 'auto' || overflowY === 'scroll') &&
              parent.scrollHeight > parent.clientHeight) {
            return parent;
          }
          parent = parent.parentElement;
        }
        return null;
      }

      function getRelativeOffsetTop(element, scrollParent) {
        let offsetTop = 0;
        let current = element;
        while (current && current !== scrollParent) {
          offsetTop += current.offsetTop;
          current = current.offsetParent;
        }
        return offsetTop;
      }

      function highlightComment(element) {
        const originalBg = element.style.backgroundColor;
        const originalBoxShadow = element.style.boxShadow;
        element.style.backgroundColor = '#fff3cd';
        element.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.5)';
        element.style.transition = 'all 0.3s ease';
        setTimeout(() => {
          element.style.backgroundColor = originalBg;
          element.style.boxShadow = originalBoxShadow;
        }, 2000);
      }

      function scrollToComment(commentId) {
        console.log(`🔍 [评论跳转] 查找评论: ${commentId}`);
        const commentEl = document.getElementById('comment-' + commentId);

        if (!commentEl) {
          console.log('⏳ [评论跳转] 评论未找到');
          return false;
        }

        console.log('✅ [评论跳转] 找到评论，开始滚动');
        const scrollParent = findScrollParent(commentEl);

        if (!scrollParent) {
          console.warn('⚠️ [评论跳转] 未找到滚动容器');
          commentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightComment(commentEl);
          return true;
        }

        const offsetTop = getRelativeOffsetTop(commentEl, scrollParent);
        const targetScroll = offsetTop - scrollParent.clientHeight / 2;
        scrollParent.scrollTop = targetScroll;
        highlightComment(commentEl);
        console.log('✅ [评论跳转] 滚动完成');
        return true;
      }

      function handleHashChange() {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#comment-')) {
          const commentId = hash.replace('#comment-', '');
          if (commentId) {
            console.log('📍 [评论跳转] 检测到评论锚点: ' + commentId);
            setTimeout(() => scrollToComment(commentId), 500);
          }
        }
      }

      // 监听 hash 变化
      window.addEventListener('hashchange', handleHashChange);

      // 页面加载完成后检查
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(handleHashChange, 1000);
        });
      } else {
        setTimeout(handleHashChange, 1000);
      }

      // SPA URL 变化检测
      let lastUrl = location.href;
      new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          setTimeout(handleHashChange, 1000);
        }
      }).observe(document.body, { childList: true, subtree: true });

      console.log('✅ [评论跳转] 脚本已就绪');
    });
  }

  /**
   * 设置 Cookie（直接使用 Cookie 数组）
   */
  async setCookies(cookieStringOrArray) {
    if (!this.page) {
      console.error('❌ [浏览器] 页面未初始化');
      return false;
    }

    try {
      let cookies;

      // 如果是字符串，先解析
      if (typeof cookieStringOrArray === 'string') {
        cookies = this.parseCookieString(cookieStringOrArray);
      } else if (Array.isArray(cookieStringOrArray)) {
        // 如果已经是数组，直接使用
        cookies = cookieStringOrArray;
      } else {
        console.error('❌ [浏览器] Cookie 格式错误');
        return false;
      }

      if (!cookies || cookies.length === 0) {
        console.error('❌ [浏览器] 没有 Cookie 可设置');
        return false;
      }

      // 关键：先访问小红书域名，然后再设置 Cookie
      await this.page.goto('https://www.xiaohongshu.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // 设置 Cookie
      await this.page.setCookie(...cookies);

      console.log(`🍪 [浏览器] 已设置 ${cookies.length} 个 Cookie`);

      // 打印关键 Cookie 状态
      const keyCookies = ['a1', 'web_session'];
      for (const name of keyCookies) {
        const cookie = cookies.find(c => c.name === name);
        if (cookie) {
          const valuePreview = cookie.value ? cookie.value.substring(0, 20) + '...' : 'empty';
          console.log(`   ✓ ${name}: ${valuePreview} (${cookie.value?.length || 0} 字符)`);
        } else {
          console.log(`   ✗ ${name}: 缺失`);
        }
      }

      return true;

    } catch (error) {
      console.error('❌ [浏览器] 设置 Cookie 失败:', error.message);
      return false;
    }
  }

  /**
   * 解析 Cookie 字符串为 Puppeteer 格式
   */
  parseCookieString(cookieString) {
    return cookieString.split('; ').map(pair => {
      const parts = pair.split('=');
      if (parts.length < 2) return null;

      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();

      if (!name || !value) return null;

      return {
        name: name,
        value: value,
        domain: '.xiaohongshu.com',
        path: '/',
        httpOnly: name === 'web_session' || name === 'a1',
        secure: true
      };
    }).filter(cookie => cookie !== null);
  }

  /**
   * 打开小红书登录页
   */
  async openLoginPage() {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    console.log('🌐 [浏览器] 打开小红书登录页...');

    await this.page.goto('https://www.xiaohongshu.com', {
      waitUntil: 'domcontentloaded',  // 改用 domcontentloaded，更快
      timeout: 15000
    });

    console.log('✅ [浏览器] 登录页已打开，等待用户扫码登录');
  }

  /**
   * 刷新当前页面（用于登录后确保 Cookie 设置完成）
   */
  async refreshPage() {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    console.log('🔄 [浏览器] 刷新页面...');
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await this.sleep(500);
    console.log('✅ [浏览器] 页面刷新完成');
  }

  /**
   * 读取当前页面的 Cookie
   */
  async readCookies() {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    console.log('🍪 [浏览器] 读取 Cookie...');

    const cookies = await this.page.cookies();

    // 先检查关键 Cookie 是否存在
    const hasA1 = cookies.some(c => c.name === 'a1');
    const hasWebSession = cookies.some(c => c.name === 'web_session');
    const hasXHng = cookies.some(c => c.name === 'x-hng');

    console.log(`📊 [Cookie] 原始 Cookie 数量: ${cookies.length}`);
    console.log(`   - a1: ${hasA1 ? '✅' : '❌'}`);
    console.log(`   - web_session: ${hasWebSession ? '✅' : '❌'}`);
    console.log(`   - x-hng: ${hasXHng ? '✅' : '❌'}`);

    // 只返回小红书相关的 Cookie
    const xhsCookies = cookies.filter(c =>
      c.domain?.includes('xiaohongshu') ||
      ['a1', 'web_session', 'x-hng', 'gid', 'webId', 'loadts', 'xsecappid'].includes(c.name)
    );

    console.log(`✅ [浏览器] 读取到 ${xhsCookies.length} 个小红书 Cookie`);

    return xhsCookies;
  }

  /**
   * 访问小红书笔记页面
   */
  async visitNotePage(noteUrl) {
    if (!this.page) {
      throw new Error('浏览器未启动');
    }

    console.log(`🌐 [浏览器] 访问笔记: ${noteUrl}`);

    try {
      await this.page.goto(noteUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // 等待页面稳定（增加等待时间避免 main frame too early 错误）
      await this.sleep(4000); // 增加到4秒，减慢操作速度

      // 检查是否被重定向到登录页（带重试）
      let isLoginPage = false;
      try {
        isLoginPage = await this.checkIsLoginPage();
      } catch (e) {
        console.warn('⚠️  [浏览器] checkIsLoginPage 失败，重试中...', e.message);
        await this.sleep(1500);
        isLoginPage = await this.checkIsLoginPage();
      }

      if (isLoginPage) {
        console.warn('⚠️  [浏览器] 检测到登录页面，Cookie 可能已失效');
        return { success: false, isLoginPage: true };
      }

      console.log('✅ [浏览器] 页面加载成功');
      return { success: true, isLoginPage: false };

    } catch (error) {
      console.error('❌ [浏览器] 访问页面失败:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查是否为登录页面
   */
  async checkIsLoginPage() {
    try {
      const loginInfo = await this.page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const title = document.title || '';

        // 检测登录相关文本
        const loginTexts = [
          '登录后推荐更懂你的笔记',
          '可用小红书或微信扫码',
          '手机号登录',
          '我已阅读并同意'
        ];

        const loginTextCount = loginTexts.filter(text => bodyText.includes(text)).length;

        // 检测密码输入框
        const passwordInput = document.querySelector('input[type="password"]');

        return {
          title,
          loginTextCount,
          hasPasswordInput: !!passwordInput,
          bodyLength: bodyText.length
        };
      });

      // 判断条件：登录文本数量 >= 3 且有密码框
      return loginInfo.loginTextCount >= 3 && loginInfo.hasPasswordInput;

    } catch (error) {
      return false;
    }
  }

  /**
   * 滚动页面加载评论（优化速度版）
   */
  async scrollToLoadComments() {
    console.log('📜 [浏览器] 开始滚动加载评论...');

    try {
      // 等待页面稳定
      await this.sleep(2000);

      // 检查页面是否就绪，等待内容容器出现
      const isReady = await this.page.evaluate(() => {
        if (!document.body) return false;

        // 检查 body 高度
        const bodyHeight = document.body.scrollHeight || document.body.offsetHeight || 0;

        // 检查主容器高度（小红书可能使用容器而非 body）
        const mainContainer = document.querySelector('#app, #main, [class*="app"], [class*="container"], [class*="wrapper"]');
        const containerHeight = mainContainer ? (mainContainer.scrollHeight || mainContainer.offsetHeight || 0) : 0;

        return bodyHeight > 100 || containerHeight > 100;
      });

      if (!isReady) {
        console.warn('⚠️ [浏览器] 页面未就绪，等待更长时间...');
        await this.sleep(5000);

        // 二次检查，打印调试信息
        const debugInfo = await this.page.evaluate(() => {
          if (!document.body) {
            return { error: 'no body' };
          }
          return {
            bodyHeight: document.body.scrollHeight,
            bodyOffset: document.body.offsetHeight,
            bodyChildren: document.body.children.length,
            html: document.body.innerHTML.substring(0, 500)
          };
        });
        console.log('🔍 调试信息:', debugInfo);
      }

      // ============ 第一步：点击"展开更多评论"按钮 ============
      console.log('🔍 查找"展开更多"按钮...');
      const expandButtonSelectors = [
        'span.more-text',
        '.expand-btn',
        '.more-btn',
        '[class*="expand"]',
        '[class*="more"]',
        'button[class*="more"]'
      ];

      for (const selector of expandButtonSelectors) {
        try {
          const elements = await this.page.$$(selector);
          for (const element of elements) {
            const text = await element.evaluate(el => el.textContent?.trim() || '');
            if (text.includes('展开') || text.includes('更多') || text.includes('全部') || text.includes('查看')) {
              console.log(`✅ 点击按钮: "${text}"`);
              try {
                await element.click();
                await this.sleep(1500); // 增加到1.5秒
              } catch (e) {
                await element.evaluate(el => el.click());
                await this.sleep(1500); // 增加到1.5秒
              }
            }
          }
        } catch (e) {
          // 继续尝试下一个
        }
      }

      // ============ 第二步：快速滚动加载评论 ============
      console.log('📜 开始滚动加载评论...');

      let previousHeight = 0;
      let scrollCount = 0;
      let noChangeCount = 0;
      let zeroHeightCount = 0;  // 新增：高度为0的计数器
      const maxNoChange = 2;
      const maxScrolls = 15;
      const maxZeroHeight = 5;  // 最多允许5次高度为0，之后放弃

      while (scrollCount < maxScrolls && noChangeCount < maxNoChange && zeroHeightCount < maxZeroHeight) {
        // 安全地获取滚动高度 - 尝试多种方式
        let currentHeight = 0;
        try {
          currentHeight = await this.page.evaluate(() => {
            if (!document.body) return 0;

            // 优先使用 body.scrollHeight
            let height = document.body.scrollHeight || 0;

            // 如果为0，尝试其他方式
            if (height === 0) {
              height = document.body.offsetHeight || 0;
            }
            if (height === 0) {
              height = document.documentElement.scrollHeight || 0;
            }
            if (height === 0) {
              // 尝试获取主容器高度
              const containers = document.querySelectorAll('#app, #main, [class*="app"], [class*="container"], [class*="wrapper"]');
              for (const container of containers) {
                const h = container.scrollHeight || container.offsetHeight || 0;
                if (h > height) height = h;
              }
            }

            return height;
          });
        } catch (e) {
          console.warn('⚠️ 获取页面高度失败，尝试重试...');
          await this.sleep(500);
          zeroHeightCount++;
          continue;
        }

        if (currentHeight === 0) {
          zeroHeightCount++;
          console.warn(`⚠️ 页面高度为0 (${zeroHeightCount}/${maxZeroHeight})，可能页面未加载完成`);
          if (zeroHeightCount >= maxZeroHeight) {
            console.error('❌ 页面高度持续为0，跳过此笔记的滚动');
            break;
          }
          await this.sleep(2000);  // 增加等待时间
          continue;
        }

        // 重置零高度计数器
        zeroHeightCount = 0;

        // 执行滚动
        try {
          await this.page.evaluate(() => {
            if (document.body) {
              window.scrollTo(0, document.body.scrollHeight);
            } else {
              window.scrollTo(0, document.documentElement.scrollHeight);
            }
          });
        } catch (e) {
          console.warn('⚠️ 滚动执行失败，跳过本次:', e.message);
          await this.sleep(500);
          continue;
        }

        scrollCount++;
        await this.sleep(1500); // 增加到1.5秒，减慢滚动速度

        // 获取新高度
        let newHeight = 0;
        try {
          newHeight = await this.page.evaluate(() => {
            if (!document.body) return 0;
            return document.body.scrollHeight || document.body.offsetHeight || 0;
          });
        } catch (e) {
          newHeight = currentHeight;
        }

        if (newHeight === currentHeight) {
          noChangeCount++;
          console.log(`⏸️ 高度未变化 (${noChangeCount}/${maxNoChange})`);

          if (noChangeCount < maxNoChange) {
            // 小幅上下滚动触发懒加载
            try {
              await this.page.evaluate(() => window.scrollBy(0, -200));
              await this.sleep(500);
              await this.page.evaluate(() => window.scrollBy(0, 300));
              await this.sleep(1200);

              const checkHeight = await this.page.evaluate(() => {
                if (!document.body) return 0;
                return document.body.scrollHeight || 0;
              });
              if (checkHeight > newHeight) {
                noChangeCount = 0;
              }
            } catch (e) {
              // 忽略滚动错误
            }
          }
        } else {
          noChangeCount = 0;
          console.log(`📜 滚动 ${scrollCount}: ${currentHeight}px → ${newHeight}px`);
        }

        previousHeight = newHeight;
      }

      if (zeroHeightCount >= maxZeroHeight) {
        console.warn('⚠️ 页面高度检测超时，跳过滚动步骤');
      } else {
        console.log(`✅ 滚动完成: 共滚动 ${scrollCount} 次`);
      }

      // ============ 第三步：最终等待 ============
      const finalWaitTime = 3000; // 增加到3秒
      console.log(`⏳ 等待评论渲染完成... (${finalWaitTime}ms)`);
      await this.sleep(finalWaitTime);

      // 输出统计
      try {
        const finalStats = await this.page.evaluate(() => {
          if (!document.body) {
            return { bodyHeight: 0, commentElements: 0 };
          }
          const commentElements = document.querySelectorAll('[class*="comment"], .comment-list, .list-container');
          return {
            bodyHeight: document.body.scrollHeight,
            commentElements: commentElements.length
          };
        });

        console.log(`📊 页面高度 ${finalStats.bodyHeight}px, 评论元素 ${finalStats.commentElements} 个`);
      } catch (e) {
        console.warn('⚠️ 获取最终统计失败:', e.message);
      }

      return true;

    } catch (error) {
      console.error('❌ [浏览器] 滚动失败:', error.message);
      return false;
    }
  }

  /**
   * 提取页面评论（增强版：多方法提取）
   */
  async extractComments() {
    console.log('📝 [浏览器] 提取评论...');

    try {
      const comments = await this.page.evaluate(() => {
        const results = [];

        // ============ 方法1：查找评论容器，同时提取作者和内容 ============
        const commentContainers = document.querySelectorAll('.list-container .right, .comments-container .right, .right');

        commentContainers.forEach(container => {
          // 在容器内查找评论内容
          const contentSelectors = ['.content', '[class*="content"]', '.note-text', '[class*="text"]'];
          let contentText = null;
          for (const selector of contentSelectors) {
            const contentElement = container.querySelector(selector);
            if (contentElement) {
              contentText = contentElement.textContent?.trim();
              if (contentText) break;
            }
          }

          // 在容器内查找作者信息
          const authorSelectors = [
            '.author-wrapper',
            '.author-name',
            '.nickname',
            '.user-name',
            '[class*="author"] [class*="name"]',
            '[class*="author"]',
            '[class*="user"]',
            '[class*="name"]',
            '.name'
          ];
          let authorText = null;
          for (const selector of authorSelectors) {
            const authorElement = container.querySelector(selector);
            if (authorElement) {
              authorText = authorElement.textContent?.trim();
              if (authorText) break;
            }
          }

          if (contentText && contentText.length > 0) {
            results.push({
              text: contentText,
              author: authorText,
              method: 'container'
            });
          }
        });

        // ============ 方法2：如果没找到容器化的评论，查找所有评论内容元素，然后向上查找作者 ============
        if (results.length === 0) {
          const contentElements = document.querySelectorAll('.note-text, [class*="comment"] [class*="text"], [class*="comment"] [class*="content"], [class*="content"]');

          contentElements.forEach(contentEl => {
            const contentText = contentEl.textContent?.trim();
            if (contentText && contentText.length > 0) {
              // 向上查找作者信息
              let authorText = null;
              let parent = contentEl.parentElement;
              let searchDepth = 0;

              while (parent && searchDepth < 8) {
                const authorSelectors = [
                  '.author-wrapper',
                  '.author-name',
                  '.nickname',
                  '.user-name',
                  '[class*="author"] [class*="name"]',
                  '[class*="author"]',
                  '[class*="user"]',
                  '[class*="name"]',
                  '.name'
                ];

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
                text: contentText,
                author: authorText,
                method: 'upward'
              });
            }
          });
        }

        // ============ 方法3：最后的兜底方法 - 根据位置关系配对内容和作者 ============
        if (results.length === 0) {
          console.log('使用兜底方法查找评论和作者配对');

          // 查找所有评论内容
          const allContents = [];
          const contentSelectors = ['.content', '[class*="content"]', '.note-text', '[class*="text"]'];

          contentSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 5 && text.length < 500) {
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
          const authorSelectors = [
            '.author-wrapper',
            '.author-name',
            '.nickname',
            '.user-name',
            '[class*="author"] [class*="name"]',
            '[class*="author"]',
            '[class*="user"]',
            '[class*="name"]',
            '.name'
          ];

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

          // 根据位置关系配对内容和作者
          allContents.forEach(content => {
            let closestAuthor = null;
            let minDistance = Infinity;

            allAuthors.forEach(author => {
              const verticalDistance = Math.abs(content.rect.top - author.rect.top);
              const horizontalDistance = Math.abs(content.rect.left - author.rect.left);

              if (verticalDistance < 100 && horizontalDistance < 200 && verticalDistance < minDistance) {
                minDistance = verticalDistance;
                closestAuthor = author;
              }
            });

            if (closestAuthor) {
              results.push({
                text: content.text,
                author: closestAuthor.text,
                method: 'position'
              });
            }
          });
        }

        return results;
      });

      console.log(`✅ [浏览器] 提取到 ${comments.length} 条评论`);

      // 打印前5条评论用于调试
      if (comments.length > 0) {
        console.log('   前5条评论:');
        for (let i = 0; i < Math.min(5, comments.length); i++) {
          const preview = comments[i].text?.substring(0, 40);
          const author = comments[i].author || '未知';
          const method = comments[i].method || 'unknown';
          console.log(`   ${i + 1}. "${preview}..." (作者: ${author}, 方法: ${method})`);
        }
      }

      return comments;

    } catch (error) {
      console.error('❌ [浏览器] 提取评论失败:', error.message);
      return [];
    }
  }

  /**
   * 移除小红书表情标签（如[doge]、[smile]等）
   */
  removeEmojiTags(text) {
    if (!text) return '';
    return text.replace(/\[[^\]]+\]/g, '').trim();
  }

  /**
   * 计算两个字符串的相似度（编辑距离算法）
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

    const words1 = str1.split(/[\s\u3000\uff0c\uff1f\uff01\uff0e\u3001\u3002]+/).filter(w => w.length > 1);
    const words2 = str2.split(/[\s\u3000\uff0c\uff1f\uff01\uff0e\u3001\u3002]+/).filter(w => w.length > 1);

    const commonWords = words1.filter(word => words2.some(w2 => w2.includes(word) || word.includes(w2)));
    return commonWords.length >= 2;
  }

  /**
   * 验证目标评论是否存在（增强版：使用服务器端匹配逻辑）
   */
  async verifyComment(targetComment, targetAuthor) {
    console.log(`🔍 [浏览器] 验证评论...`);
    console.log(`   目标内容: ${targetComment?.substring(0, 30)}...`);
    console.log(`   目标作者: ${targetAuthor}`);

    // 提取所有评论
    const comments = await this.extractComments();

    if (!targetComment) {
      console.warn('⚠️  目标评论为空，跳过验证');
      return {
        found: false,
        confidence: 0,
        targetComment: '',
        targetAuthor: '',
        matchedComment: null,
        allComments: comments,
        commentCount: comments.length
      };
    }

    // 清理和准备搜索内容
    const searchContent = targetComment.trim();
    const searchWithoutEmojis = this.removeEmojiTags(searchContent);

    // 处理作者参数
    let authorList = [];
    if (Array.isArray(targetAuthor)) {
      authorList = targetAuthor.filter(author => author && typeof author === 'string').map(author => author.trim());
    } else if (targetAuthor && typeof targetAuthor === 'string') {
      authorList = targetAuthor.split(',').map(a => a.trim()).filter(a => a);
    }

    console.log(`🔍 搜索条件: 内容="${searchContent}", 作者列表=${JSON.stringify(authorList)}`);
    console.log(`🔍 去表情后: "${searchWithoutEmojis}"`);

    // 查找匹配的评论
    let found = false;
    let matchedComment = null;
    let matchedAuthor = null;
    let bestMatchScore = 0;

    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      const commentWithoutEmojis = this.removeEmojiTags(comment.text);

      // 1. 完全匹配检查（排除表情标签）
      if (commentWithoutEmojis === searchWithoutEmojis) {
        console.log(`✅ 找到完全匹配的评论内容（已排除表情标签）: "${searchWithoutEmojis}"`);
        console.log(`👤 对应的作者: "${comment.author || '未找到'}"`);
        bestMatchScore = 1.0;
        matchedComment = comment;
        matchedAuthor = comment.author;
        found = true;
        break;
      }

      // 2. 规范化匹配：去除多余空格、换行
      const normalizedComment = commentWithoutEmojis.replace(/\s+/g, ' ').trim();
      const normalizedSearch = searchWithoutEmojis.replace(/\s+/g, ' ').trim();

      if (normalizedComment === normalizedSearch) {
        console.log(`✅ 找到规范化匹配的评论内容: "${normalizedComment}"`);
        console.log(`👤 对应的作者: "${comment.author || '未找到'}"`);
        bestMatchScore = 1.0;
        matchedComment = comment;
        matchedAuthor = comment.author;
        found = true;
        break;
      }

      // 3. 高相似度匹配（95%以上）
      const similarity = this.calculateSimilarity(normalizedComment, normalizedSearch);
      if (similarity >= 0.95) {
        console.log(`✅ 找到高相似度匹配的评论内容 (${(similarity * 100).toFixed(1)}%)`);
        console.log(`   搜索: "${normalizedSearch}"`);
        console.log(`   找到: "${normalizedComment}"`);
        console.log(`👤 对应的作者: "${comment.author || '未找到'}"`);
        bestMatchScore = similarity;
        matchedComment = comment;
        matchedAuthor = comment.author;
        found = true;
        break;
      }

      // 4. 关键词匹配（85%以上 + 共同词汇）
      if (similarity >= 0.85 && this.hasCommonWords(normalizedComment, normalizedSearch)) {
        console.log(`✅ 找到关键词匹配的评论内容 (${(similarity * 100).toFixed(1)}% + 关键词)`);
        console.log(`   搜索: "${normalizedSearch}"`);
        console.log(`   找到: "${normalizedComment}"`);
        console.log(`👤 对应的作者: "${comment.author || '未找到'}"`);
        bestMatchScore = similarity;
        matchedComment = comment;
        matchedAuthor = comment.author;
        found = true;
        break;
      }

      // 打印相似度较高的评论用于调试
      if (similarity >= 0.6) {
        console.log(`   候选 ${i + 1}: "${comment.text?.substring(0, 30)}..." (相似度: ${(similarity * 100).toFixed(1)}%, 作者: ${comment.author || '未知'})`);
      }
    }

    // 验证作者匹配（如果提供了作者列表）
    if (found && authorList.length > 0 && matchedAuthor) {
      console.log(`🔍 开始作者验证: matchedAuthor="${matchedAuthor}", authorList=${JSON.stringify(authorList)}`);

      let authorMatched = false;
      for (const expectedAuthor of authorList) {
        const cleanMatchedAuthor = matchedAuthor.replace(/\s*(关注|作者|等)$/, '').trim();
        const cleanExpectedAuthor = expectedAuthor.trim();

        if (cleanMatchedAuthor === cleanExpectedAuthor) {
          authorMatched = true;
          console.log(`✅ 作者完全匹配: "${cleanMatchedAuthor}"`);
          break;
        }

        if (cleanMatchedAuthor.includes(cleanExpectedAuthor) || cleanExpectedAuthor.includes(cleanMatchedAuthor)) {
          authorMatched = true;
          console.log(`✅ 作者部分匹配: "${cleanMatchedAuthor}" 包含 "${cleanExpectedAuthor}"`);
          break;
        }
      }

      if (!authorMatched) {
        console.log(`❌ 作者不匹配 - 找到的: "${matchedAuthor}", 期望: ${JSON.stringify(authorList)}`);
        found = false;
      }
    }

    const result = {
      found,
      confidence: found ? bestMatchScore : 0.0,
      targetComment,
      targetAuthor,
      matchedComment: matchedComment ? {
        text: matchedComment.text,
        author: matchedComment.author
      } : null,
      allComments: comments,
      commentCount: comments.length
    };

    console.log(`📊 [浏览器] 验证结果: ${found ? '✅ 找到' : '❌ 未找到'} (${comments.length} 条评论)`);

    return result;
  }

  /**
   * 提取笔记内容（标题、正文、作者）
   */
  async extractNoteContent() {
    console.log('📝 [浏览器] 提取笔记内容...');

    try {
      const noteData = await this.page.evaluate(() => {
        // 提取标题
        const titleSelectors = [
          '.title',
          '[class*="title"]',
          'h1',
          '.note-title',
          '[class*="note"][class*="title"]'
        ];
        let title = '';
        for (const selector of titleSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && el.textContent.trim().length > 0) {
            title = el.textContent.trim();
            break;
          }
        }

        // 提取作者
        const authorSelectors = [
          '.author-wrapper',
          '.author-name',
          '.nickname',
          '.user-name',
          '[class*="author"] [class*="name"]',
          '[class*="user"] [class*="name"]'
        ];
        let author = '';
        for (const selector of authorSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && el.textContent.trim().length > 0) {
            author = el.textContent.trim();
            break;
          }
        }

        // 提取正文内容
        const contentSelectors = [
          '.note-text',
          '[class*="content"]',
          '[class*="desc"]',
          '[class*="text"]',
          '.content',
          'article',
          '.post-content'
        ];
        let content = '';
        for (const selector of contentSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && el.textContent.trim().length > 20) {
            content = el.textContent.trim();
            break;
          }
        }

        // 如果正文内容太短，尝试获取body中的主要文本
        if (content.length < 50) {
          const bodyText = document.body.innerText || '';
          // 移除登录提示等无关内容
          const lines = bodyText.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 10 &&
                   !trimmed.includes('登录') &&
                   !trimmed.includes('扫码') &&
                   !trimmed.includes('推荐') &&
                   !trimmed.includes('关注');
          });
          content = lines.join('\n').substring(0, 5000);
        }

        return {
          title: title || '',
          author: author || '',
          content: content || ''
        };
      });

      console.log(`✅ [浏览器] 笔记内容提取成功`);
      console.log(`   标题: ${noteData.title.substring(0, 50)}...`);
      console.log(`   作者: ${noteData.author}`);
      console.log(`   正文长度: ${noteData.content.length} 字符`);

      return {
        success: true,
        data: noteData
      };

    } catch (error) {
      console.error('❌ [浏览器] 提取笔记内容失败:', error.message);
      return {
        success: false,
        error: error.message,
        data: { title: '', author: '', content: '' }
      };
    }
  }

  /**
   * 截图（用于调试）
   */
  async screenshot(filepath) {
    if (!this.page) return false;

    try {
      await this.page.screenshot({ path: filepath, fullPage: true });
      console.log(`📸 [浏览器] 截图保存: ${filepath}`);
      return true;
    } catch (error) {
      console.error('❌ [浏览器] 截图失败:', error.message);
      return false;
    }
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 [浏览器] 浏览器已关闭');
      } catch (error) {
        console.error('❌ [浏览器] 关闭失败:', error.message);
      }
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * 延迟函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      isLaunched: !!this.browser,
      isPageReady: !!this.page,
      headless: this.headless,
      viewport: this.viewport,
      executablePath: this.executablePath
    };
  }
}

module.exports = BrowserAutomation;
