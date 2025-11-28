const mongoose = require('mongoose');
const User = require('./models/User');

async function checkDatabase() {
  try {
    console.log('🔍 Checking database...');
    await mongoose.connect('mongodb://localhost:27017/xiaohongshu');
    console.log('✅ Connected to MongoDB');

    // 检查所有用户
    const allUsers = await User.find({}, 'username role _id createdAt').sort({ createdAt: -1 });
    console.log(`📊 Total users in database: ${allUsers.length}`);
    allUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.role}) - ID: ${user._id}`);
    });

    // 特别检查TEST用户
    const testUsers = await User.find({
      username: { $in: ['TEST_BOSS', 'TEST_CS', 'TEST_FINANCE'] }
    });
    console.log(`\n🎯 TEST users found: ${testUsers.length}`);
    testUsers.forEach(user => {
      console.log(`  - ${user.username}: ${user.role} (ID: ${user._id})`);
    });

    if (testUsers.length === 0) {
      console.log('❌ No TEST users found! Creating them now...');

      const users = [
        { username: 'TEST_BOSS', role: 'boss', openid: 'boss_' + Date.now() },
        { username: 'TEST_CS', role: 'cs', openid: 'cs_' + Date.now() },
        { username: 'TEST_FINANCE', role: 'finance', openid: 'finance_' + Date.now() }
      ];

      for (const userData of users) {
        const user = new User(userData);
        await user.save();
        console.log(`✅ Created: ${user.username}`);
      }
    }

  } catch (error) {
    console.error('❌ Database check error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkDatabase();