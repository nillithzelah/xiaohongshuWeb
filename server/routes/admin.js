const express = require('express');

const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TaskConfig = require('../models/TaskConfig');
const Complaint = require('../models/Complaint');
const DiscoveredNote = require('../models/DiscoveredNote');
const ClientHeartbeat = require('../models/ClientHeartbeat');
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

/**
 * 系统监控数据
 * GET /xiaohongshu/api/admin/monitoring
 *
 * 返回系统运行状态数据，包括审核队列、采集任务、客户端状态
 */
router.get('/monitoring', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    console.log('📊 [监控] 收到监控数据请求');

    // 计算今天的开始时间（北京时间）
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 计算5分钟前的时间（用于判断客户端在线状态）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // 并行执行所有查询
    const [
      // 审核队列数据
      pendingNotes,
      pendingComments,
      inProgress,
      todayCompleted,

      // 采集任务数据
      pendingHarvest,
      todayDiscoveredNotes,
      todayHarvestedNotes,
      todayHarvestCommentsTotal,

      // 客户端数据（从 ClientHeartbeat 中获取）
      onlineClients
    ] = await Promise.all([
      // 审核队列
      ImageReview.countDocuments({ imageType: 'note', status: 'pending' }),
      ImageReview.countDocuments({ imageType: 'comment', status: 'pending' }),
      ImageReview.countDocuments({ status: 'processing' }),
      ImageReview.countDocuments({
        updatedAt: { $gte: todayStart },
        status: { $in: ['completed', 'rejected'] }
      }),

      // 采集任务
      DiscoveredNote.countDocuments({
        needsCommentHarvest: true,
        commentsHarvested: { $ne: true }
      }),
      DiscoveredNote.countDocuments({
        createdAt: { $gte: todayStart }
      }),
      DiscoveredNote.countDocuments({
        commentsHarvestedAt: { $gte: todayStart }
      }),
      // 聚合查询：今日采集的评论总数
      DiscoveredNote.aggregate([
        { $match: { commentsHarvestedAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$lastCommentCount' } } }
      ]),

      // 客户端状态：获取5分钟内有心跳的客户端
      ClientHeartbeat.find({
        lastHeartbeat: { $gte: fiveMinutesAgo }
      }).select('clientId status lastHeartbeat taskIds').sort({ lastHeartbeat: -1 })
    ]);

    // 处理今日采集评论数
    const todayComments = todayHarvestCommentsTotal.length > 0 ? todayHarvestCommentsTotal[0].total : 0;

    // 整理客户端列表
    const clientsList = onlineClients.map(client => ({
      clientId: client.clientId,
      lastHeartbeat: client.lastHeartbeat,
      status: client.status || 'online',
      taskCount: client.taskIds ? client.taskIds.length : 0
    }));

    const monitoringData = {
      audit: {
        pendingNotes,
        pendingComments,
        inProgress,
        todayCompleted
      },
      harvest: {
        pendingHarvest,
        todayNotes: todayDiscoveredNotes,
        todayComments: todayComments
      },
      clients: {
        online: clientsList.length,
        list: clientsList
      }
    };

    console.log('📊 [监控] 返回监控数据:', monitoringData);

    res.json({
      success: true,
      data: monitoringData
    });

  } catch (error) {
    console.error('❌ [监控] 获取监控数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取监控数据失败'
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

// 获取财务统计数据（当日、当月、总提现）
router.get('/finance/stats', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    const TimeUtils = require('../utils/timeUtils');
    const now = new Date(TimeUtils.getBeijingTime());

    // 当天开始和结束时间（北京时间）
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 当月开始时间
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    // 查询所有已完成交易（只统计point_exchange类型，这是真正的提现）
    // task_reward是任务奖励，referral_bonus是推荐奖励，不算用户提现
    const completedTransactions = await Transaction.find({ status: 'completed', type: 'point_exchange' });

    // 计算统计数据
    let totalWithdrawn = 0;
    let todayWithdrawn = 0;
    let monthWithdrawn = 0;
    let totalWithdrawnCount = 0;
    let todayWithdrawnCount = 0;
    let monthWithdrawnCount = 0;

    completedTransactions.forEach(t => {
      const amount = t.amount || 0;
      const txTime = new Date(t.createdAt);

      totalWithdrawn += amount;
      totalWithdrawnCount += 1;

      // 判断是否是今日（使用本地时区比较）
      if (txTime >= todayStart && txTime <= todayEnd) {
        todayWithdrawn += amount;
        todayWithdrawnCount += 1;
      }

      // 判断是否是本月
      if (txTime >= monthStart) {
        monthWithdrawn += amount;
        monthWithdrawnCount += 1;
      }
    });

    // 查询待打款金额（只统计有效兼职用户的pending交易）
    const pendingResult = await Transaction.aggregate([
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
      {
        $match: {
          'user.is_deleted': { $ne: true },
          'user.role': 'part_time'
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    const pendingAmount = pendingResult[0]?.totalAmount || 0;
    const pendingCount = pendingResult[0]?.totalCount || 0;

    // 查询兼职用户数量
    const partTimeUserCount = await User.countDocuments({ role: 'part_time', is_deleted: { $ne: true } });

    res.json({
      success: true,
      stats: {
        // 总提现
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        totalWithdrawnCount,
        // 当日提现
        todayWithdrawn: Math.round(todayWithdrawn * 100) / 100,
        todayWithdrawnCount,
        // 当月提现
        monthWithdrawn: Math.round(monthWithdrawn * 100) / 100,
        monthWithdrawnCount,
        // 待打款
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        pendingCount,
        // 兼职用户数
        partTimeUserCount
      }
    });
  } catch (error) {
    console.error('获取财务统计失败:', error);
    res.status(500).json({ success: false, message: '获取财务统计失败' });
  }
});

// 获取提现记录列表（包含用户维度的统计）
router.get('/finance/withdrawal-records', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    const TimeUtils = require('../utils/timeUtils');
    const { startDate, endDate } = req.query;

    // 构建时间范围筛选条件
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      // startDate 格式: YYYY-MM-DD，转换为北京时间当天的开始时间
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00+08:00');
        dateFilter.createdAt.$gte = start;
      }
      // endDate 格式: YYYY-MM-DD，转换为北京时间当天的结束时间
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59+08:00');
        dateFilter.createdAt.$lte = end;
      }
    }

    // 聚合查询：按用户统计提现记录（只统计point_exchange类型）
    // task_reward是任务奖励，referral_bonus是推荐奖励，不算用户提现
    const matchCondition = {
      status: 'completed',
      type: 'point_exchange',
      ...dateFilter
    };

    const records = await Transaction.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$user_id',
          totalWithdrawn: { $sum: '$amount' },
          totalCount: { $sum: 1 },
          lastWithdrawAt: { $max: '$createdAt' },
          firstWithdrawAt: { $min: '$createdAt' },
          transactionIds: { $push: '$_id' }
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
      { $unwind: '$user' },
      {
        $match: {
          'user.is_deleted': { $ne: true },
          'user.role': 'part_time'
        }
      },
      {
        $project: {
          userId: '$_id',
          username: '$user.username',
          nickname: '$user.nickname',
          phone: '$user.phone',
          totalWithdrawn: 1,
          totalCount: 1,
          lastWithdrawAt: 1,
          firstWithdrawAt: 1
        }
      },
      { $sort: { lastWithdrawAt: -1 } }
    ]);

    // 格式化结果
    const result = records.map(record => ({
      userId: record.userId,
      username: record.username,
      nickname: record.nickname,
      phone: record.phone,
      totalWithdrawn: Math.round(record.totalWithdrawn * 100) / 100,
      totalCount: record.totalCount,
      lastWithdrawAtFormatted: record.lastWithdrawAt
        ? TimeUtils.formatBeijingTime(new Date(record.lastWithdrawAt))
        : null
    }));

    // 计算当前选择时间段的汇总
    const summary = {
      totalAmount: 0,
      totalCount: 0,
      userCount: result.length
    };
    result.forEach(r => {
      summary.totalAmount += r.totalWithdrawn;
      summary.totalCount += r.totalCount;
    });
    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;

    res.json({
      success: true,
      records: result,
      summary: summary
    });
  } catch (error) {
    console.error('获取提现记录失败:', error);
    res.status(500).json({ success: false, message: '获取提现记录失败' });
  }
});

// 获取兼职用户待打款列表
router.get('/finance/part-time-pending', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    console.log('🔍 查询兼职用户待打款列表...');

    // 获取兼职用户（part_time）的待打款记录
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
          'user.is_deleted': { $ne: true },
          'user.role': 'part_time'  // 只返回兼职用户
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
            integral_z: 1,
            mentor_id: 1,
            hr_id: 1,
            training_status: 1
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

    console.log(`📊 找到 ${userSummaries.length} 个有待打款的兼职用户`);

    res.json({
      success: true,
      transactions: userSummaries,
      pagination: {
        total: userSummaries.length
      }
    });

  } catch (error) {
    console.error('❌ 获取兼职用户待打款列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取兼职用户待打款列表失败'
    });
  }
});

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

      // 验证用户是否存在
      const user = await User.findById(transaction.user_id).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `用户 ${transaction.user_id} 不存在`
        });
      }

      transactions.push({
        transaction,
        user,
        previousWithdrawn: user.wallet?.total_withdrawn || 0
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

          // 只有 point_exchange 类型才增加已提现金额
          // task_reward 和 referral_bonus 是收入，不是提现
          if (transaction.type === 'point_exchange') {
            await User.findByIdAndUpdate(
              user._id,
              {
                $inc: {
                  'wallet.total_withdrawn': transaction.amount
                }
              },
              { session }
            );
          }

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

    // 计算总打款金额（排除积分兑换交易，避免浮点精度问题）
    const totalPaid = Math.round(
      totalPaidTransactions
        .filter(t => t.type !== 'point_exchange')
        .reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

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

// ============ 任务积分管理相关路由 ============

// 获取任务积分配置列表
router.get('/task-points', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const configs = await TaskConfig.find({ is_active: true })
      .select('type_key name price commission_1 commission_2 daily_reward_points continuous_check_days')
      .sort({ type_key: 1 });

    res.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error('获取任务积分配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务积分配置失败'
    });
  }
});

// 更新任务积分配置
router.put('/task-points/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    console.log('📝 收到更新任务积分配置请求');
    console.log('📝 请求体:', JSON.stringify(req.body, null, 2));

    const { price, commission_1, commission_2, daily_reward_points, continuous_check_days } = req.body;

    console.log('📝 解构后的参数:', {
      id: req.params.id,
      price,
      commission_1,
      commission_2,
      daily_reward_points,
      continuous_check_days
    });

    // 验证参数：只有任务积分、一级分销积分、二级分销积分是必填项
    if (price === undefined || commission_1 === undefined || commission_2 === undefined) {
      return res.status(400).json({
        success: false,
        message: '任务积分、一级分销积分、二级分销积分是必填项'
      });
    }

    if (price < 0 || commission_1 < 0 || commission_2 < 0 || (daily_reward_points !== undefined && daily_reward_points < 0)) {
      return res.status(400).json({
        success: false,
        message: '积分值不能为负数'
      });
    }

    if (continuous_check_days !== undefined && (continuous_check_days < 1 || continuous_check_days > 365)) {
      return res.status(400).json({
        success: false,
        message: '持续检查天数必须在1-365天之间'
      });
    }

    const updateData = {
      price,
      commission_1,
      commission_2,
      updatedAt: new Date()
    };

    // 只有提供了这些字段才更新
    if (daily_reward_points !== undefined) {
      updateData.daily_reward_points = daily_reward_points;
    }
    if (continuous_check_days !== undefined) {
      updateData.continuous_check_days = continuous_check_days;
    }

    console.log('📝 执行数据库更新，ID:', req.params.id);
    console.log('📝 更新数据:', JSON.stringify(updateData, null, 2));

    try {
      // 使用 findOneAndUpdate 确保更新并返回结果
      console.log('📝 使用 findOneAndUpdate 更新配置');

      const updatedDoc = await TaskConfig.findOneAndUpdate(
        { _id: req.params.id },
        { $set: updateData },
        {
          new: true,  // 返回更新后的文档
          runValidators: false  // 跳过验证以避免问题
        }
      );

      if (!updatedDoc) {
        console.log('❌ 没有找到匹配的文档');
        return res.status(404).json({
          success: false,
          message: '任务配置不存在'
        });
      }

      console.log('✅ 文档更新成功:', {
        id: updatedDoc._id,
        price: updatedDoc.price,
        commission_1: updatedDoc.commission_1,
        commission_2: updatedDoc.commission_2,
        daily_reward_points: updatedDoc.daily_reward_points
      });

      res.json({
        success: true,
        message: '任务积分配置更新成功',
        config: updatedDoc
      });

    } catch (updateError) {
      console.error('📝 数据库更新异常:', updateError);
      return res.status(500).json({
        success: false,
        message: '数据库更新失败'
      });
    }

  } catch (error) {
    console.error('更新任务积分配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新任务积分配置失败'
    });
  }
});

// ============ 兼职用户管理相关路由 ============

// 执行用户提现（将待打款移至已提现）
router.post('/withdraw/:userId', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { userId } = req.params;

    // 查找用户 - 支持 username 或 ObjectId（防御性编程）
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
    let user;
    if (isValidObjectId) {
      user = await User.findById(userId);
    }
    if (!user) {
      user = await User.findOne({ username: userId });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 使用用户的 ObjectId 进行后续操作
    const userObjectId = user._id;

    // 查找该用户的所有待打款交易
    const pendingTransactions = await Transaction.find({
      user_id: userObjectId,
      status: 'pending'
    });

    if (pendingTransactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '该用户没有待打款记录'
      });
    }

    // 计算总提现金额（避免浮点精度问题，使用整数运算）
    const totalWithdrawAmount = Math.round(
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // 由于使用内部打款，不再需要检查用户钱包信息

    // 更新所有待打款交易为已完成状态
    await Transaction.updateMany(
      {
        user_id: userObjectId,
        status: 'pending'
      },
      {
        status: 'completed',
        paid_at: new Date(),
        paid_by: req.user._id,
        paid_by_name: req.user.username,
        payment_status: 'completed',
        updatedAt: new Date()
      }
    );

    // 更新用户已提现金额（只计算 point_exchange 类型）
    const pointExchangeAmount = pendingTransactions
      .filter(t => t.type === 'point_exchange')
      .reduce((sum, t) => sum + t.amount, 0);
    if (pointExchangeAmount > 0) {
      const currentWithdrawn = user.wallet?.total_withdrawn || 0;
      await User.findByIdAndUpdate(userObjectId, {
        $inc: {
          'wallet.total_withdrawn': pointExchangeAmount
        }
      });
    }

    // 更新响应数据
    const currentWithdrawn = user.wallet?.total_withdrawn || 0;
    res.json({
      success: true,
      message: `提现成功：处理了${pendingTransactions.length}笔交易，总金额${(totalWithdrawAmount / 100).toFixed(2)}元`,
      data: {
        userId: userObjectId,
        username: user.username,
        transactionCount: pendingTransactions.length,
        totalAmount: totalWithdrawAmount,
        pointExchangeAmount: pointExchangeAmount,
        newTotalWithdrawn: currentWithdrawn + pointExchangeAmount
      }
    });

  } catch (error) {
    console.error('执行提现失败:', error);
    res.status(500).json({
      success: false,
      message: '执行提现失败'
    });
  }
});

// 驳回兑换：将待打款积分返还给用户
router.post('/reject-exchange/:userId', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // 驳回原因（可选）

    // 查找用户
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
    let user;
    if (isValidObjectId) {
      user = await User.findById(userId);
    }
    if (!user) {
      user = await User.findOne({ username: userId });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const userObjectId = user._id;

    // 查找该用户的所有待打款交易
    const pendingTransactions = await Transaction.find({
      user_id: userObjectId,
      status: 'pending'
    });

    if (pendingTransactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '该用户没有待打款记录'
      });
    }

    // 计算总返还金额（积分）
    const totalRefundAmount = Math.round(
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // 返还积分给用户
    await User.findByIdAndUpdate(userObjectId, {
      $inc: { points: totalRefundAmount }
    });

    // 更新所有待打款交易为已驳回状态
    await Transaction.updateMany(
      {
        user_id: userObjectId,
        status: 'pending'
      },
      {
        status: 'failed',
        payment_status: 'failed',
        payment_error: reason || '管理员驳回兑换',
        updatedAt: new Date()
      }
    );

    console.log(`🚫 [驳回兑换] 用户 ${user.username}，返还积分: ${totalRefundAmount}，原因: ${reason || '无'}`);

    res.json({
      success: true,
      message: `驳回成功：已返还${totalRefundAmount}积分到用户账户`,
      data: {
        userId: userObjectId,
        username: user.username,
        transactionCount: pendingTransactions.length,
        refundAmount: totalRefundAmount,
        newPoints: user.points + totalRefundAmount
      }
    });

  } catch (error) {
    console.error('驳回兑换失败:', error);
    res.status(500).json({
      success: false,
      message: '驳回兑换失败'
    });
  }
});

// ============ Cookie管理相关路由 ============

// 获取当前小红书Cookie信息（从环境变量读取，避免命令注入）
router.get('/cookie', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    // 从环境变量读取，避免命令注入风险
    const cookie = process.env.XIAOHONGSHU_COOKIE || '';

    if (!cookie) {
      return res.json({
        success: true,
        cookie: '',
        expiryInfo: null,
        maskedCookie: null,
        message: '未配置Cookie'
      });
    }

    console.log('🔍 从环境变量读取Cookie信息');

    // 解析cookie中的时间戳，计算过期时间
    let expiryInfo = null;
    if (cookie) {
      // 从cookie中提取loadts时间戳
      const loadtsMatch = cookie.match(/loadts=(\d{13})/);
      if (loadtsMatch) {
        const loadts = parseInt(loadtsMatch[1]);
        const loadDate = new Date(loadts);
        // 小红书cookie通常有效期为30天
        const expiryDate = new Date(loadDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const timeLeft = expiryDate.getTime() - now.getTime();

        expiryInfo = {
          loadedAt: loadDate.toISOString(),
          expiresAt: expiryDate.toISOString(),
          timeLeftMs: timeLeft,
          timeLeftText: timeLeft > 0 ?
            `${Math.floor(timeLeft / (24 * 60 * 60 * 1000))}天 ${Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))}小时` :
            '已过期',
          isExpired: timeLeft <= 0
        };
      }
    }

    res.json({
      success: true,
      cookie: cookie,
      expiryInfo: expiryInfo,
      maskedCookie: cookie ? cookie.substring(0, 50) + '...' : null
    });

  } catch (error) {
    console.error('获取Cookie信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie信息失败'
    });
  }
});

// 获取Cookie监控状态
router.get('/cookie/status', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const cookieMonitorService = require('../services/cookieMonitorService');
    const status = cookieMonitorService.getStatus();
    
    res.json({
      success: true,
      status: {
        isValid: status.isValid,
        lastCheckTime: status.lastCheckTime,
        cookieAge: status.cookieAge,
        cookieCreateTime: status.cookieCreateTime,
        checkInterval: status.checkInterval,
        nextCheckTime: status.nextCheckTime
      }
    });

  } catch (error) {
    console.error('获取Cookie监控状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie监控状态失败'
    });
  }
});

// 更新小红书Cookie（安全版本，避免命令注入）
router.put('/cookie', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { cookie } = req.body;

    if (!cookie || typeof cookie !== 'string' || cookie.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cookie不能为空'
      });
    }

    // 验证cookie格式（至少包含一些基本字段）
    const requiredFields = ['a1=', 'webId=', 'web_session='];
    const hasRequiredFields = requiredFields.some(field => cookie.includes(field));

    if (!hasRequiredFields) {
      return res.status(400).json({
        success: false,
        message: 'Cookie格式不正确，缺少必要的登录信息'
      });
    }

    // 安全检查：防止命令注入
    // 只允许字母、数字、常见符号，拒绝shell元字符
    const dangerousChars = ['$', '`', '|', '&', ';', '(', ')', '<', '>', '\n', '\r'];
    const hasDangerousChars = dangerousChars.some(char => cookie.includes(char));
    if (hasDangerousChars) {
      return res.status(400).json({
        success: false,
        message: 'Cookie包含非法字符'
      });
    }

    console.log('🔄 收到Cookie更新请求，长度:', cookie.length);

    // 返回更新说明（避免命令注入，改为手动更新方式）
    res.json({
      success: true,
      message: 'Cookie验证通过，请手动更新服务器上的 .env 文件中的 XIAOHONGSHU_COOKIE 变量',
      cookieLength: cookie.length,
      maskedCookie: cookie.substring(0, 50) + '...',
      updateInstructions: [
        '1. SSH登录到服务器',
        '2. 编辑 /var/www/xiaohongshu-web/server/.env 文件',
        '3. 更新 XIAOHONGSHU_COOKIE 变量值',
        '4. 运行 pm2 restart xiaohongshu-api --update-env'
      ]
    });

  } catch (error) {
    console.error('更新Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Cookie失败'
    });
  }
});

// ============ 投诉管理相关路由 ============

// 获取投诉列表
router.get('/complaints', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, keyword } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // 状态过滤
    if (status) {
      query.status = status;
    }

    // 搜索投诉内容或用户信息
    if (keyword) {
      // 这里需要联合查询用户信息
      const userIds = await User.find({
        $or: [
          { username: { $regex: keyword, $options: 'i' } },
          { nickname: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ]
      }).select('_id');

      query.$or = [
        { content: { $regex: keyword, $options: 'i' } },
        { userId: { $in: userIds.map(u => u._id) } }
      ];
    }

    const complaints = await Complaint.find(query)
      .populate('userId', 'username nickname phone')
      .populate('respondedBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(query);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取投诉列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取投诉列表失败'
    });
  }
});

// 更新投诉状态和回复
router.put('/complaints/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { status, adminResponse } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
    }

    if (adminResponse && adminResponse.trim()) {
      updateData.adminResponse = adminResponse.trim();
      updateData.respondedBy = req.user._id;
      updateData.respondedAt = new Date();
    }

    const updatedComplaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('userId', 'username nickname phone')
    .populate('respondedBy', 'username nickname');

    if (!updatedComplaint) {
      return res.status(404).json({
        success: false,
        message: '投诉不存在'
      });
    }

    res.json({
      success: true,
      message: '投诉更新成功',
      data: updatedComplaint
    });

  } catch (error) {
    console.error('更新投诉失败:', error);
    res.status(500).json({
      success: false,
      message: '更新投诉失败'
    });
  }
});


// ==================== Cookie监控相关路由 ====================

// 获取Cookie状态
// ==================== Cookie池相关路由 ====================

// 获取Cookie池状态
router.get('/cookie-pool-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');
    const status = simpleCookiePool.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('获取Cookie池状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie池状态失败'
    });
  }
});

// 重新加载Cookie池配置
router.post('/cookie-pool-reload', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');
    simpleCookiePool.reload();
    const status = simpleCookiePool.getStatus();

    res.json({
      success: true,
      message: 'Cookie池配置已重新加载',
      data: status
    });
  } catch (error) {
    console.error('重新加载Cookie池失败:', error);
    res.status(500).json({
      success: false,
      message: '重新加载Cookie池失败'
    });
  }
});

// 新增/更新Cookie
router.post('/cookie-pool-update', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { cookies } = req.body;

    if (!Array.isArray(cookies)) {
      return res.status(400).json({
        success: false,
        message: '参数格式错误'
      });
    }

    // 只保留原始配置字段，过滤掉状态字段（loadDate, ageHours等）
    const cleanCookies = cookies.map(c => {
      let cookieValue = c.value;
      let loadts = c.loadts;

      // 检查是否是JSON数组格式（浏览器导出格式）
      if (cookieValue && typeof cookieValue === 'string' && cookieValue.trim().startsWith('[')) {
        try {
          const cookieArray = JSON.parse(cookieValue);
          if (Array.isArray(cookieArray)) {
            // 转换为Cookie字符串格式: name1=value1; name2=value2; ...
            cookieValue = cookieArray
              .filter(item => item.name && item.value)
              .map(item => `${item.name}=${item.value}`)
              .join('; ');

            console.log(`🔄 [Cookie池] 已将JSON格式转换为Cookie字符串，${cookieArray.length}个cookie`);

            // 从数组中提取loadts
            const loadtsCookie = cookieArray.find(item => item.name === 'loadts');
            if (loadtsCookie && loadtsCookie.value) {
              loadts = parseInt(loadtsCookie.value);
            }
          }
        } catch (e) {
          console.log('⚠️ [Cookie池] value不是有效JSON，作为Cookie字符串处理');
        }
      }

      // 从cookie字符串中提取loadts（如果还没有）
      if (!loadts && cookieValue) {
        const loadtsMatch = cookieValue.match(/loadts=(\d{13})/);
        if (loadtsMatch) {
          loadts = parseInt(loadtsMatch[1]);
        }
      }

      return {
        id: c.id,
        name: c.name,
        value: cookieValue,
        loadts: loadts || Date.now(),
        estimatedExpiry: c.estimatedExpiry || 72,
        priority: c.priority || 5,
        enabled: c.enabled !== false
      };
    });

    // 写入配置文件
    const fs = require('fs');
    const path = require('path');

    const configContent = `/**
 * Cookie 池配置
 * 添加多个小红书账号的 Cookie，系统会自动轮询使用
 *
 * 获取 Cookie 步骤：
 * 1. 浏览器登录小红书
 * 2. F12 → Network → 刷新页面
 * 3. 点击任意请求 → Request Headers → Cookie
 * 4. 复制完整 Cookie 字符串到下面
 *
 * 支持两种格式：
 * - Cookie字符串格式: a1=xxx; webId=xxx; web_session=xxx; ...
 * - 浏览器导出JSON格式: [{"name":"a1","value":"xxx"},...]
 */

module.exports = {
  // Cookie 列表
  cookies: ${JSON.stringify(cleanCookies, null, 2)}
};
`;

    const configPath = path.join(__dirname, '../config/cookie-pool.js');
    fs.writeFileSync(configPath, configContent, 'utf8');

    // 重新加载配置
    const simpleCookiePool = require('../services/SimpleCookiePool');
    simpleCookiePool.reload();

    res.json({
      success: true,
      message: 'Cookie配置已更新',
      data: simpleCookiePool.getStatus()
    });
  } catch (error) {
    console.error('更新Cookie配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Cookie配置失败: ' + error.message
    });
  }
});

// 获取审核暂停状态
router.get('/audit-pause-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');
    const pauseStatus = simpleCookiePool.getAuditPauseStatus();

    res.json({
      success: true,
      data: pauseStatus
    });
  } catch (error) {
    console.error('获取审核暂停状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取审核暂停状态失败'
    });
  }
});

// 恢复审核（当有新Cookie生效时手动调用）
router.post('/audit-resume', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');

    // 检查是否还有有效的Cookie
    const allInvalid = simpleCookiePool.areAllCookiesInvalid();

    if (allInvalid) {
      return res.json({
        success: false,
        message: '无法恢复审核：所有Cookie均已失效，请先更新Cookie'
      });
    }

    simpleCookiePool.resumeAudits();

    res.json({
      success: true,
      message: '审核已恢复'
    });
  } catch (error) {
    console.error('恢复审核失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复审核失败'
    });
  }
});

// 清除Cookie失效标记（用于重置特定Cookie或全部Cookie）
router.post('/cookie-clear-invalid', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { cookieId } = req.body;
    const simpleCookiePool = require('../services/SimpleCookiePool');

    if (cookieId) {
      // 清除特定Cookie的失效标记
      simpleCookiePool.clearInvalidCookies(cookieId);
    } else {
      // 清除所有失效标记
      simpleCookiePool.clearInvalidCookies();
    }

    res.json({
      success: true,
      message: cookieId ? `已清除Cookie ${cookieId} 的失效标记` : '已清除所有失效标记',
      data: simpleCookiePool.getStatus()
    });
  } catch (error) {
    console.error('清除失效标记失败:', error);
    res.status(500).json({
      success: false,
      message: '清除失效标记失败'
    });
  }
});

// ==================== 公告管理相关路由 ====================

const Announcement = require('../models/Announcement');

// 获取公告列表
router.get('/announcements', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 20, enabled } = req.query;

    const query = {};
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    const total = await Announcement.countDocuments(query);
    const announcements = await Announcement.find(query)
      .sort({ isPinned: -1, order: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'nickname')
      .populate('updatedBy', 'nickname');

    res.json({
      success: true,
      data: {
        list: announcements,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告列表失败'
    });
  }
});

// 获取单个公告详情
router.get('/announcement/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'nickname')
      .populate('updatedBy', 'nickname');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    console.error('获取公告详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告详情失败'
    });
  }
});

// 创建公告
router.post('/announcement', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { title, content, type, order, enabled, isPinned, actionType, actionData, textColor, fontSize } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    const announcement = new Announcement({
      title,
      content,
      type: type || 'info',
      order: order || 0,
      enabled: enabled !== undefined ? enabled : true,
      isPinned: isPinned || false,
      actionType: actionType || 'none',
      actionData: actionData || '',
      textColor: textColor || '#ffffff',
      fontSize: fontSize || '28',
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await announcement.save();

    res.json({
      success: true,
      message: '公告创建成功',
      data: announcement
    });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({
      success: false,
      message: '创建公告失败: ' + error.message
    });
  }
});

// 更新公告
router.put('/announcement/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { title, content, type, order, enabled, isPinned, actionType, actionData, textColor, fontSize } = req.body;

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (order !== undefined) announcement.order = order;
    if (enabled !== undefined) announcement.enabled = enabled;
    if (isPinned !== undefined) announcement.isPinned = isPinned;
    if (actionType) announcement.actionType = actionType;
    if (actionData !== undefined) announcement.actionData = actionData;
    if (textColor) announcement.textColor = textColor;
    if (fontSize) announcement.fontSize = fontSize;
    announcement.updatedBy = req.user.userId;

    await announcement.save();

    res.json({
      success: true,
      message: '公告更新成功',
      data: announcement
    });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({
      success: false,
      message: '更新公告失败: ' + error.message
    });
  }
});

// 删除公告
router.delete('/announcement/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({
      success: false,
      message: '删除公告失败'
    });
  }
});

// 切换公告启用状态
router.put('/announcement/:id/toggle', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    announcement.enabled = !announcement.enabled;
    announcement.updatedBy = req.user.userId;
    await announcement.save();

    res.json({
      success: true,
      message: `公告已${announcement.enabled ? '启用' : '禁用'}`,
      data: announcement
    });
  } catch (error) {
    console.error('切换公告状态失败:', error);
    res.status(500).json({
      success: false,
      message: '切换公告状态失败'
    });
  }
});

// ==================== Cookie监控相关路由 ====================

// 获取Cookie状态
router.get('/cookie-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookieMonitorService = require('../services/cookieMonitorService');
    const status = cookieMonitorService.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('获取Cookie状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie状态失败'
    });
  }
});

// 手动检查Cookie
router.post('/cookie-check', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookieMonitorService = require('../services/cookieMonitorService');
    const result = await cookieMonitorService.manualCheck();

    res.json({
      success: true,
      message: 'Cookie检查完成',
      data: result
    });
  } catch (error) {
    console.error('手动检查Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '手动检查Cookie失败'
    });
  }
});

// ==================== CookiePoolService（数据库版本）相关路由 ====================

// 获取Cookie池统计
router.get('/cookies/stats', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const stats = await cookiePoolService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取Cookie池统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie池统计失败'
    });
  }
});

// 获取所有Cookie列表
router.get('/cookies', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const { status } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const cookies = await CookiePool.find(query)
      .sort({ priority: -1, 'metadata.lastUsed': 1 })
      .select('-cookie'); // 不返回完整的cookie值，只返回元数据
    
    res.json({
      success: true,
      data: cookies
    });
  } catch (error) {
    console.error('获取Cookie列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie列表失败'
    });
  }
});

// 获取单个Cookie详情
router.get('/cookies/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const cookie = await CookiePool.findById(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    res.json({
      success: true,
      data: cookie
    });
  } catch (error) {
    console.error('获取Cookie详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie详情失败'
    });
  }
});

// 添加新Cookie
router.post('/cookies', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { cookie, priority, notes } = req.body;
    
    if (!cookie || typeof cookie !== 'string' || cookie.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cookie不能为空'
      });
    }
    
    const cookiePoolService = require('../services/CookiePoolService');
    const newCookie = await cookiePoolService.addCookie(cookie, {
      priority,
      notes,
      source: 'admin_api'
    });
    
    res.json({
      success: true,
      message: 'Cookie添加成功',
      data: newCookie
    });
  } catch (error) {
    console.error('添加Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '添加Cookie失败'
    });
  }
});

// 更新Cookie
router.put('/cookies/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const cookie = await CookiePool.findById(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    const { cookie: newCookieValue, priority, notes, status } = req.body;
    
    // 如果提供了新的Cookie值，需要验证
    if (newCookieValue && newCookieValue.trim().length > 0) {
      const cookiePoolService = require('../services/CookiePoolService');
      const isValid = await cookiePoolService.validateCookie(newCookieValue);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Cookie无效，请检查是否已登录或Cookie是否过期'
        });
      }
      
      cookie.cookie = newCookieValue.trim();
      cookie.status = 'active';
      cookie.metadata.lastCheck = new Date();
    }
    
    if (priority !== undefined) {
      cookie.priority = priority;
    }
    
    if (notes !== undefined) {
      cookie.notes = notes;
    }
    
    if (status !== undefined) {
      cookie.status = status;
    }
    
    await cookie.save();
    
    res.json({
      success: true,
      message: 'Cookie更新成功',
      data: cookie
    });
  } catch (error) {
    console.error('更新Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Cookie失败'
    });
  }
});

// 删除Cookie
router.delete('/cookies/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const cookie = await cookiePoolService.deleteCookie(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'Cookie删除成功'
    });
  } catch (error) {
    console.error('删除Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '删除Cookie失败'
    });
  }
});

// 切换Cookie状态
router.put('/cookies/:id/toggle', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const cookie = await cookiePoolService.toggleCookieStatus(req.params.id);
    
    res.json({
      success: true,
      message: `Cookie已${cookie.status === 'active' ? '启用' : '禁用'}`,
      data: cookie
    });
  } catch (error) {
    console.error('切换Cookie状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '切换Cookie状态失败'
    });
  }
});

// 手动检查单个Cookie
router.post('/cookies/:id/check', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const result = await cookiePoolService.checkSingleCookie(req.params.id);
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('检查Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查Cookie失败'
    });
  }
});

// 批量检查所有Cookie
router.post('/cookies/check-all', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const result = await cookiePoolService.checkAllCookies();
    
    res.json({
      success: true,
      message: `检查完成: ${result.checked}个有效, ${result.expired}个失效`,
      data: result
    });
  } catch (error) {
    console.error('批量检查Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '批量检查Cookie失败'
    });
  }
});

// 标记Cookie为失效
router.post('/cookies/:id/mark-expired', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const cookie = await CookiePool.findById(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    const cookiePoolService = require('../services/CookiePoolService');
    await cookiePoolService.markCookieExpired(cookie.cookie, '手动标记为失效');
    
    res.json({
      success: true,
      message: 'Cookie已标记为失效'
    });
  } catch (error) {
    console.error('标记Cookie失效失败:', error);
    res.status(500).json({
      success: false,
      message: '标记Cookie失效失败'
    });
  }
});

module.exports = router;