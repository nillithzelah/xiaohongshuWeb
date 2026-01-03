const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function checkNoteReviews() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 查询所有笔记类型的审核通过记录
    const noteReviews = await ImageReview.find({
      imageType: 'note',
      status: { $in: ['manager_approved', 'completed'] }
    }).select('aiParsedNoteInfo.author userId createdAt status').sort({ createdAt: -1 }).limit(50);

    console.log(`📋 找到 ${noteReviews.length} 条笔记审核通过记录:`);

    const authorStats = {};
    let totalWithAuthor = 0;
    let totalWithoutAuthor = 0;

    noteReviews.forEach((review, index) => {
      const author = review.aiParsedNoteInfo?.author;
      const daysAgo = Math.floor((Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`\n${index + 1}. ${review.createdAt.toISOString()} (${daysAgo}天前) - ${review.status}`);
      console.log(`   用户ID: ${review.userId}`);
      console.log(`   AI解析昵称: ${author || '❌ 空值'}`);

      if (author && author.trim()) {
        totalWithAuthor++;
        if (!authorStats[author.trim()]) {
          authorStats[author.trim()] = [];
        }
        authorStats[author.trim()].push({
          userId: review.userId,
          createdAt: review.createdAt,
          daysAgo
        });
      } else {
        totalWithoutAuthor++;
        console.log(`   ⚠️ 缺少AI解析昵称，这条记录不会触发7天检查`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 统计结果:');
    console.log(`   总记录数: ${noteReviews.length}`);
    console.log(`   有AI解析昵称: ${totalWithAuthor}`);
    console.log(`   缺少AI解析昵称: ${totalWithoutAuthor}`);
    console.log(`   昵称覆盖率: ${((totalWithAuthor / noteReviews.length) * 100).toFixed(1)}%`);

    console.log('\n📈 各昵称使用情况:');
    Object.keys(authorStats).forEach(author => {
      const records = authorStats[author];
      console.log(`\n昵称: "${author}" - 使用次数: ${records.length}`);

      // 检查7天内使用情况
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

      const recentRecords = records.filter(r => r.createdAt.getTime() >= sevenDaysAgo);
      if (recentRecords.length > 1) {
        console.log(`   🛡️ 7天内使用 ${recentRecords.length} 次，限制生效中`);
        recentRecords.forEach(r => {
          const days = Math.floor((now - r.createdAt.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`     - ${days}天前，用户: ${r.userId}`);
        });
      } else {
        console.log(`   ✅ 7天内使用 ${recentRecords.length} 次，可以继续使用`);
      }
    });

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkNoteReviews();