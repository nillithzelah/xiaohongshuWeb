const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./server/models/User');
const ImageReview = require('./server/models/ImageReview');
const Transaction = require('./server/models/Transaction');

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
    console.error('💡 请确保 MongoDB 服务正在运行');
    process.exit(1);
  }
}

// 创建测试用户
async function createTestUsers() {
  console.log('👤 创建测试用户...');

  // 创建上级用户（王五）
  const grandParentUser = await User.findOneAndUpdate(
    { username: 'wangwu' },
    {
      username: 'wangwu',
      nickname: '王五',
      role: 'part_time',
      phone: '13800138001',
      wallet: {
        real_name: '王五',
        alipay_account: 'wangwu@alipay.com',
        balance: 0,
        total_earned: 0
      }
    },
    { upsert: true, new: true }
  );

  // 创建直接上级用户（李四）
  const parentUser = await User.findOneAndUpdate(
    { username: 'lisi' },
    {
      username: 'lisi',
      nickname: '李四',
      role: 'part_time',
      phone: '13800138002',
      parent_id: grandParentUser._id,
      wallet: {
        real_name: '李四',
        alipay_account: 'lisi@alipay.com',
        balance: 0,
        total_earned: 0
      }
    },
    { upsert: true, new: true }
  );

  // 创建测试用户（张三）
  const testUser = await User.findOneAndUpdate(
    { username: 'zhangsan' },
    {
      username: 'zhangsan',
      nickname: '张三',
      role: 'part_time',
      phone: '13800138003',
      parent_id: parentUser._id,
      wallet: {
        real_name: '张三',
        alipay_account: 'zhangsan@alipay.com',
        balance: 0,
        total_earned: 0
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

// 创建审核记录和财务记录
async function createReviewAndFinanceRecords(testUser, parentUser, grandParentUser) {
  console.log('📝 创建审核记录和财务记录...');

  // 创建已完成的审核记录（模拟任务奖励）
  const completedReview = new ImageReview({
    userId: testUser._id,
    imageType: 'note',
    snapshotPrice: 5.0, // 任务奖励5元
    snapshotCommission1: 0.5, // 一级佣金0.5元
    snapshotCommission2: 0.3, // 二级佣金0.3元
    status: 'completed',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
    auditHistory: [
      {
        operator: testUser._id,
        operatorName: testUser.username,
        action: 'user_submit',
        comment: '用户提交审核',
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        operator: testUser._id,
        operatorName: '系统管理员',
        action: 'mentor_pass',
        comment: '带教老师审核通过',
        timestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      },
      {
        operator: testUser._id,
        operatorName: '系统管理员',
        action: 'manager_approve',
        comment: '主管确认通过',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  await completedReview.save();

  // 创建对应的财务记录（已打款）
  const paidTransactions = [
    // 任务奖励 - 给张三
    {
      imageReview_id: completedReview._id,
      user_id: testUser._id,
      amount: 5.0,
      type: 'task_reward',
      status: 'paid',
      paid_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      description: `任务奖励 - ${completedReview.imageType}审核通过`
    },
    // 一级佣金 - 给李四
    {
      imageReview_id: completedReview._id,
      user_id: parentUser._id,
      amount: 0.5,
      type: 'referral_bonus_1',
      status: 'paid',
      paid_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      description: `一级推荐佣金 - 来自用户 ${testUser.username}`
    },
    // 二级佣金 - 给王五
    {
      imageReview_id: completedReview._id,
      user_id: grandParentUser._id,
      amount: 0.3,
      type: 'referral_bonus_2',
      status: 'paid',
      paid_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      description: `二级推荐佣金 - 来自用户 ${testUser.username}`
    }
  ];

  for (const transactionData of paidTransactions) {
    await new Transaction(transactionData).save();
  }

  // 更新用户余额
  await User.findByIdAndUpdate(testUser._id, { $inc: { 'wallet.balance': 5.0, 'wallet.total_earned': 5.0 } });
  await User.findByIdAndUpdate(parentUser._id, { $inc: { 'wallet.balance': 0.5, 'wallet.total_earned': 0.5 } });
  await User.findByIdAndUpdate(grandParentUser._id, { $inc: { 'wallet.balance': 0.3, 'wallet.total_earned': 0.3 } });

  console.log('✅ 已完成审核记录和财务记录创建');

  // 创建待打款的记录
  console.log('⏳ 创建待打款记录...');

  const pendingReview = new ImageReview({
    userId: testUser._id,
    imageType: 'comment',
    snapshotPrice: 3.0, // 评论任务3元
    snapshotCommission1: 0.3, // 一级佣金0.3元
    snapshotCommission2: 0.2, // 二级佣金0.2元
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2天前
    auditHistory: [
      {
        operator: testUser._id,
        operatorName: testUser.username,
        action: 'user_submit',
        comment: '用户提交审核',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        operator: testUser._id,
        operatorName: '系统管理员',
        action: 'mentor_pass',
        comment: '带教老师审核通过',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        operator: testUser._id,
        operatorName: '系统管理员',
        action: 'manager_approve',
        comment: '主管确认通过',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12小时前
      }
    ]
  });

  await pendingReview.save();

  // 创建待打款的财务记录
  const pendingTransactions = [
    // 任务奖励 - 给张三
    {
      imageReview_id: pendingReview._id,
      user_id: testUser._id,
      amount: 3.0,
      type: 'task_reward',
      status: 'pending',
      description: `任务奖励 - ${pendingReview.imageType}审核通过`
    },
    // 一级佣金 - 给李四
    {
      imageReview_id: pendingReview._id,
      user_id: parentUser._id,
      amount: 0.3,
      type: 'referral_bonus_1',
      status: 'pending',
      description: `一级推荐佣金 - 来自用户 ${testUser.username}`
    },
    // 二级佣金 - 给王五
    {
      imageReview_id: pendingReview._id,
      user_id: grandParentUser._id,
      amount: 0.2,
      type: 'referral_bonus_2',
      status: 'pending',
      description: `二级推荐佣金 - 来自用户 ${testUser.username}`
    }
  ];

  for (const transactionData of pendingTransactions) {
    await new Transaction(transactionData).save();
  }

  console.log('✅ 待打款记录创建完成');

  return { completedReview, pendingReview };
}

// 检查创建的数据
async function checkCreatedData() {
  console.log('🔍 检查创建的数据...');

  // 检查用户余额
  const users = await User.find({
    username: { $in: ['zhangsan', 'lisi', 'wangwu'] }
  }).select('username wallet.balance wallet.total_earned');

  console.log('👤 用户余额情况:');
  users.forEach(user => {
    console.log(`   ${user.username}: 余额${user.wallet.balance}元，总获得${user.wallet.total_earned}元`);
  });

  // 检查财务统计
  const totalPaidTransactions = await Transaction.find({ status: 'paid' });
  const pendingTransactions = await Transaction.find({ status: 'pending' });

  const totalPaid = totalPaidTransactions.reduce((sum, t) => sum + t.amount, 0);
  const pendingCount = pendingTransactions.length;

  console.log('\n💰 财务统计:');
  console.log(`   已打款金额: ${totalPaid}元`);
  console.log(`   待打款记录: ${pendingCount}条`);

  // 检查待打款详情
  if (pendingCount > 0) {
    console.log('\n📋 待打款详情:');
    const pendingDetails = await Transaction.find({ status: 'pending' })
      .populate('user_id', 'username wallet')
      .populate('imageReview_id', 'imageType');

    pendingDetails.forEach((transaction, index) => {
      console.log(`   ${index + 1}. ${transaction.user_id?.username}: ${transaction.amount}元 (${transaction.type})`);
      console.log(`      账号: ${transaction.user_id?.wallet?.alipay_account}`);
    });
  }
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始添加测试财务数据...\n');

    // 连接数据库
    await connectDB();

    // 创建测试用户
    const { testUser, parentUser, grandParentUser } = await createTestUsers();

    // 创建审核和财务记录
    const { completedReview, pendingReview } = await createReviewAndFinanceRecords(testUser, parentUser, grandParentUser);

    // 检查创建的数据
    await checkCreatedData();

    console.log('\n🎉 测试数据添加完成！');
    console.log('📊 现在您可以访问财务系统查看数据：');
    console.log('   - 已打款金额: 5.8元');
    console.log('   - 待打款记录: 3条');
    console.log('   - 用户余额已更新');

  } catch (error) {
    console.error('❌ 添加测试数据失败:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📪 数据库连接已关闭');
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { main };