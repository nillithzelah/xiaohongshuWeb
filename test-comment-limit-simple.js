const mongoose = require('mongoose');
const CommentLimit = require('./server/models/CommentLimit');

async function testCommentLimitSimple() {
  try {
    console.log('🔍 测试CommentLimit模型加载...');

    // 检查模型是否正确定义
    console.log('CommentLimit模型:', CommentLimit);
    console.log('CommentLimit.schema:', CommentLimit.schema);
    console.log('CommentLimit.modelName:', CommentLimit.modelName);

    // 尝试连接数据库
    console.log('📡 连接数据库...');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 测试基本查询
    console.log('📋 测试基本查询...');
    const count = await CommentLimit.countDocuments();
    console.log('CommentLimit记录总数:', count);

    // 测试静态方法是否存在
    console.log('🔧 检查静态方法...');
    console.log('checkCommentApproval方法:', typeof CommentLimit.checkCommentApproval);
    console.log('recordCommentApproval方法:', typeof CommentLimit.recordCommentApproval);

    await mongoose.disconnect();
    console.log('✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

testCommentLimitSimple();