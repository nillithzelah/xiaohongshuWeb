const asyncAiReviewService = require('./server/services/asyncAiReviewService');

// 测试评论审核重试决策修复
async function testCommentAuditRetryLogic() {
  console.log('🧪 测试评论审核重试决策修复...\n');

  // 模拟第一次审核的评论记录
  const mockReview1 = {
    _id: 'test-review-1',
    reviewAttempt: 1,
    imageType: 'comment',
    noteUrl: 'https://example.com/test',
    userNoteInfo: { comment: '测试评论' }
  };

  // 模拟第二次审核的评论记录
  const mockReview2 = {
    _id: 'test-review-2',
    reviewAttempt: 2,
    imageType: 'comment',
    noteUrl: 'https://example.com/test',
    userNoteInfo: { comment: '测试评论' }
  };

  // 测试评论不存在的重试决策
  console.log('📋 测试评论不存在的重试决策:');
  const decision1 = asyncAiReviewService.shouldRetryReview(mockReview1, 'comment_not_found');
  console.log(`第一次审核: shouldRetry=${decision1.shouldRetry}, reason="${decision1.reason}"`);

  const decision2 = asyncAiReviewService.shouldRetryReview(mockReview2, 'comment_not_found');
  console.log(`第二次审核: shouldRetry=${decision2.shouldRetry}, reason="${decision2.reason}"`);

  // 测试关键词检查失败的重试决策
  console.log('\n📋 测试关键词检查失败的重试决策:');
  const decision3 = asyncAiReviewService.shouldRetryReview(mockReview1, 'keyword_check_failed');
  console.log(`第一次审核: shouldRetry=${decision3.shouldRetry}, reason="${decision3.reason}"`);

  const decision4 = asyncAiReviewService.shouldRetryReview(mockReview2, 'keyword_check_failed');
  console.log(`第二次审核: shouldRetry=${decision4.shouldRetry}, reason="${decision4.reason}"`);

  // 测试内容解析失败的重试决策
  console.log('\n📋 测试内容解析失败的重试决策:');
  const decision5 = asyncAiReviewService.shouldRetryReview(mockReview1, 'content_parse_failed');
  console.log(`第一次审核: shouldRetry=${decision5.shouldRetry}, reason="${decision5.reason}"`);

  const decision6 = asyncAiReviewService.shouldRetryReview(mockReview2, 'content_parse_failed');
  console.log(`第二次审核: shouldRetry=${decision6.shouldRetry}, reason="${decision6.reason}"`);

  // 测试评论验证错误的重试决策
  console.log('\n📋 测试评论验证错误的重试决策:');
  const decision7 = asyncAiReviewService.shouldRetryReview(mockReview1, 'comment_verification_error');
  console.log(`第一次审核: shouldRetry=${decision7.shouldRetry}, reason="${decision7.reason}"`);

  const decision8 = asyncAiReviewService.shouldRetryReview(mockReview2, 'comment_verification_error');
  console.log(`第二次审核: shouldRetry=${decision8.shouldRetry}, reason="${decision8.reason}"`);

  console.log('\n✅ 重试决策测试完成');
  console.log('预期结果:');
  console.log('- 评论不存在: 第一次审核不重试，第二次审核不重试');
  console.log('- 关键词检查失败: 第一次审核不重试，第二次审核不重试');
  console.log('- 评论验证错误: 第一次审核重试，第二次审核不重试');
}

// 运行测试
testCommentAuditRetryLogic().catch(console.error);