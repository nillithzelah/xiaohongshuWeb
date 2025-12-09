const express = require('express');
const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const TaskConfig = require('../models/TaskConfig');
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

// 获取待审核列表（带教老师）
router.get('/pending', authenticateToken, requireRole(['mentor', 'boss']), async (req, res) => {
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

// 带教老师审核 (支持带教老师和主管)
router.put('/:id/mentor-review', authenticateToken, requireRole(['mentor', 'boss']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment, newType } = req.body;

    const review = await ImageReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该记录已被审核' });
    }

    const oldStatus = review.status;
    const oldImageType = review.imageType;
    const oldSnapshotPrice = review.snapshotPrice;

    // 如果提供了 newType，更新图片类型并重新计算价格
    if (newType && newType !== review.imageType) {
      const validTypes = ['customer_resource', 'note', 'comment'];
      if (!validTypes.includes(newType)) {
        return res.status(400).json({ success: false, message: '无效的图片类型' });
      }

      // 从 TaskConfig 查询新类型的价格
      const taskConfig = await TaskConfig.findOne({ type_key: newType, is_active: true });
      if (!taskConfig) {
        return res.status(400).json({ success: false, message: '未找到对应类型的价格配置' });
      }

      review.imageType = newType;
      review.snapshotPrice = taskConfig.price;
    }

    review.mentorReview = {
      reviewer: req.user._id,
      approved,
      comment,
      reviewedAt: new Date()
    };

    // 添加审核历史记录
    let historyComment = comment || (approved ? '审核通过' : '审核驳回');
    if (newType && newType !== oldImageType) {
      const typeNameMap = {
        'customer_resource': '客资',
        'note': '笔记',
        'comment': '评论'
      };
      const oldTypeName = typeNameMap[oldImageType] || oldImageType;
      const newTypeName = typeNameMap[newType] || newType;
      historyComment += ` (客服修正类型为 ${newTypeName}, 价格从 ¥${oldSnapshotPrice} 调整为 ¥${review.snapshotPrice})`;
    }

    review.auditHistory.push({
      operator: req.user._id,
      operatorName: req.user.username,
      action: approved ? 'mentor_pass' : 'mentor_reject',
      comment: historyComment,
      timestamp: new Date()
    });

    if (approved) {
      review.status = 'mentor_approved'; // 带教老师审核通过，等待主管确认
    } else {
      review.status = 'rejected';
    }

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    res.json({
      success: true,
      message: approved ? '审核通过，提交给主管' : '审核拒绝',
      review
    });
  } catch (error) {
    console.error('客服审核错误:', error);
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

// 主管确认
router.put('/:id/manager-approve', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const review = await ImageReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'mentor_approved') {
      return res.status(400).json({ success: false, message: '该记录状态不正确' });
    }

    const oldStatus = review.status;

    review.managerApproval = {
      approved,
      comment,
      approvedAt: new Date()
    };

    // 添加审核历史记录
    review.auditHistory.push({
      operator: req.user._id,
      operatorName: req.user.username,
      action: approved ? 'manager_approve' : 'manager_reject',
      comment: comment || (approved ? '主管确认通过' : '主管驳回重审'),
      timestamp: new Date()
    });

    if (approved) {
      review.status = 'manager_approved'; // 主管确认通过，到财务处理
    } else {
      review.status = 'manager_rejected'; // 主管驳回重审
      review.rejectionReason = comment; // 记录驳回原因（向后兼容）
    }

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    // 如果是主管驳回，额外通知带教老师
    if (!approved) {
      await notificationService.sendMentorNotification(review, 'manager_reject', req.user.username, comment);
    }

    res.json({
      success: true,
      message: approved ? '主管确认通过，提交给财务' : '主管拒绝',
      review
    });
  } catch (error) {
    console.error('老板确认错误:', error);
    res.status(500).json({ success: false, message: '确认失败' });
  }
});

// 财务处理
router.put('/:id/finance-process', authenticateToken, requireRole(['finance', 'boss']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, commission } = req.body;

    const review = await ImageReview.findById(id).populate('userId');
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'manager_approved') {
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

    // 更新用户积分和总收益
    const user = review.userId;
    user.points += amount;
    user.totalEarnings += amount;

    // 计算两级上级佣金
    // 一级佣金：直接上级
    if (user.parent_id && review.snapshotCommission1 > 0) {
      const parentUser = await User.findById(user.parent_id);
      if (parentUser) {
        parentUser.points += review.snapshotCommission1;
        parentUser.totalEarnings += review.snapshotCommission1;
        await parentUser.save();

        // 记录一级佣金发放事务
        const Transaction = require('../models/Transaction');
        await new Transaction({
          submission_id: review._id,
          user_id: parentUser._id,
          amount: review.snapshotCommission1,
          type: 'referral_bonus_1',
          description: `一级推荐佣金 - 来自用户 ${user.username || user.nickname}`
        }).save();
      }
    }

    // 二级佣金：上级的上级
    if (user.parent_id && review.snapshotCommission2 > 0) {
      const parentUser = await User.findById(user.parent_id);
      if (parentUser && parentUser.parent_id) {
        const grandParentUser = await User.findById(parentUser.parent_id);
        if (grandParentUser) {
          grandParentUser.points += review.snapshotCommission2;
          grandParentUser.totalEarnings += review.snapshotCommission2;
          await grandParentUser.save();

          // 记录二级佣金发放事务
          const Transaction = require('../models/Transaction');
          await new Transaction({
            submission_id: review._id,
            user_id: grandParentUser._id,
            amount: review.snapshotCommission2,
            type: 'referral_bonus_2',
            description: `二级推荐佣金 - 来自用户 ${user.username || user.nickname}`
          }).save();
        }
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
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Reviews API 被调用了!');
    const { page = 1, limit = 10, status, userId, imageType, keyword, reviewer, deviceName } = req.query;

    let query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (imageType) query.imageType = imageType;

    // 如果有keyword，搜索用户名匹配的用户ID
    if (keyword) {
      const matchedUsers = await User.find({
        $or: [
          { username: { $regex: keyword, $options: 'i' } },
          { nickname: { $regex: keyword, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = matchedUsers.map(user => user._id);
      query.userId = { $in: userIds };
    }

    // 如果有reviewer，按带教老师筛选审核记录
    if (reviewer) {
      query['mentorReview.reviewer'] = reviewer;
    }

    // 如果有deviceName，按设备号筛选审核记录
    if (deviceName) {
      const Device = require('../models/Device');
      const matchedDevices = await Device.find({
        accountName: { $regex: deviceName, $options: 'i' }
      }).select('assignedUser');
      const userIds = matchedDevices.map(device => device.assignedUser);
      if (userIds.length > 0) {
        query.userId = query.userId ? { $in: [...new Set([...(query.userId.$in || []), ...userIds])] } : { $in: userIds };
      } else {
        // 如果没有找到匹配的设备，返回空结果
        query.userId = null;
      }
    }

    console.log('🔍 开始查询审核记录...');
    console.log('   查询条件:', query);
    console.log('   分页参数:', { page, limit });

    // 从数据库查询真实数据
    const reviews = await ImageReview.find(query)
      .populate('userId', 'username nickname')
      .populate('mentorReview.reviewer', 'username nickname')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // 为每个审核记录添加设备信息
    for (const review of reviews) {
      if (review.userId) {
        const Device = require('../models/Device');
        const device = await Device.findOne({ assignedUser: review.userId._id });
        review._doc.deviceInfo = device ? {
          accountName: device.accountName,
          status: device.status,
          influence: device.influence
        } : null;
      }
    }

    const total = await ImageReview.countDocuments(query);

    console.log('✅ 查询成功，记录数量:', reviews.length);

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
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
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

// 一键全部通过 (只有manager和boss可以调用)
router.put('/approve-all-pending', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const result = await ImageReview.updateMany(
      { status: 'pending' },
      {
        $set: { status: 'mentor_approved' },
        $push: {
          auditHistory: {
            operator: req.user._id,
            operatorName: req.user.username,
            action: 'batch_pass_all',
            comment: '一键全部通过',
            timestamp: new Date()
          }
        }
      }
    );

    // 发送通知给所有相关用户
    const updatedReviews = await ImageReview.find({ status: 'mentor_approved' }).populate('userId');
    for (const review of updatedReviews) {
      await notificationService.sendReviewStatusNotification(review, 'pending', 'mentor_approved');
    }

    res.json({
      success: true,
      message: `成功通过 ${result.modifiedCount} 个待审核任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('一键全部通过错误:', error);
    res.status(500).json({ success: false, message: '一键全部通过失败' });
  }
});

// 一键全部驳回 (只有manager和boss可以调用)
router.put('/reject-all-pending', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: '驳回理由不能为空' });
    }

    const result = await ImageReview.updateMany(
      { status: 'pending' },
      {
        $set: {
          status: 'rejected',
          rejectionReason: comment.trim()
        },
        $push: {
          auditHistory: {
            operator: req.user._id,
            operatorName: req.user.username,
            action: 'batch_reject_all',
            comment: comment.trim(),
            timestamp: new Date()
          }
        }
      }
    );

    // 发送通知给所有相关用户
    const updatedReviews = await ImageReview.find({ status: 'rejected' }).populate('userId');
    for (const review of updatedReviews) {
      await notificationService.sendReviewStatusNotification(review, 'pending', 'rejected');
    }

    res.json({
      success: true,
      message: `成功驳回 ${result.modifiedCount} 个待审核任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('一键全部驳回错误:', error);
    res.status(500).json({ success: false, message: '一键全部驳回失败' });
  }
});

// 批量选中操作 (只有manager和boss可以调用)
router.put('/batch-cs-review', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { ids, action, comment } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的任务' });
    }

    if (!['pass', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的操作类型' });
    }

    if (action === 'reject' && (!comment || comment.trim() === '')) {
      return res.status(400).json({ success: false, message: '驳回理由不能为空' });
    }

    // 只更新状态为pending的任务
    const filter = {
      _id: { $in: ids },
      status: 'pending'
    };

    const updateData = {
      $push: {
        auditHistory: {
          operator: req.user._id,
          operatorName: req.user.username,
          action: action === 'pass' ? 'batch_pass_selected' : 'batch_reject_selected',
          comment: action === 'pass' ? '批量通过' : comment.trim(),
          timestamp: new Date()
        }
      }
    };

    if (action === 'pass') {
      updateData.$set = { status: 'mentor_approved' };
    } else {
      updateData.$set = {
        status: 'rejected',
        rejectionReason: comment.trim()
      };
    }

    const result = await ImageReview.updateMany(filter, updateData);

    // 发送通知
    const updatedReviews = await ImageReview.find({
      _id: { $in: ids },
      status: action === 'pass' ? 'mentor_approved' : 'rejected'
    }).populate('userId');

    for (const review of updatedReviews) {
      const oldStatus = 'pending';
      const newStatus = action === 'pass' ? 'mentor_approved' : 'rejected';
      await notificationService.sendReviewStatusNotification(review, oldStatus, newStatus);
    }

    res.json({
      success: true,
      message: `成功${action === 'pass' ? '通过' : '驳回'} ${result.modifiedCount} 个任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('批量操作错误:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  }
});

module.exports = router;