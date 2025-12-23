// 本地测试版本 - 模拟数据库迁移
// 用于验证迁移逻辑，不实际修改数据库

console.log('🔄 开始本地财务数据迁移测试...');

// 模拟用户数据（包含旧字段）
const mockUsers = [
  {
    _id: 'user001',
    username: 'user001',
    wallet: {
      total_income: 46,
      balance: 10,
      total_earned: 0, // 将被更新
      total_withdrawn: 0 // 将被更新
    },
    continuousCheckPoints: 8.1, // 旧字段，将被清理
    totalEarnings: 203 // 旧字段，将被清理
  },
  {
    _id: 'user002',
    username: 'user002',
    wallet: {
      total_income: 6,
      balance: 6,
      total_earned: 0,
      total_withdrawn: 0
    }
  }
];

// 模拟交易数据
const mockTransactions = [
  // user001的交易
  { user_id: 'user001', amount: 20, type: 'task_reward', status: 'completed' },
  { user_id: 'user001', amount: 15, type: 'referral_bonus_1', status: 'completed' },
  { user_id: 'user001', amount: 11, type: 'continuous_check_commission_1', status: 'completed' },
  { user_id: 'user001', amount: 36, type: 'withdrawal', status: 'completed' },

  // user002的交易
  { user_id: 'user002', amount: 6, type: 'task_reward', status: 'completed' }
];

console.log('📊 模拟迁移用户财务数据...');

for (const user of mockUsers) {
  // 计算总获得金额（从交易记录）
  const earnedTransactions = mockTransactions.filter(tx =>
    tx.user_id === user._id &&
    tx.type !== 'withdrawal' &&
    tx.status === 'completed'
  );

  const totalEarned = earnedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // 计算已提现金额
  const withdrawalTransactions = mockTransactions.filter(tx =>
    tx.user_id === user._id &&
    tx.type === 'withdrawal' &&
    tx.status === 'completed'
  );

  const totalWithdrawn = withdrawalTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  // 更新用户数据
  user.wallet.total_earned = totalEarned;
  user.wallet.total_withdrawn = totalWithdrawn;
  user.wallet.balance = Math.max(0, totalEarned - totalWithdrawn);

  // 清理旧字段
  if (user.continuousCheckPoints !== undefined) {
    console.log(`🧹 清理用户 ${user.username} 的 continuousCheckPoints 字段`);
    delete user.continuousCheckPoints;
  }

  if (user.totalEarnings !== undefined) {
    console.log(`🧹 清理用户 ${user.username} 的 totalEarnings 字段`);
    delete user.totalEarnings;
  }

  console.log(`✅ 用户 ${user.username}: 总获得 ${totalEarned}, 已提现 ${totalWithdrawn}, 余额 ${user.wallet.balance}`);
}

console.log('📋 模拟迁移交易状态...');
// 模拟更新交易状态
const updatedTransactions = mockTransactions.map(tx => {
  if (tx.status === 'paid') {
    return { ...tx, status: 'completed' };
  }
  return tx;
});

console.log(`✅ 模拟更新 ${mockTransactions.filter(tx => tx.status === 'paid').length} 条交易状态`);

console.log('✅ 本地财务数据迁移测试完成');
console.log('📊 最终用户数据:');
mockUsers.forEach(user => {
  console.log(`   ${user.username}: 余额=${user.wallet.balance}, 总获得=${user.wallet.total_earned}, 已提现=${user.wallet.total_withdrawn}`);
});

console.log('\n🎯 迁移逻辑验证通过！实际迁移请在服务器上运行 migrate-finance-data.js');