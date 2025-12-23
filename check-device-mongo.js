// 使用 MongoDB 原生驱动检查设备数据
const { MongoClient } = require('mongodb');

async function checkDevices() {
  const uri = 'mongodb://127.0.0.1:27017';
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    console.log('✅ MongoDB 连接成功\n');

    const db = client.db('xiaohongshu_audit');
    const devices = db.collection('devices');

    // 1. 统计总设备数
    const total = await devices.countDocuments();
    console.log(`📊 总设备数: ${total}`);

    // 2. 查找缺失 accountName 的设备
    const missingDevices = await devices.find({
      $or: [
        { accountName: { $exists: false } },
        { accountName: null },
        { accountName: "" }
      ]
    }).toArray();
    console.log(`⚠️ 缺失 accountName 的设备数: ${missingDevices.length}`);

    // 3. 展示缺失 accountName 的设备详情
    if (missingDevices.length > 0) {
      console.log('\n📋 缺失 accountName 的设备:');
      missingDevices.forEach((device, index) => {
        console.log(`${index + 1}. _id: ${device._id}`);
        console.log(`   phone: ${device.phone || '(空)'}`);
        console.log(`   accountId: ${device.accountId || '(空)'}`);
        console.log(`   accountName: '${device.accountName}'`);
        console.log(`   status: ${device.status}`);
        console.log('-'.repeat(40));
      });
    }

    // 4. 正常设备的 accountName 样例
    const normalDevices = await devices.find({
      accountName: { $exists: true, $ne: null, $ne: "" }
    }).limit(5).toArray();
    console.log('\n✅ 正常设备的 accountName 样例:');
    normalDevices.forEach(device => {
      console.log(`  - ${device.accountName} (${device._id})`);
    });

    console.log('\n✅ 检查完成');
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await client.close();
  }
}

checkDevices();
