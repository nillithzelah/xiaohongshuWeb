const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function debugNicknameCheck() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('Connected to database');

    // 查找所有审核通过的记录
    const approvedReviews = await ImageReview.find({
      status: { $in: ['manager_approved', 'completed'] },
      imageType: 'note' // 只检查笔记类型
    }).select('aiParsedNoteInfo.author status createdAt userId noteUrl').sort({ createdAt: -1 }).limit(10);

    console.log(`📋 找到 ${approvedReviews.length} 条审核通过的笔记记录:`);

    approvedReviews.forEach((review, index) => {
      console.log(`\n${index + 1}. 审核ID: ${review._id}`);
      console.log(`   用户ID: ${review.userId}`);
      console.log(`   状态: ${review.status}`);
      console.log(`   创建时间: ${review.createdAt.toISOString()}`);
      console.log(`   笔记链接: ${review.noteUrl}`);
      console.log(`   AI解析昵称: ${review.aiParsedNoteInfo?.author || '无'}`);
    });

    // 检查是否有重复昵称的情况
    const nicknameMap = {};
    approvedReviews.forEach(review => {
      const author = review.aiParsedNoteInfo?.author;
      if (author) {
        if (!nicknameMap[author]) {
          nicknameMap[author] = [];
        }
        nicknameMap[author].push({
          id: review._id,
          userId: review.userId,
          createdAt: review.createdAt
        });
      }
    });

    console.log('\n📊 昵称使用统计:');
    Object.keys(nicknameMap).forEach(nickname => {
      const records = nicknameMap[nickname];
      console.log(`\n昵称: "${nickname}" - 使用次数: ${records.length}`);
      records.forEach((record, index) => {
        console.log(`  ${index + 1}. 用户: ${record.userId}, 时间: ${record.createdAt.toISOString()}`);
      });

      // 检查7天内重复使用
      if (records.length > 1) {
        records.sort((a, b) => a.createdAt - b.createdAt);
        for (let i = 1; i < records.length; i++) {
          const prev = records[i - 1];
          const curr = records[i];
          const daysDiff = Math.floor((curr.createdAt - prev.createdAt) / (1000 * 60 * 60 * 24));

          if (daysDiff <= 7 && prev.userId.toString() === curr.userId.toString()) {
            console.log(`  ⚠️ 发现7天内重复使用: ${daysDiff}天前已使用过`);
          }
        }
      }
    });

    // 检查最近7天内的审核记录
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentReviews = await ImageReview.find({
      status: { $in: ['manager_approved', 'completed'] },
      imageType: 'note',
      createdAt: { $gte: sevenDaysAgo }
    }).select('aiParsedNoteInfo.author status createdAt userId').sort({ createdAt: -1 });

    console.log(`\n📅 最近7天内的审核通过记录: ${recentReviews.length} 条`);

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
  }
}

debugNicknameCheck();