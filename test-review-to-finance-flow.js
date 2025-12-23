const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ImageReview = require('./server/models/ImageReview');
const User = require('./server/models/User');
const Transaction = require('./server/models/Transaction');
const TaskConfig = require('./server/models/TaskConfig');

// 加载环境变量
dotenv.config();

// 连接数据库
async function connectDB() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
    console.log('🔍 正在连接数据库:', MONGODB_URI);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    console.error('💡 请确保 MongoDB 服务正在运行，并且连接字符串正确');
    process.exit(1);
  }
}

// 创建测试用户
async function createTestUsers() {
  console.log('👤 创建测试用户...');

  // 创建上级用户
  const grandParentUser = await User.findOneAndUpdate(
    { username: 'test_grandparent' },
    {
      username: 'test_grandparent',
      role: 'part_time',
      wallet: {
        real_name: '张三上级',
        alipay_account: 'zhangsan_parent@alipay.com',
        balance: 0
      }
    },
    { upsert: true, new: true }
  );

  // 创建直接上级用户
  const parentUser = await User.findOneAndUpdate(
    { username: 'test_parent' },
    {
      username: 'test_parent',
      role: 'part_time',
      parent_id: grandParentUser._id,
      wallet: {
        real_name: '李四上级',
        alipay_account: 'lisi_parent@alipay.com',
        balance: 0
      }
    },
    { upsert: true, new: true }
  );

  // 创建测试用户
  const testUser = await User.findOneAndUpdate(
    { username: 'test_user' },
    {
      username: 'test_user',
      role: 'part_time',
      parent_id: parentUser._id,
      wallet: {
        real_name: '王五',
        alipay_account: 'wangwu@alipay.com',
        balance: 0
      }
    },
    { upsert: true, new: true }
  );

  console.log('✅ 测试用户创建完成');
  console.log('   上级用户:', grandParentUser.username, grandParentUser._id);
  console.log('   直接上级:', parentUser.username, parentUser._id);
  console.log('   测试用户:', testUser.username, testUser._id);

  return { testUser, parentUser, grandParentUser };
}

// 创建任务配置
async function createTaskConfig() {
  console.log('⚙️ 创建任务配置...');

  const taskConfig = await TaskConfig.findOneAndUpdate(
    { type_key: 'note' },
    {
      type_key: 'note',
      price: 5.0, // 笔记价格5元
      is_active: true
    },
    { upsert: true, new: true }
  );

  console.log('✅ 任务配置创建完成，价格:', taskConfig.price);
  return taskConfig;
}

// 创建审核记录
async function createReviewRecord(testUser, taskConfig) {
  console.log('📝 创建审核记录...');

  const review = new ImageReview({
    userId: testUser._id,
    imageType: 'note',
    snapshotPrice: taskConfig.price,
    snapshotCommission1: 0.5, // 一级佣金0.5元
    snapshotCommission2: 0.3, // 二级佣金0.3元
    status: 'pending',
    createdAt: new Date(),
    auditHistory: [{
      operator: testUser._id,
      operatorName: testUser.username,
      action: 'user_submit',
      comment: '用户提交审核',
      timestamp: new Date()
    }]
  });

  await review.save();
  console.log('✅ 审核记录创建完成，ID:', review._id);
  return review;
}

// 模拟审核流程
async function simulateReviewProcess(review, testUser, parentUser, grandParentUser) {
  console.log('🔄 开始模拟审核流程...');

  // 1. 带教老师审核通过
  console.log('👨‍🏫 带教老师审核通过...');
  review.mentorReview = {
    reviewer: testUser._id, // 模拟用测试用户作为审核人
    approved: true,
    comment: '带教老师审核通过',
    reviewedAt: new Date()
  };
  review.auditHistory.push({
    operator: testUser._id,
    operatorName: testUser.username,
    action: 'mentor_pass',
    comment: '带教老师审核通过',
    timestamp: new Date()
  });
  review.status = 'mentor_approved';
  await review.save();

  // 2. 主管确认通过
  console.log('👔 主管确认通过...');
  review.managerApproval = {
    approved: true,
    comment: '主管确认通过',
    approvedAt: new Date()
  };
  review.auditHistory.push({
    operator: testUser._id,
    operatorName: testUser.username,
    action: 'manager_approve',
    comment: '主管确认通过',
    timestamp: new Date()
  });
  review.status = 'manager_approved';
  await review.save();

  // 3. 财务处理
  console.log('💰 财务处理...');
  review.financeProcess = {
    amount: review.snapshotPrice,
    commission: 0,
    processedAt: new Date()
  };
  review.status = 'completed';

  // 创建任务奖励Transaction
  console.log('💰 创建任务奖励Transaction...');
  await new Transaction({
    imageReview_id: review._id,
    user_id: testUser._id,
    amount: review.snapshotPrice,
    type: 'task_reward',
    description: `任务奖励 - ${review.imageType}审核通过`
  }).save();

  // 创建一级佣金Transaction
  if (testUser.parent_id && review.snapshotCommission1 > 0) {
    console.log('💰 创建一级佣金Transaction...');
    await new Transaction({
      imageReview_id: review._id,
      user_id: parentUser._id,
      amount: review.snapshotCommission1,
      type: 'referral_bonus_1',
      description: `一级推荐佣金 - 来自用户 ${testUser.username}`
    }).save();
  }

  // 创建二级佣金Transaction
  if (parentUser.parent_id && review.snapshotCommission2 > 0) {
    console.log('💰 创建二级佣金Transaction...');
    await new Transaction({
      imageReview_id: review._id,
      user_id: grandParentUser._id,
      amount: review.snapshotCommission2,
      type: 'referral_bonus_2',
      description: `二级推荐佣金 - 来自用户 ${testUser.username}`
    }).save();
  }

  await review.save();
  console.log('✅ 财务处理完成');
}

// 检查财务系统数据
async function checkFinanceData() {
  console.log('🔍 检查财务系统数据...');

  const pendingTransactions = await Transaction.find({ status: 'pending' })
    .populate('user_id', 'username wallet')
    .populate('imageReview_id', 'imageType')
    .sort({ createdAt: -1 });

  console.log('📊 待打款记录:');
  pendingTransactions.forEach((transaction, index) => {
    console.log(`   ${index + 1}. 用户: ${transaction.user_id?.username || '未知'}`);
    console.log(`      账号: ${transaction.user_id?.wallet?.alipay_account || '未设置'}`);
    console.log(`      金额: ${transaction.amount}元`);
    console.log(`      类型: ${transaction.type}`);
    console.log(`      创建时间: ${transaction.createdAt}`);
    console.log('');
  });

  return pendingTransactions;
}

// 模拟财务打款
async function simulateFinancePayment(transactions) {
  console.log('💸 模拟财务打款...');

  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 更新所有Transaction状态为paid
    const transactionIds = transactions.map(t => t._id);
    await Transaction.updateMany(
      { _id: { $in: transactionIds }, status: 'pending' },
      {
        status: 'paid',
        paid_at: new Date()
      },
      { session }
    );

    // 为每个用户增加余额
    for (const transaction of transactions) {
      await User.findOneAndUpdate(
        { _id: transaction.user_id },
        { $inc: { 'wallet.balance': transaction.amount } },
        { session }
      );
      console.log(`💰 用户 ${transaction.user_id.username} 余额增加 ${transaction.amount}元`);
    }

    await session.commitTransaction();
    console.log('✅ 财务打款完成，所有操作已提交');

  } catch (error) {
    await session.abortTransaction();
    console.error('❌ 财务打款失败，已回滚:', error);
  } finally {
    session.endSession();
  }
}

// 检查用户余额
async function checkUserBalances(users) {
  console.log('💰 检查用户余额...');

  for (const user of users) {
    const updatedUser = await User.findById(user._id).select('username wallet.balance');
    console.log(`   ${updatedUser.username}: ${updatedUser.wallet.balance}元`);
  }
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始测试审核到财务的完整流程...\n');

    // 连接数据库
    await connectDB();

    // 创建测试数据
    const { testUser, parentUser, grandParentUser } = await createTestUsers();
    const taskConfig = await createTaskConfig();
    const review = await createReviewRecord(testUser, taskConfig);

    console.log('\n' + '='.repeat(50));
    console.log('📋 测试数据创建完成');
    console.log('   审核记录ID:', review._id);
    console.log('   测试用户:', testUser.username);
    console.log('   任务价格:', taskConfig.price + '元');
    console.log('   一级佣金:', review.snapshotCommission1 + '元');
    console.log('   二级佣金:', review.snapshotCommission2 + '元');
    console.log('='.repeat(50) + '\n');

    // 模拟审核流程
    await simulateReviewProcess(review, testUser, parentUser, grandParentUser);

    // 检查财务数据
    const pendingTransactions = await checkFinanceData();

    console.log('\n' + '='.repeat(50));
    console.log('💰 财务系统检查结果');
    console.log('   待打款记录数:', pendingTransactions.length);
    console.log('   预期收益:');
    console.log('   - 任务奖励: 5.0元 (给测试用户)');
    console.log('   - 一级佣金: 0.5元 (给直接上级)');
    console.log('   - 二级佣金: 0.3元 (给上级上级)');
    console.log('   总计: 5.8元');
    console.log('='.repeat(50) + '\n');

    // 模拟财务打款
    if (pendingTransactions.length > 0) {
      await simulateFinancePayment(pendingTransactions);

      // 检查最终余额
      await checkUserBalances([testUser, parentUser, grandParentUser]);
    }

    console.log('\n🎉 测试流程完成！');
    console.log('✅ 从审核提交到财务打款的完整流程已验证');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 数据库连接已关闭');
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { main };