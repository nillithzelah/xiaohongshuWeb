// 测试Cookie有效性
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testCookieValidity() {
  console.log('🍪 测试Cookie有效性');

  // 根据操作系统设置不同的Chrome路径
  const isWindows = process.platform === 'win32';
  const chromePath = isWindows
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : '/usr/bin/google-chrome-stable';

  const browser = await puppeteer.launch({
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
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // 获取环境变量中的Cookie
    const cookieString = process.env.XIAOHONGSHU_COOKIE;
    console.log('📋 Cookie字符串长度:', cookieString ? cookieString.length : 0);
    console.log('📋 是否有Cookie:', !!cookieString);

    if (cookieString) {
      // 解析并设置Cookie
      const cookies = cookieString.split('; ').map(pair => {
        const [name, value] = pair.split('=');
        return {
          name: name.trim(),
          value: value.trim(),
          domain: '.xiaohongshu.com'
        };
      });

      console.log(`📋 解析到 ${cookies.length} 个Cookie`);
      await page.setCookie(...cookies);
      console.log('✅ Cookie设置完成');
    }

    // 测试访问笔记页面
    const testUrl = 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2';
    console.log(`📄 测试访问: ${testUrl}`);

    await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const currentUrl = page.url();
    const title = await page.title();

    console.log(`📄 当前URL: ${currentUrl}`);
    console.log(`📄 页面标题: ${title}`);

    // 检查是否被重定向到登录页面
    const isLoginPage = currentUrl.includes('/login') || title.includes('登录');
    console.log(`🔍 是否在登录页面: ${isLoginPage}`);

    if (isLoginPage) {
      console.log('❌ Cookie无效或已过期');
    } else {
      console.log('✅ Cookie有效，可以正常访问内容');

      // 检查是否有评论内容
      const hasComments = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        return bodyText.includes('评论') || bodyText.includes('comment');
      });

      console.log(`💬 页面是否包含评论: ${hasComments}`);
    }

    // 检查Cookie是否仍然存在
    const currentCookies = await page.cookies();
    const xhsCookies = currentCookies.filter(c => c.domain.includes('xiaohongshu.com'));
    console.log(`🍪 当前页面上的小红书Cookie数量: ${xhsCookies.length}`);

  } catch (error) {
    console.error('❌ Cookie测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

testCookieValidity().catch(console.error);