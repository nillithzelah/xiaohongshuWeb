const mongoose = require('mongoose');
const TimeUtils = require('./utils/timeUtils');

// 检查服务器时区和数据库时间数据
async function checkTimezone() {
  try {
    console.log('=== 服务器时区检查 ===\n');

    // 1. 检查当前服务器时间
    const serverTime = new Date();
    console.log('📅 当前服务器时间 (UTC):', serverTime.toISOString());
    console.log('📅 当前服务器时间 (本地):', serverTime.toLocaleString());

    // 2. 检查北京时间
    const beijingTime = TimeUtils.getBeijingTime();
    console.log('🇨🇳 北京时间:', TimeUtils.formatBeijingTime(serverTime));
    console.log('🇨🇳 北京时间对象:', beijingTime.toISOString());

    // 3. 连接数据库
    console.log('\n=== 数据库连接 ===');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 4. 检查设备表的时间数据
    console.log('\n=== 设备表时间数据检查 ===');
    const Device = require('./models/Device');

    const devices = await Device.find({})
      .select('accountName reviewStatus createdAt reviewedAt')
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`📊 找到 ${devices.length} 条设备记录:\n`);

    devices.forEach((device, index) => {
      console.log(`${index + 1}. 设备: ${device.accountName}`);
      console.log(`   状态: ${device.reviewStatus}`);
      console.log(`   创建时间 (UTC): ${device.createdAt.toISOString()}`);
      console.log(`   创建时间 (北京): ${TimeUtils.formatBeijingTime(device.createdAt)}`);
      if (device.reviewedAt) {
        console.log(`   审核时间 (UTC): ${device.reviewedAt.toISOString()}`);
        console.log(`   审核时间 (北京): ${TimeUtils.formatBeijingTime(device.reviewedAt)}`);
      } else {
        console.log(`   审核时间: 未审核`);
      }
      console.log('---');
    });

    // 5. 检查用户表的时间数据
    console.log('\n=== 用户表时间数据检查 ===');
    const User = require('./models/User');

    const users = await User.find({})
      .select('username nickname createdAt')
      .sort({ createdAt: -1 })
      .limit(3);

    console.log(`👥 找到 ${users.length} 条用户记录:\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. 用户: ${user.username} (${user.nickname})`);
      console.log(`   创建时间 (UTC): ${user.createdAt.toISOString()}`);
      console.log(`   创建时间 (北京): ${TimeUtils.formatBeijingTime(user.createdAt)}`);
      console.log('---');
    });

    // 6. 检查审核记录的时间数据
    console.log('\n=== 审核记录时间数据检查 ===');
    const ImageReview = require('./models/ImageReview');

    const reviews = await ImageReview.find({})
      .select('imageType status createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(3);

    console.log(`🔍 找到 ${reviews.length} 条审核记录:\n`);

    reviews.forEach((review, index) => {
      console.log(`${index + 1}. 审核类型: ${review.imageType}, 状态: ${review.status}`);
      console.log(`   创建时间 (UTC): ${review.createdAt.toISOString()}`);
      console.log(`   创建时间 (北京): ${TimeUtils.formatBeijingTime(review.createdAt)}`);
      console.log(`   更新时间 (UTC): ${review.updatedAt.toISOString()}`);
      console.log(`   更新时间 (北京): ${TimeUtils.formatBeijingTime(review.updatedAt)}`);
      console.log('---');
    });

    await mongoose.disconnect();
    console.log('\n🎉 时区检查完成');

  } catch (error) {
    console.error('❌ 时区检查失败:', error);
    process.exit(1);
  }
}

// 运行检查
checkTimezone();