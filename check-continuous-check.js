const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function checkContinuousCheck() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('Connected to database');

    // 检查启用了持续检查的记录
    const enabledReviews = await ImageReview.find({
      'continuousCheck.enabled': true
    });

    console.log(`📋 启用了持续检查的记录总数: ${enabledReviews.length}`);
    enabledReviews.forEach(review => {
      console.log(`  - ID: ${review._id}`);
      console.log(`    用户ID: ${review.userId}`);
      console.log(`    笔记URL: ${review.noteUrl}`);
      console.log(`    状态: ${review.status}`);
      console.log(`    持续检查状态: ${review.continuousCheck.status}`);
      console.log(`    下次检查时间: ${review.continuousCheck.nextCheckTime}`);
      console.log(`    最后检查时间: ${review.continuousCheck.lastCheckTime}`);
      console.log(`    检查历史长度: ${review.continuousCheck.checkHistory.length}`);
      console.log('');
    });

    // 检查活跃的持续检查记录
    const activeReviews = await ImageReview.find({
      'continuousCheck.enabled': true,
      'continuousCheck.status': 'active'
    });

    console.log(`📋 活跃的持续检查记录总数: ${activeReviews.length}`);

    // 检查应该被检查的记录（nextCheckTime <= now）
    const now = new Date();
    const dueReviews = await ImageReview.find({
      'continuousCheck.enabled': true,
      'continuousCheck.status': 'active',
      'continuousCheck.nextCheckTime': { $lte: now },
      imageType: 'note',
      noteUrl: { $ne: null },
      status: 'completed'
    });

    console.log(`📋 到期需要检查的记录总数: ${dueReviews.length}`);
    dueReviews.forEach(review => {
      console.log(`  - ID: ${review._id}, 下次检查时间: ${review.continuousCheck.nextCheckTime}`);
    });

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkContinuousCheck();