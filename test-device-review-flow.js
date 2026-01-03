const mongoose = require('mongoose');
const Device = require('./server/models/Device');
const User = require('./server/models/User');
require('dotenv').config();

// 测试设备账号创建和人工拒绝流程
async function testDeviceReviewFlow() {
  try {
    console.log('🔍 开始测试设备账号创建和人工拒绝流程...\n');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功\n');

    // 1. 创建测试用户（如果不存在）
    console.log('👤 步骤1: 检查/创建测试用户');
    let testUser = await User.findOne({ username: 'test_device_user' });
    if (!testUser) {
      testUser = new User({
        username: 'test_device_user',
        nickname: '测试设备用户',
        password: 'hashed_password', // 实际应该是哈希后的密码
        role: 'part_time'
      });
      await testUser.save();
      console.log('✅ 创建测试用户成功:', testUser._id);
    } else {
      console.log('✅ 使用现有测试用户:', testUser._id);
    }

    // 2. 创建测试设备
    console.log('\n📱 步骤2: 创建测试设备');
    const testDeviceData = {
      accountName: `test_device_${Date.now()}`,
      accountId: '1234567890',
      accountUrl: 'https://www.xiaohongshu.com/user/profile/test123',
      reviewImage: 'https://example.com/review-image.jpg',
      assignedUser: testUser._id,
      createdBy: testUser._id,
      status: 'reviewing',
      reviewStatus: 'pending'
    };

    const device = new Device(testDeviceData);
    await device.save();
    console.log('✅ 创建测试设备成功:', {
      id: device._id,
      accountName: device.accountName,
      reviewStatus: device.reviewStatus
    });

    // 3. 模拟AI预审核
    console.log('\n🤖 步骤3: 模拟AI预审核');
    const aiReviewResult = {
      passed: false, // 故意设置为失败，测试人工审核流程
      reason: '测试人工审核流程'
    };

    if (aiReviewResult.passed) {
      await Device.findByIdAndUpdate(device._id, { reviewStatus: 'ai_approved' });
      console.log('✅ AI预审核通过，状态更新为ai_approved');
    } else {
      console.log('❌ AI预审核失败:', aiReviewResult.reason);
      console.log('📋 设备保持pending状态，等待人工审核');
    }

    // 4. 模拟人工拒绝
    console.log('\n👨‍💼 步骤4: 模拟人工拒绝');
    const adminUser = await User.findOne({ role: 'boss' });
    if (!adminUser) {
      console.log('❌ 未找到管理员用户，无法测试人工审核');
      return;
    }

    const rejectReason = '测试人工拒绝：账号信息不完整';
    const updatedDevice = await Device.findByIdAndUpdate(
      device._id,
      {
        reviewStatus: 'rejected',
        reviewReason: rejectReason,
        reviewedBy: adminUser._id,
        reviewedAt: new Date(),
        assignedUser: null, // 解除分配
        status: 'offline'
      },
      { new: true }
    ).populate('reviewedBy', 'username');

    console.log('✅ 人工审核拒绝完成:', {
      id: updatedDevice._id,
      reviewStatus: updatedDevice.reviewStatus,
      reviewReason: updatedDevice.reviewReason,
      reviewedBy: updatedDevice.reviewedBy?.username,
      assignedUser: updatedDevice.assignedUser, // 应该为null
      status: updatedDevice.status // 应该为offline
    });

    // 5. 验证最终状态
    console.log('\n🔍 步骤5: 验证最终状态');
    const finalDevice = await Device.findById(device._id)
      .populate('assignedUser', 'username')
      .populate('reviewedBy', 'username')
      .populate('createdBy', 'username');

    console.log('📋 最终设备状态:');
    console.log('  - 设备ID:', finalDevice._id);
    console.log('  - 账号名:', finalDevice.accountName);
    console.log('  - 审核状态:', finalDevice.reviewStatus);
    console.log('  - 审核原因:', finalDevice.reviewReason);
    console.log('  - 审核人:', finalDevice.reviewedBy?.username);
    console.log('  - 分配用户:', finalDevice.assignedUser?.username || '未分配');
    console.log('  - 设备状态:', finalDevice.status);
    console.log('  - 创建人:', finalDevice.createdBy?.username);

    // 6. 验证流程正确性
    console.log('\n✅ 步骤6: 验证流程正确性');
    const checks = [
      { name: '审核状态为rejected', pass: finalDevice.reviewStatus === 'rejected' },
      { name: '审核原因正确', pass: finalDevice.reviewReason === rejectReason },
      { name: '分配用户已解除', pass: finalDevice.assignedUser === null },
      { name: '设备状态为offline', pass: finalDevice.status === 'offline' },
      { name: '审核人正确', pass: finalDevice.reviewedBy?.username === adminUser.username },
      { name: '审核时间已设置', pass: finalDevice.reviewedAt !== null }
    ];

    checks.forEach(check => {
      console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
    });

    const allPassed = checks.every(check => check.pass);
    console.log(`\n🎯 测试结果: ${allPassed ? '全部通过' : '部分失败'}`);

    // 7. 清理测试数据
    console.log('\n🧹 步骤7: 清理测试数据');
    await Device.findByIdAndDelete(device._id);
    console.log('✅ 测试设备已删除');

    // 可选：删除测试用户（如果需要）
    // await User.findByIdAndDelete(testUser._id);
    // console.log('✅ 测试用户已删除');

    console.log('\n🎉 设备账号创建人工拒绝流程测试完成!');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', {
      message: error.message,
      stack: error.stack
    });
  } finally {
    await mongoose.disconnect();
    console.log('📪 数据库连接已关闭');
  }
}

// 运行测试
if (require.main === module) {
  testDeviceReviewFlow();
}

module.exports = { testDeviceReviewFlow };