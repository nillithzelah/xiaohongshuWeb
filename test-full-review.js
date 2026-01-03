const aiReviewService = require('./server/services/asyncAiReviewService');

// 模拟一个笔记审核记录
const mockReview = {
  _id: 'test-review-id',
  imageType: 'note',
  noteUrl: 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=',
  userNoteInfo: {
    title: '减肥被骗要回来了姐妹们别买了，亲测没用',
    author: '阳 77'
  },
  userId: { _id: 'test-user-id' },
  createdAt: new Date(),
  reviewAttempt: 1,
  status: 'pending'
};

async function testFullReview() {
  console.log('🧪 开始测试完整审核流程...');

  try {

    // 执行完整AI审核
    console.log('🤖 执行完整AI审核...');
    const result = await aiReviewService.performFullAiReview(mockReview);

    console.log('📊 审核结果:');
    console.log(JSON.stringify(result, null, 2));

    if (result && result.aiReview) {
      console.log('\n📋 审核总结:');
      console.log(`- 通过: ${result.aiReview.passed}`);
      console.log(`- 置信度: ${result.aiReview.confidence}`);
      console.log(`- 原因: ${result.aiReview.reasons.join(', ')}`);
      console.log(`- 风险等级: ${result.aiReview.riskLevel}`);

      if (result.contentMatch) {
        console.log('\n📋 内容匹配详情:');
        console.log(`- 作者匹配度: ${result.contentMatch.authorMatch}%`);
        console.log(`- 标题匹配度: ${result.contentMatch.titleMatch}%`);
        console.log(`- 页面作者: "${result.contentMatch.pageAuthor}"`);
        console.log(`- 页面标题: "${result.contentMatch.pageTitle}"`);
        console.log(`- 用户提交作者: "${mockReview.userNoteInfo.author}"`);
        console.log(`- 用户提交标题: "${mockReview.userNoteInfo.title}"`);
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testFullReview();