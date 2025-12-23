const mongoose = require('mongoose');

async function checkTaskConfigs() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    const configs = await mongoose.connection.db.collection('taskconfigs').find({}).toArray();
    console.log(`📋 任务配置总数: ${configs.length}`);

    configs.forEach(config => {
      console.log(`  - ${config.type_key}: ${config.name}`);
      console.log(`    激活状态: ${config.is_active}`);
      console.log(`    价格: ${config.price}`);
      console.log(`    佣金1: ${config.commission_1}, 佣金2: ${config.commission_2}`);
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

checkTaskConfigs();