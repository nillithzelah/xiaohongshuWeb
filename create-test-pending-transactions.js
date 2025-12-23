const mongoose = require('mongoose');

// 连接数据库并创建测试待支付交易记录
async function createTestPendingTransactions() {
  try {
    console.log('🔍 正在连接数据库...');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 定义模型
    const Transaction = mongoose.model('Transaction', new mongoose.Schema({
      imageReview_id: mongoose.Schema.Types.ObjectId,
      user_id: mongoose.Schema.Types.ObjectId,
      amount: Number,
      type: String,
      status: { type: String, default: 'pending' },
      description: String,
      createdAt: { type: Date, default: Date.now },
      paid_at: Date,
      operator: mongoose.Schema.Types.ObjectId,
      operatorName: String
    }), 'transactions');

    const ImageReview = mongoose.model('ImageReview', new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      imageType: String,
      snapshotPrice: Number,
      snapshotCommission1: Number,
      snapshotCommission2: Number,
      status: String
    }), 'imagereviews');

    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      nickname: String,
      phone: String,
      role: String
    }), 'users');

    // 查找一些已完成的审核记录来创建交易
    console.log('📋 查找已完成的审核记录...');
    const completedReviews = await ImageReview.find({
      status: 'completed',
      snapshotPrice: { $gt: 0 }
    }).limit(5);

    console.log(`找到 ${completedReviews.length} 个已完成的审核记录`);

    if (completedReviews.length === 0) {
      console.log('⚠️ 没有找到已完成的审核记录，请先运行财务流程测试');
      return;
    }

    // 按用户聚合计算待支付金额
    const userPaymentMap = new Map();

    for (let i = 0; i < completedReviews.length; i++) {
      const review = completedReviews[i];

      // 获取用户信息
      const user = await User.findById(review.userId);
      if (!user) continue;

      const userId = review.userId.toString();

      // 初始化用户支付记录
      if (!userPaymentMap.has(userId)) {
        userPaymentMap.set(userId, {
          user: user,
          taskReward: 0,
          commission1: 0,
          commission2: 0,
          reviewIds: []
        });
      }

      const userPayment = userPaymentMap.get(userId);
      userPayment.taskReward += review.snapshotPrice;
      userPayment.commission1 += review.snapshotCommission1 || 0;
      userPayment.commission2 += review.snapshotCommission2 || 0;
      userPayment.reviewIds.push(review._id);
    }

    // 创建按用户聚合的待支付交易
    const testTransactions = [];
    for (const [userId, paymentData] of userPaymentMap) {
      const { user, taskReward, commission1, commission2, reviewIds } = paymentData;

      // 主任务奖励
      if (taskReward > 0) {
        testTransactions.push({
          imageReview_id: reviewIds[0], // 使用第一个审核ID作为代表
          user_id: user._id,
          amount: taskReward,
          type: 'task_reward',
          status: 'pending',
          description: `任务奖励汇总 - ${reviewIds.length}个任务，共¥${taskReward} (测试数据)`,
          operator: null,
          operatorName: '系统测试'
        });
      }

      // 一级佣金
      if (commission1 > 0 && user.parent_id) {
        const parentUser = await User.findById(user.parent_id);
        if (parentUser) {
          testTransactions.push({
            imageReview_id: reviewIds[0],
            user_id: parentUser._id,
            amount: commission1,
            type: 'referral_bonus_1',
            status: 'pending',
            description: `一级推荐佣金汇总 - 来自用户 ${user.username || user.nickname}，共¥${commission1} (测试数据)`,
            operator: null,
            operatorName: '系统测试'
          });
        }
      }

      // 二级佣金
      if (commission2 > 0 && user.parent_id) {
        const parentUser = await User.findById(user.parent_id);
        if (parentUser && parentUser.parent_id) {
          const grandParentUser = await User.findById(parentUser.parent_id);
          if (grandParentUser) {
            testTransactions.push({
              imageReview_id: reviewIds[0],
              user_id: grandParentUser._id,
              amount: commission2,
              type: 'referral_bonus_2',
              status: 'pending',
              description: `二级推荐佣金汇总 - 来自用户 ${user.username || user.nickname}，共¥${commission2} (测试数据)`,
              operator: null,
              operatorName: '系统测试'
            });
          }
        }
      }
    }

    // 插入测试交易记录
    if (testTransactions.length > 0) {
      console.log(`📝 正在创建 ${testTransactions.length} 条测试待支付交易记录...`);
      const insertedTransactions = await Transaction.insertMany(testTransactions);
      console.log(`✅ 成功创建 ${insertedTransactions.length} 条待支付交易记录`);

      // 显示创建的记录详情
      console.log('\n📋 创建的待支付交易记录:');
      for (let i = 0; i < Math.min(insertedTransactions.length, 10); i++) {
        const t = insertedTransactions[i];
        console.log(`${i+1}. [${t.status}] ${t.type} - ¥${t.amount} - ${t.description}`);
      }

      if (insertedTransactions.length > 10) {
        console.log(`... 还有 ${insertedTransactions.length - 10} 条记录`);
      }
    } else {
      console.log('⚠️ 没有创建任何测试交易记录');
    }

    // 再次检查统计
    const finalPendingCount = await Transaction.countDocuments({ status: 'pending' });
    const finalPaidCount = await Transaction.countDocuments({ status: 'paid' });
    const finalTotalCount = await Transaction.countDocuments({});

    console.log('\n📊 更新后的交易统计:');
    console.log(`   待支付: ${finalPendingCount}`);
    console.log(`   已支付: ${finalPaidCount}`);
    console.log(`   总计: ${finalTotalCount}`);

  } catch (error) {
    console.error('❌ 创建测试数据失败:', error.message);
    console.error('🔍 错误详情:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

createTestPendingTransactions();