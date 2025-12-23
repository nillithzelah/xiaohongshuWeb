const mongoose = require('mongoose');

async function checkDevices() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    const devices = await mongoose.connection.db.collection('devices').find({}).toArray();
    console.log(`📱 设备总数: ${devices.length}`);

    for (const device of devices) {
      console.log(`  - ${device.accountName} (ID: ${device._id})`);
      console.log(`    分配用户ID: ${device.assignedUser}`);
      console.log(`    状态: ${device.status}`);
      console.log(`    影响力: ${device.influence}`);

      // 查找对应的用户信息
      if (device.assignedUser) {
        const user = await mongoose.connection.db.collection('users').findOne({
          _id: new mongoose.Types.ObjectId(device.assignedUser)
        });
        if (user) {
          console.log(`    👤 用户名: ${user.username}`);
          console.log(`    📧 角色: ${user.role}`);
        } else {
          console.log(`    ❌ 用户不存在`);
        }
      }
      console.log('');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

checkDevices();