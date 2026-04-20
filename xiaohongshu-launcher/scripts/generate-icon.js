/**
 * 为 xiaohongshu-launcher 生成图标文件
 */
const fs = require('fs');
const path = require('path');

// 确保目录存在
const buildDir = path.join(__dirname, '../build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// SVG 图标 (小红书X造型)
const svgTemplate = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF2442"/>
      <stop offset="100%" style="stop-color:#FF6B6B"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="48" fill="url(#bg)"/>
  <path d="M70 80 L120 128 L70 176" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M186 80 L136 128 L186 176" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <line x1="120" y1="128" x2="136" y2="128" stroke="white" stroke-width="16" stroke-linecap="round"/>
</svg>`;

async function generateIcons() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: 'new' });

  const page = await browser.newPage();

  // 设置页面内容
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent">${svgTemplate}</body></html>`);

  // 生成 256x256 PNG
  const icon256 = await page.screenshot({ clip: { x: 0, y: 0, width: 256, height: 256 } });
  fs.writeFileSync(path.join(buildDir, 'icon.png'), icon256);
  console.log('✅ 已生成: build/icon.png (256x256)');

  // 生成 512x512 PNG (用于ICO)
  const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#FF2442"/>
        <stop offset="100%" style="stop-color:#FF6B6B"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="96" fill="url(#bg)"/>
    <path d="M140 160 L240 256 L140 352" stroke="white" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M372 160 L272 256 L372 352" stroke="white" stroke-width="48" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <line x1="240" y1="256" x2="272" y2="256" stroke="white" stroke-width="32" stroke-linecap="round"/>
  </svg>`;

  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:transparent">${svg512}</body></html>`);

  const icon512 = await page.screenshot({ clip: { x: 0, y: 0, width: 512, height: 512 } });
  fs.writeFileSync(path.join(buildDir, 'icon-512.png'), icon512);
  console.log('✅ 已生成: build/icon-512.png (512x512)');

  // 更新 resources/icon.png
  const resourcesDir = path.join(__dirname, '../resources');
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }
  fs.writeFileSync(path.join(resourcesDir, 'icon.png'), icon256);
  console.log('✅ 已更新: resources/icon.png');

  await browser.close();
  console.log('\n🎉 PNG 图标生成完成!');
  console.log('\n⚠️ 现在需要将 PNG 转换为 ICO 格式');
}

generateIcons().catch(err => {
  console.error('❌ 生成失败:', err.message);
  process.exit(1);
});
