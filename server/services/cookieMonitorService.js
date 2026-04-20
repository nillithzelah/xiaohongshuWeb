// Cookie监控服务：监控小红书Cookie有效性
const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

class CookieMonitorService {
  constructor() {
    // 直接从环境变量读取Cookie
    this.cookie = process.env.XIAOHONGSHU_COOKIE || '';
    this.testUrl = 'https://www.xiaohongshu.com/explore/695b5cb00000000009038538';
    this.checkInterval = 6 * 60 * 60 * 1000; // 每6小时检查一次
    this.warningThreshold = 24 * 60 * 60 * 1000; // 提前24小时警告
    this.lastCheckTime = null;
    this.isCookieValid = true; // 默认为有效，等待首次检查确认
    this.cookieAge = null; // Cookie使用时间
    this.cookieCreateTime = null; // Cookie创建时间（从loadts解析）

    // 定时器引用（用于停止监控）
    this.monitorTimer = null;

    // 统计数据
    this.checkHistory = []; // 检查历史记录
    this.successRate = 0; // 评论验证成功率
    this.totalChecks = 0;
    this.successCount = 0;

    // Puppeteer配置
    const isWindows = process.platform === 'win32';
    this.launchOptions = {
      headless: true,
      executablePath: isWindows
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };

    this.init();
  }

  init() {
    // 解析Cookie创建时间
    this.parseCookieCreateTime();

    // 启动定时检查
    this.startMonitoring();

    console.log('🍪 Cookie监控服务已启动');
    console.log(`检查间隔: ${this.checkInterval / 3600000}小时`);
    console.log(`警告阈值: ${this.warningThreshold / 3600000}小时`);
  }

  /**
   * 解析Cookie创建时间（从环境变量Cookie解析）
   */
  parseCookieCreateTime() {
    // 解析当前Cookie字符串
    const cookies = this.cookie.split('; ').reduce((acc, cookie) => {
      const [key, value] = cookie.split('=');
      if (key && value) {
        acc[key] = value;
      }
      return acc;
    }, {});

    if (cookies.loadts) {
      const loadTime = parseInt(cookies.loadts);
      this.cookieCreateTime = new Date(loadTime);
      this.cookieAge = Date.now() - loadTime;

      console.log(`📅 Cookie创建时间: ${this.cookieCreateTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
      console.log(`📊 Cookie已使用: ${Math.floor(this.cookieAge / 3600000)}小时`);
    }
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    // 如果已经启动，先停止旧的
    if (this.monitorTimer) {
      this.stopMonitoring();
    }

    // 立即执行一次检查
    this.checkCookieValidity();

    // 定时检查并保存定时器引用
    this.monitorTimer = setInterval(() => {
      this.checkCookieValidity();
    }, this.checkInterval);
  }

  /**
   * 停止监控（用于服务关闭）
   */
  stopMonitoring() {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      console.log('⏹️  [Cookie监控] 监控定时器已停止');
    }
  }

  /**
   * 检查Cookie有效性（轻量级：仅使用HTTP检查）
   * 注：Chrome Puppeteer 检查已禁用，避免资源浪费和孤儿进程风险
   */
  async checkCookieValidity() {
    console.log('🔍 开始检查Cookie有效性...');
    let browser = null;

    try {
      // 仅使用HTTP检查（快速、轻量、足够检测Cookie失效）
      const httpValid = await this.checkWithHttp();

      this.lastCheckTime = new Date();
      this.totalChecks++;

      // 仅使用HTTP检查结果（401/403表示Cookie失效）
      const isValid = httpValid;
      this.isCookieValid = isValid;

      // 记录历史
      this.checkHistory.push({
        time: this.lastCheckTime,
        isValid: isValid,
        isLoginPage: false,  // HTTP检查不检测登录页
        hasComments: false,  // HTTP检查不检测评论
        method: 'http-only'
      });

      // 只保留最近50条记录
      if (this.checkHistory.length > 50) {
        this.checkHistory.shift();
      }

      // 计算成功率
      this.calculateSuccessRate();

      // 输出结果
      if (isValid) {
        this.successCount++;
        console.log('✅ Cookie有效 (HTTP检查通过)');
      } else {
        console.log('❌ Cookie已失效 (HTTP返回401/403)');
        this.sendAlert('Cookie已失效：HTTP检查失败，请立即更新！');
      }

      // 检查Cookie使用时长
      if (this.cookieCreateTime && isValid) {
        const usageHours = (Date.now() - this.cookieCreateTime.getTime()) / 3600000;
        console.log(`📊 Cookie已使用: ${usageHours.toFixed(1)}小时 (${Math.floor(usageHours / 24)}天)`);

        // 如果使用时间超过25天，发出警告
        if (usageHours > 25 * 24) {
          console.log('⚠️ Cookie使用时间较长，建议更新');
          this.sendAlert(`Cookie已使用${Math.floor(usageHours / 24)}天，建议更新`);
        }
      }

      // 输出统计信息
      console.log(`📈 统计: 总检查${this.totalChecks}次, 成功${this.successCount}次, 成功率${this.successRate.toFixed(1)}%`);

    } catch (error) {
      console.error('❌ Cookie检查失败:', error.message);
      this.isCookieValid = false;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * 使用HTTP快速检查Cookie
   */
  async checkWithHttp() {
    try {
      const { withRetry } = require('../utils/apiRetry');

      // 🔧 使用重试机制包装Cookie检查
      const response = await withRetry(async () => {
        return await axios.get(this.testUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cookie': this.cookie
          },
          timeout: 10000,
          maxRedirects: 5
        });
      }, {
        maxRetries: 2,
        delay: 1000,
        backoffMultiplier: 1.5,
        shouldRetry: (error) => {
          // 401/403不重试（Cookie确实无效），其他错误重试
          if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            return false;
          }
          return true;
        }
      });

      // 检查HTTP状态码
      if (response.status === 401 || response.status === 403) {
        console.log('❌ HTTP检查失败: 401/403未授权');
        return false;
      }

      return true;
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('❌ HTTP检查失败: 401/403未授权');
        return false;
      }
      console.log('⚠️ HTTP检查超时或网络错误');
      return false;
    }
  }

  /**
   * 使用Puppeteer深度检查（检测登录页面）
   */
  async checkWithPuppeteer(browser) {
    let result = {
      isValid: false,
      isLoginPage: false,
      hasComments: false,
      pageContent: ''
    };

    try {
      browser = await puppeteer.launch(this.launchOptions);
      const page = await browser.newPage();

      // 注入Cookie
      const cookies = this.parseCookieString(this.cookie);
      await page.setCookie(...cookies);

      // 设置User-Agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      // 访问测试页面
      await page.goto(this.testUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 等待页面加载
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 获取页面内容
      const pageData = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // 【新Cookie失效检测】检查完整登录界面
        // 检测页面是否同时包含所有登录相关文本
        const loginTexts = [
          '登录后推荐更懂你的笔记',
          '可用小红书或微信扫码',
          '手机号登录',
          '我已阅读并同意',
          '新用户可直接登录'
        ];

        const allLoginTextsPresent = loginTexts.every(text => bodyText.includes(text));

        // 检测评论内容
        const commentSelectors = [
          '.note-text',
          '[class*="comment"] [class*="text"]',
          '[class*="comment"] [class*="content"]',
          '.comment-content'
        ];

        let hasComments = false;
        let commentCount = 0;

        for (const selector of commentSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            elements.forEach(el => {
              const text = el.textContent?.trim();
              if (text && text.length > 5) {
                commentCount++;
              }
            });
          }
        }

        hasComments = commentCount > 0;

        return {
          allLoginTextsPresent,
          loginTextsFound: loginTexts.filter(t => bodyText.includes(t)).length,
          hasComments,
          commentCount,
          bodyLength: bodyText.length,
          title: document.title
        };
      });

      result.pageContent = JSON.stringify(pageData);

      // 判断是否为登录页面（新逻辑）
      // 如果同时包含所有5个登录文本，认为是登录页面
      result.isLoginPage = pageData.allLoginTextsPresent;

      // 判断是否有评论内容
      result.hasComments = pageData.hasComments;

      // Cookie有效的条件：不是登录页面
      result.isValid = !result.isLoginPage;

      console.log(`🔍 登录文本检测: ${pageData.loginTextsFound}/5 ${result.isLoginPage ? '(完整登录页)' : '(正常页)'}`);
      console.log(`📝 评论数量: ${pageData.commentCount}`);
      console.log(`✅ Cookie有效性判断: ${result.isValid ? '有效' : '无效'} ${!result.hasComments ? '(无评论内容)' : ''}`);

    } catch (error) {
      console.error('❌ Puppeteer检查失败:', error.message);
      result.isValid = false;
    }

    return result;
  }

  /**
   * 解析Cookie字符串为Puppeteer格式
   */
  parseCookieString(cookieString) {
    if (!cookieString) return [];

    return cookieString.split('; ').map(pair => {
      const parts = pair.split('=');
      if (parts.length < 2) return null;

      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim(); // 处理value中包含=的情况

      if (!name || !value) return null;

      return {
        name: name,
        value: value,
        domain: '.xiaohongshu.com'
      };
    }).filter(cookie => cookie !== null);
  }

  /**
   * 计算成功率
   */
  calculateSuccessRate() {
    if (this.totalChecks === 0) {
      this.successRate = 0;
    } else {
      this.successRate = (this.successCount / this.totalChecks) * 100;
    }
  }

  /**
   * 发送警告
   */
  sendAlert(message) {
    console.log(`🚨 警告: ${message}`);
    console.log(`📅 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);

    // TODO: 可以集成邮件、短信或钉钉通知
    // 这里只是控制台输出，实际使用时可以替换为真实的通知方式
  }

  /**
   * 获取Cookie状态（增强版）
   */
  getStatus() {
    const loadts = this.cookieCreateTime ? this.cookieCreateTime.getTime() : Date.now();
    const configAgeHours = this.cookieCreateTime ? (Date.now() - loadts) / (1000 * 60 * 60) : 0;
    const estimatedExpiry = 72; // 默认72小时

    return {
      // Cookie配置状态
      config: {
        updatedAt: new Date().toISOString(),
        loadts: loadts,
        loadDate: new Date(loadts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        ageHours: Math.floor(configAgeHours),
        ageFormatted: `${Math.floor(configAgeHours)}小时${Math.floor((configAgeHours % 1) * 60)}分钟`,
        estimatedExpiry: estimatedExpiry,
        needsUpdate: configAgeHours > estimatedExpiry * 0.8,
        isExpired: configAgeHours >= estimatedExpiry,
        poolSize: 1,
        poolEnabled: 1
      },
      // 监控服务状态
      monitoring: {
        isValid: this.isCookieValid,
        lastCheckTime: this.lastCheckTime,
        cookieAge: this.cookieAge,
        cookieCreateTime: this.cookieCreateTime,
        checkInterval: this.checkInterval,
        nextCheckTime: this.lastCheckTime ? new Date(this.lastCheckTime.getTime() + this.checkInterval) : null
      },
      // 统计数据
      statistics: {
        totalChecks: this.totalChecks,
        successCount: this.successCount,
        successRate: this.successRate,
        recentHistory: this.checkHistory.slice(-10) // 最近10次检查记录
      }
    };
  }

  /**
   * 手动触发检查（供API调用）
   */
  async manualCheck() {
    console.log('🔧 手动触发Cookie检查...');
    await this.checkCookieValidity();
    return this.getStatus();
  }
}

// 导出单例
module.exports = new CookieMonitorService();
