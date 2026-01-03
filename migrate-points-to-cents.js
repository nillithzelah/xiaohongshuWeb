const mongoose = require('mongoose');

// 连接数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

console.log('🔍 正在连接数据库:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('✅ MongoDB 连接成功');

  try {
    // 获取所有用户
    const User = require('./server/models/User');
    const Transaction = require('./server/models/Transaction');

    console.log('📊 开始迁移积分数据到分单位存储...');

    // 1. 迁移用户积分 (points 字段)
    console.log('🔄 开始迁移用户积分points字段...');
    const allUsers = await User.find({});
    console.log(`📋 找到 ${allUsers.length} 个用户`);

    for (const user of allUsers) {
      if (typeof user.points === 'number' && user.points !== Math.floor(user.points * 100)) {
        const oldPoints = user.points;
        user.points = Math.floor(user.points * 100);
        await user.save();
        console.log(`🔄 用户 ${user.username}: points 从 ${oldPoints} 转换为 ${user.points} 分`);
      }
    }

    // 2. 迁移用户钱包数据 - 使用批量更新
    console.log('🔄 开始批量更新用户钱包数据...');

    // 查找所有有钱包数据的用户
    const usersWithWallet = await User.find({ 'wallet.total_earned': { $exists: true } });
    console.log(`📋 找到 ${usersWithWallet.length} 个有钱包数据的用户`);

    for (const user of usersWithWallet) {
      let updateData = {};

      if (user.wallet) {
        // 将total_earned转换为分
        if (typeof user.wallet.total_earned === 'number' && user.wallet.total_earned !== Math.floor(user.wallet.total_earned * 100)) {
          updateData['wallet.total_earned'] = Math.floor(user.wallet.total_earned * 100);
          console.log(`🔄 用户 ${user.username}: total_earned 转换为 ${updateData['wallet.total_earned']} 分`);
        }

        // 将total_withdrawn转换为分
        if (typeof user.wallet.total_withdrawn === 'number' && user.wallet.total_withdrawn !== Math.floor(user.wallet.total_withdrawn * 100)) {
          updateData['wallet.total_withdrawn'] = Math.floor(user.wallet.total_withdrawn * 100);
          console.log(`🔄 用户 ${user.username}: total_withdrawn 转换为 ${updateData['wallet.total_withdrawn']} 分`);
        }
      }

      if (Object.keys(updateData).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updateData });
      }
    }

    // 3. 迁移交易记录
    const transactions = await Transaction.find({});
    console.log(`📋 找到 ${transactions.length} 个交易记录`);

    for (const transaction of transactions) {
      // 将amount转换为分
      if (typeof transaction.amount === 'number' && transaction.amount !== Math.floor(transaction.amount * 100)) {
        const oldAmount = transaction.amount;
        transaction.amount = Math.floor(transaction.amount * 100);
        await transaction.save();
        console.log(`🔄 交易 ${transaction._id}: amount 从 ${oldAmount} 转换为 ${transaction.amount} 分`);
      }
    }

    console.log('✅ 数据迁移完成！');
    console.log('📝 注意：前端代码需要修改为除以100显示金额');

  } catch (error) {
    console.error('❌ 迁移过程中出错:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');
  }
})
.catch((error) => {
  console.error('❌ MongoDB 连接失败:', error.message);
  process.exit(1);
});