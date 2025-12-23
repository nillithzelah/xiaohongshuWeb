// 测试新的小红书链接格式验证
const XiaohongshuService = require('./server/services/xiaohongshuService');

async function testLinkValidation() {
  const testUrls = [
    'https://xiaohongshu.com/explore/1234567890',
    'https://www.xiaohongshu.com/explore/abcdef123',
    'https://xhslink.com/explore/test123',
    'https://xhslink.com/o/2rV8kDR9MxK',  // 新格式
    'https://xhslink.com/a/article123',   // 新格式
    'https://invalid.com/test',           // 无效链接
    'https://xhslink.com/invalid/path'    // 无效路径
  ];

  console.log('🧪 测试小红书链接格式验证：\n');

  for (const url of testUrls) {
    const isValid = XiaohongshuService.isValidXiaohongshuUrl(url);
    const noteId = XiaohongshuService.extractNoteId(url);
    console.log(`${isValid ? '✅' : '❌'} ${url}`);
    console.log(`   提取的笔记ID: ${noteId || '无'}`);
    console.log('');
  }

  console.log('✅ 链接格式验证测试完成');
}

testLinkValidation();