// 查找包含图片URL的记录
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
  console.log('✅ 数据库连接成功');
}

async function findRecordsWithImages() {
  console.log('\n🔍 查找包含图片的记录...\n');

  // 查找新格式中有实际URL的记录
  const recordsWithUrls = await ImageReview.find({
    imageUrls: {
      $exists: true,
      $ne: [],
      $not: { $size: 0 }
    }
  }).select('imageUrls imageMd5s imageType status createdAt');

  console.log(`📊 找到 ${recordsWithUrls.length} 条包含图片URL的记录\n`);

  if (recordsWithUrls.length > 0) {
    recordsWithUrls.forEach((record, index) => {
      console.log(`📋 记录 ${index + 1} (ID: ${record._id.toString().slice(-8)})`);
      console.log(`  📅 创建时间: ${record.createdAt}`);
      console.log(`  🎯 任务类型: ${record.imageType}`);
      console.log(`  📊 状态: ${record.status}`);
      console.log(`  🖼️  图片数量: ${record.imageUrls.length}`);

      record.imageUrls.forEach((url, i) => {
        if (url && url.trim()) {
          console.log(`    ${i + 1}. ${url}`);
        } else {
          console.log(`    ${i + 1}. [空URL]`);
        }
      });

      console.log('');
    });
  }

  // 查找可能还有旧格式数据的记录
  const recordsWithOldFormat = await ImageReview.find({
    imageUrl: { $exists: true, $ne: '' }
  }).select('imageUrl image_md5 imageType status createdAt');

  console.log(`📊 找到 ${recordsWithOldFormat.length} 条旧格式记录\n`);

  if (recordsWithOldFormat.length > 0) {
    recordsWithOldFormat.forEach((record, index) => {
      console.log(`📋 旧记录 ${index + 1} (ID: ${record._id.toString().slice(-8)})`);
      console.log(`  📅 创建时间: ${record.createdAt}`);
      console.log(`  🎯 任务类型: ${record.imageType}`);
      console.log(`  📊 状态: ${record.status}`);
      console.log(`  🖼️  图片URL: ${record.imageUrl}`);
      console.log(`  🔑 MD5: ${record.image_md5?.slice(0, 16) || '无'}`);
      console.log('');
    });
  }

  // 检查所有记录的imageUrls数组内容
  console.log('🔍 检查所有记录的imageUrls数组内容:');
  const allRecords = await ImageReview.find({}).select('imageUrls');

  let emptyArrays = 0;
  let withValidUrls = 0;
  let withEmptyStrings = 0;

  allRecords.forEach(record => {
    if (!record.imageUrls || record.imageUrls.length === 0) {
      emptyArrays++;
    } else {
      const hasValidUrl = record.imageUrls.some(url => url && url.trim());
      if (hasValidUrl) {
        withValidUrls++;
      } else {
        withEmptyStrings++;
      }
    }
  });

  console.log(`  📊 空数组: ${emptyArrays} 条`);
  console.log(`  ✅ 有有效URL: ${withValidUrls} 条`);
  console.log(`  📝 只有空字符串: ${withEmptyStrings} 条`);
}

async function main() {
  try {
    await connectDB();
    await findRecordsWithImages();
    console.log('✅ 查找完成');
  } catch (error) {
    console.error('❌ 查找失败:', error.message);
  } finally {
    process.exit(0);
  }
}

main();