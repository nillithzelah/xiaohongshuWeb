// 测试设备字段一致性问题是否已修复
const mongoose = require('mongoose');
const User = require('./server/models/User');
const Device = require('./server/models/Device');

async function testDeviceFieldConsistency() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ 数据库连接成功\n');

    // 查找一个有小红书账号的兼职用户
    const testUser = await User.findOne({
      role: 'part_time',
      xiaohongshuAccounts: { $exists: true, $ne: [] }
    }).sort({ createdAt: -1 });

    if (!testUser) {
      console.log('❌ 未找到合适的测试用户');
      return;
    }

    console.log('📋 测试用户:', {
      id: testUser._id,
      nickname: testUser.nickname,
      accountsCount: testUser.xiaohongshuAccounts.length
    });

    // 检查每个账号的设备信息
    for (let i = 0; i < testUser.xiaohongshuAccounts.length; i++) {
      const account = testUser.xiaohongshuAccounts[i];
      console.log(`\n🔍 账号 ${i + 1}:`);
      console.log(`   account: "${account.account}"`);
      console.log(`   nickname: "${account.nickname}"`);
      console.log(`   deviceId: ${account.deviceId || '无'}`);

      if (account.deviceId) {
        const device = await Device.findById(account.deviceId);
        if (device) {
          console.log(`   设备 accountName: "${device.accountName}"`);
          console.log(`   设备 accountId: "${device.accountId}"`);

          // 检查字段一致性
          const accountNameMatches = device.accountName === account.nickname.trim();
          const accountIdMatches = device.accountId === account.account.trim();

          console.log(`   ✅ accountName 匹配: ${accountNameMatches}`);
          console.log(`   ✅ accountId 匹配: ${accountIdMatches}`);

          if (!accountNameMatches) {
            console.log(`   ❌ 字段不一致！期望 accountName: "${account.nickname.trim()}", 实际: "${device.accountName}"`);
          }
          if (!accountIdMatches) {
            console.log(`   ❌ 字段不一致！期望 accountId: "${account.account.trim()}", 实际: "${device.accountId}"`);
          }
        } else {
          console.log(`   ❌ 设备不存在: ${account.deviceId}`);
        }
      } else {
        console.log(`   ⚠️  没有关联设备`);
      }
    }

    // 统计设备总数
    const totalDevices = await Device.countDocuments();
    console.log(`\n📊 数据库总设备数: ${totalDevices}`);

    // 检查是否有重复的 accountName
    const devices = await Device.find({}, { accountName: 1, accountId: 1 });
    const accountNameMap = new Map();

    devices.forEach(device => {
      if (accountNameMap.has(device.accountName)) {
        console.log(`❌ 发现重复 accountName: "${device.accountName}"`);
      } else {
        accountNameMap.set(device.accountName, device._id);
      }
    });

    console.log(`\n✅ 字段一致性检查完成`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testDeviceFieldConsistency();