const mongoose = require('mongoose');

async function checkCommentLimit() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');

    const count = await mongoose.connection.db.collection('commentlimits').count();
    console.log('CommentLimit 总数:', count);

    const records = await mongoose.connection.db.collection('commentlimits')
      .find({})
      .sort({updatedAt: -1})
      .limit(5)
      .toArray();

    console.log('最近5条记录:');
    records.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.authorNickname} - ${r.noteUrl} - 审核通过次数: ${r.approvedCommentCount} - 更新时间: ${r.updatedAt}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkCommentLimit();