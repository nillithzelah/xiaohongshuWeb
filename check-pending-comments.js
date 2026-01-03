const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function checkPendingComments() {
  try {
    // 连接数据库
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10秒超时
      connectTimeoutMS: 10000
    });
    console.log('✅ 数据库连接成功');

    const pendingComments = await ImageReview.find({
      status: 'pending',
      imageType: 'comment'
    }).limit(5).select('_id noteUrl userNoteInfo createdAt');

    console.log('待处理的评论审核任务:');
    pendingComments.forEach(review => {
      console.log(`- ID: ${review._id}`);
      console.log(`  URL: ${review.noteUrl}`);
      console.log(`  作者: ${Array.isArray(review.userNoteInfo?.author) ? review.userNoteInfo.author.join(', ') : review.userNoteInfo?.author}`);
      console.log(`  评论: ${review.userNoteInfo?.comment?.substring(0, 50)}...`);
      console.log(`  创建时间: ${review.createdAt}`);
      console.log('');
    });

    if (pendingComments.length === 0) {
      console.log('没有待处理的评论审核任务');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkPendingComments();