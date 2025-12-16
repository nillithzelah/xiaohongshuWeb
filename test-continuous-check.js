// 测试持续检查功能
require('dotenv').config();
const mongoose = require('mongoose');
const continuousCheckService = require('./server/services/continuousCheckService');

async function testContinuousCheck() {
  try {
    console.log('🧪 开始测试持续检查功能...');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 手动触发检查
    await continuousCheckService.triggerManualCheck();

    console.log('✅ 持续检查测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');
  }
}

// 运行测试
if (require.main === module) {
  testContinuousCheck();
}

module.exports = { testContinuousCheck };