require('dotenv').config();
const mongoose = require('mongoose');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 检查用户数据
async function checkUserData() {
  try {
    const User = require('./server/models/User');

    console.log('🔍 查询用户数据...');

    const users = await User.find({
      username: { $in: ['user001', 'user002'] }
    }).select('username nickname points wallet');

    users.forEach(user => {
      console.log(`\n👤 ${user.username} (${user.nickname})`);
      console.log(`   积分: ${user.points}`);
      console.log(`   钱包:`, JSON.stringify(user.wallet, null, 2));
    });

    // 检查交易数据
    const Transaction = require('./server/models/Transaction');
    console.log('\n💰 检查交易数据...');

    const transactions = await Transaction.find({
      user_id: { $in: users.map(u => u._id) }
    }).select('user_id type amount status');

    transactions.forEach(tx => {
      const user = users.find(u => u._id.toString() === tx.user_id.toString());
      console.log(`   ${user?.username}: ${tx.type} - ${tx.amount}元 (${tx.status})`);
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
  }
}

// 主函数
async function main() {
  await connectDB();
  await checkUserData();
  await mongoose.connection.close();
  console.log('📪 数据库连接已关闭');
}

main().catch(console.error);