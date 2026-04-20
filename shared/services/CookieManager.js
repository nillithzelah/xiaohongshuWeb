// Cookie 管理器 - 使用 Puppeteer 从浏览器读取 Cookie
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const CookieReader = require('./CookieReader');

puppeteer.use(StealthPlugin());

class CookieManager {
  constructor(config = {}) {
    this.reader = new CookieReader(config.cookies || {});
    this.cookies = [];
    this.cookieString = '';
    this.browser = null;
    this.isInitialized = false;
  }

  /**
   * 初始化 - 从浏览器读取 Cookie
   */
  async init() {
    console.log('🍪 [Cookie管理器] 正在从浏览器读取 Cookie...');

    try {
      // 获取浏览器配置
      const browserInfo = this.reader.getBrowserInfo();
      console.log(`📁 [Cookie管理器] 平台: ${browserInfo.platform}`);
      console.log(`📁 [Cookie管理器] 浏览器: ${browserInfo.browser}`);
      console.log(`📁 [Cookie管理器] 用户数据目录: ${browserInfo.userDataDir}`);
      console.log(`📁 [Cookie管理器] 找到配置文件: ${browserInfo.profilesFound}个`);

      // 尝试从 Default 配置文件启动浏览器并读取 Cookie
      const cookieConfig = this.reader.getPuppeteerCookieConfig('Default');

      console.log('🚀 [Cookie管理器] 启动浏览器读取 Cookie...');

      // 使用 stealth 插件启动浏览器
      this.browser = await puppeteer.launch({
        headless: true, // 后台运行
        userDataDir: cookieConfig.userDataDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });

      const page = await this.browser.newPage();

      // 访问小红书首页触发 Cookie 加载
      console.log('🌐 [Cookie管理器] 访问小红书首页...');
      await page.goto('https://www.xiaohongshu.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 等待一下确保 Cookie 加载
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 读取所有 Cookie
      const allCookies = await page.cookies();
      console.log(`📊 [Cookie管理器] 读取到 ${allCookies.length} 个 Cookie`);

      // 筛选小红书相关 Cookie
      this.cookies = this.reader.filterXiaohongshuCookies(allCookies);
      console.log(`✅ [Cookie管理器] 筛选出 ${this.cookies.length} 个小红书 Cookie`);

      // 打印 Cookie 名称
      const cookieNames = this.cookies.map(c => c.name).join(', ');
      console.log(`📋 [Cookie管理器] Cookie 名称: ${cookieNames}`);

      // 检查关键 Cookie
      const hasA1 = this.cookies.some(c => c.name === 'a1');
      const hasWebSession = this.cookies.some(c => c.name === 'web_session');
      console.log(`🔑 [Cookie管理器] a1: ${hasA1 ? '✅' : '❌'}, web_session: ${hasWebSession ? '✅' : '❌'}`);

      // 转换为字符串格式
      this.cookieString = this.reader.cookiesToString(this.cookies);

      // 验证 Cookie
      const validation = this.reader.validateCookieString(this.cookieString);
      if (!validation.valid) {
        console.warn(`⚠️  [Cookie管理器] Cookie 验证失败: ${validation.reason}`);
        console.warn(`💡 [Cookie管理器] 请先在 Chrome 浏览器中登录 xiaohongshu.com，然后重新启动客户端`);
      } else {
        console.log('✅ [Cookie管理器] Cookie 验证通过');

        // 解析创建时间
        const createTime = this.reader.parseCookieCreateTime(this.cookieString);
        if (createTime) {
          const age = Date.now() - createTime.getTime();
          const ageHours = Math.floor(age / 3600000);
          console.log(`📅 [Cookie管理器] Cookie 创建时间: ${createTime.toLocaleString('zh-CN')}`);
          console.log(`⏱️  [Cookie管理器] Cookie 已使用: ${ageHours} 小时`);
        }
      }

      await this.browser.close();
      this.browser = null;
      this.isInitialized = true;

      return {
        success: validation.valid,
        cookies: this.cookies,
        cookieString: this.cookieString,
        message: validation.reason || 'Cookie 读取成功'
      };

    } catch (error) {
      console.error('❌ [Cookie管理器] 读取 Cookie 失败:', error.message);

      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {
          // 忽略关闭错误
        }
        this.browser = null;
      }

      return {
        success: false,
        error: error.message,
        cookies: [],
        cookieString: ''
      };
    }
  }

  /**
   * 获取 Cookie 字符串
   */
  getCookieString() {
    return this.cookieString;
  }

  /**
   * 获取 Cookie 数组（用于 Puppeteer setCookie）
   */
  getCookies() {
    return this.cookies;
  }

  /**
   * 获取 Cookie 状态
   */
  getStatus() {
    const createTime = this.reader.parseCookieCreateTime(this.cookieString);
    let age = 0;
    if (createTime) {
      age = Date.now() - createTime.getTime();
    }

    return {
      isInitialized: this.isInitialized,
      cookieCount: this.cookies.length,
      cookieLength: this.cookieString.length,
      createTime: createTime?.toISOString(),
      ageHours: Math.floor(age / 3600000),
      hasRequiredFields: this.cookieString.includes('a1=') && this.cookieString.includes('web_session=')
    };
  }

  /**
   * 刷新 Cookie（重新读取）
   */
  async refresh() {
    console.log('🔄 [Cookie管理器] 刷新 Cookie...');
    return await this.init();
  }
}

module.exports = CookieManager;
