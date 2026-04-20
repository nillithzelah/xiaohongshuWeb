/**
 * 初始化系统配置数据
 *
 * 运行方式：
 * node server/init-system-config.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('./models/SystemConfig');

async function initConfig() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 采集优先级间隔配置
    await SystemConfig.setValue(
      'harvest_priority_intervals',
      {
        10: 10,    // 10分钟
        5: 60,     // 1小时
        2: 360,    // 6小时
        1: 1440    // 24小时
      },
      '采集优先级间隔配置（单位：分钟）',
      'harvest'
    );
    console.log('✅ harvest_priority_intervals 配置已初始化');

    // 显示所有配置
    const configs = await SystemConfig.find();
    console.log('\n📋 当前系统配置：');
    configs.forEach(config => {
      console.log(`   - ${config.key}: ${JSON.stringify(config.value)}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  }
}

initConfig();
