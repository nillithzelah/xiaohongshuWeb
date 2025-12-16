const xiaohongshuService = require('./server/services/xiaohongshuService');

// 测试评论验证功能
async function testCommentVerification() {
  console.log('🧪 开始测试评论验证功能...');

  // 测试用例
  const testCases = [
    {
      noteUrl: 'https://www.xiaohongshu.com/explore/6581234567890123456789', // 替换为真实笔记URL
      commentContent: '这个笔记写得很好，很有参考价值！',
      commentAuthor: '测试用户',
      description: '测试真实评论验证'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 测试用例: ${testCase.description}`);
    console.log(`🔗 笔记链接: ${testCase.noteUrl}`);
    console.log(`💬 评论内容: ${testCase.commentContent}`);
    console.log(`👤 评论作者: ${testCase.commentAuthor}`);

    try {
      const result = await xiaohongshuService.performCommentAIReview(
        testCase.noteUrl,
        testCase.commentContent,
        testCase.commentAuthor
      );

      console.log('✅ 审核结果:', {
        通过: result.passed,
        置信度: Math.round(result.confidence * 100) + '%',
        风险等级: result.riskLevel,
        原因: result.reasons
      });

    } catch (error) {
      console.error('❌ 测试失败:', error.message);
    }
  }

  // 清理资源
  await xiaohongshuService.cleanup();
  console.log('\n🧹 测试完成，资源已清理');
}

// 运行测试
if (require.main === module) {
  testCommentVerification().catch(console.error);
}

module.exports = { testCommentVerification };