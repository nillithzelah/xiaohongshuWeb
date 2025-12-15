// 检查数据库并执行数据迁移
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
    console.log('💡 请确保MongoDB服务正在运行');
    return false;
  }
}

async function checkExistingData() {
  try {
    console.log('\n📊 检查现有数据...');

    const totalCount = await ImageReview.countDocuments({});
    console.log(`📈 总记录数: ${totalCount}`);

    if (totalCount === 0) {
      console.log('ℹ️ 数据库为空，没有需要迁移的数据');
      return;
    }

    // 检查数据结构
    const sampleDoc = await ImageReview.findOne({}).lean();
    if (sampleDoc) {
      console.log('\n🔍 示例文档结构:');
      console.log('字段列表:', Object.keys(sampleDoc));

      // 检查是否已有新字段
      const hasImageUrls = sampleDoc.imageUrls && Array.isArray(sampleDoc.imageUrls);
      const hasImageUrl = typeof sampleDoc.imageUrl === 'string';

      console.log(`📋 数据格式检查:`);
      console.log(`  - imageUrls数组字段: ${hasImageUrls ? '✅ 存在' : '❌ 不存在'}`);
      console.log(`  - imageUrl单字段: ${hasImageUrl ? '✅ 存在' : '❌ 不存在'}`);

      if (hasImageUrls && hasImageUrl) {
        console.log('🔄 数据可能已部分迁移');
      } else if (hasImageUrl && !hasImageUrls) {
        console.log('📝 数据为旧格式，需要迁移');
      } else if (hasImageUrls && !hasImageUrl) {
        console.log('✅ 数据为新格式，无需迁移');
      }
    }

    // 统计各类数据
    const oldFormatCount = await ImageReview.countDocuments({
      imageUrl: { $exists: true },
      imageUrls: { $exists: false }
    });

    const newFormatCount = await ImageReview.countDocuments({
      imageUrls: { $exists: true }
    });

    const mixedFormatCount = await ImageReview.countDocuments({
      imageUrl: { $exists: true },
      imageUrls: { $exists: true }
    });

    console.log(`\n📊 数据格式统计:`);
    console.log(`  - 旧格式(单图): ${oldFormatCount} 条`);
    console.log(`  - 新格式(多图): ${newFormatCount} 条`);
    console.log(`  - 混合格式: ${mixedFormatCount} 条`);

  } catch (error) {
    console.error('❌ 检查数据失败:', error.message);
  }
}

async function runMigration() {
  try {
    console.log('\n🔄 开始数据迁移...');

    // 查找需要迁移的旧格式数据
    const oldRecords = await ImageReview.find({
      imageUrl: { $exists: true },
      $or: [
        { imageUrls: { $exists: false } },
        { imageUrls: { $size: 0 } }
      ]
    });

    console.log(`📋 找到 ${oldRecords.length} 条需要迁移的记录`);

    if (oldRecords.length === 0) {
      console.log('✅ 没有需要迁移的数据');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const record of oldRecords) {
      try {
        // 迁移数据：单图字段转为数组
        await ImageReview.findByIdAndUpdate(record._id, {
          imageUrls: [record.imageUrl],
          imageMd5s: [record.image_md5 || '']
        });

        migratedCount++;
        if (migratedCount % 10 === 0) {
          console.log(`📈 已迁移 ${migratedCount} 条记录`);
        }

      } catch (error) {
        console.error(`❌ 迁移记录 ${record._id} 失败:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ 迁移完成!`);
    console.log(`📊 成功迁移: ${migratedCount} 条`);
    console.log(`❌ 迁移失败: ${errorCount} 条`);

  } catch (error) {
    console.error('❌ 迁移过程出错:', error.message);
  }
}

async function verifyMigration() {
  try {
    console.log('\n🔍 验证迁移结果...');

    const totalCount = await ImageReview.countDocuments({});
    const newFormatCount = await ImageReview.countDocuments({
      imageUrls: { $exists: true, $ne: [] }
    });

    console.log(`📊 验证结果:`);
    console.log(`  - 总记录数: ${totalCount}`);
    console.log(`  - 新格式记录数: ${newFormatCount}`);

    if (newFormatCount === totalCount) {
      console.log('✅ 所有记录都已迁移到新格式');
    } else {
      console.log(`⚠️ 还有 ${totalCount - newFormatCount} 条记录未迁移`);
    }

    // 显示几个示例
    const samples = await ImageReview.find({})
      .select('imageUrls imageMd5s imageUrl image_md5')
      .limit(3);

    if (samples.length > 0) {
      console.log('\n📋 示例记录:');
      samples.forEach((sample, index) => {
        console.log(`  ${index + 1}. ID: ${sample._id.toString().slice(-8)}`);
        console.log(`     imageUrls: ${sample.imageUrls ? sample.imageUrls.length : 0} 张`);
        console.log(`     imageUrl(旧): ${sample.imageUrl ? '存在' : '不存在'}`);
      });
    }

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  }
}

async function main() {
  console.log('🚀 数据库检查和迁移工具\n');

  // 连接数据库
  const connected = await connectDB();
  if (!connected) {
    process.exit(1);
  }

  // 检查现有数据
  await checkExistingData();

  // 询问是否执行迁移
  console.log('\n❓ 是否执行数据迁移？(y/N): ');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async (input) => {
    const answer = input.trim().toLowerCase();

    if (answer === 'y' || answer === 'yes') {
      await runMigration();
      await verifyMigration();
    } else {
      console.log('ℹ️ 跳过迁移操作');
    }

    console.log('\n👋 操作完成');
    process.exit(0);
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { connectDB, checkExistingData, runMigration, verifyMigration };