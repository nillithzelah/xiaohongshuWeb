const mongoose = require('mongoose');
const TaskConfig = require('./server/models/TaskConfig');

async function checkTaskConfigs() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('Connected to database');

    const configs = await TaskConfig.find({ is_active: true })
      .sort({ type_key: 1 });

    console.log(`📋 任务配置总数: ${configs.length}`);
    configs.forEach(config => {
      console.log(`  - ${config.type_key}: ${config.name}`);
      console.log(`    激活状态: ${config.is_active}`);
      console.log(`    价格: ${config.price}`);
      console.log(`    佣金1: ${config.commission_1}, 佣金2: ${config.commission_2}`);
      console.log(`    每日奖励积分: ${config.daily_reward_points}`);
      console.log(`    完整数据:`, JSON.stringify(config, null, 2));
      console.log('');
    });

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTaskConfigs();