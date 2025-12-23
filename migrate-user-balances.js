const mongoose = require('mongoose');
const User = require('./server/models/User');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit');
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库连接失败:', error);
    process.exit(1);
  }
}

// 迁移用户余额数据
async function migrateUserBalances() {
  try {
    console.log('开始迁移用户余额数据...');

    // 获取所有用户
    const users = await User.find({ is_deleted: false });
    console.log(`找到 ${users.length} 个用户`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      let needsUpdate = false;

      // 初始化wallet对象（如果不存在）
      if (!user.wallet) {
        user.wallet = {
          alipay_account: null,
          real_name: null,
          total_income: 0,
          balance: 0
        };
        needsUpdate = true;
      }

      // 如果wallet.balance为0但points有值，迁移points到balance
      if (user.wallet.balance === 0 && user.points > 0) {
        user.wallet.balance = user.points;
        user.wallet.total_income = user.totalEarnings || 0;
        needsUpdate = true;
        console.log(`迁移用户 ${user.username}: points=${user.points} -> balance=${user.wallet.balance}`);
      }

      // 如果balance已经有值但points不同步，保持balance优先
      if (user.wallet.balance > 0 && user.points !== user.wallet.balance) {
        console.log(`用户 ${user.username} balance=${user.wallet.balance}, points=${user.points} - 保持balance优先`);
        // 可以选择更新points以保持同步
        user.points = user.wallet.balance;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        migratedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`迁移完成: 迁移了 ${migratedCount} 个用户，跳过了 ${skippedCount} 个用户`);

    // 统计迁移结果
    const stats = await User.aggregate([
      {
        $match: { is_deleted: false }
      },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalBalance: { $sum: '$wallet.balance' },
          totalPoints: { $sum: '$points' },
          totalEarnings: { $sum: '$totalEarnings' }
        }
      }
    ]);

    if (stats.length > 0) {
      const stat = stats[0];
      console.log('\n=== 迁移统计 ===');
      console.log(`总用户数: ${stat.totalUsers}`);
      console.log(`总余额 (wallet.balance): ${stat.totalBalance}`);
      console.log(`总积分 (points): ${stat.totalPoints}`);
      console.log(`总收益 (totalEarnings): ${stat.totalEarnings}`);
    }

  } catch (error) {
    console.error('迁移失败:', error);
  }
}

// 主函数
async function main() {
  await connectDB();
  await migrateUserBalances();

  console.log('\n=== 迁移脚本执行完成 ===');
  console.log('建议后续步骤:');
  console.log('1. 检查迁移结果是否正确');
  console.log('2. 更新前端代码使用wallet.balance');
  console.log('3. 逐步废弃points和totalEarnings字段');

  process.exit(0);
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { migrateUserBalances };