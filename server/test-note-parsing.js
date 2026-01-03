// 测试笔记内容解析
const xiaohongshuService = require('./services/xiaohongshuService');

async function testNoteParsing() {
  try {
    console.log('🧪 开始测试笔记内容解析...');

    // 测试链接
    const testUrl = 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=';

    console.log(`🔍 测试链接: ${testUrl}`);

    // 1. 验证链接
    const linkValidation = await xiaohongshuService.validateNoteUrl(testUrl);
    console.log('🔗 链接验证结果:', linkValidation);

    if (!linkValidation.valid) {
      console.log('❌ 链接验证失败');
      return;
    }

    // 2. 解析内容
    const contentResult = await xiaohongshuService.parseNoteContent(testUrl);
    console.log('📄 内容解析结果:', JSON.stringify(contentResult, null, 2));

    // 3. 检查关键词
    if (contentResult.success) {
      const keywordCheck = xiaohongshuService.checkContentKeywords(null, contentResult.title || '');
      console.log('🔍 关键词检查结果:', keywordCheck);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testNoteParsing();