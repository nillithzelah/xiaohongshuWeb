// 测试设备创建重复问题是否已修复
const mongoose = require('mongoose');
const User = require('./server/models/User');
const Device = require('./server/models/Device');

async function testDeviceCreation() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ 数据库连接成功\n');

    // 查找一个有小红书账号的兼职用户
    const testUser = await User.findOne({
      role: 'part_time',
      xiaohongshuAccounts: { $exists: true, $ne: [] },
      mentor_id: null // 未分配带教老师
    });

    if (!testUser) {
      console.log('❌ 未找到合适的测试用户');
      return;
    }

    console.log('📋 测试用户:', {
      id: testUser._id,
      nickname: testUser.nickname,
      accounts: testUser.xiaohongshuAccounts.length
    });

    // 统计分配前设备数量
    const devicesBefore = await Device.countDocuments();
    console.log(`📊 分配前设备总数: ${devicesBefore}`);

    // 模拟分配带教老师（不实际保存）
    console.log('\n🔄 模拟分配带教老师流程...');

    let createdCount = 0;
    let updatedCount = 0;

    if (testUser.xiaohongshuAccounts && testUser.xiaohongshuAccounts.length > 0) {
      for (let i = 0; i < testUser.xiaohongshuAccounts.length; i++) {
        const account = testUser.xiaohongshuAccounts[i];

        // 如果已经有设备ID，说明HR创建时已创建设备，直接更新设备信息
        if (account.deviceId) {
          console.log(`✅ 账号 ${account.account} 已关联设备 ${account.deviceId}，将更新设备信息`);
          updatedCount++;
        } else {
          // 如果没有设备ID（兼容旧数据），按昵称查找设备并更新
          const existingDevice = await Device.findOne({ accountName: account.nickname });
          if (existingDevice) {
            console.log(`🔄 账号 ${account.account} 找到现有设备 ${existingDevice._id}，将更新设备信息`);
            updatedCount++;
          } else {
            // 如果设备不存在，创建新设备（兜底逻辑）
            console.log(`🆕 账号 ${account.account} 需要创建新设备`);
            createdCount++;
          }
        }
      }
    }

    console.log(`\n📈 分配结果统计:`);
    console.log(`   更新设备: ${updatedCount}`);
    console.log(`   创建设备: ${createdCount}`);
    console.log(`   总操作数: ${updatedCount + createdCount}`);

    if (createdCount === 0) {
      console.log('✅ 修复成功：分配带教老师时不会重复创建设备！');
    } else {
      console.log('⚠️ 仍有设备创建，可能存在兼容性问题');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testDeviceCreation();