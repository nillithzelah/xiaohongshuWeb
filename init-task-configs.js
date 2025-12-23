const mongoose = require('mongoose');

async function initTaskConfigs() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    const TaskConfig = require('./server/models/TaskConfig');

    // 定义任务配置
    const taskConfigs = [
      {
        type_key: 'customer_resource',
        name: '客资',
        price: 5.00,
        commission_1: 0.5,
        commission_2: 0.25,
        is_active: true
      },
      {
        type_key: 'note',
        name: '笔记',
        price: 10.00,
        commission_1: 1.0,
        commission_2: 0.5,
        is_active: true
      },
      {
        type_key: 'comment',
        name: '评论',
        price: 3.00,
        commission_1: 0.3,
        commission_2: 0.15,
        is_active: true
      }
    ];

    // 先清空现有配置
    await TaskConfig.deleteMany({});
    console.log('🗑️ 清空现有任务配置');

    // 插入新配置
    const createdConfigs = await TaskConfig.insertMany(taskConfigs);
    console.log(`✅ 成功创建 ${createdConfigs.length} 个任务配置`);

    // 显示创建的配置
    createdConfigs.forEach(config => {
      console.log(`  - ${config.type_key}: ${config.name} - ¥${config.price} (佣金: ${config.commission_1}/${config.commission_2})`);
    });

    await mongoose.disconnect();
    console.log('🎉 任务配置初始化完成！');

  } catch (error) {
    console.error('❌ 初始化任务配置失败:', error.message);
  }
}

initTaskConfigs();