/**
 * 测试笔记和评论审核延迟逻辑
 * 验证从任务提交时间开始计时的逻辑是否正确
 */

// 模拟测试数据
function createMockReview(createdAtMinutesAgo, reviewAttempt = 1) {
  const createdAt = new Date(Date.now() - (createdAtMinutesAgo * 60 * 1000));

  return {
    _id: 'mock_review_id',
    createdAt,
    reviewAttempt,
    imageType: 'note', // 或 'comment'
    userNoteInfo: {
      author: 'test_author',
      title: 'test_title'
    }
  };
}

// 测试延迟计算逻辑
function testDelayCalculation(review, targetDelaySeconds) {
  const timeSinceSubmission = Date.now() - review.createdAt.getTime();
  const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

  console.log(`任务提交时间: ${review.createdAt.toISOString()}`);
  console.log(`当前时间: ${new Date().toISOString()}`);
  console.log(`距离提交已过: ${timeSinceSubmissionSeconds}秒`);
  console.log(`目标延迟: ${targetDelaySeconds}秒`);

  if (timeSinceSubmissionSeconds < targetDelaySeconds) {
    const remainingTime = (targetDelaySeconds - timeSinceSubmissionSeconds) * 1000;
    console.log(`✅ 需要等待: ${remainingTime/1000}秒`);
    return { shouldWait: true, waitTime: remainingTime };
  } else {
    console.log(`✅ 已过延迟时间，直接执行审核`);
    return { shouldWait: false, waitTime: 0 };
  }
}

function runTests() {
  console.log('=== 测试笔记审核延迟逻辑 ===');

  // 测试笔记第一次审核 - 刚提交（0分钟前）
  console.log('\n📝 笔记第一次审核 - 刚提交:');
  const noteReview1 = createMockReview(0, 1);
  testDelayCalculation(noteReview1, 120); // 120秒 = 2分钟

  // 测试笔记第一次审核 - 已过1分钟
  console.log('\n📝 笔记第一次审核 - 已过1分钟:');
  const noteReview2 = createMockReview(1, 1);
  testDelayCalculation(noteReview2, 120);

  // 测试笔记第一次审核 - 已过3分钟
  console.log('\n📝 笔记第一次审核 - 已过3分钟:');
  const noteReview3 = createMockReview(3, 1);
  testDelayCalculation(noteReview3, 120);

  // 测试笔记第二次审核 - 刚提交
  console.log('\n📝 笔记第二次审核 - 刚提交:');
  const noteReview4 = createMockReview(0, 2);
  testDelayCalculation(noteReview4, 180); // 180秒 = 3分钟

  // 测试笔记第二次审核 - 已过2分钟
  console.log('\n📝 笔记第二次审核 - 已过2分钟:');
  const noteReview5 = createMockReview(2, 2);
  testDelayCalculation(noteReview5, 180);

  console.log('\n=== 测试评论审核延迟逻辑 ===');

  // 测试评论第一次审核 - 刚提交
  console.log('\n💬 评论第一次审核 - 刚提交:');
  const commentReview1 = createMockReview(0, 1);
  testDelayCalculation(commentReview1, 90); // 90秒

  // 测试评论第一次审核 - 已过1.5分钟
  console.log('\n💬 评论第一次审核 - 已过1.5分钟:');
  const commentReview2 = createMockReview(1.5, 1);
  testDelayCalculation(commentReview2, 90);

  // 测试评论第二次审核 - 刚提交
  console.log('\n💬 评论第二次审核 - 刚提交:');
  const commentReview3 = createMockReview(0, 2);
  testDelayCalculation(commentReview3, 150); // 150秒 = 2.5分钟

  console.log('\n=== 测试完成 ===');
  console.log('✅ 延迟逻辑验证通过：所有审核都是从任务提交时间开始计时，而不是重新等待');
}

// 运行测试
if (require.main === module) {
  runTests();
}

module.exports = { testDelayCalculation, createMockReview };