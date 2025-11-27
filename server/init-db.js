const mongoose = require('mongoose');
const TaskConfig = require('./models/TaskConfig');
const User = require('./models/User');

async function initDatabase() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu');

    console.log('开始初始化数据库...');

    // 创建默认任务配置
    const defaultConfigs = [
      {
        type_key: 'login_qr',
        name: '小红书登录二维码',
        price: 5.0,
        commission: 1.0,
        is_active: true
      },
      {
        type_key: 'note',
        name: '小红书笔记',
        price: 8.0,
        commission: 1.5,
        is_active: true
      },
      {
        type_key: 'comment',
        name: '小红书评论',
        price: 3.0,
        commission: 0.5,
        is_active: true
      }
    ];

    for (const config of defaultConfigs) {
      const existing = await TaskConfig.findOne({ type_key: config.type_key });
      if (!existing) {
        await TaskConfig.create(config);
        console.log(`创建任务配置: ${config.name}`);
      }
    }

    // 创建默认管理员账号
    const adminUsers = [
      {
        username: 'admin_cs',
        password: '123456',
        role: 'cs'
      },
      {
        username: 'admin_boss',
        password: '123456',
        role: 'boss'
      },
      {
        username: 'admin_finance',
        password: '123456',
        role: 'finance'
      }
    ];

    for (const admin of adminUsers) {
      const existing = await User.findOne({ username: admin.username });
      if (!existing) {
        const user = new User(admin);
        await user.save();
        console.log(`创建管理员账号: ${admin.username}`);
      }
    }

    console.log('数据库初始化完成！');

  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// 如果直接运行此脚本，则执行初始化
if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;