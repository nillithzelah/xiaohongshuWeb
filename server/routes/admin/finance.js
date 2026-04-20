/**
 * 财务管理路由模块
 *
 * 从 admin.js 拆分出的财务相关路由
 * 包含：财务统计、提现记录、打款处理等
 */

const express = require('express');
const mongoose = require('mongoose');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const TaskConfig = require('../../models/TaskConfig');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();
const log = logger.module('Finance');

// ==================== 财务统计 ====================

/**
 * 获取财务统计数据（当日、当月、总提现）
 * GET /finance/stats
 */
router.get('/stats', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    const TimeUtils = require('../../utils/timeUtils');
    const now = new Date(TimeUtils.getBeijingTime());

    // 当天开始和结束时间（北京时间）
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 当月开始时间
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    // 查询所有已完成交易（只统计point_exchange类型）
    const completedTransactions = await Transaction.find({
      status: 'completed',
      type: 'point_exchange'
    }).lean();

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

      if (txTime >= todayStart && txTime <= todayEnd) {
        todayWithdrawn += amount;
        todayWithdrawnCount += 1;
      }

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
    const partTimeUserCount = await User.countDocuments({
      role: 'part_time',
      is_deleted: { $ne: true }
    });

    res.json({
      success: true,
      stats: {
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        totalWithdrawnCount,
        todayWithdrawn: Math.round(todayWithdrawn * 100) / 100,
        todayWithdrawnCount,
        monthWithdrawn: Math.round(monthWithdrawn * 100) / 100,
        monthWithdrawnCount,
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        pendingCount,
        partTimeUserCount
      }
    });
  } catch (error) {
    log.error('获取财务统计失败:', error);
    res.status(500).json({ success: false, message: '获取财务统计失败' });
  }
});

/**
 * 获取提现记录列表（包含用户维度的统计）
 * GET /finance/withdrawal-records
 */
router.get('/withdrawal-records', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    const TimeUtils = require('../../utils/timeUtils');
    const { startDate, endDate } = req.query;

    // 构建时间范围筛选条件
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate + 'T00:00:00+08:00');
        dateFilter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59+08:00');
        dateFilter.createdAt.$lte = end;
      }
    }

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
    log.error('获取提现记录失败:', error);
    res.status(500).json({ success: false, message: '获取提现记录失败' });
  }
});

/**
 * 获取兼职用户待打款列表
 * GET /finance/part-time-pending
 */
router.get('/part-time-pending', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    log.info('🔍 查询兼职用户待打款列表...');

    const userSummaries = await Transaction.aggregate([
      { $match: { status: 'pending' } },
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
      { $unwind: '$user' },
      {
        $match: {
          'user.is_deleted': { $ne: true },
          'user.role': 'part_time'
        }
      },
      {
        $project: {
          user: {
            _id: 1, username: 1, nickname: 1, phone: 1, wechat: 1,
            wallet: 1, integral_w: 1, integral_z: 1,
            mentor_id: 1, hr_id: 1, training_status: 1
          },
          totalAmount: 1, transactionCount: 1, transactionIds: 1,
          types: 1, earliestCreated: 1, latestCreated: 1
        }
      },
      { $sort: { latestCreated: -1 } }
    ]);

    log.info(`📊 找到 ${userSummaries.length} 个有待打款的兼职用户`);

    res.json({
      success: true,
      transactions: userSummaries,
      pagination: { total: userSummaries.length }
    });
  } catch (error) {
    log.error('❌ 获取兼职用户待打款列表失败:', error);
    res.status(500).json({ success: false, message: '获取兼职用户待打款列表失败' });
  }
});

/**
 * 获取待打款列表（按用户汇总）
 * GET /finance/pending
 */
router.get('/pending', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    log.info('🔍 开始查询待打款列表（按用户汇总）...');

    const userSummaries = await Transaction.aggregate([
      { $match: { status: 'pending' } },
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
      { $unwind: '$user' },
      { $match: { 'user.is_deleted': { $ne: true } } },
      {
        $project: {
          user: {
            _id: 1, username: 1, nickname: 1, phone: 1, wechat: 1,
            wallet: 1, integral_w: 1, integral_z: 1
          },
          totalAmount: 1, transactionCount: 1, transactionIds: 1,
          types: 1, earliestCreated: 1, latestCreated: 1
        }
      },
      { $sort: { latestCreated: -1 } }
    ]);

    log.info('📊 查询结果: 用户数:', userSummaries.length);

    if (userSummaries.length > 0) {
      log.info('📋 第一条记录: 用户:', userSummaries[0].user.username,
               '总金额:', userSummaries[0].totalAmount);
    }

    res.json({
      success: true,
      transactions: userSummaries,
      pagination: {
        page: 1, limit: userSummaries.length,
        total: userSummaries.length, pages: 1
      }
    });
  } catch (error) {
    log.error('❌ 获取待打款列表失败:', error);
    res.status(500).json({ success: false, message: '获取待打款列表失败' });
  }
});

/**
 * 确认打款（集成阿里支付自动转账）
 * POST /finance/pay
 */
router.post('/pay', authenticateToken, requireRole(['boss', 'finance']), async (req, res) => {
  const alipayService = require('../../services/alipayService');
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

    const transactions = [];

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

      if (transaction.amount <= 0 || transaction.amount > 50000) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `交易记录 ${transactionId} 金额无效（限额0-50000元）`
        });
      }

      const user = await User.findById(transaction.user_id).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({
          success: false,
          message: `用户 ${transaction.user_id} 不存在`
        });
      }

      transactions.push({ transaction, user });
    }

    const successfulPayments = [];
    const failedPayments = [];

    for (const { transaction, user } of transactions) {
      try {
        log.info(`🔄 开始处理交易 ${transaction._id}: 用户 ${user.username}, 金额 ${transaction.amount}元`);

        const transferResult = await alipayService.transferToAccount({
          outBizNo: transaction._id.toString(),
          payeeAccount: user.wallet.alipay_account,
          payeeRealName: user.wallet.real_name,
          amount: transaction.amount,
          remark: `任务奖励 - ${transaction.type === 'task_reward' ? '任务奖励' : '邀请奖励'}`
        });

        if (transferResult.success) {
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

          if (transaction.type === 'point_exchange') {
            await User.findByIdAndUpdate(
              user._id,
              { $inc: { 'wallet.total_withdrawn': transaction.amount } },
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

          log.info(`✅ 交易 ${transaction._id} 转账成功: ${transferResult.orderId}`);
        } else {
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

          log.error(`❌ 交易 ${transaction._id} 转账失败:`, transferResult);
        }
      } catch (error) {
        log.error(`❌ 处理交易 ${transaction._id} 时发生异常:`, error);

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

    await session.commitTransaction();

    const totalProcessed = successfulPayments.length + failedPayments.length;
    log.info(`✅ 财务打款处理完成: 成功 ${successfulPayments.length}, 失败 ${failedPayments.length}`);

    res.json({
      success: true,
      message: `处理完成：成功 ${successfulPayments.length} 笔，失败 ${failedPayments.length} 笔`,
      results: { successful: successfulPayments, failed: failedPayments, totalProcessed }
    });
  } catch (error) {
    await session.abortTransaction();
    log.error('❌ 打款处理失败，已回滚事务:', error);
    res.status(500).json({ success: false, message: '打款处理失败，已回滚所有操作' });
  } finally {
    session.endSession();
  }
});

/**
 * 导出Excel（简化版，返回JSON数据，前端处理下载）
 * GET /finance/export-excel
 */
router.get('/export-excel', authenticateToken, requireRole(['boss', 'finance', 'manager']), async (req, res) => {
  try {
    const transactions = await Transaction.find({ status: 'pending' })
      .populate({
        path: 'user_id',
        select: 'username nickname phone wechat wallet integral_w integral_z'
      })
      .sort({ createdAt: -1 })
      .lean();

    const excelData = transactions.map(t => ({
      用户名: t.user_id?.username || '未设置',
      昵称: t.user_id?.nickname || '未设置',
      手机号: t.user_id?.phone || '未设置',
      微信号: t.user_id?.integral_w || '未设置',
      支付宝号: t.user_id?.integral_z || '未设置',
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
    log.error('导出Excel失败:', error);
    res.status(500).json({ success: false, message: '导出Excel失败' });
  }
});

module.exports = router;
