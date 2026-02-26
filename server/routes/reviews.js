const express = require('express');
const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const TaskConfig = require('../models/TaskConfig');
const CommentLimit = require('../models/CommentLimit');
const { authenticateToken, requireRole, Role, getStatusQueryForRole, getValidStatusesForRole } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const reviewOptimizationService = require('../services/reviewOptimizationService');
const { escapeRegExp, validateSearchKeyword } = require('../utils/security');
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

// 获取待审核列表（带教老师、主管、HR）
router.get('/pending', authenticateToken, requireRole(['mentor', 'manager', 'boss', 'hr']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'pending' } = req.query;

    // 自动清理超时的 processing 任务（10分钟超时）
    const now = new Date();
    const timeoutReleaseResult = await ImageReview.updateMany(
      {
        status: 'processing',
        'processingLock.lockedUntil': { $lt: now }
      },
      {
        $set: { status: 'pending' },
        $unset: { processingLock: 1 }  // 完全删除锁定字段，避免留下空对象
      }
    );

    if (timeoutReleaseResult.modifiedCount > 0) {
      console.log(`🔄 [超时清理] 自动释放 ${timeoutReleaseResult.modifiedCount} 个超时的 processing 任务`);
    }

    // 数据权限过滤
    let query = { status };

    if (Role.isMentor(req)) {
      // 带教老师可以看到：
      // 1. 自己名下用户的审核 + 未分配带教老师的用户的审核（status = pending）
      // 2. 自己提交的待人工复审的笔记（status = ai_approved）
      // 看不到其他带教老师名下的用户
      const mentorUsers = await User.find({
        $or: [
          { mentor_id: req.user._id },              // 自己名下的用户
          { mentor_id: null },                      // 未分配带教老师的用户
          { mentor_id: { $exists: false } }         // 没有 mentor_id 字段的用户
        ],
        role: 'part_time'
      }).select('_id');
      const mentorUserIds = mentorUsers.map(user => user._id);

      console.log(`🔍 [审核权限] 带教老师 ${req.user.username} 查询审核，找到 ${mentorUserIds.length} 个兼职用户`);

      // 如果查询的是 ai_approved 状态，只显示自己提交的笔记
      if (status === 'ai_approved') {
        query.userId = req.user._id;
      } else {
        // 其他状态显示自己名下用户的审核
        query.userId = { $in: mentorUserIds };
      }
    } else if (Role.isHr(req)) {
      // HR 只能看到自己创建的用户的审核 + 未分配HR的用户的审核
      const hrUsers = await User.find({
        $or: [
          { hr_id: req.user._id },
          { hr_id: null },
          { hr_id: { $exists: false } }
        ],
        role: 'part_time'
      }).select('_id');
      const hrUserIds = hrUsers.map(user => user._id);

      console.log(`🔍 [审核权限] HR ${req.user.username} 查询审核，找到 ${hrUserIds.length} 个兼职用户`);

      query.userId = { $in: hrUserIds };
    }
    // boss 和 manager 可以看到所有审核，不过滤

    const reviews = await ImageReview.find(query)
      .populate('userId', 'username nickname')
      .sort({ createdAt: 1 })
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
    console.error('获取待审核列表错误:', error);
    res.status(500).json({ success: false, message: '获取审核列表失败' });
  }
});

// 带教老师审核 (支持带教老师和主管) - POST版本（前端兼容）
router.post('/:id/review', authenticateToken, requireRole(['mentor', 'manager', 'boss', 'hr']), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, comment } = req.body;

    const review = await ImageReview.findById(id).populate('userId');
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    const isManagerOrBoss = Role.isAdmin(req);
    const isMentor = Role.isMentor(req);

    // 不允许操作的状态
    const noActionStatuses = ['manager_approved', 'finance_processing', 'completed'];

    // 带教老师可以处理 pending、ai_approved、mentor_approved 状态（如果是自己的笔记）
    if (isMentor) {
      const validStatuses = ['pending', 'ai_approved', 'mentor_approved'];
      if (!validStatuses.includes(review.status)) {
        return res.status(400).json({ success: false, message: '该记录已被审核' });
      }
      // 如果是 ai_approved 或 mentor_approved 状态，只能操作自己名下用户的笔记
      if (['ai_approved', 'mentor_approved'].includes(review.status)) {
        // 检查笔记提交者是否属于当前带教老师名下
        const submitter = await User.findById(review.userId);
        if (!submitter || submitter.mentor_id?.toString() !== req.user._id.toString()) {
          return res.status(403).json({ success: false, message: '只能操作自己名下用户的笔记' });
        }
      }
    }

    // 老板和主管可以处理所有状态（除了不允许操作的状态）- 作为AI判断错误的备用
    if (isManagerOrBoss && noActionStatuses.includes(review.status)) {
      return res.status(400).json({ success: false, message: `该记录状态为 ${review.status}，不允许操作` });
    }

    const oldStatus = review.status;
    const isCustomerResource = review.imageType === 'customer_resource';
    const actionComment = reason || comment || (action === 'approve' ? '审核通过' : '审核驳回');

    if (action === 'approve') {
      review.auditHistory.push({
        operator: req.user._id,
        operatorName: req.user.username,
        action: isManagerOrBoss ? 'manager_approve' : 'mentor_pass',
        comment: actionComment,
        timestamp: new Date()
      });

      if (isManagerOrBoss) {
        review.managerApproval = {
          approved: true,
          comment: actionComment,
          approvedAt: new Date()
        };
      } else {
        review.mentorReview = {
          reviewer: req.user._id,
          approved: true,
          comment: actionComment,
          reviewedAt: new Date()
        };
      }

      // 所有类型人工审核通过后直接完成（一次审核）
      review.status = 'manager_approved';

      // 如果是笔记类型，启用持续检查
      if (review.imageType === 'note') {
        const firstCheckTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        review.continuousCheck = {
          enabled: true,
          status: 'active',
          nextCheckTime: firstCheckTime
        };
        console.log(`✅ [单次审核] 笔记类型审核通过，已启用持续检查，reviewId: ${review._id}`);
      }

      // 人工审核通过时发放任务积分（根据类型）
      let typeKey;
      if (review.imageType === 'customer_resource') {
        typeKey = 'customer_resource';
      } else if (review.imageType === 'note') {
        typeKey = 'note';
      } else if (review.imageType === 'comment') {
        typeKey = 'comment';
      }

      if (typeKey) {
        const taskConfig = await TaskConfig.findOne({ type_key: typeKey, is_active: true });
        const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

        if (pointsReward > 0) {
          try {
            const Transaction = require('../models/Transaction');

            // 【防止重复发放】检查是否已经发放过该任务的积分
            const existingReward = await Transaction.findOne({
              imageReview_id: review._id,
              type: 'task_reward'
            });

            if (existingReward) {
              console.log(`⚠️ [人工审核] 该任务已发放过积分，跳过重复发放: ${review._id}`);
            } else {
              await User.findByIdAndUpdate(review.userId, {
                $inc: { points: pointsReward }
              });
              console.log(`💰 [人工审核] ${review.imageType}审核通过，已发放任务积分: ${pointsReward}`);

              // 创建任务奖励交易记录
              await new Transaction({
              user_id: review.userId,
              type: 'task_reward',
              amount: pointsReward,
              description: `任务奖励 - ${review.imageType}审核通过`,
              status: 'completed',
              imageReview_id: review._id,
              createdAt: new Date()
            }).save();

            // 更新审核历史，记录积分发放
            review.auditHistory.push({
              operator: req.user._id,
              operatorName: req.user.username,
              action: 'points_reward',
              comment: `${review.imageType}审核通过，发放${pointsReward}积分`,
              timestamp: new Date()
            });
            }
          } catch (pointsError) {
            console.error('❌ [人工审核] 发放任务积分失败:', pointsError);
          }
        }
      }

      // 人工审核通过时发放分销积分（所有类型）
      if (review.snapshotCommission1 > 0) {
        try {
          // review.userId 已经在查询时 populate 了
          if (review.userId?.parent_id) {
            const Transaction = require('../models/Transaction');

            // 【防重复发放】检查一级佣金是否已发放
            const existingCommission1 = await Transaction.findOne({
              imageReview_id: review._id,
              type: 'referral_bonus_1'
            });

            // 一级佣金：直接增加上级积分
            const parentUser = await User.findById(review.userId.parent_id);
            if (parentUser && !parentUser.is_deleted) {
              if (!existingCommission1) {
                await User.findByIdAndUpdate(parentUser._id, {
                  $inc: { points: review.snapshotCommission1 }
                });
                console.log(`💰 [分销佣金] 一级: +${review.snapshotCommission1}积分 → ${parentUser.username}`);

                // 创建一级佣金交易记录
                await new Transaction({
                  user_id: parentUser._id,
                  type: 'referral_bonus_1',
                  amount: review.snapshotCommission1,
                  description: `一级推荐佣金 - 来自用户 ${review.userId.username || review.userId.nickname} (${review.imageType})`,
                  status: 'completed',
                  imageReview_id: review._id,
                  createdAt: new Date()
                }).save();
              } else {
                console.log(`⚠️ [分销佣金] 一级佣金已发放，跳过: ${review._id}`);
              }

              // 二级佣金
              if (parentUser.parent_id && review.snapshotCommission2 > 0) {
                // 【防重复发放】检查二级佣金是否已发放
                const existingCommission2 = await Transaction.findOne({
                  imageReview_id: review._id,
                  type: 'referral_bonus_2'
                });

                const grandParentUser = await User.findById(parentUser.parent_id);
                if (grandParentUser && !grandParentUser.is_deleted) {
                  if (!existingCommission2) {
                    await User.findByIdAndUpdate(grandParentUser._id, {
                      $inc: { points: review.snapshotCommission2 }
                    });
                    console.log(`💰 [分销佣金] 二级: +${review.snapshotCommission2}积分 → ${grandParentUser.username}`);

                    await new Transaction({
                      user_id: grandParentUser._id,
                      type: 'referral_bonus_2',
                      amount: review.snapshotCommission2,
                      description: `二级推荐佣金 - 来自用户 ${review.userId.username || review.userId.nickname} (${review.imageType})`,
                      status: 'completed',
                      imageReview_id: review._id,
                      createdAt: new Date()
                    }).save();
                  } else {
                    console.log(`⚠️ [分销佣金] 二级佣金已发放，跳过: ${review._id}`);
                  }
                }
              }
            }
          }
        } catch (commissionError) {
          console.error('❌ [分销佣金] 发放佣金失败:', commissionError);
        }
      }
    } else if (action === 'reject') {
      review.auditHistory.push({
        operator: req.user._id,
        operatorName: req.user.username,
        action: isManagerOrBoss ? 'manager_reject' : 'mentor_reject',
        comment: actionComment,
        timestamp: new Date()
      });

      review.status = 'rejected';

      if (isManagerOrBoss) {
        review.managerApproval = {
          approved: false,
          comment: actionComment,
          approvedAt: new Date()
        };
      } else {
        review.mentorReview = {
          reviewer: req.user._id,
          approved: false,
          comment: actionComment,
          reviewedAt: new Date()
        };
      }

      review.rejectionReason = actionComment;
    }

    // 重置 reviewAttempt（人工审核后不需要AI重试计数）
    if (review.reviewAttempt > 2) {
      review.reviewAttempt = 1;
    }

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    // 返回清理后的review对象，避免循环引用导致序列化失败
    const cleanReview = {
      _id: review._id,
      status: review.status,
      imageType: review.imageType,
      imageUrls: review.imageUrls,
      createdAt: review.createdAt,
      auditHistory: review.auditHistory,
      userId: review.userId?._id || review.userId,
      username: review.userId?.username || review.userId?.username
    };

    res.json({
      success: true,
      message: action === 'approve'
        ? (isCustomerResource ? '审核通过' : (isManagerOrBoss ? '审核通过' : '审核通过，提交给主管'))
        : '审核拒绝',
      review: cleanReview
    });
  } catch (error) {
    console.error('审核错误:', error);
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

// 带教老师审核 (支持带教老师和主管)
router.put('/:id/mentor-review', authenticateToken, requireRole(['mentor', 'manager', 'boss', 'hr']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment, newType } = req.body;

    const review = await ImageReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    // 带教老师可以处理 pending、ai_approved、mentor_approved 状态的记录
    const validStatuses = getValidStatusesForRole(req.user.role);
    if (!validStatuses.includes(review.status)) {
      return res.status(400).json({ success: false, message: '该记录已被审核或状态不允许此操作' });
    }

    // 带教老师权限过滤：只能操作自己下属用户的审核
    if (Role.isMentor(req)) {
      const mentorUsers = await User.find({
        $or: [
          { mentor_id: req.user._id },
          { mentor_id: null },
          { mentor_id: { $exists: false } }
        ],
        role: 'part_time'
      }).select('_id');
      const mentorUserIds = mentorUsers.map(user => user._id);

      // 使用 equals() 方法比较 ObjectId，因为 includes() 使用引用比较，会导致 ObjectId 比较失败
      const hasPermission = mentorUserIds.some(id => id.equals(review.userId));
      if (!hasPermission) {
        return res.status(403).json({ success: false, message: '无权操作此记录' });
      }
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
      historyComment += ` (客服修正类型为 ${newTypeName}, 价格从 ${oldSnapshotPrice} 调整为 ${review.snapshotPrice})`;
    }

    review.auditHistory.push({
      operator: req.user._id,
      operatorName: req.user.username,
      action: approved ? 'mentor_pass' : 'mentor_reject',
      comment: historyComment,
      timestamp: new Date()
    });

    if (approved) {
      review.status = 'manager_approved'; // 带教老师审核通过，直接进入财务流程
    } else {
      review.status = 'rejected';
    }

    await review.save();

    // 发送通知
    await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);

    res.json({
      success: true,
      message: approved ? '审核通过' : '审核拒绝',
      review
    });
  } catch (error) {
    console.error('客服审核错误:', error);
    res.status(500).json({ success: false, message: '审核失败' });
  }
});

// 主管确认（支持人工复审AI审核通过的记录）
router.put('/:id/manager-approve', authenticateToken, requireRole(['mentor', 'manager', 'boss']), async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, comment } = req.body;

    const review = await ImageReview.findById(id);
    if (!review) {
      return res.status(404).json({ success: false, message: '审核记录不存在' });
    }

    // 支持mentor_approved（带教老师审核通过）和ai_approved（AI审核通过）两种状态
    if (!['mentor_approved', 'ai_approved'].includes(review.status)) {
      return res.status(400).json({ success: false, message: '该记录状态不正确，只能人工复审AI审核通过或带教老师审核通过的记录' });
    }

    const oldStatus = review.status;

    review.managerApproval = {
      approved,
      comment,
      approvedAt: new Date()
    };

    // 添加审核历史记录
    const actionComment = comment || (approved ? '人工复审通过' : '人工复审驳回');
    review.auditHistory.push({
      operator: req.user._id,
      operatorName: req.user.username,
      action: approved ? 'manager_approve' : 'manager_reject',
      comment: actionComment,
      timestamp: new Date()
    });

    if (approved) {
      review.status = 'manager_approved'; // 人工复审通过，可以开始持续检查和财务处理

      // 自动发放两级推荐佣金（直接增加积分）
      if (review.snapshotCommission1 > 0) {
        try {
          const User = require('../models/User');
          const Transaction = require('../models/Transaction');
          const populatedReview = await ImageReview.findById(id).populate('userId');

          console.log(`🔍 [佣金调试] reviewId: ${id}, type: ${review.imageType}, commission: ${review.snapshotCommission1}`);
          console.log(`🔍 [佣金调试] userId: ${populatedReview.userId}, parent_id: ${populatedReview.userId?.parent_id}`);

          if (populatedReview.userId?.parent_id) {
            // 【防重复发放】检查一级佣金是否已发放
            const existingCommission1 = await Transaction.findOne({
              imageReview_id: review._id,
              type: 'referral_bonus_1'
            });

            // 一级佣金：直接增加上级积分
            const parentUser = await User.findById(populatedReview.userId.parent_id);
            if (parentUser && !parentUser.is_deleted) {
              if (!existingCommission1) {
                await User.findByIdAndUpdate(parentUser._id, {
                  $inc: { points: review.snapshotCommission1 }
                });
                console.log(`💰 [佣金] 一级: +${review.snapshotCommission1}积分 → ${parentUser.username}`);

                // 创建一级佣金交易记录
                await new Transaction({
                  user_id: parentUser._id,
                  type: 'referral_bonus_1',
                  amount: review.snapshotCommission1,
                  description: `一级推荐佣金 - 来自用户 ${populatedReview.userId.username || populatedReview.userId.nickname}`,
                  status: 'completed',
                  imageReview_id: review._id,
                  createdAt: new Date()
                }).save();
                console.log(`📝 [佣金] 已创建一级佣金交易记录`);
              } else {
                console.log(`⚠️ [佣金] 一级佣金已发放，跳过: ${review._id}`);
              }

              // 二级佣金
              if (parentUser.parent_id && review.snapshotCommission2 > 0) {
                // 【防重复发放】检查二级佣金是否已发放
                const existingCommission2 = await Transaction.findOne({
                  imageReview_id: review._id,
                  type: 'referral_bonus_2'
                });

                const grandParentUser = await User.findById(parentUser.parent_id);
                if (grandParentUser && !grandParentUser.is_deleted) {
                  if (!existingCommission2) {
                    await User.findByIdAndUpdate(grandParentUser._id, {
                      $inc: { points: review.snapshotCommission2 }
                    });
                    console.log(`💰 [佣金] 二级: +${review.snapshotCommission2}积分 → ${grandParentUser.username}`);

                    // 创建二级佣金交易记录
                    await new Transaction({
                      user_id: grandParentUser._id,
                      type: 'referral_bonus_2',
                      amount: review.snapshotCommission2,
                      description: `二级推荐佣金 - 来自用户 ${populatedReview.userId.username || populatedReview.userId.nickname}`,
                      status: 'completed',
                      imageReview_id: review._id,
                      createdAt: new Date()
                    }).save();
                    console.log(`📝 [佣金] 已创建二级佣金交易记录`);
                  } else {
                    console.log(`⚠️ [佣金] 二级佣金已发放，跳过: ${review._id}`);
                  }
                }
              }
            } else {
              console.log(`⚠️ [佣金] 上级用户不存在或已删除`);
            }
          } else {
            console.log(`⚠️ [佣金] userId.parent_id 不存在`);
          }
        } catch (error) {
          console.error('❌ [佣金] 发放佣金失败:', error);
        }
      }

      // 记录评论限制（如果是从 pending/mentor_approved → manager_approved）
      if (review.imageType === 'comment' && oldStatus !== 'ai_approved') {
        try {
          // 获取作者昵称（从多个来源尝试）
          let authorToRecord = review.aiParsedNoteInfo?.author;
          if (!authorToRecord && Array.isArray(review.userNoteInfo?.author)) {
            authorToRecord = review.userNoteInfo.author[0];
          } else if (!authorToRecord && typeof review.userNoteInfo?.author === 'string') {
            const authorStr = review.userNoteInfo.author.trim();
            authorToRecord = authorStr.includes(',') || authorStr.includes('，')
              ? authorStr.split(/[,，]/)[0].trim()
              : authorStr;
          }

          if (authorToRecord && review.noteUrl && review.userNoteInfo?.comment) {
            await CommentLimit.recordCommentApproval(
              review.noteUrl,
              authorToRecord,
              review.userNoteInfo.comment,
              review._id
            );
            console.log(`✅ [manager审批] 评论限制记录: ${authorToRecord}`);
          }
        } catch (error) {
          console.error('❌ [manager审批] 记录评论限制失败:', error);
        }
      }

      // 如果是笔记类型，启用持续检查
      if (review.imageType === 'note') {
        const firstCheckTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        review.continuousCheck = {
          enabled: true,
          status: 'active',
          nextCheckTime: firstCheckTime
        };
        console.log(`✅ [人工复审] 笔记类型审核通过，已启用持续检查，reviewId: ${review._id}`);

        // 笔记类型：AI审核通过时未发放积分，人工复审通过时才发放
        // 从ai_approved或mentor_approved转来都需要发放积分
        if (oldStatus === 'ai_approved' || oldStatus === 'mentor_approved') {
          const TaskConfig = require('../models/TaskConfig');
          const taskConfig = await TaskConfig.findOne({ type_key: 'note', is_active: true });
          const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

          if (pointsReward > 0) {
            const User = require('../models/User');
            const Transaction = require('../models/Transaction');

            // 【防止重复发放】检查是否已经发放过该任务的积分
            const existingReward = await Transaction.findOne({
              imageReview_id: review._id,
              type: 'task_reward'
            });

            if (existingReward) {
              console.log(`⚠️ [人工复审] 该任务已发放过积分，跳过重复发放: ${review._id}`);
            } else {
              await User.findByIdAndUpdate(review.userId, {
                $inc: { points: pointsReward }
              });
              console.log(`💰 [人工复审] 笔记类型审核通过，已发放积分: ${pointsReward}`);

              // 创建任务奖励交易记录
              await new Transaction({
                user_id: review.userId,
                type: 'task_reward',
                amount: pointsReward,
                description: `任务奖励 - 笔记审核通过`,
                status: 'completed',
                imageReview_id: review._id,
                createdAt: new Date()
              }).save();

              // 更新审核历史，记录积分发放
              review.auditHistory.push({
                operator: req.user._id,
              operatorName: req.user.username,
              action: 'points_reward',
              comment: `人工复审通过，发放${pointsReward}积分`,
              timestamp: new Date()
              });
            }
          }
        }
      }
    } else {
      review.status = 'manager_rejected'; // 人工复审驳回
      review.rejectionReason = comment; // 记录驳回原因（向后兼容）
    }

    await review.save();

    // 发送通知（失败不影响主流程）
    try {
      await notificationService.sendReviewStatusNotification(review, oldStatus, review.status);
    } catch (notifError) {
      console.error('发送审核状态通知失败:', notifError.message);
    }

    // 如果是主管驳回且原状态是mentor_approved，额外通知带教老师（失败不影响主流程）
    if (!approved && oldStatus === 'mentor_approved') {
      try {
        await notificationService.sendMentorNotification(review, 'manager_reject', req.user.username, comment);
      } catch (notifError) {
        console.error('发送带教老师通知失败:', notifError.message);
      }
    }

    res.json({
      success: true,
      message: approved ? '人工复审通过，提交给财务处理' : '人工复审驳回',
      review
    });
  } catch (error) {
    console.error('人工复审错误:', error);
    res.status(500).json({ success: false, message: '人工复审失败' });
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
            parentUser.wallet = {};
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
              grandParentUser.wallet = {};
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

    // 评论类型的防作弊计数器更新已在asyncAiReviewService中处理（通过CommentLimit.recordCommentApproval）

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

// 获取所有审核记录（管理员）- 优化版本
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Reviews API 被调用了! (优化版本)');

    const options = {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      userId: req.query.userId,
      imageType: req.query.imageType,
      keyword: req.query.keyword,
      reviewer: req.query.reviewer,
      deviceName: req.query.deviceName,
      currentUserId: req.user ? req.user._id : null,
      currentUserRole: req.user ? req.user.role : null
    };

    console.log('📋 Reviews API 收到的参数:', JSON.stringify({
      page: options.page,
      limit: options.limit,
      status: options.status,
      imageType: options.imageType,
      userId: options.userId,
      keyword: options.keyword
    }));

    const result = await reviewOptimizationService.getOptimizedReviews(options);

    console.log('✅ 查询成功，记录数量:', result.reviews.length);

    res.json({
      success: true,
      data: {
        reviews: result.reviews,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('=== 获取审核记录错误 ===');
    console.error('错误名称:', error.name);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
    console.error('请求参数:', JSON.stringify(req.query));
    console.error('用户信息:', req.user ? { id: req.user._id, role: req.user.role } : '无');
    console.error('====================');
    res.status(500).json({
      success: false,
      message: '获取审核记录失败',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

// 一键全部通过 (只有manager和boss可以调用) - 优化版本
router.put('/approve-all-pending', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

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
      },
      { session }
    );

    await session.commitTransaction();

    // 批量发送通知（事务外执行）
    const updatedReviews = await ImageReview.find({ status: 'mentor_approved' })
      .populate('userId')
      .limit(1000 );    
    await reviewOptimizationService.batchSendNotifications(updatedReviews, 'pending', 'mentor_approved', notificationService);

    res.json({
      success: true,
      message: `成功通过 ${result.modifiedCount} 个待审核任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('一键全部通过错误:', error);
    res.status(500).json({ success: false, message: '一键全部通过失败' });
  } finally {
    session.endSession();
  }
});

// 一键全部驳回 (只有manager和boss可以调用) - 优化版本
router.put('/reject-all-pending', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      await session.abortTransaction();
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
      },
      { session }
    );

    await session.commitTransaction();

    // 批量发送通知（事务外执行）
    const updatedReviews = await ImageReview.find({ status: 'rejected' }).populate('userId');
    await reviewOptimizationService.batchSendNotifications(updatedReviews, 'pending', 'rejected', notificationService);

    res.json({
      success: true,
      message: `成功驳回 ${result.modifiedCount} 个待审核任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('一键全部驳回错误:', error);
    res.status(500).json({ success: false, message: '一键全部驳回失败' });
  } finally {
    session.endSession();
  }
});

// 主管批量确认 (mentor、manager和boss可以调用)
router.put('/batch-manager-approve', authenticateToken, requireRole(['mentor', 'manager', 'boss']), async (req, res) => {
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

    // 发放任务积分和佣金 (approved 时)
    if (approved) {
      const User = require('../models/User');
      const TaskConfig = require('../models/TaskConfig');
      const Transaction = require('../models/Transaction');
      const updatedReviews = await ImageReview.find({ _id: { $in: ids }, status: 'manager_approved' }).populate('userId');

      for (const review of updatedReviews) {
        // 发放任务积分（所有类型：客资、笔记、评论）
        let typeKey;
        if (review.imageType === 'customer_resource') {
          typeKey = 'customer_resource';
        } else if (review.imageType === 'note') {
          typeKey = 'note';
        } else if (review.imageType === 'comment') {
          typeKey = 'comment';
        }

        if (typeKey) {
          const taskConfig = await TaskConfig.findOne({ type_key: typeKey, is_active: true });
          const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

          if (pointsReward > 0) {
            // 【防止重复发放】检查是否已经发放过该任务的积分
            const existingReward = await Transaction.findOne({
              imageReview_id: review._id,
              type: 'task_reward'
            });

            if (existingReward) {
              console.log(`⚠️ [批量审核] 该任务已发放过积分，跳过重复发放: ${review._id}`);
            } else {
              await User.findByIdAndUpdate(review.userId._id, {
                $inc: { points: pointsReward }
              });
              console.log(`💰 [批量审核] ${review.imageType}审核通过，已发放任务积分: ${pointsReward} → ${review.userId.username}`);

              // 创建任务奖励交易记录
              await new Transaction({
                user_id: review.userId._id,
                type: 'task_reward',
                amount: pointsReward,
                description: `任务奖励 - ${review.imageType}审核通过（批量）`,
                status: 'completed',
                imageReview_id: review._id,
                createdAt: new Date()
              }).save();

              // 更新审核历史
            await ImageReview.findByIdAndUpdate(review._id, {
              $push: {
                auditHistory: {
                  operator: req.user._id,
                  operatorName: req.user.username,
                  action: 'points_reward',
                  comment: `批量${review.imageType === 'customer_resource' ? '客资' : (review.imageType === 'note' ? '笔记' : '评论')}审核通过，发放${pointsReward}积分`,
                  timestamp: new Date()
                }
              }
            });
            }
          }
        }

        // 批量审批：直接增加积分作为推荐佣金
        if (review.snapshotCommission1 > 0 && review.userId?.parent_id) {
          // 【防重复发放】检查一级佣金是否已发放
          const existingCommission1 = await Transaction.findOne({
            imageReview_id: review._id,
            type: 'referral_bonus_1'
          });

          const parentUser = await User.findById(review.userId.parent_id);
          if (parentUser && !parentUser.is_deleted) {
            if (!existingCommission1) {
              await User.findByIdAndUpdate(parentUser._id, {
                $inc: { points: review.snapshotCommission1 }
              });
              console.log(`💰 [批量佣金] 一级: +${review.snapshotCommission1}积分 → ${parentUser.username}`);

              // 创建一级佣金交易记录
              await new Transaction({
                user_id: parentUser._id,
                type: 'referral_bonus_1',
                amount: review.snapshotCommission1,
                description: `一级推荐佣金 - 来自用户 ${review.userId.username || review.userId.nickname} (${review.imageType})`,
                status: 'completed',
                imageReview_id: review._id,
                createdAt: new Date()
              }).save();
            } else {
              console.log(`⚠️ [批量佣金] 一级佣金已发放，跳过: ${review._id}`);
            }

            if (parentUser.parent_id && review.snapshotCommission2 > 0) {
              // 【防重复发放】检查二级佣金是否已发放
              const existingCommission2 = await Transaction.findOne({
                imageReview_id: review._id,
                type: 'referral_bonus_2'
              });

              const grandParentUser = await User.findById(parentUser.parent_id);
              if (grandParentUser && !grandParentUser.is_deleted) {
                if (!existingCommission2) {
                  await User.findByIdAndUpdate(grandParentUser._id, {
                    $inc: { points: review.snapshotCommission2 }
                  });
                  console.log(`💰 [批量佣金] 二级: +${review.snapshotCommission2}积分 → ${grandParentUser.username}`);

                  // 创建二级佣金交易记录
                  await new Transaction({
                    user_id: grandParentUser._id,
                    type: 'referral_bonus_2',
                    amount: review.snapshotCommission2,
                    description: `二级推荐佣金 - 来自用户 ${review.userId.username || review.userId.nickname} (${review.imageType})`,
                    status: 'completed',
                    imageReview_id: review._id,
                    createdAt: new Date()
                  }).save();
                } else {
                  console.log(`⚠️ [批量佣金] 二级佣金已发放，跳过: ${review._id}`);
                }
              }
            }
          }
        }

        // 批量审批时也记录评论限制
        if (review.imageType === 'comment') {
          try {
            let authorToRecord = review.aiParsedNoteInfo?.author;
            if (!authorToRecord && Array.isArray(review.userNoteInfo?.author)) {
              authorToRecord = review.userNoteInfo.author[0];
            } else if (!authorToRecord && typeof review.userNoteInfo?.author === 'string') {
              const authorStr = review.userNoteInfo.author.trim();
              authorToRecord = authorStr.includes(',') || authorStr.includes('，')
                ? authorStr.split(/[,，]/)[0].trim()
                : authorStr;
            }

            if (authorToRecord && review.noteUrl && review.userNoteInfo?.comment) {
              await CommentLimit.recordCommentApproval(
                review.noteUrl,
                authorToRecord,
                review.userNoteInfo.comment,
                review._id
              );
              console.log(`✅ [批量审批] 评论限制记录: ${authorToRecord}`);
            }
          } catch (error) {
            console.error('❌ [批量审批] 记录评论限制失败:', error);
          }
        }
      }
    }

    // 发送通知 (事务外执行，避免死锁)
    const reviewsForNotification = await ImageReview.find({
      _id: { $in: ids },
      status: approved ? 'manager_approved' : 'manager_rejected'
    }).populate('userId');

    for (const review of reviewsForNotification) {
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

// 批量选中操作 (mentor、manager、boss可调用，带教老师只能操作自己下属用户) - 优化版本
router.put('/batch-cs-review', authenticateToken, requireRole(['mentor', 'manager', 'boss']), async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ids, action, comment } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '请选择要操作的任务' });
    }

    if (!['pass', 'reject'].includes(action)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '无效的操作类型' });
    }

    if (action === 'reject' && (!comment || comment.trim() === '')) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '驳回理由不能为空' });
    }

    // 基础过滤条件：带教老师可以操作 pending、ai_approved、mentor_approved 状态的任务
    const filter = {
      _id: { $in: ids },
      status: getStatusQueryForRole(req.user.role)
    };

    // 带教老师权限过滤：只能操作自己下属用户的审核
    if (Role.isMentor(req)) {
      const mentorUsers = await User.find({
        $or: [
          { mentor_id: req.user._id },
          { mentor_id: null },
          { mentor_id: { $exists: false } }
        ],
        role: 'part_time'
      }).select('_id');
      const mentorUserIds = mentorUsers.map(user => user._id);

      console.log(`🔍 [批量审核权限] 带教老师 ${req.user.username} 操作，找到 ${mentorUserIds.length} 个兼职用户`);

      filter.userId = { $in: mentorUserIds };
    }

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

    const result = await ImageReview.updateMany(filter, updateData, { session });
    await session.commitTransaction();

    // 批量发送通知（事务外执行）
    const updatedReviews = await ImageReview.find({
      _id: { $in: ids },
      status: action === 'pass' ? 'mentor_approved' : 'rejected'
    }).populate('userId');

    const oldStatus = 'pending';
    const newStatus = action === 'pass' ? 'mentor_approved' : 'rejected';
    await reviewOptimizationService.batchSendNotifications(updatedReviews, oldStatus, newStatus, notificationService);

    res.json({
      success: true,
      message: `成功${action === 'pass' ? '通过' : '驳回'} ${result.modifiedCount} 个任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('批量操作错误:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  } finally {
    session.endSession();
  }
});

// 批量操作别名路由 - 专门给带教老师使用（前端调用 /batch-mentor-review）
// 功能与 /batch-cs-review 完全相同，带教老师只能操作自己下属用户的审核
// 带教老师可以操作 pending 和 ai_approved 状态的任务
router.put('/batch-mentor-review', authenticateToken, requireRole(['mentor', 'manager', 'boss']), async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { ids, action, comment } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '请选择要操作的任务' });
    }

    if (!['pass', 'reject'].includes(action)) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '无效的操作类型' });
    }

    if (action === 'reject' && (!comment || comment.trim() === '')) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '驳回理由不能为空' });
    }

    // 基础过滤条件：带教老师可以操作 pending、ai_approved、mentor_approved 状态的任务
    const filter = {
      _id: { $in: ids },
      status: getStatusQueryForRole(req.user.role)
    };

    // 带教老师权限过滤：只能操作自己下属用户的审核
    if (Role.isMentor(req)) {
      const mentorUsers = await User.find({
        $or: [
          { mentor_id: req.user._id },
          { mentor_id: null },
          { mentor_id: { $exists: false } }
        ],
        role: 'part_time'
      }).select('_id');
      const mentorUserIds = mentorUsers.map(user => user._id);

      console.log(`🔍 [批量审核-带教] 带教老师 ${req.user.username} 操作，找到 ${mentorUserIds.length} 个兼职用户`);

      filter.userId = { $in: mentorUserIds };
    }

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

    const result = await ImageReview.updateMany(filter, updateData, { session });
    await session.commitTransaction();

    // 批量发送通知（事务外执行）
    const updatedReviews = await ImageReview.find({
      _id: { $in: ids },
      status: action === 'pass' ? 'mentor_approved' : 'rejected'
    }).populate('userId');

    const oldStatus = 'pending';
    const newStatus = action === 'pass' ? 'mentor_approved' : 'rejected';
    await reviewOptimizationService.batchSendNotifications(updatedReviews, oldStatus, newStatus, notificationService);

    res.json({
      success: true,
      message: `成功${action === 'pass' ? '通过' : '驳回'} ${result.modifiedCount} 个任务`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('批量操作-带教错误:', error);
    res.status(500).json({ success: false, message: '批量操作失败' });
  } finally {
    session.endSession();
  }
});

// 获取AI自动审核记录（老板、主管、带教老师可见）- 优化版本
router.get('/ai-auto-approved', authenticateToken, requireRole(['mentor', 'manager', 'boss', 'hr']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, userId, imageType, keyword, noteId } = req.query;
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

    // AI自动审核记录只显示笔记类型，不显示评论；排除主管驳回重审
    // 注意：由于笔记类型跳过服务器AI审核，使用 skip_server_audit action
    let query = {
      'auditHistory.action': 'skip_server_audit',
      imageType: 'note',  // 只显示笔记，评论不需要持续检查
      status: { $ne: 'manager_rejected' }  // 排除主管驳回重审的记录
    };

    // 添加其他筛选条件
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (imageType) query.imageType = imageType;

    // 如果有noteId，按ID后6位搜索
    if (noteId) {
      query._id = { $regex: escapeRegExp(noteId), $options: 'i' };
    }

    // 如果有keyword，搜索用户名匹配的用户ID
    if (keyword) {
      // 【安全修复】验证搜索关键词，防止 ReDoS 攻击
      const validation = validateSearchKeyword(keyword);
      if (!validation.safe) {
        return res.status(400).json({
          success: false,
          message: validation.error || '搜索关键词无效'
        });
      }

      const matchedUsers = await User.find({
        $or: [
          { username: { $regex: validation.escaped, $options: 'i' } },
          { nickname: { $regex: validation.escaped, $options: 'i' } }
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

    // 批量计算收益和添加设备信息
    console.log('💰 开始批量计算持续检查收益...');

    // 收集所有需要查询的用户ID（用于上级佣金计算）
    const userIdsForCommission = reviews
      .map(review => review.userId?.parent_id)
      .filter(id => id);

    // 批量查询上级用户信息
    const parentUsers = userIdsForCommission.length > 0 ?
      await User.find({ _id: { $in: userIdsForCommission } }).select('_id parent_id') : [];

    const parentUserMap = new Map();
    parentUsers.forEach(user => {
      parentUserMap.set(user._id.toString(), user);
    });

    // 批量查询TaskConfig（用于兼容旧数据的snapshotPrice修正）
    const taskConfigs = await TaskConfig.find({ is_active: true });
    const taskConfigMap = new Map();
    taskConfigs.forEach(config => {
      taskConfigMap.set(config.type_key, config);
    });

    // 为每个审核记录计算收益
    for (const review of reviews) {
      // 计算生存天数：使用实际持续检查成功的次数（从第0天开始）
      // 第0天 = 审核通过发放500积分
      // 第1天 = 第1次检查成功，第2天 = 第2次检查成功，...
      let survivalDays = 0;

      // 统计成功检查的次数
      if (review.continuousCheck?.enabled && review.continuousCheck?.checkHistory?.length > 0) {
        const successChecks = review.continuousCheck.checkHistory.filter(
          check => check.result === 'success'
        );
        survivalDays = successChecks.length;
      }

      // 【修复】使用实际的持续检查奖励记录计算收益，而非理论计算
      // 从 continuousCheck.checkHistory 中统计实际发放的积分
      let actualAdditionalEarnings = 0;
      let actualCheckCount = 0;
      let dailyReward = 30; // 默认每天30积分

      if (review.continuousCheck?.enabled && review.continuousCheck?.checkHistory?.length > 0) {
        // 统计成功检查且有奖励的记录
        const rewardedChecks = review.continuousCheck.checkHistory.filter(
          check => check.result === 'success' && check.rewardPoints > 0
        );
        actualCheckCount = rewardedChecks.length;

        // 累加实际奖励积分（兼容旧数据：如果rewardPoints<1，视为30）
        actualAdditionalEarnings = rewardedChecks.reduce((sum, check) => {
          let points = check.rewardPoints || 0;
          // 兼容旧数据：如果存储的是小数（如0.3），则视为30积分
          if (points > 0 && points < 1) {
            points = 30;
          }
          return sum + points;
        }, 0);

        // 获取实际的每日奖励积分（从最新记录中获取）
        if (rewardedChecks.length > 0) {
          const latestCheck = rewardedChecks[rewardedChecks.length - 1];
          let points = latestCheck.rewardPoints || 30;
          // 兼容旧数据
          if (points > 0 && points < 1) {
            points = 30;
          }
          dailyReward = points;
        }
      }

      // 【兼容旧数据】处理snapshotPrice值不正确的问题
      // 旧数据中笔记的snapshotPrice可能是10或8，但实际应该是500（TaskConfig中的当前价格）
      let initialPrice = review.snapshotPrice || 0;
      if (review.imageType === 'note' && initialPrice < 100) {
        // 对于笔记类型，如果snapshotPrice小于100，说明是旧数据，从TaskConfig获取正确值
        const noteConfig = taskConfigMap.get('note');
        if (noteConfig) {
          initialPrice = noteConfig.price || initialPrice;
        }
      }

      const additionalEarnings = actualAdditionalEarnings; // 实际持续检查奖励总和
      const totalEarnings = initialPrice + additionalEarnings; // 总收益（积分）

      // 计算上级用户佣金（积分）
      let parentCommission = 0;
      let grandParentCommission = 0;

      if (review.userId && review.userId.parent_id) {
        const parentUser = parentUserMap.get(review.userId.parent_id.toString());
        if (parentUser) {
          // 一级佣金：基于后续收益计算
          const commissionRate1 = review.snapshotCommission1 || 0;
          parentCommission = Math.floor(additionalEarnings * commissionRate1);

          // 二级佣金
          if (parentUser.parent_id) {
            const commissionRate2 = review.snapshotCommission2 || 0;
            grandParentCommission = Math.floor(additionalEarnings * commissionRate2);
          }
        }
      }

      // 添加计算结果到记录中
      review._doc.survivalDays = survivalDays;
      review._doc.actualCheckCount = actualCheckCount; // 实际检查次数
      review._doc.totalEarnings = totalEarnings;
      review._doc.initialPrice = initialPrice;
      review._doc.additionalEarnings = additionalEarnings;
      review._doc.dailyReward = dailyReward;
      review._doc.parentCommission = parentCommission;
      review._doc.grandParentCommission = grandParentCommission;
    }

    // 批量添加设备信息
    await reviewOptimizationService.batchAttachDeviceInfo(reviews);

    // 【修复】通过userNoteInfo.author中的昵称匹配正确的设备
    // 因为批量提交时没有deviceId，需要通过昵称匹配
    const Device = require('../models/Device');

    // 收集所有用户的设备（用于昵称匹配）
    const allDevices = await Device.find({
      assignedUser: { $in: reviews.map(r => r.userId?._id || r.userId).filter(id => id) }
    }).select('assignedUser accountName status influence');

    // 创建昵称到设备的映射
    const nicknameToDeviceMap = new Map();
    allDevices.forEach(device => {
      if (device.accountName) {
        nicknameToDeviceMap.set(device.accountName, device);
      }
    });

    // 为每个审核记录匹配正确的设备
    for (const review of reviews) {
      if (!review) continue;

      // 如果已经有正确的deviceInfo且不是virtual_device，跳过
      if (review.deviceInfo && review.deviceInfo.accountName && review.deviceInfo.accountName !== 'virtual_device' && review.deviceInfo.accountName !== '自动审核') {
        continue;
      }

      // 从userNoteInfo.author中提取昵称进行匹配
      if (review.userNoteInfo && review.userNoteInfo.author) {
        // 处理逗号分隔的多个昵称
        const nicknames = review.userNoteInfo.author.split(/,|，/).map(n => n.trim()).filter(n => n);

        // 尝试匹配每个昵称
        for (const nickname of nicknames) {
          const matchedDevice = nicknameToDeviceMap.get(nickname);
          if (matchedDevice) {
            const deviceInfo = {
              accountName: matchedDevice.accountName,
              status: matchedDevice.status,
              influence: matchedDevice.influence
            };

            // 更新review的deviceInfo
            if (review._doc) {
              review._doc.deviceInfo = deviceInfo;
            } else {
              review.deviceInfo = deviceInfo;
            }
            break; // 找到匹配就停止
          }
        }
      }
    }

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


