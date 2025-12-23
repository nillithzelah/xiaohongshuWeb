const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');
const Transaction = require('./server/models/Transaction');

async function migrateFinanceData() {
  try {
    console.log('🔄 开始财务数据迁移...');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 数据库连接成功');

    // 1. 迁移User数据
    console.log('📊 迁移用户财务数据...');
    const users = await User.find({});

    for (const user of users) {
      const oldTotalIncome = user.wallet.total_income || 0;
      const oldBalance = user.wallet.balance || 0;

      // 计算总获得金额（从交易记录）
      const earnedTransactions = await Transaction.find({
        user_id: user._id,
        type: { $ne: 'withdrawal' },
        status: 'completed'
      });

      const totalEarned = earnedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      // 计算已提现金额
      const withdrawalTransactions = await Transaction.find({
        user_id: user._id,
        type: 'withdrawal',
        status: 'completed'
      });

      const totalWithdrawn = withdrawalTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      // 更新用户数据
      user.wallet.total_earned = totalEarned;
      user.wallet.total_withdrawn = totalWithdrawn;
      user.wallet.balance = Math.max(0, totalEarned - totalWithdrawn);

      // 清理旧字段
      if (user.continuousCheckPoints !== undefined) {
        console.log(`🧹 清理用户 ${user.username} 的 continuousCheckPoints 字段`);
        user.continuousCheckPoints = undefined;
      }

      if (user.totalEarnings !== undefined) {
        console.log(`🧹 清理用户 ${user.username} 的 totalEarnings 字段`);
        user.totalEarnings = undefined;
      }

      await user.save();
      console.log(`✅ 用户 ${user.username}: 总获得 ${totalEarned}, 已提现 ${totalWithdrawn}, 余额 ${user.wallet.balance}`);
    }

    // 2. 迁移Transaction状态
    console.log('📋 迁移交易状态...');
    await Transaction.updateMany(
      { status: 'paid' },
      { $set: { status: 'completed' } }
    );

    console.log('✅ 财务数据迁移完成');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 数据库连接已关闭');
  }
}

migrateFinanceData();