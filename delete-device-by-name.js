const mongoose = require('mongoose');

async function deleteDeviceByName(accountName) {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('🔗 数据库连接成功');

    // 查找设备
    const device = await mongoose.connection.db.collection('devices').findOne({ accountName: accountName });

    if (!device) {
      console.log(`❌ 未找到昵称为 "${accountName}" 的设备`);
      return;
    }

    console.log('📋 找到设备信息:', {
      _id: device._id,
      accountName: device.accountName,
      accountId: device.accountId,
      status: device.status,
      reviewStatus: device.reviewStatus,
      createdBy: device.createdBy
    });

    // 删除设备
    const result = await mongoose.connection.db.collection('devices').deleteOne({ _id: device._id });

    if (result.deletedCount > 0) {
      console.log(`✅ 成功删除设备 "${accountName}"`);
      console.log('🗑️ 删除的设备ID:', device._id);
    } else {
      console.log('❌ 删除失败');
    }

  } catch (error) {
    console.error('❌ 删除设备失败:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

// 从命令行参数获取设备昵称
const accountName = process.argv[2];

if (!accountName) {
  console.log('❌ 请提供设备昵称作为参数');
  console.log('📝 使用方法: node delete-device-by-name.js "设备昵称"');
  process.exit(1);
}

console.log(`🗑️ 开始删除设备，昵称: "${accountName}"`);
deleteDeviceByName(accountName);