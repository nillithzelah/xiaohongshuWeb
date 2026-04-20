const puppeteer = require('puppeteer');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://xhslink.com/o/7dmBKJ3UgYO', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);

  const result = await page.evaluate(() => {
    // 获取当前URL
    const url = window.location.href;

    // 获取时间文本
    const timeSelectors = ['time', '.time', 'span[class*="time"]', '.note-time', '.publish-time', '.date-info'];
    let timeText = '';
    for (const selector of timeSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent) {
        timeText = el.textContent.trim();
        break;
      }
    }

    // 如果没找到，从页面文本中提取
    if (!timeText) {
      const bodyText = document.body.textContent || '';
      const timeMatch = bodyText.match(/(\d+\s*(分钟|小时|天)前|刚刚|今天|昨天)/);
      if (timeMatch) timeText = timeMatch[1];
    }

    // 获取标题
    const titleEl = document.querySelector('h1, .title, [class*="title"]');
    const title = titleEl ? titleEl.textContent.trim() : '';

    return { url, timeText, title };
  });

  console.log('URL:', result.url);
  console.log('时间:', result.timeText || '(未找到)');
  console.log('标题:', result.title.substring(0, 50));

  await browser.close();
})();
