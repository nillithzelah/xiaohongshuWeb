// 简单检查被驳回的记录
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    const rejectedReviews = await ImageReview.find({ status: 'rejected' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('imageType noteUrl rejectionReason createdAt userId');

    console.log(`\n📋 最近 ${rejectedReviews.length} 条驳回记录：\n`);

    rejectedReviews.forEach((review, index) => {
      console.log(`${index + 1}. ID: ${review._id.toString().slice(-8)}`);
      console.log(`   类型: ${review.imageType}`);
      console.log(`   驳回原因: ${review.rejectionReason}`);
      console.log(`   链接: ${review.noteUrl}`);
      console.log(`   时间: ${review.createdAt.toISOString()}`);
      console.log('   ---');
    });

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    process.exit(0);
  }
}

main();