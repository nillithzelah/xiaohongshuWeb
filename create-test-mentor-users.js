// 创建测试用的兼职用户
const mongoose = require('mongoose');
const User = require('./server/models/User');

async function createTestMentorUsers() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 检查是否已有mentor用户
    const existingMentors = await User.find({ role: 'mentor', is_deleted: { $ne: true } });
    console.log(`📊 现有兼职用户数量: ${existingMentors.length}`);

    if (existingMentors.length > 0) {
      console.log('兼职用户列表:');
      existingMentors.forEach(user => {
        console.log(`  - ${user.username} (${user.nickname})`);
      });
      return;
    }

    // 创建测试兼职用户
    const testMentors = [
      {
        username: 'mentor001',
        password: 'admin123',
        role: 'mentor',
        nickname: '小王老师',
        phone: '13800138001',
        wechat: 'mentor001_wechat'
      },
      {
        username: 'mentor002',
        password: 'admin123',
        role: 'mentor',
        nickname: '小李老师',
        phone: '13800138002',
        wechat: 'mentor002_wechat'
      },
      {
        username: 'mentor003',
        password: 'admin123',
        role: 'mentor',
        nickname: '小张老师',
        phone: '13800138003',
        wechat: 'mentor003_wechat'
      }
    ];

    console.log('🛠️ 创建测试兼职用户...');

    for (const mentorData of testMentors) {
      // 检查用户名是否已存在
      const existingUser = await User.findOne({
        username: mentorData.username,
        is_deleted: { $ne: true }
      });

      if (existingUser) {
        console.log(`⚠️ 用户 ${mentorData.username} 已存在，跳过`);
        continue;
      }

      // 创建新用户
      const newUser = new User(mentorData);
      await newUser.save();

      console.log(`✅ 创建兼职用户: ${mentorData.username} (${mentorData.nickname})`);
    }

    // 验证创建结果
    const finalMentors = await User.find({ role: 'mentor', is_deleted: { $ne: true } });
    console.log(`\n📊 创建完成后兼职用户数量: ${finalMentors.length}`);
    console.log('兼职用户列表:');
    finalMentors.forEach(user => {
      console.log(`  - ${user.username} (${user.nickname}) - ID: ${user._id}`);
    });

    console.log('\n🎉 测试兼职用户创建完成！');
    console.log('现在可以在设备管理中为设备分配兼职用户了。');

  } catch (error) {
    console.error('❌ 创建兼职用户失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 数据库连接已关闭');
  }
}

// 运行脚本
if (require.main === module) {
  createTestMentorUsers().catch(console.error);
}

module.exports = { createTestMentorUsers };