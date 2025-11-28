const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const Submission = require('../models/Submission');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const TaskConfig = require('../models/TaskConfig');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 获取任务列表（根据角色显示不同状态）
router.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    let statusFilter = {};

    // 根据角色设置状态过滤
    if (req.user.role === 'cs') {
      statusFilter = { status: 0 }; // 客服只看待审核
    } else if (req.user.role === 'boss') {
      statusFilter = { status: 1 }; // 老板只看待确认
    } else if (req.user.role === 'finance') {
      statusFilter = { status: 2 }; // 财务只看待打款
    }

    const submissions = await Submission.find(statusFilter)
      .populate('user_id', 'username wallet')
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Submission.countDocuments(statusFilter);

    res.json({
      success: true,
      submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取任务列表错误:', error);
    res.status(500).json({ success: false, message: '获取任务列表失败' });
  }
});

// 客服审核
router.post('/audit/cs', authenticateToken, requireRole(['cs']), async (req, res) => {
  try {
    const { id, action, reason } = req.body;

    const submission = await Submission.findById(id);
    if (!submission) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    if (submission.status !== 0) {
      return res.status(400).json({ success: false, message: '任务状态不正确' });
    }

    const newStatus = action === 'pass' ? 1 : -1;
    const actionType = action === 'pass' ? 'cs_pass' : 'cs_reject';

    submission.status = newStatus;
    submission.audit_history.push({
      operator_id: req.user._id,
      action: actionType,
      comment: reason || (action === 'pass' ? '客服审核通过' : '客服审核驳回')
    });

    await submission.save();

    res.json({
      success: true,
      message: action === 'pass' ? '审核通过' : '审核驳回',
      submission
    });

  } catch (error) {
    console.error('客服审核错误:', error);
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

// 老板批量确认 (使用数据库事务确保数据一致性)
router.post('/audit/boss', authenticateToken, requireRole(['boss']), async (req, res) => {
  const session = await Submission.startSession();
  session.startTransaction();

  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供任务ID列表' });
    }

    const results = [];

    for (const id of ids) {
      const submission = await Submission.findById(id).session(session);
      if (!submission || submission.status !== 1) {
        continue; // 跳过不存在或状态不正确的任务
      }

      // 更新任务状态
      submission.status = 2;
      submission.audit_history.push({
        operator_id: req.user._id,
        action: 'boss_confirm',
        comment: '老板确认通过'
      });

      // 生成用户奖励交易记录
      const userTransaction = new Transaction({
        submission_id: submission._id,
        user_id: submission.user_id,
        amount: submission.snapshot_price,
        type: 'task_reward'
      });

      // 检查是否有上级，生成佣金记录
      const user = await User.findById(submission.user_id).session(session);
      let parentTransaction = null;

      if (user && user.parent_id && submission.snapshot_commission > 0) {
        parentTransaction = new Transaction({
          submission_id: submission._id,
          user_id: user.parent_id,
          amount: submission.snapshot_commission,
          type: 'referral_bonus'
        });
      }

      // 保存所有更改 (使用事务会话)
      await submission.save({ session });
      await userTransaction.save({ session });
      if (parentTransaction) {
        await parentTransaction.save({ session });
      }

      results.push({
        submission_id: id,
        status: 'success',
        transactions: [
          userTransaction._id,
          ...(parentTransaction ? [parentTransaction._id] : [])
        ]
      });
    }

    // 提交事务 - 所有操作同时生效
    await session.commitTransaction();

    res.json({
      success: true,
      message: `成功处理 ${results.length} 个任务`,
      results
    });

  } catch (error) {
    // 回滚事务 - 就像什么都没发生过
    await session.abortTransaction();
    console.error('老板确认错误:', error);
    res.status(500).json({ success: false, message: '确认失败' });
  } finally {
    session.endSession();
  }
});

// 财务打款
router.post('/finance/pay', authenticateToken, requireRole(['finance']), async (req, res) => {
  try {
    const { transaction_ids } = req.body;

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供交易ID列表' });
    }

    const results = [];

    for (const transactionId of transaction_ids) {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction || transaction.status !== 'pending') {
        continue;
      }

      // 更新交易状态
      transaction.status = 'paid';
      transaction.paid_at = new Date();
      await transaction.save();

      // 更新对应的任务状态
      const submission = await Submission.findById(transaction.submission_id);
      if (submission) {
        submission.status = 3; // 已完成
        submission.audit_history.push({
          operator_id: req.user._id,
          action: 'finance_pay',
          comment: '财务已打款'
        });
        await submission.save();
      }

      results.push(transactionId);
    }

    res.json({
      success: true,
      message: `成功处理 ${results.length} 笔打款`,
      paid_transactions: results
    });

  } catch (error) {
    console.error('财务打款错误:', error);
    res.status(500).json({ success: false, message: '打款失败' });
  }
});

// 获取财务待打款列表
router.get('/finance/pending', authenticateToken, requireRole(['finance']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const transactions = await Transaction.find({ status: 'pending' })
      .populate('user_id', 'username wallet')
      .populate('submission_id', 'task_type image_url')
      .sort({ created_at: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取待打款列表错误:', error);
    res.status(500).json({ success: false, message: '获取列表失败' });
  }
});

// 任务配置管理（老板专用）
router.get('/task-configs', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const configs = await TaskConfig.find().sort({ type_key: 1 });
    res.json({ success: true, configs });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取配置失败' });
  }
});

router.put('/task-configs/:id', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { price, commission, is_active } = req.body;
    const config = await TaskConfig.findByIdAndUpdate(
      req.params.id,
      { price, commission, is_active },
      { new: true }
    );
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新配置失败' });
  }
});

// Excel导出待打款列表
router.get('/finance/export-excel', authenticateToken, requireRole(['finance']), async (req, res) => {
  try {
    // 获取所有待打款的交易记录
    const transactions = await Transaction.find({ status: 'pending' })
      .populate('user_id', 'username wallet')
      .populate('submission_id', 'task_type image_type')
      .sort({ created_at: 1 });

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('待打款列表');

    // 设置列标题
    worksheet.columns = [
      { header: '序号', key: 'index', width: 8 },
      { header: '收款人姓名', key: 'realName', width: 15 },
      { header: '支付宝账号', key: 'alipayAccount', width: 25 },
      { header: '打款金额', key: 'amount', width: 12 },
      { header: '奖励类型', key: 'rewardType', width: 12 },
      { header: '任务类型', key: 'taskType', width: 12 },
      { header: '提交时间', key: 'createdAt', width: 20 },
      { header: '备注', key: 'remark', width: 20 }
    ];

    // 设置标题样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // 添加数据行
    transactions.forEach((transaction, index) => {
      const user = transaction.user_id;
      const submission = transaction.submission_id;

      // 获取任务类型显示文本
      const getTaskTypeText = (type) => {
        const types = {
          login_qr: '登录二维码',
          note: '笔记',
          comment: '评论'
        };
        return types[type] || type;
      };

      // 获取奖励类型显示文本
      const getRewardTypeText = (type) => {
        return type === 'task_reward' ? '任务奖励' : '邀请奖励';
      };

      worksheet.addRow({
        index: index + 1,
        realName: user?.wallet?.real_name || '未设置',
        alipayAccount: user?.wallet?.alipay_account || '未设置',
        amount: transaction.amount,
        rewardType: getRewardTypeText(transaction.type),
        taskType: getTaskTypeText(submission?.task_type),
        createdAt: new Date(transaction.created_at).toLocaleString('zh-CN'),
        remark: `${user?.username || '未知用户'} - ${getTaskTypeText(submission?.task_type)}`
      });
    });

    // 设置边框
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });

    // 设置响应头
    const fileName = `待打款列表_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    // 生成并发送Excel文件
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('导出Excel错误:', error);
    res.status(500).json({ success: false, message: '导出失败' });
  }
});

module.exports = router;