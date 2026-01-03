const mongoose = require('mongoose');
const CommentLimit = require('./server/models/CommentLimit');

async function checkCommentLimits() {
  try {
    console.log('🔄 正在连接数据库...');

    // 加载环境变量
    require('dotenv').config();
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
    console.log('📍 数据库连接字符串:', MONGODB_URI);

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10秒超时
      connectTimeoutMS: 10000
    });
    console.log('✅ 数据库连接成功');

    const count = await CommentLimit.countDocuments({});
    console.log('📊 CommentLimit 记录总数:', count);

    if (count > 0) {
      const records = await CommentLimit.find({}).sort({ updatedAt: -1 }).limit(5);
      console.log('📝 最近的记录:');
      records.forEach((record, index) => {
        console.log(`记录 ${index + 1}:`);
        console.log(`  noteUrl: ${record.noteUrl}`);
        console.log(`  authorNickname: ${record.authorNickname}`);
        console.log(`  approvedCommentCount: ${record.approvedCommentCount}`);
        console.log(`  approvedComments: ${record.approvedComments.length} 条`);
        console.log(`  lastApprovedAt: ${record.lastApprovedAt}`);
        console.log('');
      });
    } else {
      console.log('📭 没有找到任何 CommentLimit 记录');
    }

    await mongoose.disconnect();
    console.log('✅ 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error('❌ 错误详情:', error);
  }
}

checkCommentLimits();