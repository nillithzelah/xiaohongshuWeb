// 调试页面内容，查看评论区域的HTML结构
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugPageContent() {
  console.log('🔍 调试页面内容结构');

  // 根据操作系统设置不同的Chrome路径
  const isWindows = process.platform === 'win32';
  const chromePath = isWindows
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Windows Chrome路径
    : '/usr/bin/google-chrome-stable'; // Linux Chrome路径

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

    const url = 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=';

    console.log(`📄 访问页面: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // 等待页面加载
    await page.waitForSelector('body', { timeout: 10000 });

    // 滚动加载评论
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollBy(0, 500);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // 获取页面标题
    const title = await page.title();
    console.log(`📄 页面标题: ${title}`);

    // 查找评论相关元素
    const commentElements = await page.evaluate(() => {
      const results = [];

      // 尝试多种选择器
      const selectors = [
        '.note-text',
        '[class*="comment"] [class*="text"]',
        '[class*="comment"] [class*="content"]',
        '[data-testid*="comment"] [class*="text"]',
        '.comment-item .content',
        '.comment-text',
        '.comment-content',
        '[class*="CommentItem"] [class*="content"]',
        '[class*="CommentItem"] [class*="text"]',
        'div[class*="comment"] span[class*="text"]',
        'div[class*="comment"] div[class*="content"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          results.push({
            selector,
            count: elements.length,
            samples: Array.from(elements).slice(0, 3).map(el => ({
              text: el.textContent?.trim().substring(0, 100),
              className: el.className,
              outerHTML: el.outerHTML.substring(0, 200)
            }))
          });
        }
      });

      return results;
    });

    console.log('\n🔍 评论元素查找结果:');
    commentElements.forEach(result => {
      console.log(`\n选择器: ${result.selector} (找到 ${result.count} 个)`);
      result.samples.forEach((sample, i) => {
        console.log(`  ${i + 1}. 文本: "${sample.text}"`);
        console.log(`     类名: ${sample.className}`);
        console.log(`     HTML: ${sample.outerHTML.substring(0, 100)}...`);
      });
    });

    // 查找评论容器
    const commentContainers = await page.evaluate(() => {
      const containers = document.querySelectorAll('[class*="comment"], [class*="reply"], .comment-item, .reply-item');
      return Array.from(containers).slice(0, 5).map(container => ({
        className: container.className,
        text: container.textContent?.trim().substring(0, 200),
        innerHTML: container.innerHTML.substring(0, 300)
      }));
    });

    console.log('\n📦 评论容器查找结果:');
    commentContainers.forEach((container, i) => {
      console.log(`\n容器 ${i + 1}:`);
      console.log(`  类名: ${container.className}`);
      console.log(`  文本: "${container.text}"`);
      console.log(`  HTML: ${container.innerHTML.substring(0, 150)}...`);
    });

    // 获取页面总评论数信息
    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const commentCountMatch = bodyText.match(/(\d+)\s*条评论/) || bodyText.match(/评论\s*(\d+)/) || bodyText.match(/(\d+)\s*comments?/i);

      return {
        bodyLength: bodyText.length,
        hasComments: bodyText.includes('评论') || bodyText.includes('comment'),
        commentCountMatch: commentCountMatch ? commentCountMatch[1] : null,
        url: window.location.href
      };
    });

    console.log('\n📊 页面信息:');
    console.log(`  页面文本长度: ${pageInfo.bodyLength}`);
    console.log(`  包含评论关键词: ${pageInfo.hasComments}`);
    console.log(`  匹配到的评论数: ${pageInfo.commentCountMatch}`);
    console.log(`  当前URL: ${pageInfo.url}`);

  } catch (error) {
    console.error('❌ 调试失败:', error);
  } finally {
    await browser.close();
  }
}

debugPageContent().catch(console.error);