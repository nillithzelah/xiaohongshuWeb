const mongoose = require('mongoose');
const User = require('./models/User');

async function createTestUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/xiaohongshu');
    console.log('Connected to MongoDB');

    // 创建测试用户
    const users = [
      { openid: 'mock_openid_TEST_BOSS', username: 'TEST_BOSS', role: 'boss' },
      { openid: 'mock_openid_TEST_CS', username: 'TEST_CS', role: 'cs' },
      { openid: 'mock_openid_TEST_FINANCE', username: 'TEST_FINANCE', role: 'finance' }
    ];

    for (const userData of users) {
      const existing = await User.findOne({ username: userData.username });
      if (!existing) {
        const user = new User(userData);
        await user.save();
        console.log('Created user:', userData.username);
      } else {
        console.log('User already exists:', userData.username);
      }
    }

    console.log('Test users creation completed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUsers();