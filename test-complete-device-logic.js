// 完整测试设备创建逻辑
const mongoose = require('mongoose');
const User = require('./server/models/User');
const Device = require('./server/models/Device');

async function testCompleteDeviceLogic() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ 数据库连接成功\n');

    // 清理测试数据
    console.log('🧹 清理旧的测试数据...');
    await User.deleteMany({ username: /^test_device_/ });
    await Device.deleteMany({ accountName: /^test_device_/ });
    console.log('✅ 测试数据清理完成\n');

    // 模拟 HR 创建线索
    console.log('👤 模拟 HR 创建线索...');
    const hrUser = await User.findOne({ role: 'hr' });
    if (!hrUser) {
      console.log('❌ 未找到 HR 用户');
      return;
    }

    const testAccounts = [
      { account: 'test_account_001', nickname: '测试昵称001' },
      { account: 'test_account_002', nickname: '测试昵称002' }
    ];

    // 1. HR 创建线索（会创建设备）
    const leadUser = new User({
      username: 'test_device_lead',
      nickname: '测试线索用户',
      phone: '13800000001',
      wechat: 'test_wechat',
      role: 'part_time',
      training_status: '已筛选',
      hr_id: hrUser._id,
      xiaohongshuAccounts: testAccounts.map(account => ({
        account: account.account,
        nickname: account.nickname,
        status: 'pending'
      }))
    });

    // 模拟 HR 创建设备逻辑
    const devices = [];
    for (const account of testAccounts) {
      const existingDevice = await Device.findOne({ accountName: account.nickname.trim() });
      if (existingDevice) {
        console.log(`🔄 HR: 设备已存在 ${account.nickname} -> ${existingDevice._id}`);
        devices.push(existingDevice._id);
      } else {
        const device = new Device({
          accountName: account.nickname.trim(),
          accountId: account.account.trim(),
          assignedUser: null,
          status: 'online',
          influence: ['new'],
          createdBy: hrUser._id
        });
        await device.save();
        console.log(`🆕 HR: 创建设备 ${account.nickname} -> ${device._id}`);
        devices.push(device._id);
      }
    }

    // 保存线索用户
    leadUser.xiaohongshuAccounts = leadUser.xiaohongshuAccounts.map((account, index) => ({
      ...account,
      deviceId: devices[index]
    }));
    await leadUser.save();
    console.log(`✅ HR 创建线索完成: ${leadUser._id}\n`);

    // 2. 主管分配带教老师（应该复用设备）
    console.log('👨‍🏫 模拟主管分配带教老师...');
    const mentorUser = await User.findOne({ role: 'mentor' });
    if (!mentorUser) {
      console.log('❌ 未找到带教老师');
      return;
    }

    const managerUser = await User.findOne({ role: 'manager' });
    if (!managerUser) {
      console.log('❌ 未找到主管用户');
      return;
    }

    // 模拟分配逻辑
    leadUser.mentor_id = mentorUser._id;
    leadUser.assigned_to_mentor_at = new Date();
    leadUser.training_status = '培训中';

    let updatedCount = 0;
    let createdCount = 0;

    for (let i = 0; i < leadUser.xiaohongshuAccounts.length; i++) {
      const account = leadUser.xiaohongshuAccounts[i];

      if (account.deviceId) {
        // 应该走这个分支：复用现有设备
        await Device.findByIdAndUpdate(account.deviceId, {
          assignedUser: leadUser._id,
          mentor_id: mentorUser._id,
          updatedAt: new Date()
        });
        console.log(`✅ 主管: 复用设备 ${account.deviceId} (${account.nickname})`);
        updatedCount++;
      } else {
        // 不应该走这个分支
        const existingDevice = await Device.findOne({ accountName: account.nickname.trim() });
        if (existingDevice) {
          await Device.findByIdAndUpdate(existingDevice._id, {
            assignedUser: leadUser._id,
            mentor_id: mentorUser._id,
            updatedAt: new Date()
          });
          leadUser.xiaohongshuAccounts[i].deviceId = existingDevice._id;
          console.log(`🔄 主管: 查找并更新设备 ${existingDevice._id} (${account.nickname})`);
          updatedCount++;
        } else {
          const device = new Device({
            accountName: account.nickname.trim(),
            accountId: account.account.trim(),
            assignedUser: leadUser._id,
            mentor_id: mentorUser._id,
            status: 'online',
            influence: ['new'],
            createdBy: managerUser._id
          });
          await device.save();
          leadUser.xiaohongshuAccounts[i].deviceId = device._id;
          console.log(`🆕 主管: 创建设备 ${device._id} (${account.nickname})`);
          createdCount++;
        }
      }

      leadUser.xiaohongshuAccounts[i].status = 'assigned';
    }

    leadUser.markModified('xiaohongshuAccounts');
    await leadUser.save();

    console.log(`\n📊 分配结果:`);
    console.log(`   更新设备: ${updatedCount}`);
    console.log(`   创建设备: ${createdCount}`);

    // 3. 验证最终结果
    console.log('\n🔍 验证最终结果...');
    const finalDevices = await Device.find({ accountName: /^测试昵称/ });
    console.log(`总设备数: ${finalDevices.length}`);

    finalDevices.forEach(device => {
      console.log(`  - ${device.accountName} (${device._id})`);
      console.log(`    assignedUser: ${device.assignedUser}`);
      console.log(`    mentor_id: ${device.mentor_id}`);
    });

    if (createdCount === 0 && updatedCount === testAccounts.length) {
      console.log('\n✅ 测试通过：设备创建逻辑正确，无重复创建！');
    } else {
      console.log('\n❌ 测试失败：存在重复创建设备的问题');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  }
}

testCompleteDeviceLogic();