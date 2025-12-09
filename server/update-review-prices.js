const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');

async function updateReviewPrices() {
  try {
    await mongoose.connect('mongodb://localhost:27017/xiaohongshu');

    console.log('🔄 开始更新审核记录价格...');

    // 定义价格映射
    const priceMap = {
      'login_qr': 5.00,
      'note': 8.00,
      'comment': 3.00
    };

    // 查找所有没有snapshotPrice的记录
    const reviewsWithoutPrice = await ImageReview.find({
      $or: [
        { snapshotPrice: { $exists: false } },
        { snapshotPrice: null }
      ]
    });

    console.log(`📊 找到 ${reviewsWithoutPrice.length} 条需要更新的记录`);

    let updatedCount = 0;
    for (const review of reviewsWithoutPrice) {
      const price = priceMap[review.imageType] || 0;
      review.snapshotPrice = price;
      await review.save();
      updatedCount++;
    }

    console.log(`✅ 成功更新 ${updatedCount} 条记录的价格`);

    // 验证更新结果
    const totalReviews = await ImageReview.countDocuments();
    const reviewsWithPrice = await ImageReview.countDocuments({
      snapshotPrice: { $exists: true, $ne: null }
    });

    console.log(`📈 更新统计:`);
    console.log(`  总记录数: ${totalReviews}`);
    console.log(`  有价格记录: ${reviewsWithPrice}`);
    console.log(`  更新成功率: ${((reviewsWithPrice / totalReviews) * 100).toFixed(1)}%`);

    // 显示几个示例
    const sampleReviews = await ImageReview.find().limit(3);
    console.log('\n💰 价格示例:');
    sampleReviews.forEach(review => {
      console.log(`  ${review.imageType}: ¥${review.snapshotPrice}`);
    });

  } catch (error) {
    console.error('❌ 更新价格失败:', error);
  } finally {
    await mongoose.connection.close();
  }
}

updateReviewPrices();