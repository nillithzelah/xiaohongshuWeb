const mongoose = require('mongoose');
const User = require('./server/models/User');

async function checkUser() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('Connected to MongoDB');

    const user = await User.findById('693d29b5cbc188007ecc5848');
    if (user) {
      console.log('User found:', {
        _id: user._id,
        username: user.username,
        role: user.role,
        nickname: user.nickname,
        is_deleted: user.is_deleted
      });
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
  }
}

checkUser();