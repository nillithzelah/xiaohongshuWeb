const mongoose = require('mongoose');
const User = require('./models/User');

async function recreateTestUsers() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/xiaohongshu');
    console.log('✅ Connected to MongoDB');

    // 检查现有用户
    const existingUsers = await User.find({ username: { $in: ['TEST_BOSS', 'TEST_CS', 'TEST_FINANCE'] } });
    console.log('Existing test users:', existingUsers.length);

    // 删除旧的测试用户
    const deleteResult = await User.deleteMany({ username: { $in: ['TEST_BOSS', 'TEST_CS', 'TEST_FINANCE'] } });
    console.log('🗑️ Deleted old test users:', deleteResult.deletedCount);

    // 创建正确的测试用户
    const users = [
      { username: 'TEST_BOSS', role: 'boss', openid: 'admin_boss_openid_' + Date.now() },
      { username: 'TEST_CS', role: 'cs', openid: 'admin_cs_openid_' + Date.now() },
      { username: 'TEST_FINANCE', role: 'finance', openid: 'admin_finance_openid_' + Date.now() }
    ];

    console.log('📝 Creating new test users...');
    for (const userData of users) {
      const user = new User(userData);
      const savedUser = await user.save();
      console.log('✅ Created user:', savedUser.username, 'ID:', savedUser._id);
    }

    // 验证创建结果
    const finalUsers = await User.find({ username: { $in: ['TEST_BOSS', 'TEST_CS', 'TEST_FINANCE'] } });
    console.log('🎯 Final test users count:', finalUsers.length);
    finalUsers.forEach(u => console.log('  -', u.username, u.role));

    console.log('🎉 Test users recreation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

recreateTestUsers();