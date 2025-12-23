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

    // 验证输入参数
    if (typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ success: false, message: '金额必须是有效的非负数' });
    }

    if (amount > 10000) {
      return res.status(400).json({ success: false, message: '单笔金额不能超过10000元' });
    }

    if (commission !== undefined && (typeof commission !== 'number' || commission < 0)) {
      return res.status(400).json({ success: false, message: '佣金必须是有效的非负数' });
    }

    const review = await ImageReview.findById(id).populate('userId');
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    if (review.status !== 'manager_approved') {
      return res.status(400).json({ success: false, message: '该记录状态不正确' });
    }

    // 验证金额是否与快照价格一致（防止前端篡改）
    const expectedAmount = review.snapshotPrice;
    if (Math.abs(amount - expectedAmount) > 0.01) { // 允许0.01元的误差
      return res.status(400).json({
        success: false,
        message: `金额验证失败，期望金额: ${expectedAmount}元，实际金额: ${amount}元`
      });
    }

    // 验证佣金是否合理
    const expectedCommission1 = review.snapshotCommission1 || 0;
    const expectedCommission2 = review.snapshotCommission2 || 0;
    const maxExpectedCommission = expectedCommission1 + expectedCommission2;

    if (commission > maxExpectedCommission * 1.1) { // 允许10%的误差
      return res.status(400).json({
        success: false,
        message: `佣金金额异常，期望最大佣金: ${maxExpectedCommission}元，实际佣金: ${commission}元`
      });
    }

    // 验证用户钱包信息完整性
    if (!review.userId) {
      return res.status(400).json({ success: false, message: '用户关联信息缺失' });
    }

    const oldStatus = review.status;

    // 更新审核记录
    review.financeProcess = {
      amount,
      commission: commission || 0,
      processedAt: new Date(),
      processedBy: req.user._id,
      processedByName: req.user.username
    };
    review.status = 'completed';

    // 积分奖励已在审核通过时发放，这里不再重复发放

    // 添加财务处理历史记录
    review.auditHistory.push({
      operator: req.user._id,
      operatorName: req.user.username,
      action: 'finance_process',
      comment: `财务处理完成 - 金额: ${amount}元, 佣金: ${commission || 0}元`,
      timestamp: new Date()
    });

    // 创建任务奖励的Transaction记录（等待管理员确认打款）
    const Transaction = require('../models/Transaction');
    await new Transaction({
      imageReview_id: review._id,
      user_id: review.userId._id,
      amount: amount,
      type: 'task_reward',
      description: `任务奖励 - ${review.imageType}审核通过`,
      operator: req.user._id,
      operatorName: req.user.username
    }).save();

    // 计算两级上级佣金（带边界检查）
    let totalCommission = 0;

    // 一级佣金：直接上级
    if (review.userId.parent_id && review.snapshotCommission1 > 0) {
      try {
        const parentUser = await User.findById(review.userId.parent_id);
        if (parentUser && !parentUser.is_deleted) {
          // 验证上级用户状态
          if (!parentUser.wallet) {
            parentUser.wallet = { balance: 0, total_earned: 0 };
          }

          // 直接发放一级佣金（进入待打款状态）
          await new Transaction({
            imageReview_id: review._id,
            user_id: parentUser._id,
            amount: review.snapshotCommission1,
            type: 'referral_bonus_1',
            description: `一级推荐佣金 - 来自用户 ${review.userId.username || review.userId.nickname}`,
            operator: req.user._id,
            operatorName: req.user.username
          }).save();

          totalCommission += review.snapshotCommission1;
        } else {
          console.warn(`上级用户 ${review.userId.parent_id} 不存在或已删除，跳过一级佣金发放`);
        }
      } catch (error) {
        console.error('处理一级佣金时出错:', error);
        // 继续处理，不影响主流程
      }
    }

    // 二级佣金：上级的上级
    if (review.userId.parent_id && review.snapshotCommission2 > 0) {
      try {
        const parentUser = await User.findById(review.userId.parent_id);
        if (parentUser && parentUser.parent_id && !parentUser.is_deleted) {
          const grandParentUser = await User.findById(parentUser.parent_id);
          if (grandParentUser && !grandParentUser.is_deleted) {
            // 验证二级上级用户状态
            if (!grandParentUser.wallet) {
              grandParentUser.wallet = { balance: 0, total_earned: 0 };
            }

            // 直接发放二级佣金（进入待打款状态）
            await new Transaction({
              imageReview_id: review._id,
              user_id: grandParentUser._id,
              amount: review.snapshotCommission2,
              type: 'referral_bonus_2',
              description: `二级推荐佣金 - 来自用户 ${review.userId.username || review.userId.nickname}`,
              operator: req.user._id,
              operatorName: req.user.username
            }).save();

            totalCommission += review.snapshotCommission2;
          } else {
            console.warn(`二级上级用户 ${parentUser.parent_id} 不存在或已删除，跳过二级佣金发放`);
          }
        }
      } catch (error) {
        console.error('处理二级佣金时出错:', error);
        // 继续处理，不影响主流程
      }
    }

    console.log(`💰 财务处理完成 - 任务奖励: ${amount}元, 佣金总额: ${totalCommission}元`);

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    res.json({
      success: true,
      message: '财务处理完成',
      review
    });
  } catch (error) {
    console.error('财务处理错误:', error);

    // 记录错误到系统日志
    try {
      const AuditLog = require('../models/AuditLog') || {
        create: (log) => console.log('审计日志:', log)
      };

      await AuditLog.create({
        operation: 'finance_process',
        operator: req.user._id,
        operatorName: req.user.username,
        targetId: req.params.id,
        action: 'error',
        details: {
          error: error.message,
          stack: error.stack,
          input: { amount, commission }
        },
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      });
    } catch (auditError) {
      console.error('审计日志记录失败:', auditError);
    }

    res.status(500).json({ success: false, message: '处理失败，请联系管理员' });
  }
});

// 获取所有审核记录（管理员）
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Reviews API 被调用了!');
    const { page = 1, limit = 10, status, userId, imageType, keyword, reviewer, deviceName } = req.query;
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

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
    console.log('   分页参数:', { page: pageNum, limit: limitNum });

    // 获取当前用户ID（如果已认证）
    const currentUserId = req.user ? req.user._id : null;

    // 从数据库查询真实数据 - 优先显示属于自己的待审核记录
    let reviews;

    if (currentUserId && req.user.role === 'mentor') {
      // 带教老师：优先显示自己名下用户的待审核记录
      const assignedUsers = await User.find({ mentor_id: currentUserId }).select('_id');
      const assignedUserIds = assignedUsers.map(u => u._id);

      // 自己名下用户的待审核记录
      const ownPendingQuery = { ...query, status: 'pending', userId: { $in: assignedUserIds } };
      const ownPending = await ImageReview.find(ownPendingQuery)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 });

      // 其他待审核记录
      const otherPendingQuery = { ...query, status: 'pending', userId: { $nin: assignedUserIds } };
      const otherPending = await ImageReview.find(otherPendingQuery)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 });

      // 非待审核记录（按最新操作时间倒序）
      const nonPendingQuery = { ...query };
      nonPendingQuery.$and = nonPendingQuery.$and || [];
      nonPendingQuery.$and.push({ status: { $ne: 'pending' } });

      const nonPending = await ImageReview.find(nonPendingQuery)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname');

      // 对非待审核记录按最新审核时间排序
      nonPending.sort((a, b) => {
        const getLatestAuditTime = (review) => {
          const times = [];
          if (review.mentorReview?.reviewedAt) times.push(new Date(review.mentorReview.reviewedAt));
          if (review.managerApproval?.approvedAt) times.push(new Date(review.managerApproval.approvedAt));
          if (review.financeProcess?.processedAt) times.push(new Date(review.financeProcess.processedAt));
          if (review.auditHistory && review.auditHistory.length > 0) {
            review.auditHistory.forEach(history => {
              if (history.timestamp) times.push(new Date(history.timestamp));
            });
          }
          return times.length > 0 ? Math.max(...times.map(t => t.getTime())) : new Date(review.createdAt).getTime();
        };
        return getLatestAuditTime(b) - getLatestAuditTime(a);
      });

      // 合并结果：待审核优先，然后是非待审核
      reviews = [...ownPending, ...otherPending, ...nonPending];

      // 应用分页
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      reviews = reviews.slice(startIndex, endIndex);
    } else if (currentUserId) {
      // 其他角色用户：按原有逻辑
      console.log('👤 当前用户角色分支:', req.user?.role, '用户ID:', currentUserId);

      const selfReviewedQuery = { ...query };
      const otherReviewedQuery = { ...query };

      selfReviewedQuery.$or = [
        { 'mentorReview.reviewer': currentUserId },
        { 'auditHistory.operator': currentUserId }
      ];

      otherReviewedQuery.$and = otherReviewedQuery.$and || [];
      otherReviewedQuery.$and.push({
        $nor: [
          { 'mentorReview.reviewer': currentUserId },
          { 'auditHistory.operator': currentUserId }
        ]
      });

      console.log('🔍 selfReviewedQuery:', JSON.stringify(selfReviewedQuery, null, 2));
      console.log('🔍 otherReviewedQuery:', JSON.stringify(otherReviewedQuery, null, 2));

      const selfReviewed = await ImageReview.find(selfReviewedQuery)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname');

      console.log('📊 selfReviewed 数量:', selfReviewed.length);

      selfReviewed.sort((a, b) => {
        const getLatestAuditTime = (review) => {
          const times = [];
          if (review.mentorReview?.reviewedAt) times.push(new Date(review.mentorReview.reviewedAt));
          if (review.managerApproval?.approvedAt) times.push(new Date(review.managerApproval.approvedAt));
          if (review.financeProcess?.processedAt) times.push(new Date(review.financeProcess.processedAt));
          if (review.auditHistory && review.auditHistory.length > 0) {
            review.auditHistory.forEach(history => {
              if (history.timestamp) times.push(new Date(history.timestamp));
            });
          }
          return times.length > 0 ? Math.max(...times.map(t => t.getTime())) : new Date(review.createdAt).getTime();
        };
        return getLatestAuditTime(b) - getLatestAuditTime(a);
      });

      const otherReviewed = await ImageReview.find(otherReviewedQuery)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 });

      console.log('📊 otherReviewed 数量:', otherReviewed.length);

      reviews = [...selfReviewed, ...otherReviewed];
      console.log('📊 合并后总数量:', reviews.length);

      // 对整个合并后的数组按最新审核时间排序
      reviews.sort((a, b) => {
        const getLatestAuditTime = (review) => {
          const times = [];
          if (review.mentorReview?.reviewedAt) times.push(new Date(review.mentorReview.reviewedAt));
          if (review.managerApproval?.approvedAt) times.push(new Date(review.managerApproval.approvedAt));
          if (review.financeProcess?.processedAt) times.push(new Date(review.financeProcess.processedAt));
          if (review.auditHistory && review.auditHistory.length > 0) {
            review.auditHistory.forEach(history => {
              if (history.timestamp) times.push(new Date(history.timestamp));
            });
          }
          return times.length > 0 ? Math.max(...times.map(t => t.getTime())) : new Date(review.createdAt).getTime();
        };
        return getLatestAuditTime(b) - getLatestAuditTime(a);
      });

      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      reviews = reviews.slice(startIndex, endIndex);
      console.log('📊 分页后数量:', reviews.length);
    } else {
      // 未登录用户按原有逻辑
      reviews = await ImageReview.find(query)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
    }

    // 为每个审核记录添加设备信息（优先使用已有的deviceInfo，否则查询Device表）
    console.log('🔗 开始为审核记录添加设备信息...');
    for (const review of reviews) {
      console.log(`🔍 处理记录 ${review._id}, 用户: ${review.userId?.username || '未知'}`);

      // 如果审核记录已经有deviceInfo，直接使用
      if (review.deviceInfo && review.deviceInfo.accountName) {
        console.log(`📱 使用已有设备信息: ${review.deviceInfo.accountName}`);
        continue;
      }

      // 如果没有deviceInfo，从Device表查询
      if (review.userId) {
        try {
          const Device = require('../models/Device');
          const device = await Device.findOne({ assignedUser: review.userId._id });
          console.log(`📱 从数据库查询设备: ${device ? device.accountName : '无设备'}`);
          review._doc.deviceInfo = device ? {
            accountName: device.accountName,
            status: device.status,
            influence: device.influence
          } : null;
        } catch (error) {
          console.error('❌ 设备查询失败:', error);
          review._doc.deviceInfo = null;
        }
      } else {
        console.log('⚠️ 记录没有userId');
        review._doc.deviceInfo = null;
      }
    }
    console.log('✅ 设备信息关联完成');

    // 计算实际返回的记录总数
    let total;
    if (currentUserId && req.user.role === 'mentor') {
      // 带教老师：需要计算所有可能记录的总数
      const assignedUsers = await User.find({ mentor_id: currentUserId }).select('_id');
      const assignedUserIds = assignedUsers.map(u => u._id);

      // 计算自己名下用户的记录数
      const ownQuery = { ...query, status: 'pending', userId: { $in: assignedUserIds } };
      const ownCount = await ImageReview.countDocuments(ownQuery);

      // 计算其他记录数
      const otherQuery = { ...query, status: 'pending', userId: { $nin: assignedUserIds } };
      const otherCount = await ImageReview.countDocuments(otherQuery);

      // 计算非待审核记录数
      const nonPendingQuery = { ...query };
      nonPendingQuery.$and = nonPendingQuery.$and || [];
      nonPendingQuery.$and.push({ status: { $ne: 'pending' } });
      const nonPendingCount = await ImageReview.countDocuments(nonPendingQuery);

      total = ownCount + otherCount + nonPendingCount;
    } else if (currentUserId) {
      // 其他角色：计算所有相关记录的总数
      const selfQuery = { ...query };
      selfQuery.$or = [
        { 'mentorReview.reviewer': currentUserId },
        { 'auditHistory.operator': currentUserId }
      ];
      const selfCount = await ImageReview.countDocuments(selfQuery);

      const otherQuery = { ...query };
      otherQuery.$and = otherQuery.$and || [];
      otherQuery.$and.push({
        $nor: [
          { 'mentorReview.reviewer': currentUserId },
          { 'auditHistory.operator': currentUserId }
        ]
      });
      const otherCount = await ImageReview.countDocuments(otherQuery);

      total = selfCount + otherCount;
    } else {
      // 未登录或简单查询：使用数据库计数
      total = await ImageReview.countDocuments(query);
    }

    console.log('✅ 查询成功，记录数量:', reviews.length);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
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

// 主管批量确认 (只有manager和boss可以调用)
router.put('/batch-manager-approve', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ids, approved, comment } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要操作的任务' });
    }

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ success: false, message: '必须指定批准或驳回' });
    }

    if (!approved && (!comment || comment.trim() === '')) {
      return res.status(400).json({ success: false, message: '驳回理由不能为空' });
    }

    // 只更新状态为mentor_approved的任务
    const filter = {
      _id: { $in: ids },
      status: 'mentor_approved'
    };

    const updateData = {
      $set: {
        managerApproval: {
          approved,
          comment: approved ? '主管批量确认通过' : comment.trim(),
          approvedAt: new Date()
        }
      },
      $push: {
        auditHistory: {
          operator: req.user._id,
          operatorName: req.user.username,
          action: approved ? 'batch_manager_approve' : 'batch_manager_reject',
          comment: approved ? '主管批量确认通过' : comment.trim(),
          timestamp: new Date()
        }
      }
    };

    if (approved) {
      updateData.$set.status = 'manager_approved';
    } else {
      updateData.$set.status = 'manager_rejected';
      updateData.$set.rejectionReason = comment.trim();
    }

    const result = await ImageReview.updateMany(filter, updateData, { session });

    if (result.modifiedCount === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '没有找到可操作的任务' });
    }

    // 提交事务
    await session.commitTransaction();

    // 发送通知 (事务外执行，避免死锁)
    const updatedReviews = await ImageReview.find({
      _id: { $in: ids },
      status: approved ? 'manager_approved' : 'manager_rejected'
    }).populate('userId');

    for (const review of updatedReviews) {
      const oldStatus = 'mentor_approved';
      const newStatus = approved ? 'manager_approved' : 'manager_rejected';
      await notificationService.sendReviewStatusNotification(review, oldStatus, newStatus);

      // 如果是主管驳回，额外通知带教老师
      if (!approved) {
        await notificationService.sendMentorNotification(review, 'manager_reject', req.user.username, comment);
      }
    }

    res.json({
      success: true,
      message: `成功${approved ? '确认' : '驳回'} ${result.modifiedCount} 个任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('主管批量确认错误:', error);
    res.status(500).json({ success: false, message: '批量确认失败' });
  } finally {
    session.endSession();
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

// 获取AI自动审核记录（老板、主管、带教老师可见）
router.get('/ai-auto-approved', authenticateToken, requireRole(['mentor', 'manager', 'boss']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, userId, imageType, keyword } = req.query;
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

    let query = {
      'auditHistory.action': 'ai_auto_approved'
    };

    // 添加其他筛选条件
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

    console.log('🔍 AI自动审核记录查询条件:', query);
    console.log('   分页参数:', { page: pageNum, limit: limitNum });

    // 查询AI自动审核的记录
    const reviews = await ImageReview.find(query)
      .populate('userId', 'username nickname')
      .populate('mentorReview.reviewer', 'username nickname')
      .sort({ 'auditHistory.timestamp': -1 }) // 按AI审核时间倒序
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await ImageReview.countDocuments(query);

    // 为每个审核记录计算持续检查收益和生存天数
    console.log('💰 开始计算持续检查收益...');
    for (const review of reviews) {
      // 计算生存天数：从AI审核通过开始到今天的天数
      const aiAuditTime = review.auditHistory.find(h => h.action === 'ai_auto_approved')?.timestamp;
      const survivalDays = aiAuditTime ? Math.floor((Date.now() - new Date(aiAuditTime).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1;

      // 计算总收益：第一天原价 + 后续每天0.3元
      const initialPrice = review.snapshotPrice || 0; // 第一天收益（原笔记价格）
      const dailyReward = 0.3; // 后续每天奖励
      const additionalDays = Math.max(0, survivalDays - 1); // 除了第一天外的天数
      const additionalEarnings = additionalDays * dailyReward; // 后续天数的收益
      const totalEarnings = initialPrice + additionalEarnings; // 总收益

      // 计算上级用户佣金
      let parentCommission = 0;
      let grandParentCommission = 0;

      if (review.userId && review.userId.parent_id) {
        // 一级佣金
        parentCommission = additionalEarnings * (review.snapshotCommission1 / review.snapshotPrice);

        // 二级佣金
        const parentUser = await User.findById(review.userId.parent_id);
        if (parentUser && parentUser.parent_id) {
          grandParentCommission = additionalEarnings * (review.snapshotCommission2 / review.snapshotPrice);
        }
      }

      // 添加计算结果到记录中
      review._doc.survivalDays = survivalDays;
      review._doc.totalEarnings = totalEarnings;
      review._doc.initialPrice = initialPrice;
      review._doc.additionalEarnings = additionalEarnings;
      review._doc.dailyReward = dailyReward;
      review._doc.parentCommission = parentCommission;
      review._doc.grandParentCommission = grandParentCommission;

      console.log(`📊 记录 ${review._id}: 生存${survivalDays}天，总收益${totalEarnings}元 (初始${initialPrice} + 后续${additionalEarnings})，上级佣金: ${parentCommission}元，二级佣金: ${grandParentCommission}元`);
    }

    // 为每个审核记录添加设备信息
    console.log('🔗 开始为AI审核记录添加设备信息...');
    for (const review of reviews) {
      console.log(`🔍 处理记录 ${review._id}, 用户: ${review.userId?.username || '未知'}`);

      // 如果审核记录已经有deviceInfo，直接使用
      if (review.deviceInfo && review.deviceInfo.accountName) {
        console.log(`📱 使用已有设备信息: ${review.deviceInfo.accountName}`);
        continue;
      }

      // 如果没有deviceInfo，从Device表查询
      if (review.userId) {
        try {
          const Device = require('../models/Device');
          const device = await Device.findOne({ assignedUser: review.userId._id });
          console.log(`📱 从数据库查询设备: ${device ? device.accountName : '无设备'}`);
          review._doc.deviceInfo = device ? {
            accountName: device.accountName,
            status: device.status,
            influence: device.influence
          } : null;
        } catch (error) {
          console.error('❌ 设备查询失败:', error);
          review._doc.deviceInfo = null;
        }
      } else {
        console.log('⚠️ 记录没有userId');
        review._doc.deviceInfo = null;
      }
    }
    console.log('✅ 设备信息关联完成');

    console.log('✅ AI自动审核记录查询成功，记录数量:', reviews.length);

    res.json({
      success: true,
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('获取AI自动审核记录错误:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ success: false, message: '获取AI自动审核记录失败' });
  }
});

module.exports = router;


