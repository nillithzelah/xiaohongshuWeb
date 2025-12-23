// 测试远程数据库连接
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('🔗 正在连接远程数据库...');
    await mongoose.connect('mongodb://112.74.163.102:27017/xiaohongshu_audit', {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ 远程数据库连接成功');

    // 测试查询
    const Device = mongoose.model('Device', new mongoose.Schema({}, { strict: false }), 'devices');
    const count = await Device.countDocuments();
    console.log(`📊 设备数量: ${count}`);

    const devices = await Device.find({}).limit(3);
    console.log('📋 前3个设备:');
    devices.forEach((d, i) => {
      console.log(`  ${i+1}. ${d.accountName || '无昵称'} (${d.phone || '无电话'})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    process.exit(1);
  }
}

testConnection();
