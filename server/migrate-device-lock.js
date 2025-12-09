const mongoose = require('mongoose');
const Device = require('./models/Device');

// 连接数据库
async function migrateDeviceLock() {
  try {
    console.log('🔄 开始迁移设备锁定字段...');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ 数据库连接成功');

    // 为所有现有设备添加isLocked字段（默认为false）
    const result = await Device.updateMany(
      { isLocked: { $exists: false } }, // 只更新没有isLocked字段的设备
      { $set: { isLocked: false } }
    );

    console.log(`✅ 迁移完成，更新了 ${result.modifiedCount} 个设备`);

    // 断开数据库连接
    await mongoose.disconnect();
    console.log('✅ 数据库连接已断开');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

// 运行迁移
migrateDeviceLock();