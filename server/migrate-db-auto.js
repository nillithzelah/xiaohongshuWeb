// 自动执行数据迁移（非交互式）
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}

async function checkData() {
  console.log('\n📊 检查现有数据...');

  const totalCount = await ImageReview.countDocuments({});
  console.log(`📈 总记录数: ${totalCount}`);

  const oldFormatCount = await ImageReview.countDocuments({
    imageUrl: { $exists: true },
    imageUrls: { $exists: false }
  });

  console.log(`📝 旧格式记录: ${oldFormatCount} 条`);

  return { totalCount, oldFormatCount };
}

async function migrateData() {
  console.log('\n🔄 执行数据迁移...');

  const oldRecords = await ImageReview.find({
    imageUrl: { $exists: true },
    $or: [
      { imageUrls: { $exists: false } },
      { imageUrls: { $size: 0 } }
    ]
  });

  console.log(`📋 找到 ${oldRecords.length} 条需要迁移的记录`);

  let migratedCount = 0;
  let errorCount = 0;

  for (const record of oldRecords) {
    try {
      // 显示迁移进度
      console.log(`  迁移记录 ${record._id.toString().slice(-8)}: ${record.imageUrl?.slice(-20)}`);

      await ImageReview.findByIdAndUpdate(record._id, {
        imageUrls: [record.imageUrl],
        imageMd5s: [record.image_md5 || '']
      });

      migratedCount++;

    } catch (error) {
      console.error(`❌ 迁移记录 ${record._id} 失败:`, error.message);
      errorCount++;
    }
  }

  return { migratedCount, errorCount };
}

async function verifyMigration() {
  console.log('\n🔍 验证迁移结果...');

  const totalCount = await ImageReview.countDocuments({});
  const newFormatCount = await ImageReview.countDocuments({
    imageUrls: { $exists: true, $ne: [] }
  });

  console.log(`📊 迁移结果:`);
  console.log(`  - 总记录数: ${totalCount}`);
  console.log(`  - 新格式记录数: ${newFormatCount}`);

  // 显示几个迁移后的示例
  const samples = await ImageReview.find({})
    .select('imageUrls imageMd5s imageUrl')
    .limit(3);

  console.log('\n📋 迁移后示例:');
  samples.forEach((sample, index) => {
    console.log(`  ${index + 1}. ID: ${sample._id.toString().slice(-8)}`);
    console.log(`     imageUrls: [${sample.imageUrls?.join(', ') || '空'}]`);
    console.log(`     imageUrl(旧): ${sample.imageUrl || '已清理'}`);
  });

  return newFormatCount === totalCount;
}

async function main() {
  console.log('🚀 自动数据迁移工具\n');

  // 连接数据库
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }

  // 检查数据
  const { totalCount, oldFormatCount } = await checkData();

  if (oldFormatCount === 0) {
    console.log('✅ 没有需要迁移的数据');
    process.exit(0);
  }

  // 执行迁移
  const { migratedCount, errorCount } = await migrateData();

  // 验证结果
  const success = await verifyMigration();

  console.log(`\n🏁 迁移完成!`);
  console.log(`📊 成功迁移: ${migratedCount} 条`);
  console.log(`❌ 迁移失败: ${errorCount} 条`);
  console.log(`✅ 验证结果: ${success ? '通过' : '失败'}`);

  if (success) {
    console.log('\n🎉 数据迁移成功！现在可以使用多图功能了');
  } else {
    console.log('\n⚠️ 迁移可能有问题，请检查数据库');
  }

  process.exit(success ? 0 : 1);
}

main();