const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 使用stealth插件避免被检测
puppeteer.use(StealthPlugin());

async function checkComments() {
  console.log('🔍 开始检查小红书评论内容...');

  const browser = await puppeteer.launch({
    headless: true,
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

    // 设置浏览器标识，模拟真实用户
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // 设置视窗大小
    await page.setViewport({ width: 1920, height: 1080 });

    // 访问笔记页面
    const noteUrl = 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=';
    console.log('📄 正在访问笔记页面:', noteUrl);

    await page.goto(noteUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // 等待页面加载完成
    console.log('⏳ 等待页面加载...');
    await page.waitForSelector('body', { timeout: 30000 });

    // 等待更长时间确保内容加载
    console.log('⏳ 等待内容加载...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 检查页面是否正常加载
    const title = await page.title();
    console.log('📄 页面标题:', title);

    // 滚动页面加载评论（小红书评论是懒加载）
    console.log('💬 正在加载评论...');
    let previousHeight = 0;
    let scrollCount = 0;
    const maxScrolls = 10;

    while (scrollCount < maxScrolls) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const currentHeight = await page.evaluate(() => {
        return document.body.scrollHeight;
      });

      if (currentHeight === previousHeight) {
        break;
      }

      previousHeight = currentHeight;
      scrollCount++;

      console.log(`📜 滚动 ${scrollCount}/${maxScrolls}, 页面高度: ${currentHeight}`);
    }

    // 最后再等待一下确保所有内容加载完成
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 获取页面中所有评论元素
    console.log('🔍 正在查找评论...');
    const comments = await page.evaluate(() => {
      // 尝试多种评论选择器
      const commentSelectors = [
        '[data-testid*="comment"]',
        '[class*="comment"]',
        '[class*="review"]',
        '[class*="reply"]',
        '.note-comment-item',
        '.interaction-item'
      ];

      let commentElements = [];
      for (const selector of commentSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          commentElements = Array.from(elements);
          break;
        }
      }

      // 如果没找到特定选择器，尝试通过文本内容查找
      if (commentElements.length === 0) {
        const allDivs = document.querySelectorAll('div');
        commentElements = Array.from(allDivs).filter(div => {
          const text = div.textContent?.trim() || '';
          return text.length > 10 && text.length < 500 &&
                !text.includes('点赞') &&
                !text.includes('收藏') &&
                !text.includes('分享');
        });
      }

      return commentElements.map((element, index) => {
        const text = element.textContent?.trim() || '';
        // 查找作者信息
        const authorSelectors = [
          '[class*="author"]',
          '[class*="user"]',
          '[class*="name"]',
          '[class*="nick"]'
        ];

        let author = '';
        for (const selector of authorSelectors) {
          const authorElement = element.querySelector(selector);
          if (authorElement) {
            author = authorElement.textContent?.trim() || '';
            if (author.length > 0 && author.length < 50) break;
          }
        }

        return {
          index: index + 1,
          text,
          author,
          html: element.innerHTML.substring(0, 200) // 限制HTML长度
        };
      }).filter(comment => comment.text.length > 5);
    });

    console.log(`📊 找到 ${comments.length} 个评论元素`);
    console.log('📝 评论内容列表:');

    comments.forEach((comment, index) => {
      console.log(`\n${index + 1}. 作者: "${comment.author}"`);
      console.log(`   内容: "${comment.text}"`);
      console.log(`   长度: ${comment.text.length} 字符`);
    });

    // 特别查找包含"还真是这样"的评论
    const targetComments = comments.filter(comment =>
      comment.text.toLowerCase().includes('还真是这样')
    );

    if (targetComments.length > 0) {
      console.log('\n🎯 找到包含"还真是这样"的评论:');
      targetComments.forEach(comment => {
        console.log(`   作者: "${comment.author}"`);
        console.log(`   内容: "${comment.text}"`);
      });
    } else {
      console.log('\n❌ 未找到包含"还真是这样"的评论');
    }

  } catch (error) {
    console.error('❌ 检查评论失败:', error);
  } finally {
    await browser.close();
  }
}

// 运行检查
if (require.main === module) {
  checkComments().catch(console.error);
}

module.exports = { checkComments };