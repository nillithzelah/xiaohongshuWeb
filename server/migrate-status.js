const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');

async function migrateStatus() {
  try {
    console.log('🔄 开始状态数据迁移...');

    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 迁移状态
    const migrations = [
      { from: 'cs_review', to: 'mentor_approved', description: '带教老师审核通过状态' },
      { from: 'cs_approved', to: 'mentor_approved', description: '客服审核通过状态' },
      { from: 'approved', to: 'manager_approved', description: '主管审核通过状态' }
    ];

    for (const migration of migrations) {
      const result = await ImageReview.updateMany(
        { status: migration.from },
        { $set: { status: migration.to } }
      );

      console.log(`📝 ${migration.description}: ${migration.from} → ${migration.to}, 影响 ${result.modifiedCount} 条记录`);
    }

    // 验证迁移结果
    const statusCounts = await ImageReview.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    console.log('\n📈 迁移后的状态分布:');
    statusCounts.forEach(item => {
      console.log(`  ${item._id}: ${item.count} 条`);
    });

    // 检查是否还有无效状态
    const validStatuses = ['pending', 'mentor_approved', 'manager_rejected', 'manager_approved', 'finance_processing', 'completed', 'rejected'];
    const invalidRecords = await ImageReview.find({
      status: { $nin: validStatuses }
    });

    if (invalidRecords.length > 0) {
      console.log(`❌ 仍有 ${invalidRecords.length} 条无效状态记录`);
    } else {
      console.log('✅ 所有记录状态都已迁移完成');
    }

    await mongoose.disconnect();
    console.log('🎉 状态数据迁移完成');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

migrateStatus();