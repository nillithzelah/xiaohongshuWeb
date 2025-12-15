// 将一些单图记录更新为多图记录，用于测试多图显示功能
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
  console.log('✅ 数据库连接成功');
}

async function updateToMultiImages() {
  console.log('\n🔄 将部分记录更新为多图数据...\n');

  // 获取所有记录
  const allRecords = await ImageReview.find({}).sort({ createdAt: -1 });

  if (allRecords.length === 0) {
    console.log('❌ 没有找到记录');
    return;
  }

  // 准备一些测试图片URL（使用占位图服务）
  const testImageUrls = [
    'https://picsum.photos/400/300?random=1',
    'https://picsum.photos/400/300?random=2',
    'https://picsum.photos/400/300?random=3',
    'https://picsum.photos/400/300?random=4',
    'https://picsum.photos/400/300?random=5'
  ];

  // 为前3条记录设置多图数据
  const recordsToUpdate = allRecords.slice(0, 3);

  for (let i = 0; i < recordsToUpdate.length; i++) {
    const record = recordsToUpdate[i];
    const imageCount = Math.min(i + 2, 5); // 第1条记录2张，第2条记录3张，第3条记录4张

    const selectedUrls = testImageUrls.slice(0, imageCount);
    const selectedMd5s = selectedUrls.map((_, index) => `test_md5_multi_${record._id.toString().slice(-4)}_${index}`);

    try {
      await ImageReview.findByIdAndUpdate(record._id, {
        imageUrls: selectedUrls,
        imageMd5s: selectedMd5s
      });

      console.log(`✅ 记录 ${record._id.toString().slice(-8)} 更新为 ${imageCount} 张图片`);

    } catch (error) {
      console.error(`❌ 更新记录 ${record._id} 失败:`, error.message);
    }
  }

  console.log('\n📊 更新结果验证...\n');

  // 验证更新结果
  const updatedRecords = await ImageReview.find({
    'imageUrls.1': { $exists: true } // 至少有2张图片的记录
  }).select('imageUrls imageMd5s imageType status createdAt');

  console.log(`找到 ${updatedRecords.length} 条多图记录:\n`);

  updatedRecords.forEach((record, index) => {
    console.log(`📋 多图记录 ${index + 1} (ID: ${record._id.toString().slice(-8)})`);
    console.log(`  📅 创建时间: ${record.createdAt.toLocaleString('zh-CN')}`);
    console.log(`  🎯 任务类型: ${record.imageType}`);
    console.log(`  📊 状态: ${record.status}`);
    console.log(`  🖼️  图片数量: ${record.imageUrls.length}`);
    console.log(`  🔗 图片URLs: ${record.imageUrls.join(', ')}`);
    console.log(`  🔑 MD5s: ${record.imageMd5s.join(', ')}\n`);
  });

  // 统计信息
  const totalCount = await ImageReview.countDocuments({});
  const multiImageCount = await ImageReview.countDocuments({
    'imageUrls.1': { $exists: true }
  });
  const singleImageCount = await ImageReview.countDocuments({
    'imageUrls.0': { $exists: true },
    'imageUrls.1': { $exists: false }
  });

  console.log('📈 最终统计:');
  console.log(`  📊 总记录数: ${totalCount}`);
  console.log(`  🖼️  多图记录: ${multiImageCount}`);
  console.log(`  🖼️  单图记录: ${singleImageCount}`);
}

async function main() {
  try {
    await connectDB();
    await updateToMultiImages();
    console.log('✅ 多图数据更新完成');
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
  } finally {
    process.exit(0);
  }
}

main();