const express = require('express');
const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const router = express.Router();

// 获取我的审核记录（用户）
router.get('/my-reviews', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await ImageReview.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ImageReview.countDocuments({ userId: req.user._id });

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取我的审核记录错误:', error);
    res.status(500).json({ success: false, message: '获取审核记录失败' });
  }
});

// 获取待审核列表（客服）
router.get('/pending', authenticateToken, requireRole(['cs']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'pending' } = req.query;

    const reviews = await ImageReview.find({ status })
      .populate('userId', 'username nickname')
      .sort({ createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ImageReview.countDocuments({ status });

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取待审核列表错误:', error);
    res.status(500).json({ success: false, message: '获取审核列表失败' });
  }
});

// 客服审核
router.put('/:id/cs-review', authenticateToken, requireRole(['cs']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const review = await ImageReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该记录已被审核' });
    }

    const oldStatus = review.status;

    review.csReview = {
      reviewer: req.user._id,
      approved,
      comment,
      reviewedAt: new Date()
    };

    if (approved) {
      review.status = 'boss_approved'; // 直接到老板审核
    } else {
      review.status = 'rejected';
    }

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    res.json({
      success: true,
      message: approved ? '审核通过，提交给老板' : '审核拒绝',
      review
    });
  } catch (error) {
    console.error('客服审核错误:', error);
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

// 老板确认
router.put('/:id/boss-approve', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const review = await ImageReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'boss_approved') {
      return res.status(400).json({ success: false, message: '该记录状态不正确' });
    }

    const oldStatus = review.status;

    review.bossApproval = {
      approved,
      comment,
      approvedAt: new Date()
    };

    if (approved) {
      review.status = 'finance_done'; // 到财务处理
    } else {
      review.status = 'rejected';
    }

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    res.json({
      success: true,
      message: approved ? '老板确认通过，提交给财务' : '老板拒绝',
      review
    });
  } catch (error) {
    console.error('老板确认错误:', error);
    res.status(500).json({ success: false, message: '确认失败' });
  }
});

// 财务处理
router.put('/:id/finance-process', authenticateToken, requireRole(['finance']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, commission } = req.body;

    const review = await ImageReview.findById(id).populate('userId');
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'finance_done') {
      return res.status(400).json({ success: false, message: '该记录状态不正确' });
    }

    const oldStatus = review.status;

    // 更新审核记录
    review.financeProcess = {
      amount,
      commission: commission || 0,
      processedAt: new Date()
    };
    review.status = 'completed';

    // 更新用户余额和总收益
    const user = review.userId;
    user.balance += amount;
    user.totalEarnings += amount;

    // 计算上级佣金（如果有上级）
    if (user.parent_id && commission > 0) {
      const parentUser = await User.findById(user.parent_id);
      if (parentUser) {
        parentUser.balance += commission;
        parentUser.totalEarnings += commission;
        await parentUser.save();
      }
    }

    await review.save();
    await user.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    res.json({
      success: true,
      message: '财务处理完成',
      review
    });
  } catch (error) {
    console.error('财务处理错误:', error);
    res.status(500).json({ success: false, message: '处理失败' });
  }
});

// 获取所有审核记录（管理员）
router.get('/', authenticateToken, requireRole(['cs', 'boss', 'finance']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, userId, imageType } = req.query;

    let query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (imageType) query.imageType = imageType;

    const reviews = await ImageReview.find(query)
      .populate('userId', 'username nickname')
      .populate('csReview.reviewer', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ImageReview.countDocuments(query);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取审核记录错误:', error);
    res.status(500).json({ success: false, message: '获取审核记录失败' });
  }
});

// 获取用户通知
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = notificationService.getUserNotifications(req.user._id);
    const unreadCount = notificationService.getUnreadCount(req.user._id);

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('获取通知错误:', error);
    res.status(500).json({ success: false, message: '获取通知失败' });
  }
});

// 标记通知为已读
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    notificationService.markAsRead(req.params.id);
    res.json({ success: true, message: '标记已读成功' });
  } catch (error) {
    console.error('标记已读错误:', error);
    res.status(500).json({ success: false, message: '标记已读失败' });
  }
});

module.exports = router;