const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function quickCheck() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    const userId = '6952518717cd0e4322fed437';

    // 查询最近的审核记录
    const recentReviews = await ImageReview.find({
      userId: userId
    }).select('status rejectionReason auditHistory createdAt imageType').sort({ createdAt: -1 }).limit(5);

    console.log(`📋 用户 ${userId} 最近5条审核记录:`);

    recentReviews.forEach((review, index) => {
      console.log(`\n${index + 1}. ${review.createdAt.toISOString()} - ${review.status} - ${review.imageType}`);
      if (review.rejectionReason) {
        console.log(`   拒绝原因: ${review.rejectionReason}`);
      }

      // 检查AI审核历史
      const aiComments = review.auditHistory?.filter(h => h.comment?.includes('AI') || h.comment?.includes('风控'));
      if (aiComments && aiComments.length > 0) {
        aiComments.forEach(h => {
          console.log(`   AI历史: ${h.comment}`);
        });
      }
    });

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

quickCheck();