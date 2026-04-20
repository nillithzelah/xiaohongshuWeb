const fs = require('fs');

// 创建一个 16x16 红色圆形 PNG 图标
// 使用 Base64 编码的有效 PNG
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAFklEQVR42mP8/5+hHgAHjmJ6QI0wH/zN+CADUP9H7w1/OAAAAAElFTkSuQmCC';
const pngBuffer = Buffer.from(pngBase64, 'base64');
fs.writeFileSync('icon.png', pngBuffer);
console.log('Created icon.png, size:', pngBuffer.length);
console.log('Icon path:', require('path').join(__dirname, 'icon.png'));
