// 检查最近被驳回的审核记录
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');

async function checkRejectedReviews() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 查询最近5条被驳回的记录
    const rejectedReviews = await ImageReview.find({ status: 'rejected' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'username phone')
      .select('imageType noteUrl userNoteInfo status rejectionReason aiReviewResult createdAt reviewAttempt');

    console.log(`\n📋 最近 ${rejectedReviews.length} 条驳回记录：\n`);

    rejectedReviews.forEach((review, index) => {
      console.log(`${index + 1}. ID: ${review._id}`);
      console.log(`   类型: ${review.imageType}`);
      console.log(`   链接: ${review.noteUrl}`);
      console.log(`   用户: ${review.userId?.username || '未知'}`);
      console.log(`   驳回原因: ${review.rejectionReason}`);
      console.log(`   审核尝试次数: ${review.reviewAttempt || 1}`);
      console.log(`   提交时间: ${review.createdAt.toISOString()}`);

      if (review.aiReviewResult) {
        console.log(`   AI审核结果: passed=${review.aiReviewResult.passed}, confidence=${review.aiReviewResult.confidence}`);
        if (review.aiReviewResult.reasons) {
          console.log(`   AI原因: ${review.aiReviewResult.reasons.join('; ')}`);
        }
      }

      if (review.userNoteInfo) {
        console.log(`   用户信息: ${JSON.stringify(review.userNoteInfo, null, 2)}`);
      }

      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkRejectedReviews();