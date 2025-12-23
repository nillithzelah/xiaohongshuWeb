const mongoose = require('mongoose');
const TaskConfig = require('./server/models/TaskConfig');

async function createTaskConfigs() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    const configs = [
      { type_key: 'customer_resource', name: '客资', price: 5.00, commission_1: 0.5, commission_2: 0.25, is_active: true },
      { type_key: 'note', name: '笔记', price: 10.00, commission_1: 1.0, commission_2: 0.5, is_active: true },
      { type_key: 'comment', name: '评论', price: 3.00, commission_1: 0.3, commission_2: 0.15, is_active: true }
    ];

    await TaskConfig.insertMany(configs);
    console.log('✅ 任务配置创建成功');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

createTaskConfigs();