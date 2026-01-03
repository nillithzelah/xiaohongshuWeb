// 直接测试评论验证功能
const CommentVerificationService = require('./server/services/CommentVerificationService');

async function testCommentDirect() {
  const service = new CommentVerificationService();

  console.log('🧪 直接测试评论验证功能');
  console.log('================================');

  // 测试用例：使用实际的笔记URL和评论内容
  const testCases = [
    {
      noteUrl: 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=',
      commentContent: '这个减肥方法真的有效，我试了之后瘦了5斤',
      authorNicknames: ['test_user'],
      description: '测试评论验证功能'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 测试: ${testCase.description}`);
    console.log(`📄 笔记URL: ${testCase.noteUrl}`);
    console.log(`💬 评论内容: "${testCase.commentContent}"`);
    console.log(`👤 作者列表: ${JSON.stringify(testCase.authorNicknames)}`);

    try {
      const result = await service.verifyCommentExists(
        testCase.noteUrl,
        testCase.commentContent,
        testCase.authorNicknames,
        process.env.XIAOHONGSHU_COOKIE
      );

      console.log('\n📊 验证结果:');
      console.log(`   ✅ 存在: ${result.exists}`);
      console.log(`   🎯 置信度: ${result.confidence}`);
      console.log(`   📝 原因: ${result.reason}`);
      console.log(`   📊 扫描评论数: ${result.scannedComments}`);
      console.log(`   📄 页面评论总数: ${result.pageCommentCount}`);

      if (result.foundComments && result.foundComments.length > 0) {
        console.log('🔍 找到的评论:');
        result.foundComments.forEach((comment, i) => {
          console.log(`   ${i + 1}. "${comment.text}" (作者: ${comment.author || '未知'})`);
        });
      }

      if (result.pageComments && result.pageComments.length > 0) {
        console.log('📋 页面评论预览 (前3条):');
        result.pageComments.slice(0, 3).forEach((comment, i) => {
          console.log(`   ${i + 1}. "${comment.content?.substring(0, 50)}..." (作者: ${comment.author || '未知'})`);
        });
      }

      if (result.error) {
        console.log(`❌ 错误: ${result.error}`);
      }

    } catch (error) {
      console.error('❌ 测试失败:', error.message);
    }

    // 测试间隔
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // 获取服务状态
  console.log('\n📊 服务状态:');
  console.log(service.getStatus());

  // 清理资源
  await service.close();
}

testCommentDirect().catch(console.error);