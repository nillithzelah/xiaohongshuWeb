const mongoose = require('mongoose');
const User = require('./server/models/User');

async function checkUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    const user = await User.findById('6952518717cd0e4322fed437');
    console.log('User found:', user ? { id: user._id, username: user.username, role: user.role, is_deleted: user.is_deleted } : 'Not found');

    // 也检查username查找
    const userByName = await User.findOne({ username: 'feng' });
    console.log('User by name:', userByName ? { id: userByName._id, username: userByName.username, role: userByName.role } : 'Not found');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUser();