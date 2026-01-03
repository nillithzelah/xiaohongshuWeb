/*
 * 此检查脚本已被废弃
 * SubmissionTracker 模型已被 CommentLimit 模型替代
 * 如需检查评论限制数据，请查看 CommentLimit 集合
 */

/*
const mongoose = require('mongoose');
const SubmissionTracker = require('./server/models/SubmissionTracker');

async function checkSubmissionTracker() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库成功');

    // 检查集合是否存在
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    const hasSubmissionTracker = collectionNames.includes('submissiontrackers');

    console.log('📋 数据库中的集合:', collectionNames);
    console.log('🔍 SubmissionTracker集合存在:', hasSubmissionTracker);

    if (hasSubmissionTracker) {
      // 检查数据
      const count = await SubmissionTracker.countDocuments();
      console.log('📊 SubmissionTracker记录总数:', count);

      if (count > 0) {
        // 显示前几条记录
        const records = await SubmissionTracker.find().limit(5);
        console.log('📝 前5条记录:');
        records.forEach((record, index) => {
          console.log(`  ${index + 1}. 链接: ${record.noteUrl}`);
          console.log(`     昵称: ${record.nickname}`);
          console.log(`     次数: ${record.count}`);
          console.log(`     评论: [${record.comments.join(', ')}]`);
          console.log(`     最后提交: ${record.lastSubmissionTime}`);
          console.log('');
        });
      } else {
        console.log('⚠️ 集合存在但没有数据');
      }
    } else {
      console.log('❌ SubmissionTracker集合不存在，将在第一次使用时自动创建');
    }

    await mongoose.disconnect();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

checkSubmissionTracker();
*/