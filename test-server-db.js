const mongoose = require('mongoose');
const User = require('./server/models/User');

async function testServerDb() {
  try {
    // 使用与服务器相同的连接配置
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
    console.log('🔍 正在连接数据库:', MONGODB_URI);

    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5秒超时
      socketTimeoutMS: 45000, // 45秒socket超时
    });
    console.log('✅ 数据库连接成功');

    // 先测试简单的数据库操作
    console.log('🔍 测试数据库基本操作...');

    // 测试集合数量
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📋 数据库中有 ${collections.length} 个集合`);

    // 测试简单的用户计数
    const totalUsers = await User.countDocuments();
    console.log(`👥 总用户数: ${totalUsers}`);

    // 测试兼职用户计数
    const partTimeUsers = await User.countDocuments({ role: 'part_time' });
    console.log(`👷 兼职用户数: ${partTimeUsers}`);

    // 测试有积分的用户计数
    const usersWithPoints = await User.countDocuments({
      points: { $gt: 0 },
      is_deleted: { $ne: true }
    });
    console.log(`💰 有积分的用户数: ${usersWithPoints}`);

    if (usersWithPoints > 0) {
      console.log('✅ 找到有积分的用户，积分兑换功能应该可以正常工作');
    } else {
      console.log('⚠️ 没有找到有积分的用户，可能需要先生成一些测试数据');
    }

    await mongoose.disconnect();
    console.log('👋 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

testServerDb();