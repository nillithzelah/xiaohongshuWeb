const express = require('express');

const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 获取仪表盘统计数据 (老板专用)
router.get('/stats', authenticateToken, requireRole(['boss', 'manager', 'finance', 'mentor', 'hr']), async (req, res) => {
  try {
    console.log('📊 收到统计数据请求');

    // 并行执行所有查询，速度更快
    const [
      totalReviews,
      pendingReviews,
      mentorReviewing,
      completedReviews,
      rejectedReviews,
      totalUsers
    ] = await Promise.all([
      ImageReview.countDocuments(), // 总审核数
      ImageReview.countDocuments({ status: 'pending' }), // 待审核
      ImageReview.countDocuments({ status: 'mentor_approved' }), // 带教老师审核中（待经理确认）
      ImageReview.countDocuments({ status: 'completed' }), // 已完成
      ImageReview.countDocuments({ status: 'rejected' }), // 已拒绝
      User.countDocuments({ role: 'part_time' }) // 总用户数 (只算兼职用户)
    ]);

    const stats = {
      totalReviews,
      pendingReviews,
      inProgressReviews: mentorReviewing, // 把带教老师审核过的也算作处理中
      completedReviews,
      rejectedReviews,
      totalUsers
    };

    console.log('📊 返回统计数据:', stats);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
});

// HR专用仪表盘统计
router.get('/dashboard/hr', authenticateToken, requireRole(['hr']), async (req, res) => {
  try {
    const hrId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 今日新增线索数（该HR名下的今日新增用户）
    const todayNewLeads = await User.countDocuments({
      role: 'part_time',
      hr_id: hrId,
      createdAt: { $gte: today, $lt: tomorrow },
      is_deleted: { $ne: true }
    });

    // 本月累计客户数（该HR名下的本月累计用户）
    const monthlyClients = await User.countDocuments({
      role: 'part_time',
      hr_id: hrId,
      createdAt: { $gte: monthStart },
      is_deleted: { $ne: true }
    });

    // 待跟进客户数（该HR名下还没有分配给带教老师的用户）
    const pendingFollowups = await User.countDocuments({
      role: 'part_time',
      hr_id: hrId,
      mentor_id: null,
      is_deleted: { $ne: true }
    });

    // 最近录入的 5 条线索（该HR录入的最新用户）
    const recentLeads = await User.find({
      role: 'part_time',
      hr_id: hrId,
      is_deleted: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('username nickname phone wechat createdAt');

    res.json({
      success: true,
      stats: {
        todayNewLeads,
        monthlyClients,
        pendingFollowups
      },
      recentLeads
    });
  } catch (error) {
    console.error('获取销售仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

// 主管专用仪表盘统计
router.get('/dashboard/manager', authenticateToken, requireRole(['manager']), async (req, res) => {
  try {
    // 团队总客户数（所有用户数量）
    const teamTotalClients = await User.countDocuments({
      role: 'part_time',
      is_deleted: { $ne: true }
    });

    // 待分配线索数 (hr_id不为空但mentor_id为空，即分配给HR但还没有分配给带教老师)
    const unassignedLeads = await User.countDocuments({
      role: 'part_time',
      hr_id: { $ne: null },
      mentor_id: null,
      is_deleted: { $ne: true }
    });

    // HR业绩排行榜（按客户数量排序）
    const hrRanking = await User.aggregate([
      {
        $match: {
          role: 'hr',
          is_deleted: { $ne: true }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'hr_id',
          as: 'clients'
        }
      },
      {
        $project: {
          username: 1,
          nickname: 1,
          clientCount: { $size: '$clients' }
        }
      },
      {
        $sort: { clientCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      stats: {
        teamPerformance: teamTotalClients,
        unassignedLeads,
        conversionRate: 0 // 暂时设为0，后续可以计算转化率
      },
      hrRanking
    });
  } catch (error) {
    console.error('获取主管仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

// 带教老师专用仪表盘统计
router.get('/dashboard/mentor', authenticateToken, requireRole(['mentor']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 待审核任务数 (status: pending)
    const pendingReviews = await ImageReview.countDocuments({
      status: 'pending'
    });

    // 我的活跃客户数（分配给我的用户数量）
    const activeClients = await User.countDocuments({
      role: 'part_time',
      mentor_id: req.user._id,
      is_deleted: { $ne: true }
    });

    // 今日已审核数（今日更新的审核记录）
    const completedToday = await ImageReview.countDocuments({
      status: { $in: ['mentor_approved', 'completed', 'rejected'] },
      updatedAt: { $gte: today, $lt: tomorrow }
    });

    // 最近的 5 条待审核任务
    const recentPendingReviews = await ImageReview.find({
      status: 'pending'
    })
    .populate('userId', 'username nickname')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      success: true,
      stats: {
        pendingReviews,
        activeClients,
        completedToday
      },
      pendingReviewsList: recentPendingReviews
    });
  } catch (error) {
    console.error('获取客服仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

// ============ 财务管理相关路由 ============

// 获取待打款列表（按用户汇总）
router.get('/finance/pending', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    console.log('🔍 开始查询待打款列表（按用户汇总）...');

    // 获取所有status为'pending'的交易记录，按用户分组汇总
    const userSummaries = await Transaction.aggregate([
      {
        $match: { status: 'pending' }
      },
      {
        $group: {
          _id: '$user_id',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          transactionIds: { $push: '$_id' },
          types: { $addToSet: '$type' },
          earliestCreated: { $min: '$createdAt' },
          latestCreated: { $max: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $match: {
          'user.is_deleted': { $ne: true }
        }
      },
      {
        $project: {
          user: {
            _id: 1,
            username: 1,
            nickname: 1,
            phone: 1,
            wechat: 1,
            wallet: 1,
            integral_w: 1,
            integral_z: 1
          },
          totalAmount: 1,
          transactionCount: 1,
          transactionIds: 1,
          types: 1,
          earliestCreated: 1,
          latestCreated: 1
        }
      },
      {
        $sort: { latestCreated: -1 }
      }
    ]);

    console.log('📊 查询结果:');
    console.log('   用户数:', userSummaries.length);

    if (userSummaries.length > 0) {
      console.log('📋 第一条记录详情:');
      console.log('   用户:', userSummaries[0].user.username);
      console.log('   总金额:', userSummaries[0].totalAmount);
      console.log('   交易数量:', userSummaries[0].transactionCount);
      console.log('   交易类型:', userSummaries[0].types);
    } else {
      console.log('⚠️ 没有找到任何待打款记录');
    }

    const response = {
      success: true,
      transactions: userSummaries,
      pagination: {
        page: 1,
        limit: userSummaries.length,
        total: userSummaries.length,
        pages: 1
      }
    };

    console.log('✅ 返回汇总响应数据');
    res.json(response);

  } catch (error) {
    console.error('❌ 获取待打款列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取待打款列表失败'
    });
  }
});

// 确认打款（集成阿里支付自动转账）
router.post('/finance/pay', authenticateToken, requireRole(['boss', 'finance']), async (req, res) => {
  const mongoose = require('mongoose');
  const alipayService = require('../services/alipayService');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { transaction_ids } = req.body;

    if (!transaction_ids || !Array.isArray(transaction_ids)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: '请提供交易ID列表'
      });
    }

    // 预先验证所有交易记录
    const transactions = [];
    const currentTimestamp = Date.now();

    for (const transactionId of transaction_ids) {
      const transaction = await Transaction.findById(transactionId).session(session);
      if (!transaction) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `交易记录 ${transactionId} 不存在`
        });
      }
      if (transaction.status !== 'pending') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `交易记录 ${transactionId} 状态不是待支付`
        });
      }

      // 验证金额有效性
      if (transaction.amount <= 0 || transaction.amount > 50000) { // 阿里支付单笔限额5万
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `交易记录 ${transactionId} 金额无效（限额0-50000元）`
        });
      }

      // 验证用户钱包信息
      const user = await User.findById(transaction.user_id).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `用户 ${transaction.user_id} 不存在`
        });
      }
      if (!user.wallet || !user.wallet.alipay_account || !user.wallet.real_name) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `用户 ${user.username} 钱包信息不完整（需要支付宝账号和真实姓名）`
        });
      }

      // 检查用户已提现金额是否会溢出
      const currentWithdrawn = user.wallet.total_withdrawn || 0;
      if (currentWithdrawn + transaction.amount > 999999.99) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `用户 ${user.username} 已提现金额将超过上限`
        });
      }

      transactions.push({
        transaction,
        user,
        previousWithdrawn: currentWithdrawn
      });
    }

    // 处理每笔交易的阿里支付转账
    const successfulPayments = [];
    const failedPayments = [];

    for (const { transaction, user } of transactions) {
      try {
        console.log(`🔄 开始处理交易 ${transaction._id}: 用户 ${user.username}, 金额 ${transaction.amount}元`);

        // 调用阿里支付转账
        const transferResult = await alipayService.transferToAccount({
          outBizNo: transaction._id.toString(),
          payeeAccount: user.wallet.alipay_account,
          payeeRealName: user.wallet.real_name,
          amount: transaction.amount,
          remark: `任务奖励 - ${transaction.type === 'task_reward' ? '任务奖励' : '邀请奖励'}`
        });

        if (transferResult.success) {
          // 转账成功，更新交易记录
          await Transaction.findByIdAndUpdate(
            transaction._id,
            {
              status: 'completed',
              payment_status: 'success',
              paid_at: new Date(),
              paid_by: req.user._id,
              paid_by_name: req.user.username,
              alipay_order_id: transferResult.orderId,
              alipay_pay_date: transferResult.payDate,
              updatedAt: new Date()
            },
            { session }
          );

          // 所有交易类型都直接增加已提现金额
          await User.findByIdAndUpdate(
            user._id,
            {
              $inc: {
                'wallet.total_withdrawn': transaction.amount
              }
            },
            { session }
          );

          successfulPayments.push({
            transactionId: transaction._id,
            userId: user._id,
            username: user.username,
            amount: transaction.amount,
            alipayOrderId: transferResult.orderId
          });

          console.log(`✅ 交易 ${transaction._id} 转账成功: ${transferResult.orderId}`);

        } else {
          // 转账失败，记录错误信息
          await Transaction.findByIdAndUpdate(
            transaction._id,
            {
              payment_status: 'failed',
              payment_error: transferResult.errorMessage || transferResult.subMessage,
              payment_error_code: transferResult.errorCode || transferResult.subCode,
              updatedAt: new Date()
            },
            { session }
          );

          failedPayments.push({
            transactionId: transaction._id,
            userId: user._id,
            username: user.username,
            amount: transaction.amount,
            error: transferResult.errorMessage || transferResult.subMessage
          });

          console.error(`❌ 交易 ${transaction._id} 转账失败:`, transferResult);
        }

      } catch (error) {
        console.error(`❌ 处理交易 ${transaction._id} 时发生异常:`, error);

        // 记录异常错误
        await Transaction.findByIdAndUpdate(
          transaction._id,
          {
            payment_status: 'failed',
            payment_error: error.message,
            payment_error_code: 'EXCEPTION',
            updatedAt: new Date()
          },
          { session }
        );

        failedPayments.push({
          transactionId: transaction._id,
          userId: user._id,
          username: user.username,
          amount: transaction.amount,
          error: error.message
        });
      }
    }

    // 提交事务
    await session.commitTransaction();

    const totalProcessed = successfulPayments.length + failedPayments.length;
    console.log(`✅ 财务打款处理完成: 成功 ${successfulPayments.length}, 失败 ${failedPayments.length}`);

    res.json({
      success: true,
      message: `处理完成：成功 ${successfulPayments.length} 笔，失败 ${failedPayments.length} 笔`,
      results: {
        successful: successfulPayments,
        failed: failedPayments,
        totalProcessed
      }
    });

  } catch (error) {
    // 回滚事务
    await session.abortTransaction();
    console.error('❌ 打款处理失败，已回滚事务:', error);
    res.status(500).json({
      success: false,
      message: '打款处理失败，已回滚所有操作'
    });
  } finally {
    session.endSession();
  }
});

// 导出Excel（简化版，返回JSON数据，前端处理下载）
router.get('/finance/export-excel', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: 'pending' })
      .populate({
        path: 'user_id',
        select: 'username nickname phone wechat wallet integral_w integral_z'
      })
      .sort({ createdAt: -1 });

    // 格式化数据为Excel格式
    const excelData = transactions.map(t => ({
      用户名: t.user_id?.username || '未设置',
      昵称: t.user_id?.nickname || '未设置',
      手机号: t.user_id?.phone || '未设置',
      微信号: t.user_id?.integral_w || '未设置', // 积分号W = 微信号
      支付宝号: t.user_id?.integral_z || '未设置', // 积分号Z = 支付宝号
      支付宝账号: t.user_id?.wallet?.alipay_account || '未设置',
      收款人: t.user_id?.wallet?.real_name || '未设置',
      金额: t.amount,
      类型: t.type === 'task_reward' ? '任务奖励' :
           t.type === 'referral_bonus_1' ? '一级佣金' :
           t.type === 'referral_bonus_2' ? '二级佣金' : t.type,
      创建时间: t.createdAt.toLocaleString('zh-CN')
    }));

    res.json({
      success: true,
      data: excelData,
      filename: `待打款列表_${new Date().toISOString().split('T')[0]}.xlsx`
    });

  } catch (error) {
    console.error('导出Excel失败:', error);
    res.status(500).json({
      success: false,
      message: '导出Excel失败'
    });
  }
});

// 获取财务统计数据
router.get('/finance/stats', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    // 并行获取各项统计数据
    const [
      totalPaidTransactions,
      pendingUsersCount,
      totalUsers
    ] = await Promise.all([
      Transaction.find({ status: 'completed' }),
      // 待打款用户数（按用户去重，排除已删除用户）
      Transaction.aggregate([
        { $match: { status: 'pending' } },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        { $match: { 'user.is_deleted': { $ne: true } } },
        { $group: { _id: '$user_id' } }
      ]).then(result => result.length),
      User.countDocuments({ role: 'part_time', is_deleted: { $ne: true } })
    ]);

    // 计算总打款金额（排除积分兑换交易）
    const totalPaid = totalPaidTransactions
      .filter(t => t.type !== 'point_exchange')
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      stats: {
        totalPaid,
        pendingPayments: pendingUsersCount, // 待打款用户数（排除已删除用户）
        totalUsers
      }
    });

  } catch (error) {
    console.error('获取财务统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取财务统计失败'
    });
  }
});


module.exports = router;