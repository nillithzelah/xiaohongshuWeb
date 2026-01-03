const mongoose = require('mongoose');
const Device = require('./models/Device');

// 模拟performDeviceAiReview函数（从routes/devices.js复制）
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

async function testDeviceAiReview() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 创建测试设备数据
    const testDevices = [
      {
        accountName: '测试账号1',
        accountId: '123456789',
        accountUrl: 'https://xiaohongshu.com/user/profile/123456789',
        reviewImage: 'https://example.com/review-image.jpg',
        reviewStatus: 'pending'
      },
      {
        accountName: '测试账号2',
        accountId: 'invalid_id',
        accountUrl: 'https://xiaohongshu.com/user/profile/123456789',
        reviewImage: 'https://example.com/review-image.jpg',
        reviewStatus: 'pending'
      },
      {
        accountName: '测试账号3',
        accountId: '123456789',
        accountUrl: 'https://invalid-url.com',
        reviewImage: 'https://example.com/review-image.jpg',
        reviewStatus: 'pending'
      },
      {
        accountName: '测试账号4',
        accountId: '123456789',
        accountUrl: 'https://xiaohongshu.com/user/profile/123456789',
        reviewImage: '', // 缺少审核图片
        reviewStatus: 'pending'
      }
    ];

    console.log('\n=== 开始设备AI审核测试 ===\n');

    for (let i = 0; i < testDevices.length; i++) {
      const device = testDevices[i];
      console.log(`测试设备 ${i + 1}: ${device.accountName}`);

      const result = await performDeviceAiReview(device);

      if (result.passed) {
        console.log(`✅ AI审核通过: ${result.reason}`);
        console.log(`   状态应更新为: ai_approved`);
      } else {
        console.log(`❌ AI审核失败: ${result.reason}`);
        console.log(`   状态保持为: pending`);
      }

      console.log('---');
    }

    console.log('\n=== 测试完成 ===');
    console.log('✅ 设备AI预审核逻辑验证完成');

    await mongoose.disconnect();
    console.log('🎉 数据库连接已关闭');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testDeviceAiReview();