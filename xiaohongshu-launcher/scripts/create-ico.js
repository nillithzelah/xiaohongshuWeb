/**
 * 直接生成 Windows ICO 文件
 * 从 PNG 读取并转换为标准 ICO 格式
 */
const fs = require('fs');
const path = require('path');

// 简单的 PNG 转 ICO - 使用标准 ICO 格式
async function pngToIco(pngPath, icoPath) {
  const pngData = fs.readFileSync(pngPath);

  // ICO 文件头
  const icoHeader = Buffer.alloc(22);

  // ICO 头 (6 bytes)
  icoHeader.writeUInt16LE(0, 0);      // Reserved (must be 0)
  icoHeader.writeUInt16LE(1, 2);      // Type: 1 = ICO
  icoHeader.writeUInt16LE(1, 4);      // Number of images

  // 目录条目 (16 bytes)
  const width = 256;  // 256 = 0 for ICO
  const height = 256;
  icoHeader.writeUInt8(0, 6);         // Width (0 = 256)
  icoHeader.writeUInt8(0, 7);         // Height (0 = 256)
  icoHeader.writeUInt8(0, 8);         // Color count (0 = >256 colors)
  icoHeader.writeUInt8(0, 9);         // Reserved
  icoHeader.writeUInt16LE(1, 10);     // Color planes (hotspot x for cursor)
  icoHeader.writeUInt16LE(32, 12);    // Bits per pixel
  icoHeader.writeUInt32LE(pngData.length, 14);  // Size of image data
  icoHeader.writeUInt32LE(22, 18);    // Offset to image data

  // 合并头部和PNG数据
  const icoData = Buffer.concat([icoHeader, pngData]);
  fs.writeFileSync(icoPath, icoData);
  console.log(`✅ 已生成: ${icoPath}`);
}

const buildDir = path.join(__dirname, '../build');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

if (!fs.existsSync(pngPath)) {
  console.error('❌ 找不到 build/icon.png，请先运行 node scripts/generate-icon.js');
  process.exit(1);
}

console.log('🔄 转换 PNG 到 ICO...');
pngToIco(pngPath, icoPath);
console.log('\n🎉 完成! 现在可以运行 npm run build');
