// 检查迁移后的数据详情
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
  console.log('✅ 数据库连接成功');
}

async function checkMigratedData() {
  console.log('\n📊 检查迁移后的数据详情...\n');

  const records = await ImageReview.find({})
    .select('imageUrls imageMd5s imageUrl image_md5 imageType status createdAt')
    .sort({ createdAt: -1 })
    .limit(5);

  records.forEach((record, index) => {
    console.log(`📋 记录 ${index + 1} (ID: ${record._id.toString().slice(-8)})`);
    console.log(`  📅 创建时间: ${record.createdAt}`);
    console.log(`  🎯 任务类型: ${record.imageType}`);
    console.log(`  📊 状态: ${record.status}`);

    console.log(`  🖼️  新格式 - imageUrls: ${record.imageUrls?.length || 0} 张`);
    if (record.imageUrls && record.imageUrls.length > 0) {
      record.imageUrls.forEach((url, i) => {
        console.log(`    ${i + 1}. ${url?.slice(-30) || '空'}`);
      });
    }

    console.log(`  🔒 新格式 - imageMd5s: ${record.imageMd5s?.length || 0} 个`);
    if (record.imageMd5s && record.imageMd5s.length > 0) {
      record.imageMd5s.forEach((md5, i) => {
        console.log(`    ${i + 1}. ${md5?.slice(0, 16) || '空'}...`);
      });
    }

    console.log(`  📝 旧格式 - imageUrl: ${record.imageUrl ? record.imageUrl.slice(-30) : '不存在'}`);
    console.log(`  🔑 旧格式 - image_md5: ${record.image_md5 ? record.image_md5.slice(0, 16) + '...' : '不存在'}`);

    console.log(''); // 空行分隔
  });

  // 统计信息
  const totalCount = await ImageReview.countDocuments({});
  const withImagesCount = await ImageReview.countDocuments({
    'imageUrls.0': { $exists: true, $ne: '' }
  });

  console.log('📈 统计信息:');
  console.log(`  📊 总记录数: ${totalCount}`);
  console.log(`  🖼️  有图片的记录: ${withImagesCount}`);
  console.log(`  📭  无图片的记录: ${totalCount - withImagesCount}`);
}

async function main() {
  try {
    await connectDB();
    await checkMigratedData();
    console.log('✅ 数据检查完成');
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    process.exit(0);
  }
}

main();