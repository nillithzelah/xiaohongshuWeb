// 在服务器上运行，检查设备数据
const mongoose = require('mongoose');

async function checkDevices() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      serverSelectionTimeoutMS: 5000
    });
    console.log('数据库连接成功\n');

    const Device = require('./models/Device');
    const devices = await Device.find({}).select('accountName phone status');
    console.log(`总设备数: ${devices.length}`);
    console.log('\n设备列表:');
    devices.forEach((d, i) => {
      console.log(`${i+1}. accountName: "${d.accountName}" phone: "${d.phone}" status: "${d.status}"`);
    });

    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkDevices();
