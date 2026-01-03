const mongoose = require('mongoose');
const Device = require('./models/Device');
const TimeUtils = require('./utils/timeUtils');

async function testCreateDevice() {
  try {
    console.log('=== 测试创建设备时间存储 ===\n');

    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 获取当前时间
    const beforeCreate = TimeUtils.getLocalTime();
    console.log('创建前本地时间:', beforeCreate.toLocaleString('zh-CN'));
    console.log('创建前UTC时间:', beforeCreate.toISOString());

    // 创建测试设备
    const testDevice = {
      accountName: '时间测试设备',
      accountId: '123456789',
      accountUrl: 'https://xiaohongshu.com/user/profile/123456789',
      reviewImage: 'https://example.com/test-image.jpg',
      reviewStatus: 'pending',
      createdBy: '507f1f77bcf86cd799439011' // 假的用户ID
    };

    console.log('\n📝 创建设备数据:', testDevice);

    const device = new Device(testDevice);
    await device.save();

    console.log('\n✅ 设备创建成功');
    console.log('设备ID:', device._id);

    // 重新查询设备，查看存储的时间
    const savedDevice = await Device.findById(device._id);
    console.log('\n📊 数据库中存储的时间:');
    console.log('createdAt (UTC):', savedDevice.createdAt.toISOString());
    console.log('createdAt (北京):', TimeUtils.formatBeijingTime(savedDevice.createdAt));
    console.log('updatedAt (UTC):', savedDevice.updatedAt.toISOString());
    console.log('updatedAt (北京):', TimeUtils.formatBeijingTime(savedDevice.updatedAt));

    // 测试AI审核
    console.log('\n🤖 测试AI审核...');
    const aiReviewResult = await performDeviceAiReview(savedDevice);

    if (aiReviewResult.passed) {
      console.log('✅ AI审核通过，更新状态为 ai_approved');
      await Device.findByIdAndUpdate(savedDevice._id, {
        reviewStatus: 'ai_approved'
      });
    } else {
      console.log('❌ AI审核失败:', aiReviewResult.reason);
    }

    // 再次查询查看更新后的状态和时间
    const updatedDevice = await Device.findById(device._id);
    console.log('\n📊 更新后的设备状态:');
    console.log('reviewStatus:', updatedDevice.reviewStatus);
    console.log('updatedAt (UTC):', updatedDevice.updatedAt.toISOString());
    console.log('updatedAt (北京):', TimeUtils.formatBeijingTime(updatedDevice.updatedAt));

    // 删除测试数据
    await Device.findByIdAndDelete(device._id);
    console.log('\n🗑️ 测试数据已清理');

    await mongoose.disconnect();
    console.log('\n🎉 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// AI审核函数（复制自routes/devices.js）
async function performDeviceAiReview(device) {
  try {
    console.log(`🤖 AI审核设备: ${device.accountName}`);

    // 基础检查：必须有审核图片
    if (!device.reviewImage) {
      return {
        passed: false,
        reason: '缺少审核图片'
      };
    }

    // 检查图片URL是否有效（简单的URL格式检查）
    if (!device.reviewImage.startsWith('http')) {
      return {
        passed: false,
        reason: '审核图片URL无效'
      };
    }

    // 检查账号名称格式（简单的格式检查）
    if (!device.accountName || device.accountName.length < 2) {
      return {
        passed: false,
        reason: '账号名称格式不正确'
      };
    }

    // 检查账号ID格式
    if (!device.accountId || !/^\d{8,12}$/.test(device.accountId)) {
      return {
        passed: false,
        reason: '账号ID格式不正确'
      };
    }

    // 检查账号链接格式
    if (!device.accountUrl || !device.accountUrl.includes('xiaohongshu.com')) {
      return {
        passed: false,
        reason: '账号链接格式不正确'
      };
    }

    // 所有检查通过
    return {
      passed: true,
      reason: 'AI预审核通过'
    };

  } catch (error) {
    console.error('设备AI预审核出错:', error);
    return {
      passed: false,
      reason: 'AI预审核系统错误'
    };
  }
}

// 运行测试
testCreateDevice();