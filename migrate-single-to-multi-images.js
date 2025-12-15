// 数据迁移脚本：将单图存储迁移到多图数组存储
const mongoose = require('mongoose');
require('dotenv').config();

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 临时模型：用于读取旧格式数据
const oldImageReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: { type: String, required: true }, // 旧字段
  imageType: { type: String, enum: ['customer_resource', 'note', 'comment'], required: true },
  image_md5: { type: String, required: true }, // 旧字段
  // ... 其他字段保持不变
}, { collection: 'imagereviews' });

const OldImageReview = mongoose.model('OldImageReview', oldImageReviewSchema);

// 新模型：多图格式
const ImageReview = require('./server/models/ImageReview');

async function migrateData() {
  try {
    console.log('🔄 开始数据迁移...');

    // 获取所有旧格式记录
    const oldRecords = await OldImageReview.find({});
    console.log(`📊 找到 ${oldRecords.length} 条旧记录`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const oldRecord of oldRecords) {
      try {
        // 检查是否已经迁移过（新格式有 imageUrls 字段）
        const existingNewRecord = await ImageReview.findById(oldRecord._id);
        if (existingNewRecord && existingNewRecord.imageUrls) {
          console.log(`⏭️ 记录 ${oldRecord._id} 已迁移，跳过`);
          skippedCount++;
          continue;
        }

        // 创建新格式记录
        const newRecord = {
          _id: oldRecord._id,
          userId: oldRecord.userId,
          imageUrls: [oldRecord.imageUrl], // 单图转为数组
          imageType: oldRecord.imageType,
          imageMd5s: [oldRecord.image_md5], // 单MD5转为数组
          snapshotPrice: oldRecord.snapshotPrice,
          snapshotCommission1: oldRecord.snapshotCommission1,
          snapshotCommission2: oldRecord.snapshotCommission2,
          status: oldRecord.status,
          mentorReview: oldRecord.mentorReview,
          managerApproval: oldRecord.managerApproval,
          financeProcess: oldRecord.financeProcess,
          rejectionReason: oldRecord.rejectionReason,
          deviceInfo: oldRecord.deviceInfo,
          auditHistory: oldRecord.auditHistory,
          createdAt: oldRecord.createdAt
        };

        // 使用 upsert 更新或插入
        await ImageReview.findByIdAndUpdate(
          oldRecord._id,
          newRecord,
          { upsert: true, new: true }
        );

        migratedCount++;
        if (migratedCount % 100 === 0) {
          console.log(`📈 已迁移 ${migratedCount} 条记录`);
        }

      } catch (recordError) {
        console.error(`❌ 迁移记录 ${oldRecord._id} 失败:`, recordError.message);
      }
    }

    console.log(`\n✅ 迁移完成！`);
    console.log(`📊 成功迁移: ${migratedCount} 条`);
    console.log(`⏭️ 跳过已迁移: ${skippedCount} 条`);

    // 验证迁移结果
    const totalNewRecords = await ImageReview.countDocuments({});
    const multiImageRecords = await ImageReview.countDocuments({ 'imageUrls.1': { $exists: true } }); // 有多图的记录

    console.log(`\n🔍 验证结果:`);
    console.log(`📊 新格式总记录数: ${totalNewRecords}`);
    console.log(`📊 多图记录数: ${multiImageRecords}`);
    console.log(`📊 单图记录数: ${totalNewRecords - multiImageRecords}`);

  } catch (error) {
    console.error('❌ 迁移过程出错:', error);
  }
}

async function main() {
  console.log('🚀 开始单图到多图数据迁移\n');

  await connectDB();
  await migrateData();

  console.log('\n👋 迁移脚本执行完毕');
  process.exit(0);
}

// 运行迁移
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { migrateData };