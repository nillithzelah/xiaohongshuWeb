const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function testNicknameLimit() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('Connected to database');

    // 测试昵称7天检查逻辑
    const testNickname = '测试昵称'; // 替换为实际的昵称
    const testUserId = '507f1f77bcf86cd799439011'; // 替换为实际的用户ID

    console.log(`🔍 测试昵称 "${testNickname}" 的7天使用限制，用户ID: ${testUserId}`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log(`📅 7天前时间: ${sevenDaysAgo.toISOString()}`);

    const recentReview = await ImageReview.findOne({
      'aiParsedNoteInfo.author': testNickname,
      userId: testUserId,
      status: { $in: ['manager_approved', 'completed'] },
      createdAt: { $gte: sevenDaysAgo }
    });

    if (recentReview) {
      console.log(`❌ 发现最近使用记录:`);
      console.log(`   审核ID: ${recentReview._id}`);
      console.log(`   状态: ${recentReview.status}`);
      console.log(`   创建时间: ${recentReview.createdAt.toISOString()}`);
      console.log(`   天数差: ${Math.floor((Date.now() - recentReview.createdAt.getTime()) / (1000 * 60 * 60 * 24))}天`);
      console.log('   结果: 昵称限制触发');
    } else {
      console.log(`✅ 昵称 "${testNickname}" 在7天内未被使用，可以使用`);
    }

    // 统计所有有aiParsedNoteInfo.author的记录
    const totalWithAuthor = await ImageReview.countDocuments({
      'aiParsedNoteInfo.author': { $exists: true, $ne: null }
    });

    console.log(`\n📊 统计信息:`);
    console.log(`   总共有aiParsedNoteInfo.author的记录数: ${totalWithAuthor}`);

    // 查找最近的一些记录来检查数据结构
    const recentRecords = await ImageReview.find({
      'aiParsedNoteInfo.author': { $exists: true, $ne: null }
    }).select('aiParsedNoteInfo.author status createdAt userId').sort({ createdAt: -1 }).limit(5);

    console.log(`\n📋 最近5条有昵称的记录:`);
    recentRecords.forEach((record, index) => {
      console.log(`${index + 1}. 昵称: "${record.aiParsedNoteInfo.author}", 状态: ${record.status}, 用户: ${record.userId}, 时间: ${record.createdAt.toISOString()}`);
    });

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
  }
}

testNicknameLimit();