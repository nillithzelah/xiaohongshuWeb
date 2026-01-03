const mongoose = require('mongoose');

async function checkPendingReviews() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    const count = await mongoose.connection.db.collection('imagereviews').countDocuments({status: 'pending'});
    console.log('📊 待审核任务数量:', count);

    if (count > 0) {
      const recent = await mongoose.connection.db.collection('imagereviews')
        .find({status: 'pending'})
        .sort({createdAt: -1})
        .limit(5)
        .toArray();

      console.log('📋 最近5个待审核任务:');
      recent.forEach((r, i) => {
        console.log(`${i+1}. ID: ${r._id}, 类型: ${r.imageType}, 时间: ${r.createdAt}, URL: ${r.noteUrl || '无'}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  }
}

checkPendingReviews();