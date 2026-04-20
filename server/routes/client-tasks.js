/**
 * 客户端任务相关路由
 *
 * 从原 client.js 拆分出来的任务管理相关功能：
 * - 任务配置
 * - 任务提交（单图/批量）
 * - 用户任务查询
 * - 待处理任务
 * - 任务详情
 * - 任务失败处理
 * - 审核员状态
 */

const express = require('express');
const crypto = require('crypto');
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const submitDeduplicationService = require('../services/submitDeduplicationService');
const TimeUtils = require('../utils/timeUtils');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('Tasks');

// 验证 ObjectId 格式
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * 获取审核员在线状态（基于客户端心跳）
 * GET /xiaohongshu/api/client/auditor-status
 */
router.get('/auditor-status', async (req, res) => {
  try {
    // 获取最近5分钟内有心跳的客户端数量
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // 查找所有有活跃心跳且已锁定的任务
    const activeTasks = await ImageReview.find({
      'processingLock.clientId': { $exists: true, $ne: null },
      'processingLock.heartbeatAt': { $gte: fiveMinutesAgo }
    }).select('processingLock.clientId');

    // 统计唯一客户端数量（实际在线的审核员）
    const uniqueClientIds = new Set();
    activeTasks.forEach(task => {
      if (task.processingLock && task.processingLock.clientId) {
        uniqueClientIds.add(task.processingLock.clientId);
      }
    });

    const onlineAuditors = uniqueClientIds.size;
    const totalAuditors = onlineAuditors;

    res.json({
      success: true,
      data: { totalAuditors, onlineAuditors }
    });
  } catch (error) {
    log.error('获取审核员状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取审核员状态失败'
    });
  }
});

/**
 * 获取任务配置（显示给用户）
 * GET /xiaohongshu/api/client/task-configs
 */
router.get('/task-configs', async (req, res) => {
  try {
    const configs = await TaskConfig.find({ is_active: true })
      .select('type_key name price commission_1 commission_2 daily_reward_points continuous_check_days')
      .sort({ type_key: 1 });

    const processedConfigs = configs.map(config => ({
      _id: config._id,
      type_key: config.type_key,
      name: config.name,
      price: config.price,
      commission_1: config.commission_1,
      commission_2: config.commission_2,
      daily_reward_points: config.daily_reward_points,
      continuous_check_days: config.continuous_check_days
    }));

    res.json({ success: true, configs: processedConfigs });
  } catch (error) {
    log.error('获取任务配置错误:', error);
    res.status(500).json({ success: false, message: '获取任务配置失败' });
  }
});

/**
 * 获取指定用户的待审核任务（用于测试）
 * GET /xiaohongshu/api/client/test-user-tasks?nickname=xxx&limit=10
 */
router.get('/test-user-tasks', async (req, res) => {
  try {
    const { nickname, limit = 10 } = req.query;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        message: '请提供用户昵称'
      });
    }

    const user = await User.findOne({ nickname });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const tasks = await ImageReview.find({
      userId: user._id,
      imageType: 'comment',
      status: { $in: ['pending', 'ai_approved', 'rejected'] }
    })
    .select('_id noteUrl status userNoteInfo aiReviewResult createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    log.info(`📋 [测试API] 获取用户 ${nickname} 的 ${tasks.length} 个任务`);

    res.json({
      success: true,
      data: {
        nickname: nickname,
        userId: user._id,
        count: tasks.length,
        tasks: tasks
      }
    });
  } catch (error) {
    log.error('获取用户任务失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户任务失败'
    });
  }
});

/**
 * 上传图片并计算MD5（使用真实OSS上传）
 * POST /xiaohongshu/api/client/upload
 */
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, message: '没有图片数据' });
    }

    const md5 = crypto.createHash('md5').update(imageData).digest('hex');
    const hasKeys = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET;

    if (!hasKeys) {
      return res.status(500).json({
        success: false,
        message: 'OSS配置缺失，无法上传图片'
      });
    }

    const OSS = require('ali-oss');
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true
    });

    const filename = `uploads/${Date.now()}-${md5}.jpg`;

    try {
      const result = await client.put(filename, Buffer.from(imageData, 'base64'));
      const httpsUrl = result.url.replace('http://', 'https://');

      res.json({
        success: true,
        imageUrl: httpsUrl,
        md5
      });
    } catch (ossError) {
      log.error('❌ OSS上传失败:', ossError);
      res.status(500).json({
        success: false,
        message: 'OSS上传失败',
        error: ossError.message
      });
    }
  } catch (error) {
    log.error('上传图片错误:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

/**
 * 提交任务
 * POST /xiaohongshu/api/client/task/submit
 */
router.post('/task/submit', authenticateToken, async (req, res) => {
  try {
    const { deviceId, imageType: taskType, image_url: imageUrl, imageMd5 } = req.body;

    if (!taskType || !imageUrl || !imageMd5 || !deviceId) {
      return res.status(400).json({
        success: false,
        message: '参数不完整',
        missingParams: {
          taskType: !taskType,
          imageUrl: !imageUrl,
          imageMd5: !imageMd5,
          deviceId: !deviceId
        }
      });
    }

    let device = null;

    // 验证设备
    try {
      if (isValidObjectId(deviceId)) {
        device = await Device.findOne({
          _id: deviceId,
          assignedUser: req.user._id,
          is_deleted: { $ne: true }
        });
      }
    } catch (error) {
      log.info('真实设备查找失败:', error.message);
    }

    // 开发环境允许使用模拟设备
    if (!device && process.env.NODE_ENV !== 'production' && deviceId.startsWith('device_')) {
      const developerRoles = ['boss', 'manager', 'hr', 'mentor'];
      if (!developerRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: '无权使用测试设备'
        });
      }

      const deviceNumber = deviceId.split('_')[1] || '001';
      device = {
        _id: deviceId,
        accountName: `xiaohongshu_user_${deviceNumber}`,
        status: 'online',
        influence: ['new'],
        assignedUser: req.user._id
      };
      log.info('🧪 使用模拟设备进行测试:', device);
    }

    if (!device) {
      return res.status(400).json({ success: false, message: '无效的设备选择' });
    }

    const taskConfig = await TaskConfig.findOne({ type_key: taskType, is_active: true });
    if (!taskConfig) {
      return res.status(400).json({ success: false, message: '无效的任务类型' });
    }

    // MD5去重检查
    const existingReview = await ImageReview.findOne({
      imageMd5s: imageMd5,
      status: 'manager_approved'
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: '该图片已被使用，请勿重复提交'
      });
    }

    const review = new ImageReview({
      userId: req.user._id,
      imageUrls: [imageUrl],
      imageType: taskType,
      imageMd5s: [imageMd5],
      snapshotPrice: taskConfig.price,
      snapshotCommission1: taskConfig.commission_1,
      snapshotCommission2: taskConfig.commission_2,
      deviceInfo: {
        accountName: device.accountName,
        status: device.status,
        influence: device.influence
      },
      auditHistory: [{
        operator: req.user._id,
        operatorName: req.user.username,
        action: 'submit',
        comment: '用户提交任务'
      }]
    });

    await review.save();

    res.json({
      success: true,
      message: '任务提交成功，等待审核',
      review: {
        id: review._id,
        imageType: review.imageType,
        status: review.status,
        createdAt: review.createdAt
      }
    });
  } catch (error) {
    log.error('提交任务错误:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

/**
 * 获取用户任务记录
 * GET /xiaohongshu/api/client/user/tasks
 */
router.get('/user/tasks', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, imageType } = req.query;

    const query = { userId: req.user._id };
    if (imageType) {
      query.imageType = imageType;
    }

    const reviews = await ImageReview.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ImageReview.countDocuments(query);

    const formattedReviews = [];

    for (const review of reviews) {
      const reviewObj = review.toObject();
      reviewObj.createdAt = TimeUtils.formatBeijingTime(review.createdAt);
      formattedReviews.push(reviewObj);

      // 添加持续检查奖励记录
      if (review.continuousCheck &&
          review.continuousCheck.enabled &&
          review.continuousCheck.checkHistory &&
          review.continuousCheck.checkHistory.length > 0) {

        const rewardedChecks = review.continuousCheck.checkHistory.filter(
          check => check.result === 'success' && check.rewardPoints > 0
        );

        for (const check of rewardedChecks) {
          const checkTime = TimeUtils.formatBeijingTime(check.checkTime);
          formattedReviews.push({
            _id: review._id + '_check_' + checkTime,
            isContinuousCheckReward: true,
            originalReviewId: review._id,
            imageType: 'continuous_check',
            status: 'completed',
            createdAt: checkTime,
            noteUrl: review.noteUrl,
            continuousCheckInfo: {
              checkTime: checkTime,
              rewardPoints: check.rewardPoints,
              checkIndex: review.continuousCheck.checkHistory.indexOf(check) + 1
            },
            deviceInfo: review.deviceInfo,
            aiParsedNoteInfo: review.aiParsedNoteInfo
          });
        }
      }
    }

    formattedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const startIndex = 0;
    const endIndex = limit;
    const paginatedReviews = formattedReviews.slice(startIndex, endIndex);

    res.json({
      success: true,
      reviews: paginatedReviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: formattedReviews.length,
        pages: Math.ceil(formattedReviews.length / limit)
      }
    });
  } catch (error) {
    log.error('获取用户任务错误:', error);
    res.status(500).json({ success: false, message: '获取任务记录失败' });
  }
});

/**
 * 获取待处理任务（客户端拉取）
 * GET /xiaohongshu/api/client/pending-tasks
 */
router.get('/pending-tasks', async (req, res) => {
  try {
    const { type, limit = 5, clientId } = req.query;

    // 构建查询条件
    const query = { status: 'pending' };

    // 如果指定了类型，添加类型过滤
    if (type && type !== 'all') {
      query.imageType = type;
    }

    // 获取待处理任务
    const tasks = await ImageReview.find(query)
      .select('_id userId imageUrls imageType noteUrl userNoteInfo deviceInfo createdAt')
      .sort({ createdAt: 1 })
      .limit(parseInt(limit));

    // 如果指定了客户端ID，锁定任务
    if (clientId && tasks.length > 0) {
      const now = new Date();
      const lockExpiry = new Date(now.getTime() + 5 * 60 * 1000); // 5分钟锁

      const taskIds = tasks.map(t => t._id);
      await ImageReview.updateMany(
        { _id: { $in: taskIds } },
        {
          $set: {
            'processingLock.clientId': clientId,
            'processingLock.lockedAt': now,
            'processingLock.heartbeatAt': now,
            'processingLock.expiresAt': lockExpiry,
            status: 'locked'
          }
        }
      );
    }

    res.json({
      success: true,
      tasks: tasks,
      count: tasks.length
    });
  } catch (error) {
    log.error('获取待处理任务错误:', error);
    res.status(500).json({
      success: false,
      message: '获取待处理任务失败'
    });
  }
});

/**
 * 获取任务详情
 * GET /xiaohongshu/api/client/task/:id
 */
router.get('/task/:id', async (req, res) => {
  try {
    const task = await ImageReview.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      task: task
    });
  } catch (error) {
    log.error('获取任务详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取任务详情失败'
    });
  }
});

const CommentLimit = require('../models/CommentLimit');
const asyncAiReviewService = require('../services/asyncAiReviewService');

/**
 * 任务失败处理
 * POST /xiaohongshu/api/client/task-failed
 */
router.post('/task-failed', async (req, res) => {
  try {
    const { taskId, clientId, reason, errorType } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少任务ID'
      });
    }

    const updateData = {
      $set: {
        status: 'pending',
        'processingLock.clientId': null,
        'processingLock.lockedAt': null,
        'processingLock.heartbeatAt': null,
        'processingLock.expiresAt': null
      },
      $push: {
        auditHistory: {
          operator: null,
          operatorName: '系统',
          action: 'task_failed',
          comment: `任务处理失败: ${reason || '未知错误'}`,
          timestamp: new Date()
        }
      }
    };

    await ImageReview.findByIdAndUpdate(taskId, updateData);

    res.json({
      success: true,
      message: '任务已重置为待处理状态'
    });
  } catch (error) {
    log.error('任务失败处理错误:', error);
    res.status(500).json({
      success: false,
      message: '任务失败处理出错'
    });
  }
});

/**
 * 批量提交多图任务
 * POST /xiaohongshu/api/client/tasks/batch-submit
 */
router.post('/tasks/batch-submit', authenticateToken, async (req, res) => {
  try {
    const { deviceId = null, imageType, imageUrls, imageMd5s, noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat } = req.body;

    // 🛡️ 防重复提交检查（在参数验证之前）
    const duplicateCheck = submitDeduplicationService.checkDuplicate({
      userId: req.user._id,
      imageType,
      noteUrl,
      commentContent,
      noteTitle,
      customerPhone,
      customerWechat
    });

    if (duplicateCheck.isDuplicate) {
      log.info(`⚠️ [防重复提交] 拦截重复提交: 用户=${req.user._id}, 类型=${imageType}`);
      return res.status(429).json({
        success: false,
        message: duplicateCheck.reason || '请勿重复提交'
      });
    }

    // 验证参数
    if (!imageType) {
      return res.status(400).json({ success: false, message: '参数不完整：缺少任务类型' });
    }

    // 图片现在是可选的，只有当提供了图片时才验证
    if (imageUrls && imageMd5s) {
      if (imageUrls.length !== imageMd5s.length) {
        return res.status(400).json({ success: false, message: '图片和MD5数量不匹配' });
      }
      if (imageUrls.length > 9) {
        return res.status(400).json({ success: false, message: '图片数量不能超过9张' });
      }
    }

    // 验证不同类型的要求
    if (imageType === 'note') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记类型必须填写笔记链接' });
      }
      if (!noteAuthor || (Array.isArray(noteAuthor) && noteAuthor.length === 0) || (!Array.isArray(noteAuthor) && noteAuthor.trim() === '')) {
        return res.status(400).json({ success: false, message: '笔记类型必须填写作者昵称' });
      }
      if (!noteTitle || noteTitle.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记类型必须填写笔记标题' });
      }

      // 【重要】检查笔记限制（1天内是否已提交过笔记，或有审核中/待人工复审的笔记）
      const TimeUtils = require('../utils/timeUtils');
      const oneDayAgo = new Date(TimeUtils.getBeijingTime());
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      // 获取作者昵称（处理字符串或数组格式）
      const authorNickname = Array.isArray(noteAuthor) ? noteAuthor[0] : noteAuthor;
      const trimmedNickname = authorNickname ? authorNickname.trim() : '';

      if (trimmedNickname) {
        // 构建昵称匹配条件（支持新旧格式）
        const nicknameMatchCondition = {
          imageType: 'note',
          $or: [
            { 'userNoteInfo.author': trimmedNickname },
            { 'userNoteInfo.author': { $regex: trimmedNickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }
          ],
          createdAt: { $gte: oneDayAgo }
        };

        // 1. 首先检查是否有审核中或待人工复审的笔记（最高优先级）
        const pendingNote = await ImageReview.findOne({
          ...nicknameMatchCondition,
          status: { $in: ['pending', 'ai_approved', 'mentor_approved'] }
        }).sort({ createdAt: -1 });

        if (pendingNote) {
          const statusText = {
            'pending': '待审核',
            'ai_approved': '待人工复审',
            'mentor_approved': '主管审核中'
          }[pendingNote.status] || '审核中';

          return res.status(400).json({
            success: false,
            message: `该昵称有一篇笔记正在${statusText}中，请等待审核完成后再提交新笔记`,
            limitType: 'pending',
            currentStatus: pendingNote.status
          });
        }

        // 2. 然后检查1天内是否已通过笔记
        const approvedNote = await ImageReview.findOne({
          ...nicknameMatchCondition,
          status: { $in: ['manager_approved', 'completed'] }
        }).sort({ createdAt: -1 });

        if (approvedNote) {
          const hoursSinceApproved = Math.floor((Date.now() - approvedNote.createdAt.getTime()) / (1000 * 60 * 60));
          const remainingHours = 24 - hoursSinceApproved;

          return res.status(400).json({
            success: false,
            message: `该昵称在${hoursSinceApproved}小时前已通过笔记审核，还需等待${remainingHours}小时才能再次提交笔记`,
            limitType: 'approved',
            remainingHours: remainingHours,
            lastNoteDate: approvedNote.createdAt
          });
        }
      }
    } else if (imageType === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '评论类型必须填写链接' });
      }
      if (!noteAuthor || (Array.isArray(noteAuthor) && noteAuthor.length === 0) || (!Array.isArray(noteAuthor) && noteAuthor.trim() === '')) {
        return res.status(400).json({ success: false, message: '评论类型必须填写作者昵称' });
      }
      if (!commentContent || commentContent.trim() === '') {
        return res.status(400).json({ success: false, message: '评论类型必须填写评论内容' });
      }
    } else if (imageType === 'customer_resource') {
      // 客资类型：电话和微信至少填写一项
      const hasPhone = customerPhone && customerPhone.trim() !== '';
      const hasWechat = customerWechat && customerWechat.trim() !== '';

      if (!hasPhone && !hasWechat) {
        return res.status(400).json({ success: false, message: '客资类型必须填写客户电话或微信号' });
      }
    }

    // 如果提供了链接，验证格式
    if (noteUrl && noteUrl.trim() !== '') {
      const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)*/i;
      if (!xiaohongshuUrlPattern.test(noteUrl)) {
        return res.status(400).json({ success: false, message: '笔记链接格式不正确' });
      }
    }

    // 图片数量验证（如果提供了图片）
    if (imageUrls && imageUrls.length > 0 && imageUrls.length > 9) {
      return res.status(400).json({ success: false, message: '图片数量不能超过9张' });
    }

    // 验证设备是否属于当前用户
    let device = null;

    // 如果提供了deviceId，尝试查找真实设备
    if (deviceId) {
      // 首先尝试查找真实设备（如果是有效的ObjectId）
      try {
        if (deviceId.match(/^[0-9a-fA-F]{24}$/)) { // 检查是否是有效的ObjectId格式
          device = await Device.findOne({
            _id: deviceId,
            assignedUser: req.user._id,
            is_deleted: { $ne: true }
          });
        }
      } catch (error) {
        log.info('真实设备查找失败:', error.message);
      }

      // 如果找不到真实设备，且是开发环境，允许使用模拟设备
      // 【安全修复】增加开发者角色检查，防止滥用
      if (!device && process.env.NODE_ENV !== 'production' && deviceId.startsWith('device_')) {
        const developerRoles = ['boss', 'manager', 'hr', 'mentor'];
        if (!developerRoles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: '无权使用测试设备'
          });
        }

        // 根据设备ID生成对应的模拟设备信息，与小程序保持一致
        const deviceNumber = deviceId.split('_')[1] || '001';
        device = {
          _id: deviceId,
          accountName: `xiaohongshu_user_${deviceNumber}`,
          status: 'online',
          influence: ['new'],
          assignedUser: req.user._id
        };
        log.info('🧪 使用模拟设备进行测试:', device);
      }

      if (!device) {
        return res.status(400).json({ success: false, message: '无效的设备选择' });
      }
    } else {
      // 如果没有提供deviceId（批量提交使用昵称），创建一个虚拟设备对象
      device = {
        _id: 'virtual_device_' + Date.now(),
        accountName: 'virtual_device', // 将在后续通过昵称匹配真实设备
        status: 'online',
        influence: ['new'],
        assignedUser: req.user._id
      };
      log.info('📱 使用虚拟设备进行批量提交，实际设备将通过昵称匹配');
    }

    // 检查任务类型是否存在且激活
    const taskConfig = await TaskConfig.findOne({ type_key: imageType, is_active: true });
    if (!taskConfig) {
      return res.status(400).json({ success: false, message: '无效的任务类型' });
    }

    // 检查MD5重复（只有当提供了图片时才检查）
    // 只有人工复审通过的记录才算"已使用"
    if (imageMd5s && imageMd5s.length > 0) {
      const existingReviews = await ImageReview.find({
        imageMd5s: { $in: imageMd5s }, // 检查MD5数组中是否包含
        status: 'manager_approved' // 只有人工复审通过才算真正使用
      });

      if (existingReviews.length > 0) {
        // 收集所有重复的MD5值
        const duplicateMd5s = [];
        existingReviews.forEach(review => {
          // 检查每个review的imageMd5s数组中哪些MD5与上传的重复
          review.imageMd5s.forEach(existingMd5 => {
            if (imageMd5s.includes(existingMd5)) {
              duplicateMd5s.push(existingMd5);
            }
          });
        });

        return res.status(400).json({
          success: false,
          message: '部分图片已被使用，请勿重复提交',
          duplicates: [...new Set(duplicateMd5s)] // 去重
        });
      }
    }

    // 防作弊检查：检查是否已提交过相同评论（防止pending状态重复提交）
    if (imageType === 'comment' && noteUrl && commentContent) {
      // 只检查审核中或已通过的记录，不包含rejected（允许驳回后重新提交）
      const existingReview = await ImageReview.findOne({
        userId: req.user._id,
        noteUrl: noteUrl.trim(),
        'userNoteInfo.comment': commentContent.trim(),
        imageType: 'comment',
        status: { $in: ['pending', 'ai_approved', 'mentor_approved', 'manager_approved', 'completed'] } // 排除 rejected
      });

      if (existingReview) {
        log.info(`⚠️ [防作弊] 检测到重复提交相同评论，已有状态: ${existingReview.status}`);
        return res.status(400).json({
          success: false,
          message: '您已提交过该笔记的此评论，正在审核中',
          existingReviewId: existingReview._id,
          existingStatus: existingReview.status
        });
      }
    }

    // 防作弊检查：检查昵称在链接下的审核通过次数和内容重复限制（仅对评论类型）
    if (imageType === 'comment' && noteUrl && noteAuthor && commentContent) {
      log.info('🛡️ 开始防作弊检查：评论昵称审核通过次数和内容重复限制');

      // 处理昵称数组或字符串
      const nicknames = Array.isArray(noteAuthor) ? noteAuthor : [noteAuthor];
      const validNicknames = nicknames.filter(n => n && typeof n === 'string' && n.trim());
      const normalizedCommentContent = commentContent.trim();

      for (const nickname of validNicknames) {
        const approvalCheck = await CommentLimit.checkCommentApproval(
          noteUrl.trim(),
          nickname.trim(),
          normalizedCommentContent,
          { checkPending: true, ImageReviewModel: ImageReview } // 提交时检查包括待审核中的评论
        );

        if (!approvalCheck.canApprove) {
          return res.status(403).json({
            success: false,
            message: `违规提示：${approvalCheck.reason}`
          });
        }
      }

      log.info('✅ 评论防作弊检查通过');
    }

    // AI审核逻辑改为异步处理（仅对笔记和评论类型）
    // 上传时不验证链接，链接验证在后台异步AI审核中进行
    let aiReviewResult = null;
    if (imageType === 'note' || imageType === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记和评论类型必须提供小红书链接' });
      }

      // 上传时不进行链接验证，不设置aiReviewResult，由后台异步审核处理
      log.info('🔗 链接将在后台异步审核时验证');
      log.info('✅ 任务已提交，将进入后台AI审核队列');
    }

    // 获取用户的mentor信息
    const user = await User.findById(req.user._id);
    let mentorInfo = null;
    if (user && user.mentor_id) {
      mentorInfo = {
        reviewer: user.mentor_id // 只保存ObjectId，populate会在查询时填充
      };
    }

    // 批量创建审核记录（使用新的多图格式）
    const reviews = await Promise.all((imageUrls && imageUrls.length > 0 ? imageUrls : [null]).map(async (url, index) => {
      const reviewData = {
        userId: req.user._id,
        imageUrls: url ? [url] : [], // 多图格式：单图也存储为数组，没有图片时为空数组
        imageType: imageType,
        imageMd5s: (imageMd5s && imageMd5s[index]) ? [imageMd5s[index]] : [], // 多图MD5格式：单MD5也存储为数组
        noteUrl: noteUrl && noteUrl.trim() ? noteUrl.trim() : null,
        // 用户提供的笔记信息
        userNoteInfo: {
          author: noteAuthor ? (Array.isArray(noteAuthor) ? noteAuthor.join(', ') : (typeof noteAuthor === 'string' && noteAuthor.trim() ? noteAuthor.trim() : null)) : null,
          title: noteTitle && noteTitle.trim() ? noteTitle.trim() : null,
          comment: commentContent && commentContent.trim() ? commentContent.trim() : null,
          customerPhone: customerPhone && customerPhone.trim() ? customerPhone.trim() : null,
          customerWechat: customerWechat && customerWechat.trim() ? customerWechat.trim() : null
        },
        snapshotPrice: taskConfig.price,
        snapshotCommission1: taskConfig.commission_1,
        snapshotCommission2: taskConfig.commission_2,
        deviceInfo: {
          accountName: device.accountName,
          status: device.status,
          influence: device.influence
        },
        mentorReview: mentorInfo, // 添加mentor信息
        auditHistory: [{
          operator: req.user._id,
          operatorName: req.user.username,
          action: 'submit',
          comment: '用户批量提交任务'
        }]
      };

      // 如果有AI审核结果，保存相关信息
      if (aiReviewResult && aiReviewResult.aiReview) {
        reviewData.aiReviewResult = aiReviewResult.aiReview;
        if (aiReviewResult.contentMatch) {
          reviewData.aiParsedNoteInfo = {
            author: aiReviewResult.contentMatch.pageAuthor,
            title: aiReviewResult.contentMatch.pageTitle
          };
        }
        // 保存评论验证结果
        if (aiReviewResult.commentVerification) {
          reviewData.aiReviewResult.commentVerification = aiReviewResult.commentVerification;

          // 对于评论类型，尝试多种方式获取昵称信息
          if (imageType === 'comment') {
            let authorToSet = null;

            // 1. 优先从评论验证结果的foundComments获取
            if (aiReviewResult.commentVerification?.foundComments?.length > 0) {
              authorToSet = aiReviewResult.commentVerification.foundComments[0].author;
              log.info(`📝 从foundComments获取昵称: ${authorToSet}`);
            }

            // 2. 如果foundComments为空，尝试从pageComments中找到匹配的评论
            if (!authorToSet && aiReviewResult.commentVerification?.pageComments?.length > 0 && commentContent) {
              const matchedComment = aiReviewResult.commentVerification.pageComments.find(c =>
                c.content && c.content.trim() === commentContent.trim()
              );
              if (matchedComment?.author) {
                authorToSet = matchedComment.author;
                log.info(`📝 从pageComments匹配获取昵称: ${authorToSet}`);
              }
            }

            // 3. 如果评论验证完全失败，不使用用户提交的昵称，只用匹配到的昵称
            if (!authorToSet) {
              log.info(`📝 评论验证失败，无法获取匹配的昵称`);
            }

            // 设置昵称信息
            if (authorToSet) {
              reviewData.aiParsedNoteInfo = reviewData.aiParsedNoteInfo || {};
              reviewData.aiParsedNoteInfo.author = authorToSet;
              log.info(`✅ 评论昵称设置成功: ${authorToSet}`);
            } else {
              log.info(`❌ 无法获取评论昵称信息`);
            }
          }
        }
      }

      // AI审核改为异步处理，所有任务初始状态为 'pending'

      const review = await new ImageReview(reviewData).save();

      // 评论类型的计数和内容记录将在审核通过后进行（通过CommentLimit.recordCommentApproval）

      // 如果是笔记或评论类型，将任务加入异步AI审核队列
      if ((imageType === 'note' || imageType === 'comment') && review.status === 'pending') {
        try {
          asyncAiReviewService.addToQueue(review._id);
          log.info(`📋 任务 ${review._id} 已加入AI审核队列`);
        } catch (queueError) {
          log.error('加入AI审核队列失败:', queueError);
          // 不影响主流程，继续执行
        }
      }

      return review;
    }));

    res.json({
      success: true,
      message: `成功提交${reviews.length}个任务`,
      reviews: reviews.map(r => ({
        id: r._id,
        imageType: r.imageType,
        status: r.status
      }))
    });

  } catch (error) {
    log.error('批量提交失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

/**
 * 检查昵称的笔记限制（1天内是否已通过笔记，或有审核中/待人工复审的笔记）
 * GET /xiaohongshu/api/client/check-note-limit
 */
router.get('/check-note-limit', authenticateToken, async (req, res) => {
  try {
    const { nickname } = req.query;

    if (!nickname || nickname.trim() === '') {
      return res.json({
        success: true,
        canSubmit: true,
        message: '昵称为空，允许提交'
      });
    }

    const trimmedNickname = nickname.trim();

    // 计算1天前的日期（使用北京时间）
    const TimeUtils = require('../utils/timeUtils');
    const oneDayAgo = new Date(TimeUtils.getBeijingTime());
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // 构建昵称匹配条件（支持新旧格式）
    const nicknameMatchCondition = {
      imageType: 'note',
      $or: [
        // 新格式：单个昵称完全匹配
        { 'userNoteInfo.author': trimmedNickname },
        // 旧格式：多昵称字符串中包含该昵称
        { 'userNoteInfo.author': { $regex: trimmedNickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }
      ],
      createdAt: { $gte: oneDayAgo }
    };

    // 1. 首先检查是否有审核中或待人工复审的笔记（最高优先级）
    const pendingNote = await ImageReview.findOne({
      ...nicknameMatchCondition,
      status: { $in: ['pending', 'ai_approved', 'mentor_approved'] } // 待审核、AI通过待人工复审、主管审核中
    }).sort({ createdAt: -1 });

    if (pendingNote) {
      const statusText = {
        'pending': '待审核',
        'ai_approved': '待人工复审',
        'mentor_approved': '主管审核中'
      }[pendingNote.status] || '审核中';

      return res.json({
        success: true,
        canSubmit: false,
        hasLimit: true,
        limitType: 'pending', // 标识为审核中限制
        message: `该昵称有一篇笔记正在${statusText}中，请等待审核完成后再提交新笔记`,
        currentStatus: pendingNote.status
      });
    }

    // 2. 然后检查1天内是否已通过笔记（原有逻辑）
    const approvedNote = await ImageReview.findOne({
      ...nicknameMatchCondition,
      status: { $in: ['manager_approved', 'completed'] } // 审核通过或已完成
    }).sort({ createdAt: -1 });

    if (approvedNote) {
      // 计算剩余小时数
      const hoursSinceApproved = Math.floor((Date.now() - approvedNote.createdAt.getTime()) / (1000 * 60 * 60));
      const remainingHours = 24 - hoursSinceApproved;

      return res.json({
        success: true,
        canSubmit: false,
        hasLimit: true,
        limitType: 'approved', // 标识为已通过限制
        message: `该昵称在${hoursSinceApproved}小时前已通过笔记审核，还需等待${remainingHours}小时才能再次提交笔记`,
        remainingHours: remainingHours,
        lastApprovedDate: approvedNote.createdAt
      });
    }

    res.json({
      success: true,
      canSubmit: true,
      hasLimit: false,
      message: '可以提交笔记'
    });

  } catch (error) {
    log.error('检查笔记限制失败:', error);
    // 出错时默认允许提交，避免影响正常功能
    res.json({
      success: true,
      canSubmit: true,
      message: '检查限制时出错，允许提交'
    });
  }
});

module.exports = router;
