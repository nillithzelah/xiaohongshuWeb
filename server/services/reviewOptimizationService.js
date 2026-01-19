const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const Device = require('../models/Device');

/**
 * 审核流程优化服务
 * 解决N+1查询和性能问题
 */
class ReviewOptimizationService {

  /**
   * 批量为审核记录添加设备信息（使用聚合管道优化）
   * @param {Array} reviews - 审核记录数组
   * @returns {Promise<Array>} 包含设备信息的审核记录
   */
  async batchAttachDeviceInfo(reviews) {
    if (!reviews || reviews.length === 0) return reviews;

    // 提取所有用户ID
    const userIds = reviews
      .map(review => review.userId?._id || review.userId)
      .filter(id => id);

    if (userIds.length === 0) return reviews;

    // 批量查询设备信息
    const devices = await Device.find({
      assignedUser: { $in: userIds }
    }).select('assignedUser accountName status influence');

    // 创建设备映射
    const deviceMap = new Map();
    devices.forEach(device => {
      deviceMap.set(device.assignedUser.toString(), {
        accountName: device.accountName,
        status: device.status,
        influence: device.influence
      });
    });

    // 为每个审核记录添加设备信息
    reviews.forEach(review => {
      if (!review) return; // 跳过 undefined 或 null

      const userId = review.userId?._id?.toString() || review.userId?.toString();

      // 兼容 Mongoose 文档（有 _doc）和普通对象（.lean() 返回）
      if (review._doc) {
        // Mongoose 文档
        if (userId && deviceMap.has(userId)) {
          review._doc.deviceInfo = deviceMap.get(userId);
        } else if (!review.deviceInfo) {
          review._doc.deviceInfo = null;
        }
      } else {
        // 普通对象（.lean() 返回）
        if (userId && deviceMap.has(userId)) {
          review.deviceInfo = deviceMap.get(userId);
        } else if (!review.deviceInfo) {
          review.deviceInfo = null;
        }
      }
    });

    return reviews;
  }

  /**
   * 优化的审核记录查询（支持复杂排序和分页）
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async getOptimizedReviews(options = {}) {
    // 自动清理超时的 processing 任务（10分钟超时）
    const now = new Date();
    const timeoutReleaseResult = await ImageReview.updateMany(
      {
        status: 'processing',
        'processingLock.lockedUntil': { $lt: now }
      },
      {
        $set: {
          status: 'pending',
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      }
    );

    if (timeoutReleaseResult.modifiedCount > 0) {
      console.log(`🔄 [超时清理] 自动释放 ${timeoutReleaseResult.modifiedCount} 个超时的 processing 任务`);
    }

    const {
      page = 1,
      limit = 10,
      status,
      userId,
      imageType,
      keyword,
      reviewer,
      deviceName,
      currentUserId,
      currentUserRole
    } = options;

    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);

    // 构建基础查询条件
    let query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (imageType) query.imageType = imageType;

    // 处理关键词搜索
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

    // 处理reviewer筛选
    if (reviewer) {
      query['mentorReview.reviewer'] = reviewer;
    }

    // 处理设备名筛选
    if (deviceName) {
      const matchedDevices = await Device.find({
        accountName: { $regex: deviceName, $options: 'i' }
      }).select('assignedUser');
      const userIds = matchedDevices.map(device => device.assignedUser);
      if (userIds.length > 0) {
        query.userId = query.userId ? { $in: [...new Set([...(query.userId.$in || []), ...userIds])] } : { $in: userIds };
      } else {
        query.userId = null;
      }
    }

    let reviews;
    let total;

    if (currentUserId && currentUserRole === 'mentor') {
      // 带教老师：可以看到自己名下用户的记录 + 未分配带教老师的用户的记录 + 自己提交的 ai_approved 记录
      const assignedUsers = await User.find({
        $or: [
          { mentor_id: currentUserId },
          { mentor_id: null }
        ],
        role: 'part_time'
      }).select('_id');
      const assignedUserIds = assignedUsers.map(u => u._id);

      console.log(`🎓 [带教老师权限] 当前带教老师: ${currentUserId}, 找到用户数: ${assignedUserIds.length}`);

      // 使用聚合管道进行高效查询和排序
      const pipeline = [
        {
          $match: {
            ...query,
            $or: [
              { userId: { $in: assignedUserIds } }, // 自己名下用户 + 未分配带教老师用户的记录
              { userId: currentUserId, status: 'ai_approved' } // 自己提交的待人工复审记录
            ]
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'userId'
          }
        },
        { $unwind: '$userId' },
        {
          $lookup: {
            from: 'users',
            localField: 'mentorReview.reviewer',
            foreignField: '_id',
            as: 'mentorReview.reviewer'
          }
        },
        {
          $addFields: {
            'mentorReview.reviewer': { $arrayElemAt: ['$mentorReview.reviewer', 0] }
          }
        },
        {
          $addFields: {
            sortPriority: {
              $cond: {
                if: { $eq: ['$status', 'pending'] },
                then: 1,
                else: {
                  $cond: {
                    if: { $eq: ['$status', 'ai_approved'] },
                    then: 2,
                    else: 3
                  }
                }
              }
            },
            latestAuditTime: {
              $max: [
                '$createdAt',
                { $ifNull: ['$mentorReview.reviewedAt', null] },
                { $ifNull: ['$managerApproval.approvedAt', null] },
                { $ifNull: ['$financeProcess.processedAt', null] },
                { $max: '$auditHistory.timestamp' }
              ]
            }
          }
        },
        { $sort: { sortPriority: 1, latestAuditTime: -1 } },
        { $skip: (pageNum - 1) * limitNum },
        { $limit: limitNum }
      ];

      reviews = await ImageReview.aggregate(pipeline);

      // 计算总数
      const countPipeline = [
        {
          $match: {
            ...query,
            $or: [
              { userId: { $in: assignedUserIds } }, // 自己名下用户 + 未分配带教老师用户的记录
              { userId: currentUserId, status: 'ai_approved' } // 自己提交的待人工复审记录
            ]
          }
        },
        { $count: 'total' }
      ];

      const countResult = await ImageReview.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

    } else if (currentUserId && currentUserRole === 'hr') {
      // HR：可以看到自己创建用户的记录 + 未分配HR的用户的记录
      const hrUsers = await User.find({
        $or: [
          { hr_id: currentUserId },
          { hr_id: null }
        ],
        role: 'part_time'
      }).select('_id');
      const hrUserIds = hrUsers.map(u => u._id);

      console.log(`👥 [HR权限] 当前HR: ${currentUserId}, 找到用户数: ${hrUserIds.length}`);

      reviews = await ImageReview.find({
        ...query,
        userId: { $in: hrUserIds }
      })
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

      total = await ImageReview.countDocuments({
        ...query,
        userId: { $in: hrUserIds }
      });

    } else if (currentUserId) {
      // boss、manager、finance 角色：显示所有记录（不限制只能看到自己操作过的）
      reviews = await ImageReview.find(query)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .lean();

      total = await ImageReview.countDocuments(query);

    } else {
      // 未登录或简单查询
      reviews = await ImageReview.find(query)
        .populate('userId', 'username nickname')
        .populate('mentorReview.reviewer', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum);

      total = await ImageReview.countDocuments(query);
    }

    // 批量添加设备信息
    reviews = await this.batchAttachDeviceInfo(reviews);

    return {
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  /**
   * 批量发送通知（优化版本）
   * @param {Array} reviews - 审核记录数组
   * @param {string} oldStatus - 旧状态
   * @param {string} newStatus - 新状态
   * @param {Object} notificationService - 通知服务实例
   */
  async batchSendNotifications(reviews, oldStatus, newStatus, notificationService) {
    if (!reviews || reviews.length === 0) return;

    const notifications = reviews.map(review =>
      notificationService.sendReviewStatusNotification(review, oldStatus, newStatus)
    );

    await Promise.allSettled(notifications);
  }

  /**
   * 添加审核历史记录的统一方法
   * @param {Object} review - 审核记录
   * @param {Object} operator - 操作者信息
   * @param {string} action - 操作类型
   * @param {string} comment - 评论
   */
  addAuditHistory(review, operator, action, comment) {
    review.auditHistory.push({
      operator: operator._id,
      operatorName: operator.username,
      action,
      comment,
      timestamp: new Date()
    });
  }
}

module.exports = new ReviewOptimizationService();