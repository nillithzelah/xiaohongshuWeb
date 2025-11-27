const express = require('express');
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

// 老板批量确认
router.post('/audit/boss', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请提供任务ID列表' });
    }

    const results = [];

    for (const id of ids) {
      const submission = await Submission.findById(id);
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
      const user = await User.findById(submission.user_id);
      let parentTransaction = null;

      if (user && user.parent_id && submission.snapshot_commission > 0) {
        parentTransaction = new Transaction({
          submission_id: submission._id,
          user_id: user.parent_id,
          amount: submission.snapshot_commission,
          type: 'referral_bonus'
        });
      }

      // 保存所有更改
      await submission.save();
      await userTransaction.save();
      if (parentTransaction) {
        await parentTransaction.save();
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

    res.json({
      success: true,
      message: `成功处理 ${results.length} 个任务`,
      results
    });

  } catch (error) {
    console.error('老板确认错误:', error);
    res.status(500).json({ success: false, message: '确认失败' });
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

module.exports = router;