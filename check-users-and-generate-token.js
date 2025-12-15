// 检查用户并生成正确的测试token
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('./server/models/User');

async function checkUsersAndGenerateToken() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 获取所有用户
    const users = await User.find({}).select('username role _id');
    console.log('👥 数据库中的用户:');
    users.forEach(user => {
      console.log(`  - ${user.username} (${user.role}): ${user._id}`);
    });

    // 选择第一个兼职用户作为测试用户
    const testUser = users.find(u => u.role === 'part_time');
    if (!testUser) {
      console.log('❌ 没有找到兼职用户');
      return;
    }

    console.log(`\n🎯 选择测试用户: ${testUser.username} (ID: ${testUser._id})`);

    // 生成JWT token
    const token = jwt.sign(
      {
        userId: testUser._id,
        username: testUser.username
      },
      'xiaohongshu_prod_jwt_secret_2025_v2_a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      { expiresIn: '7d' }
    );

    console.log('\n🔑 生成的测试Token:');
    console.log(token);

    console.log('\n📋 测试命令:');
    console.log(`curl -X POST http://localhost:5000/xiaohongshu/api/client/tasks/batch-submit \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId":"device_003","imageType":"note","imageUrls":["https://test.com/img1.jpg"],"imageMd5s":["a1b2c3d4_001234"]}'`);

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ 操作失败:', error);
  }
}

checkUsersAndGenerateToken();