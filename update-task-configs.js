const mongoose = require('mongoose');
const TaskConfig = require('./server/models/TaskConfig');

async function updateTaskConfigs() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('Connected to database');

    // 更新所有TaskConfig记录，确保有daily_reward_points字段
    const result = await TaskConfig.updateMany(
      { daily_reward_points: { $exists: false } },
      { $set: { daily_reward_points: 30 } }
    );

    console.log(`Updated ${result.modifiedCount} TaskConfig records`);

    // 再次查询并显示所有记录
    const configs = await TaskConfig.find({ is_active: true })
      .sort({ type_key: 1 });

    console.log('\n📋 更新后的任务配置:');
    configs.forEach(config => {
      console.log(`  - ${config.type_key}: ${config.name}`);
      console.log(`    激活状态: ${config.is_active}`);
      console.log(`    价格: ${config.price}`);
      console.log(`    佣金1: ${config.commission_1}, 佣金2: ${config.commission_2}`);
      console.log(`    每日奖励积分: ${config.daily_reward_points}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('Disconnected from database');
  } catch (error) {
    console.error('Error:', error);
  }
}

updateTaskConfigs();