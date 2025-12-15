// 修复单图记录，给它们添加测试图片URL
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
  console.log('✅ 数据库连接成功');
}

async function fixSingleImageRecords() {
  console.log('\n🔧 修复单图记录，添加测试图片...\n');

  // 查找所有单图记录（imageUrls数组只有一个元素且为null的记录）
  const singleImageRecords = await ImageReview.find({
    'imageUrls.0': { $exists: true },
    'imageUrls.1': { $exists: false }, // 确保只有1个元素
    imageUrls: [null] // 第一个元素是null
  });

  console.log(`找到 ${singleImageRecords.length} 条需要修复的单图记录\n`);

  if (singleImageRecords.length === 0) {
    console.log('没有找到需要修复的单图记录');
    return;
  }

  // 准备一些测试图片URL
  const testImageUrls = [
    'https://picsum.photos/400/300?random=10',
    'https://picsum.photos/400/300?random=11',
    'https://picsum.photos/400/300?random=12',
    'https://picsum.photos/400/300?random=13',
    'https://picsum.photos/400/300?random=14',
    'https://picsum.photos/400/300?random=15',
    'https://picsum.photos/400/300?random=16',
    'https://picsum.photos/400/300?random=17',
    'https://picsum.photos/400/300?random=18',
    'https://picsum.photos/400/300?random=19'
  ];

  // 为每条记录分配一个唯一的测试图片
  for (let i = 0; i < singleImageRecords.length; i++) {
    const record = singleImageRecords[i];
    const testUrl = testImageUrls[i % testImageUrls.length];
    const testMd5 = `test_md5_fixed_${record._id.toString().slice(-4)}`;

    try {
      await ImageReview.findByIdAndUpdate(record._id, {
        imageUrls: [testUrl],
        imageMd5s: [testMd5]
      });

      console.log(`✅ 记录 ${record._id.toString().slice(-8)} 修复完成`);
      console.log(`   图片URL: ${testUrl}`);
      console.log(`   MD5: ${testMd5}\n`);

    } catch (error) {
      console.error(`❌ 修复记录 ${record._id} 失败:`, error.message);
    }
  }

  console.log('📊 验证修复结果...\n');

  // 验证修复结果
  const fixedRecords = await ImageReview.find({
    'imageUrls.0': { $exists: true, $ne: null },
    'imageUrls.1': { $exists: false }
  }).select('imageUrls imageMd5s imageType status createdAt');

  console.log(`修复后单图记录数量: ${fixedRecords.length}\n`);

  fixedRecords.forEach((record, index) => {
    console.log(`📋 修复后的单图记录 ${index + 1} (ID: ${record._id.toString().slice(-8)})`);
    console.log(`  📅 创建时间: ${record.createdAt.toLocaleString('zh-CN')}`);
    console.log(`  🎯 任务类型: ${record.imageType}`);
    console.log(`  📊 状态: ${record.status}`);
    console.log(`  🖼️  图片数量: ${record.imageUrls.length}`);
    console.log(`  🔗 图片URL: ${record.imageUrls[0]}`);
    console.log(`  🔑 MD5: ${record.imageMd5s[0]}\n`);
  });

  // 最终统计
  const totalCount = await ImageReview.countDocuments({});
  const multiImageCount = await ImageReview.countDocuments({
    'imageUrls.1': { $exists: true }
  });
  const singleImageCount = await ImageReview.countDocuments({
    'imageUrls.0': { $exists: true, $ne: null },
    'imageUrls.1': { $exists: false }
  });
  const emptyRecords = await ImageReview.countDocuments({
    $or: [
      { imageUrls: { $exists: false } },
      { imageUrls: [] },
      { imageUrls: [null] }
    ]
  });

  console.log('📈 最终统计:');
  console.log(`  📊 总记录数: ${totalCount}`);
  console.log(`  🖼️  多图记录: ${multiImageCount}`);
  console.log(`  🖼️  单图记录: ${singleImageCount}`);
  console.log(`  📭 空记录: ${emptyRecords}`);
}

async function main() {
  try {
    await connectDB();
    await fixSingleImageRecords();
    console.log('✅ 单图记录修复完成');
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    process.exit(0);
  }
}

main();