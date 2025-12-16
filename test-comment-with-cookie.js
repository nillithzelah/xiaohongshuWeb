const xiaohongshuService = require('./server/services/xiaohongshuService');

// 测试评论验证功能（带Cookie）
async function testCommentVerificationWithCookie() {
  console.log('🧪 开始测试评论验证功能（带Cookie）...');

  // 用户提供的Cookie字符串
  const cookieString = "abRequestId=c7ff57cb-3eab-525c-94ff-31346019cf3e; webBuild=5.0.6; a1=19b1fa5581arp96q4do2jogvmkhpqw9gnajck4xkq50000506606; webId=27630fea4a8db7edc6bb7bf2107520dd; gid=yjDyi02KYdIfyjDyi022Y04Cy0FUjKA4flJVVTAlkh6TxS28UAEjkT88828KK8K8q0WjDS2d; customer-sso-sid=68c517583925544884305923kovxpeeyrjwfgwtk; x-user-id-creator.xiaohongshu.com=692e89b9000000003201a590; customerClientId=102464056668731; access-token-creator.xiaohongshu.com=customer.creator.AT-68c517583925544884305924vlq0rwvac8uwttaq; galaxy_creator_session_id=CABvIkhWNtPfD1Ss9RoARo1G5Umex9zFxt3d; galaxy.creator.beaker.session.id=1765770266185050396757; web_session=0400698ecf30cf56f97562c00a3b4b27f91792; xsecappid=xhs-pc-web; unread={%22ub%22:%2269395aed000000001e02d19f%22%2C%22ue%22:%22693ee07f000000001f004ee7%22%2C%22uc%22:22}; acw_tc=0a4a6fd717658501361352030e65329224bf6ad64d3f8a45848775e0099cbb; xsecappid=xhs-pc-web; sec_poison_id=b210133c-e6a2-4d3b-aa42-8b092c069daa; loadts=1765850684678";

  // 测试用例
  const testCases = [
    {
      noteUrl: 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=',
      commentContent: '还真是这样，我就是 我的天咯怎么办',
      commentAuthor: '也许呢jgk',
      description: '测试真实评论验证（带Cookie）'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📝 测试用例: ${testCase.description}`);
    console.log(`🔗 笔记链接: ${testCase.noteUrl}`);
    console.log(`💬 评论内容: ${testCase.commentContent}`);
    console.log(`👤 评论作者: ${testCase.commentAuthor}`);
    console.log(`🍪 Cookie长度: ${cookieString.length} 字符`);

    try {
      const result = await xiaohongshuService.performCommentAIReview(
        testCase.noteUrl,
        testCase.commentContent,
        testCase.commentAuthor,
        cookieString // 传递Cookie
      );

      console.log('✅ 审核结果:', {
        通过: result.passed,
        置信度: Math.round(result.confidence * 100) + '%',
        风险等级: result.riskLevel,
        原因: result.reasons
      });

      if (result.commentVerification) {
        console.log('🔍 评论验证详情:', {
          是否存在: result.commentVerification.exists,
          验证置信度: Math.round(result.commentVerification.confidence * 100) + '%',
          页面评论数: result.commentVerification.pageCommentCount,
          扫描评论数: result.commentVerification.scannedComments,
          找到的匹配评论: result.commentVerification.foundComments?.length || 0
        });
      }

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
  testCommentVerificationWithCookie().catch(console.error);
}

module.exports = { testCommentVerificationWithCookie };