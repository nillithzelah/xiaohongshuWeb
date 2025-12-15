const mongoose = require('mongoose');
const User = require('./server/models/User');
const ImageReview = require('./server/models/ImageReview');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const OSS = require('ali-oss');

async function checkDatabase() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ Connected to database');

    const totalPartTime = await User.countDocuments({ role: 'part_time', is_deleted: { $ne: true } });
    const withMentor = await User.countDocuments({ role: 'part_time', mentor_id: { $ne: null }, is_deleted: { $ne: true } });
    const withHr = await User.countDocuments({ role: 'part_time', hr_id: { $ne: null }, is_deleted: { $ne: true } });
    const withParent = await User.countDocuments({ role: 'part_time', parent_id: { $ne: null }, is_deleted: { $ne: true } });

    console.log('\n📊 Part-time user statistics:');
    console.log(`- Total active part-time users: ${totalPartTime}`);
    console.log(`- Users with mentor assigned: ${withMentor}`);
    console.log(`- Users with HR assigned: ${withHr}`);
    console.log(`- Users with parent assigned: ${withParent}`);

    // Get some sample data
    const sampleUsers = await User.find({ role: 'part_time', is_deleted: { $ne: true } })
      .select('username nickname points totalEarnings hr_id mentor_id parent_id createdAt')
      .populate('hr_id', 'username nickname')
      .populate('mentor_id', 'username nickname')
      .populate('parent_id', 'username nickname')
      .limit(5);

    console.log('\n👥 Sample part-time users:');
    sampleUsers.forEach(user => {
      console.log(`- ${user.nickname} (${user.username}): ${user.points} points, ${user.totalEarnings} earnings`);
      console.log(`  HR: ${user.hr_id ? user.hr_id.nickname : 'None'}`);
      console.log(`  Mentor: ${user.mentor_id ? user.mentor_id.nickname : 'None'}`);
      console.log(`  Parent: ${user.parent_id ? user.parent_id.nickname : 'None'}`);
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}


