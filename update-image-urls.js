const mongoose = require('mongoose');
const ImageReview = require('../models/ImageReview');

async function updateImageUrls() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    // 更新所有图片URL为本地picsum.photos地址
    const result = await ImageReview.updateMany(
      {},
      { $set: { imageUrl: 'https://picsum.photos/200/300' } }
    );

    console.log(`✅ 更新完成: 修改了 ${result.modifiedCount} 条记录`);

    // 查看更新后的数据
    const updatedReviews = await ImageReview.find({}).select('imageUrl');
    console.log('\n📊 更新后的图片URL:');
    updatedReviews.forEach(review => {
      console.log(`- ${review.imageUrl}`);
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

updateImageUrls();