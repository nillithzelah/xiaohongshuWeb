// 检查设备 accountName 字段情况
const mongoose = require('mongoose');
const Device = require('./server/models/Device');

async function checkDeviceAccountName() {
  try {
    // 连接数据库，增加超时时间
    mongoose.set('bufferCommands', false);
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000
    });
    console.log('✅ 数据库连接成功\n');

    // 1. 统计总设备数
    const total = await Device.countDocuments();
    console.log(`📊 总设备数: ${total}`);

    // 2. 统计缺失 accountName 的设备
    const missingAccountName = await Device.find({
      $or: [
        { accountName: { $exists: false } },
        { accountName: null },
        { accountName: "" }
      ]
    });
    console.log(`⚠️ 缺失 accountName 的设备数: ${missingAccountName.length}`);

    // 3. 展示缺失 accountName 的设备详情
    if (missingAccountName.length > 0) {
      console.log('\n📋 缺失 accountName 的设备详情:');
      console.log('='.repeat(80));
      missingAccountName.forEach((device, index) => {
        console.log(`${index + 1}. ID: ${device._id}`);
        console.log(`   phone: ${device.phone || '(空)'}`);
        console.log(`   accountId: ${device.accountId || '(空)'}`);
        console.log(`   accountName: '${device.accountName}'`);
        console.log(`   status: ${device.status}`);
        console.log('-'.repeat(40));
      });
    }

    // 4. 正常设备的 accountName 样例
    const normalDevices = await Device.find({
      accountName: { $exists: true, $ne: null, $ne: "" }
    }).limit(5);
    console.log('\n✅ 正常设备的 accountName 样例:');
    normalDevices.forEach(device => {
      console.log(`  - ${device.accountName} (${device._id})`);
    });

    console.log('\n检查完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    if (error.message.includes('buffering timed out')) {
      console.error('💡 数据库连接可能有问题，请检查 MongoDB 服务是否正常运行');
    }
    process.exit(1);
  }
}

checkDeviceAccountName();
