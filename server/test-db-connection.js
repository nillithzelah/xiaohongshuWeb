const mongoose = require('mongoose');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 测试MongoDB数据库连接...\n');

  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit');
    console.log('✅ MongoDB连接成功！');

    // 获取数据库信息
    const db = mongoose.connection.db;
    const stats = await db.stats();

    console.log('\n📊 数据库统计信息:');
    console.log(`- 数据库名称: ${stats.db}`);
    console.log(`- 集合数量: ${stats.collections}`);
    console.log(`- 文档总数: ${stats.objects}`);
    console.log(`- 数据大小: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- 存储大小: ${(stats.storageSize / 1024 / 1024).toFixed(2)} MB`);

    // 列出所有集合
    const collections = await db.listCollections().toArray();
    console.log('\n📋 数据库集合:');
    if (collections.length === 0) {
      console.log('- 暂无集合 (系统会自动创建)');
    } else {
      collections.forEach(collection => {
        console.log(`- ${collection.name}`);
      });
    }

    // 测试集合操作
    console.log('\n🧪 测试集合操作...');

    // 检查用户集合
    const User = require('./server/models/User');
    const userCount = await User.countDocuments();
    console.log(`- 用户数量: ${userCount}`);

    // 检查审核记录集合
    const ImageReview = require('./server/models/ImageReview');
    const reviewCount = await ImageReview.countDocuments();
    console.log(`- 审核记录数量: ${reviewCount}`);

    // 检查资金流水集合
    const Transaction = require('./server/models/Transaction');
    const transactionCount = await Transaction.countDocuments();
    console.log(`- 资金流水数量: ${transactionCount}`);

    console.log('\n🎉 数据库连接测试完成！所有功能正常。');

  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📪 数据库连接已关闭');
  }
}

testDatabaseConnection();