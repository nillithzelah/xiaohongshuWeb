const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const CommentLimit = require('../models/CommentLimit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const DiscoveredNote = require('../models/DiscoveredNote');
const ClientHeartbeat = require('../models/ClientHeartbeat');
const { authenticateToken } = require('../middleware/auth');
const xiaohongshuService = require('../services/xiaohongshuService');
const deviceNoteService = require('../services/deviceNoteService');
const asyncAiReviewService = require('../services/asyncAiReviewService');
const aiContentAnalysisService = require('../services/aiContentAnalysisService');
const submitDeduplicationService = require('../services/submitDeduplicationService');
const TimeUtils = require('../utils/timeUtils');
const router = express.Router();

// 使用 AI 分析服务实例（已经是单例，不需要 new）
const aiAnalysis = aiContentAnalysisService;

// 验证 ObjectId 格式
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

console.log('📋 client路由已加载');

// 字符串相似度比对函数
function compareStrings(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // 完全匹配
  if (s1 === s2) return 100;

  // 包含关系
  if (s1.includes(s2) || s2.includes(s1)) return 90;

  // 计算编辑距离相似度
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  const editDistance = levenshteinDistance(longer, shorter);
  return Math.round((longer.length - editDistance) / longer.length * 100);
}

// 计算编辑距离
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替换
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 删除
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// 获取审核员在线状态（基于客户端心跳）
router.get('/auditor-status', async (req, res) => {
  try {
    const ImageReview = require('../models/ImageReview');

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

    // 总审核员数 = 当前在线客户端数（每个在线客户端就是一个审核员）
    const totalAuditors = onlineAuditors;

    res.json({
      success: true,
      data: {
        totalAuditors,
        onlineAuditors
      }
    });
  } catch (error) {
    console.error('获取审核员状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取审核员状态失败'
    });
  }
});

// 获取任务配置（显示给用户）
router.get('/task-configs', async (req, res) => {
  try {
    const configs = await TaskConfig.find({ is_active: true })
      .select('type_key name price commission_1 commission_2 daily_reward_points continuous_check_days')
      .sort({ type_key: 1 });

    // 确保所有字段都被正确返回
    const processedConfigs = configs.map(config => {
      const configObj = config.toObject(); // 转换为普通对象确保所有字段都被访问
      return {
        _id: configObj._id,
        type_key: configObj.type_key,
        name: configObj.name,
        price: configObj.price,
        commission_1: configObj.commission_1,
        commission_2: configObj.commission_2,
        daily_reward_points: configObj.daily_reward_points,
        continuous_check_days: configObj.continuous_check_days
      };
    });

    res.json({
      success: true,
      configs: processedConfigs
    });
  } catch (error) {
    console.error('获取任务配置错误:', error);
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

    // 查找用户
    const user = await User.findOne({ nickname: nickname });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 获取用户的评论类型待审核任务
    const tasks = await ImageReview.find({
      userId: user._id,
      imageType: 'comment',
      status: { $in: ['pending', 'ai_approved', 'rejected'] } // 包含待审核和已处理的
    })
    .select('_id noteUrl status userNoteInfo aiReviewResult createdAt')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    console.log(`📋 [测试API] 获取用户 ${nickname} 的 ${tasks.length} 个任务`);

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
    console.error('获取用户任务失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户任务失败'
    });
  }
});

// 上传图片并计算MD5（使用真实OSS上传）
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    // 这里应该处理文件上传，暂时模拟
    // 实际实现需要multer处理文件
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, message: '没有图片数据' });
    }

    // 计算MD5（使用Base64数据）
    const md5 = crypto.createHash('md5').update(imageData).digest('hex');

    // 检查是否有OSS配置
    const hasKeys = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET;

    console.log('🔑 OSS环境变量检查:', {
      OSS_ACCESS_KEY_ID: process.env.OSS_ACCESS_KEY_ID ? '***REDACTED***' : 'MISSING',
      OSS_ACCESS_KEY_SECRET: process.env.OSS_ACCESS_KEY_SECRET ? '***REDACTED***' : 'MISSING',
      OSS_BUCKET: process.env.OSS_BUCKET,
      OSS_REGION: process.env.OSS_REGION
    });

    if (!hasKeys) {
      console.log('❌ [Error] 未检测到 OSS Key，无法上传');
      return res.status(500).json({
        success: false,
        message: 'OSS配置缺失，无法上传图片'
      });
    }

    // 初始化OSS客户端
    const OSS = require('ali-oss');
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true
    });

    // 上传到OSS
    const filename = `uploads/${Date.now()}-${md5}.jpg`;
    console.log('📤 正在上传到OSS，文件名:', filename);
    console.log('🔑 OSS配置:', {
      region: process.env.OSS_REGION,
      bucket: process.env.OSS_BUCKET,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID ? '***REDACTED***' : 'MISSING',
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET ? '***REDACTED***' : 'MISSING'
    });
    console.log('📦 数据长度:', imageData.length);

    try {
      // 直接构建真实的OSS URL，使用正确的环境变量名
      const finalUrl = `https://${process.env.OSS_BUCKET}.oss-${process.env.OSS_REGION}.aliyuncs.com/${filename}`;
      console.log('🔗 构建的OSS URL:', finalUrl);
      console.log('📋 使用的环境变量:', {
        OSS_BUCKET: process.env.OSS_BUCKET,
        OSS_REGION: process.env.OSS_REGION
      });

      const result = await client.put(filename, Buffer.from(imageData, 'base64'));
      console.log('✅ OSS上传成功，返回结果:', JSON.stringify(result, null, 2));

      // 确保返回 HTTPS URL（强行替换）
      const httpsUrl = result.url.replace('http://', 'https://');

      // 返回真实的OSS URL
      res.json({
        success: true,
        imageUrl: httpsUrl,
        md5
      });
    } catch (ossError) {
      console.error('❌ OSS上传失败:', ossError);
      res.status(500).json({
        success: false,
        message: 'OSS上传失败',
        error: ossError.message
      });
    }

  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// 提交任务
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

    // 验证设备是否属于当前用户
    let device = null;

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
      console.log('真实设备查找失败:', error.message);
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
      console.log('🧪 使用模拟设备进行测试:', device);
    }

    if (!device) {
      return res.status(400).json({ success: false, message: '无效的设备选择' });
    }

    // 检查任务类型是否存在且激活
    const taskConfig = await TaskConfig.findOne({ type_key: taskType, is_active: true });
    if (!taskConfig) {
      return res.status(400).json({ success: false, message: '无效的任务类型' });
    }

    // MD5去重检查：只有人工复审通过的记录才算"已使用"
    const existingReview = await ImageReview.findOne({
      imageMd5s: imageMd5, // 检查MD5数组中是否包含
      status: 'manager_approved' // 只有人工复审通过才算真正使用
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: '该图片已被使用，请勿重复提交'
      });
    }

    // 创建审核记录，使用快照价格和两级佣金（兼容新多图格式）
    const review = new ImageReview({
      userId: req.user._id,
      imageUrls: [imageUrl], // 兼容：单图也存储为数组
      imageType: taskType,
      imageMd5s: [imageMd5], // 兼容：单MD5也存储为数组
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
    console.error('提交任务错误:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// 获取用户任务记录 (允许所有登录用户访问)
router.get('/user/tasks', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, imageType } = req.query;

    // 构建查询条件
    const query = { userId: req.user._id };
    if (imageType) {
      query.imageType = imageType;
    }

    const reviews = await ImageReview.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ImageReview.countDocuments(query);

    // 格式化时间为北京时间，并添加持续检查奖励记录
    const formattedReviews = [];

    for (const review of reviews) {
      const reviewObj = review.toObject();
      reviewObj.createdAt = TimeUtils.formatBeijingTime(review.createdAt);
      formattedReviews.push(reviewObj);

      // 如果有持续检查成功记录，添加到任务列表中
      if (review.continuousCheck &&
          review.continuousCheck.enabled &&
          review.continuousCheck.checkHistory &&
          review.continuousCheck.checkHistory.length > 0) {

        // 只显示有奖励积分的持续检查记录
        const rewardedChecks = review.continuousCheck.checkHistory.filter(
          check => check.result === 'success' && check.rewardPoints > 0
        );

        for (const check of rewardedChecks) {
          // 创建一个虚拟任务记录，用于显示持续检查奖励
          const checkTime = TimeUtils.formatBeijingTime(check.checkTime);
          formattedReviews.push({
            _id: review._id + '_check_' + checkTime,
            isContinuousCheckReward: true, // 标记为持续检查奖励
            originalReviewId: review._id, // 原始审核记录ID
            imageType: 'continuous_check', // 特殊类型
            status: 'completed', // 已完成
            createdAt: checkTime, // 使用检查时间
            noteUrl: review.noteUrl,
            continuousCheckInfo: {
              checkTime: checkTime,
              rewardPoints: check.rewardPoints,
              checkIndex: review.continuousCheck.checkHistory.indexOf(check) + 1
            },
            // 用于前端显示
            deviceInfo: review.deviceInfo,
            aiParsedNoteInfo: review.aiParsedNoteInfo
          });
        }
      }
    }

    // 按时间倒序排序（最新的在前）
    formattedReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 分页处理（只返回当前页的数据）
    const startIndex = 0;
    const endIndex = limit;
    const paginatedReviews = formattedReviews.slice(startIndex, endIndex);

    res.json({
      success: true,
      reviews: paginatedReviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: formattedReviews.length, // 包含持续检查记录的总数
        pages: Math.ceil(formattedReviews.length / limit)
      }
    });
  } catch (error) {
    console.error('获取用户任务错误:', error);
    res.status(500).json({ success: false, message: '获取任务记录失败' });
  }
});


// 获取用户被分配的设备列表
router.get('/device/my-list', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({
      assignedUser: req.user._id,
      is_deleted: { $ne: true },
      reviewStatus: { $in: ['ai_approved', 'approved'] } // 只返回审核通过的设备
    })
    .select('accountName status influence onlineDuration points reviewStatus reviewReason reviewedAt')
    .sort({ createdAt: -1 });

    // 为每个设备添加昵称限制状态检查
    const devicesWithNicknameStatus = await Promise.all(devices.map(async (device) => {
      const deviceObj = device.toObject();

      // 检查该设备的昵称是否在1天内被使用过（从人工复审通过时间开始计算）
      const nowBeijing = TimeUtils.getBeijingTime();
      const oneDayAgo = new Date(nowBeijing);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      // 将北京时间转换为UTC用于数据库查询
      const oneDayAgoUTC = TimeUtils.beijingToUTC(oneDayAgo);

      // 查找最近1天内人工复审通过使用该昵称的记录
      const recentReview = await ImageReview.findOne({
        'aiParsedNoteInfo.author': device.accountName,
        userId: req.user._id,
        status: { $in: ['manager_approved', 'completed'] },
        $or: [
          { 'managerApproval.approvedAt': { $gte: oneDayAgoUTC } }, // 人工复审通过时间
          { 'financeProcess.processedAt': { $gte: oneDayAgoUTC } } // 财务处理时间（兼容老数据）
        ]
      });

      if (recentReview) {
        // 计算还有多少小时不能使用（从人工复审通过时间开始计算）
        const lastUsedTime = recentReview.managerApproval?.approvedAt || recentReview.financeProcess?.processedAt || recentReview.createdAt;
        const lastUsedBeijing = new Date(lastUsedTime.getTime() + (8 * 60 * 60 * 1000));
        const hoursSinceLastUse = Math.floor((nowBeijing.getTime() - lastUsedBeijing.getTime()) / (1000 * 60 * 60));
        const remainingHours = 24 - hoursSinceLastUse;

        deviceObj.nicknameLimitStatus = {
          canUse: false,
          reason: '昵称限制中',
          remainingHours: Math.max(0, remainingHours),
          lastUsed: lastUsedTime
        };
      } else {
        deviceObj.nicknameLimitStatus = {
          canUse: true,
          reason: '可正常使用'
        };
      }

      return deviceObj;
    }));

    res.json({
      success: true,
      devices: devicesWithNicknameStatus
    });
  } catch (error) {
    console.error('获取用户设备列表错误:', error);
    res.status(500).json({ success: false, message: '获取设备列表失败' });
  }
});

// 获取系统公告（从数据库）
router.get('/announcements', async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');

    // 获取所有启用的公告，按置顶和排序
    const announcements = await Announcement.find({ enabled: true })
      .sort({ isPinned: -1, order: 1, createdAt: -1 })
      .select('title content type actionType actionData textColor fontSize');

    // 返回公告列表
    const summaries = announcements.map(a => ({
      id: a._id,
      title: a.title,
      content: a.content,
      type: a.type,
      actionType: a.actionType,
      actionData: a.actionData,
      textColor: a.textColor,
      fontSize: a.fontSize
    }));

    res.json({
      success: true,
      announcements: summaries
    });
  } catch (error) {
    console.error('获取公告错误:', error);
    // 降级处理：返回空数组而不是错误，避免小程序崩溃
    res.json({
      success: true,
      announcements: []
    });
  }
});

// 获取单条公告详情（富文本内容）
router.get('/announcement/:id', async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');
    const announcement = await Announcement.findById(req.params.id);

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
    console.error('获取公告详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取公告详情失败'
    });
  }
});

// 批量提交多图任务
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
      console.log(`⚠️ [防重复提交] 拦截重复提交: 用户=${req.user._id}, 类型=${imageType}`);
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
      // 评论类型图片为可选项
      // if (!imageUrls || imageUrls.length === 0) {
      //   return res.status(400).json({ success: false, message: '评论类型必须上传评论截图作为证据' });
      // }
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
        console.log('真实设备查找失败:', error.message);
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
        console.log('🧪 使用模拟设备进行测试:', device);
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
      console.log('📱 使用虚拟设备进行批量提交，实际设备将通过昵称匹配');
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
        console.log(`⚠️ [防作弊] 检测到重复提交相同评论，已有状态: ${existingReview.status}`);
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
      console.log('🛡️ 开始防作弊检查：评论昵称审核通过次数和内容重复限制');

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

      console.log('✅ 评论防作弊检查通过');
    }

    // AI审核逻辑改为异步处理（仅对笔记和评论类型）
    // 上传时不验证链接，链接验证在后台异步AI审核中进行
    let aiReviewResult = null;
    if (imageType === 'note' || imageType === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记和评论类型必须提供小红书链接' });
      }

      // 上传时不进行链接验证，不设置aiReviewResult，由后台异步审核处理
      console.log('🔗 链接将在后台异步审核时验证');
      console.log('✅ 任务已提交，将进入后台AI审核队列');
    }

    // 获取用户的mentor信息
    const user = await require('../models/User').findById(req.user._id);
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
              console.log(`📝 从foundComments获取昵称: ${authorToSet}`);
            }

            // 2. 如果foundComments为空，尝试从pageComments中找到匹配的评论
            if (!authorToSet && aiReviewResult.commentVerification?.pageComments?.length > 0 && commentContent) {
              const matchedComment = aiReviewResult.commentVerification.pageComments.find(c =>
                c.content && c.content.trim() === commentContent.trim()
              );
              if (matchedComment?.author) {
                authorToSet = matchedComment.author;
                console.log(`📝 从pageComments匹配获取昵称: ${authorToSet}`);
              }
            }

            // 3. 如果评论验证完全失败，不使用用户提交的昵称，只用匹配到的昵称
            if (!authorToSet) {
              console.log(`📝 评论验证失败，无法获取匹配的昵称`);
            }

            // 设置昵称信息
            if (authorToSet) {
              reviewData.aiParsedNoteInfo = reviewData.aiParsedNoteInfo || {};
              reviewData.aiParsedNoteInfo.author = authorToSet;
              console.log(`✅ 评论昵称设置成功: ${authorToSet}`);
            } else {
              console.log(`❌ 无法获取评论昵称信息`);
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
          console.log(`📋 任务 ${review._id} 已加入AI审核队列`);
        } catch (queueError) {
          console.error('加入AI审核队列失败:', queueError);
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
    console.error('批量提交失败:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// 获取用户设备审核状态
router.get('/devices/my-review-status', authenticateToken, async (req, res) => {
  try {
    // 获取用户最新提交的设备审核记录
    const latestDevice = await Device.findOne({
      assignedUser: req.user._id,
      reviewStatus: { $in: ['pending', 'ai_approved', 'rejected'] }
    })
    .select('accountName reviewStatus reviewReason createdAt reviewedAt')
    .sort({ createdAt: -1 }); // 获取最新的审核记录

    if (!latestDevice) {
      return res.json({
        success: true,
        reviewStatus: null,
        message: '暂无设备审核记录'
      });
    }

    // 格式化时间为北京时间
    const TimeUtils = require('../utils/timeUtils');
    const formattedDevice = {
      ...latestDevice.toObject(),
      accountName: latestDevice.accountName || '未知设备', // 确保accountName不为空
      createdAt: TimeUtils.formatBeijingTime(latestDevice.createdAt),
      reviewedAt: latestDevice.reviewedAt ? TimeUtils.formatBeijingTime(latestDevice.reviewedAt) : null
    };

    res.json({
      success: true,
      reviewStatus: formattedDevice
    });

  } catch (error) {
    console.error('获取用户设备审核状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备审核状态失败'
    });
  }
});

// 检查昵称的笔记限制（1天内是否已通过笔记，或有审核中/待人工复审的笔记）
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
    console.error('检查笔记限制失败:', error);
    // 出错时默认允许提交，避免影响正常功能
    res.json({
      success: true,
      canSubmit: true,
      message: '检查限制时出错，允许提交'
    });
  }
});

// ============================================================
// 本地审核客户端专用 API 接口
// ============================================================

/**
 * 获取待审核任务列表
 * GET /xiaohongshu/api/client/pending-tasks
 *
 * 供本地客户端拉取待审核的评论任务
 */
router.get('/pending-tasks', async (req, res) => {
  try {
    const { limit = 10, imageType, clientId, includeClientVerification } = req.query;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: '缺少clientId参数'
      });
    }

    const now = new Date();
    const lockTimeoutMinutes = 10; // 锁定超时时间（分钟）- 缩短到10分钟

    // 1. 先清理超时的锁定（将超时且未完成的任务重置为pending或client_verification_pending）
    const timeoutReleaseResult = await ImageReview.updateMany(
      {
        status: { $in: ['processing', 'client_verification_pending'] },
        'processingLock.lockedUntil': { $lt: now }
      },
      {
        $set: {
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      }
    );

    if (timeoutReleaseResult.modifiedCount > 0) {
      console.log(`🔄 [本地客户端] 释放超时锁定: ${timeoutReleaseResult.modifiedCount} 个任务`);
    }

    // 2. 确定要查询的状态
    // 修改：客户端只拉取 client_verification_pending 状态的任务
    // pending 状态的任务由服务器先进行AI审核，完成后标记为 client_verification_pending
    const statusesToQuery = ['client_verification_pending'];

    // 3. 查询待审核任务（排除被其他客户端锁定的任务）
    const lockedUntil = new Date(now.getTime() + lockTimeoutMinutes * 60 * 1000);

    // 使用 findOneAndUpdate 实现原子性锁定
    const tasks = [];
    const maxTasks = parseInt(limit);
    let attempts = 0;
    const maxAttempts = maxTasks * 2; // 最多尝试次数

    while (tasks.length < maxTasks && attempts < maxAttempts) {
      attempts++;

      // 查找一个未被锁定或锁定已超时的pending任务
      const task = await ImageReview.findOneAndUpdate(
        {
          status: { $in: statusesToQuery },
          imageType: imageType || 'comment',
          $or: [
            { 'processingLock.lockedUntil': { $exists: false } },
            { 'processingLock.lockedUntil': null },
            { 'processingLock.lockedUntil': { $lt: now } }
          ]
        },
        {
          $set: {
            'processingLock.clientId': clientId,
            'processingLock.lockedAt': now,
            'processingLock.heartbeatAt': now,
            'processingLock.lockedUntil': lockedUntil
          }
        },
        { sort: { createdAt: 1 }, new: true } // 返回更新后的文档
      );

      if (task) {
        tasks.push(task);
      } else {
        break; // 没有更多任务了
      }
    }

    console.log(`📥 [本地客户端] 客户端 ${clientId} 拉取任务: ${tasks.length} 个 (状态: ${statusesToQuery.join(', ')})`);

    res.json({
      success: true,
      data: {
        tasks: tasks.map(task => ({
          _id: task._id,
          id: task._id.toString(),
          userId: task.userId,
          imageType: task.imageType,
          status: task.status,
          noteUrl: task.noteUrl,
          userNoteInfo: task.userNoteInfo,
          aiReviewResult: task.aiReviewResult,
          clientVerification: task.clientVerification, // 添加客户端验证信息
          reviewAttempt: task.reviewAttempt,
          createdAt: task.createdAt
        })),
        count: tasks.length,
        clientId: clientId,
        lockTimeoutMinutes: lockTimeoutMinutes,
        heartbeatIntervalMinutes: 5, // 建议心跳间隔
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端] 拉取任务失败:', error);
    res.status(500).json({
      success: false,
      message: '拉取任务失败',
      error: error.message
    });
  }
});

/**
 * 获取单个任务详情
 * GET /xiaohongshu/api/client/task/:id
 */
router.get('/task/:id', async (req, res) => {
  try {
    const task = await ImageReview.findById(req.params.id)
      .select('_id userId imageType imageUrls imageMd5s status aiReviewResult userNoteInfo noteUrl createdAt');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      data: {
        _id: task._id,
        id: task._id.toString(),
        userId: task.userId,
        imageType: task.imageType,
        status: task.status,
        noteUrl: task.noteUrl,
        userNoteInfo: task.userNoteInfo,
        aiReviewResult: task.aiReviewResult,
        createdAt: task.createdAt
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端] 获取任务详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务详情失败',
      error: error.message
    });
  }
});

/**
 * 心跳接口 - 延长任务锁定时间 + 更新客户端在线状态
 * POST /xiaohongshu/api/client/heartbeat
 * Body: { clientId, status, taskIds }
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { clientId, status, taskIds, clientType } = req.body;
    // 也从请求头读取客户端类型（备用）
    const headerClientType = req.headers['x-client-type'];

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: '缺少客户端ID'
      });
    }

    const now = new Date();

    // 1. 更新客户端心跳记录（用于在线状态显示）
    const heartbeatData = {
      clientId,
      status: status || 'online',
      lastHeartbeat: now
    };

    // 添加客户端类型（优先使用 body，其次使用 header）
    if (clientType || headerClientType) {
      heartbeatData.clientType = clientType || headerClientType;
    }

    // 如果有任务ID，更新任务列表
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      heartbeatData.taskIds = taskIds;
    }

    await ClientHeartbeat.findOneAndUpdate(
      { clientId },
      heartbeatData,
      { upsert: true, new: true }
    );

    // 2. 如果有任务，更新任务锁定时间
    let updatedCount = 0;
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      const lockTimeoutMinutes = 30;
      const lockedUntil = new Date(now.getTime() + lockTimeoutMinutes * 60 * 1000);

      const result = await ImageReview.updateMany(
        {
          _id: { $in: taskIds },
          'processingLock.clientId': clientId // 只更新自己锁定的任务
        },
        {
          $set: {
            'processingLock.heartbeatAt': now,
            'processingLock.lockedUntil': lockedUntil
          }
        }
      );
      updatedCount = result.modifiedCount;
    }

    res.json({
      success: true,
      data: {
        updated: updatedCount,
        clientId: clientId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端] 心跳失败:', error);
    res.status(500).json({
      success: false,
      message: '心跳失败',
      error: error.message
    });
  }
});

/**
 * 上报验证结果
 * POST /xiaohongshu/api/client/verify-result
 *
 * 本地客户端完成评论验证后上报结果
 *
 * 多设备安全设计：
 * 1. 使用 findOneAndUpdate 原子操作，只有 status='processing' 时才更新
 * 2. 只有状态实际被更新的客户端才发放积分，防止重复发放
 * 3. 使用 processingLock.clientId 验证权限
 */
router.post('/verify-result', async (req, res) => {
  try {
    const { taskId, exists, confidence, foundComments, pageComments, commentCount, verifiedAt, targetComment, targetAuthor, verificationMethod, clientId, screenshotUrl, result: verifyResultType, reason } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少任务ID'
      });
    }

    // 验证 taskId 格式
    if (!isValidObjectId(taskId)) {
      return res.status(400).json({
        success: false,
        message: '任务ID格式不正确'
      });
    }

    // 先查询任务，检查是否使用新的客户端验证流程
    const existingTask = await ImageReview.findById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    // 处理客户端内容审核失败的情况
    if (verifyResultType === 'content_audit_failed') {
      console.log(`❌ [客户端验证] 内容审核失败: ${taskId}, 原因: ${reason}`);

      // 使用 handleClientVerificationResult 处理（等待第二次验证）
      const asyncAiReviewService = require('../services/asyncAiReviewService');
      const result = await asyncAiReviewService.handleClientVerificationResult(taskId, {
        success: false,
        verified: false,
        comment: reason || '客户端内容审核失败',
        reason: reason,
        contentAudit: req.body.contentAudit
      });

      // 清除处理锁定
      await ImageReview.findByIdAndUpdate(taskId, {
        $set: {
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      });

      return res.json(result);
    }

    // 处理评论验证失败的情况（包含内容审核信息）
    if (!exists && reason && reason.includes('关键词检查:')) {
      console.log(`❌ [客户端验证] 评论验证失败（含内容审核）: ${taskId}, 原因: ${reason}`);

      await ImageReview.findByIdAndUpdate(taskId, {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: new Date(),
        // 清除处理锁定
        'processingLock.clientId': null,
        'processingLock.lockedAt': null,
        'processingLock.heartbeatAt': null,
        'processingLock.lockedUntil': null
      });

      return res.json({
        success: true,
        message: '任务已驳回',
        rejectionReason: reason
      });
    }

    // 如果任务有 clientVerification 字段，使用新的验证流程
    if (existingTask.clientVerification) {
      const asyncAiReviewService = require('../services/asyncAiReviewService');
      const result = await asyncAiReviewService.handleClientVerificationResult(taskId, {
        success: exists !== false,
        verified: exists,
        comment: reason || (exists ? '客户端验证：评论已找到' : '客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）'),
        screenshotUrl: screenshotUrl,
        contentAudit: req.body.contentAudit  // 传递内容审核结果
      });

      // 清除处理锁定
      await ImageReview.findByIdAndUpdate(taskId, {
        $set: {
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      });

      return res.json(result);
    }

    // 以下是旧的验证流程（保持向后兼容）
    // 根据验证结果设置状态
    const finalStatus = exists ? 'completed' : 'rejected';
    const now = new Date();

    // 驳回原因（用于小程序显示）
    // 如果客户端提供了完整的 reason（包含关键词检查信息），使用它；否则使用默认原因
    const rejectionReason = exists ? null :
      (reason && reason.includes('关键词检查:') ? reason : '当前帖子评论区无法检测到你的评论（请用其他号观察）');

    // 构建验证结果对象
    const commentVerification = {
      verified: true,
      exists: exists,
      confidence: confidence || 0,
      verifiedAt: verifiedAt || now.toISOString(),
      verificationMethod: verificationMethod || 'local-client-visual',
      targetComment: targetComment,
      targetAuthor: targetAuthor,
      foundComments: foundComments || [],
      pageComments: pageComments || [],
      commentCount: commentCount || (pageComments ? pageComments.length : 0),
      result: exists ? 'passed' : 'comment_not_found'
    };

    // ==================== 原子更新状态 + 清除锁定 ====================
    // 使用 findOneAndUpdate 确保只有 status='processing' 时才能更新
    // 同时检查 processingLock.clientId 是否匹配（如果有）
    const updateQuery = {
      _id: taskId,
      status: 'processing'  // 只有 processing 状态才能更新
    };

    // 如果提供了 clientId，还要验证是否匹配
    if (clientId) {
      updateQuery['processingLock.clientId'] = clientId;
    }

    const updatedTask = await ImageReview.findOneAndUpdate(
      updateQuery,
      {
        $set: {
          status: finalStatus,
          'aiReviewResult.commentVerification': commentVerification,
          'aiReviewResult.passed': exists,
          'aiReviewResult.reasons': exists
            ? ['本地客户端验证：评论已找到']
            : ['本地客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）'],
          rejectionReason: rejectionReason,  // 设置驳回原因
          updatedAt: now,
          // 清除处理锁定
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      },
      { new: true }  // 返回更新后的文档
    );

    // 如果更新失败（任务不存在或状态不是 processing）
    if (!updatedTask) {
      const existingTask = await ImageReview.findById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: '任务不存在'
        });
      }

      // 任务状态已经不是 processing，可能已被其他客户端处理
      return res.status(409).json({
        success: false,
        message: `任务已被处理，当前状态: ${existingTask.status}`,
        currentStatus: existingTask.status,
        alreadyProcessed: true
      });
    }

    console.log(`✅ [本地客户端] 任务 ${taskId} 状态更新: processing → ${finalStatus}`);

    // ==================== 记录审核历史 ====================
    // 记录审核结果到 auditHistory（用于管理后台显示）
    const auditAction = finalStatus === 'completed' ? 'local_client_passed' : 'local_client_rejected';
    const auditComment = finalStatus === 'completed'
      ? '本地客户端验证：评论已找到'
      : '本地客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）';

    await ImageReview.updateOne(
      { _id: taskId },
      {
        $push: {
          auditHistory: {
            operator: null,
            operatorName: `本地客户端 (${clientId || 'unknown'})`,
            action: auditAction,
            comment: auditComment,
            timestamp: now
          }
        }
      }
    );

    // ==================== 记录评论限制（重要：防止重复提交） ====================
    // 当评论审核通过时，记录到CommentLimit数据库
    if (updatedTask.imageType === 'comment' && exists && updatedTask.status === 'completed') {
      // 获取作者昵称（优先使用aiParsedNoteInfo.author，其次使用userNoteInfo.author）
      const authorToRecord = updatedTask.aiParsedNoteInfo?.author || updatedTask.userNoteInfo?.author;
      const commentContent = updatedTask.userNoteInfo?.comment;

      if (authorToRecord && updatedTask.noteUrl && commentContent) {
        try {
          console.log(`📝 [本地客户端] 记录评论限制: 作者=${authorToRecord}, 链接=${updatedTask.noteUrl}`);
          await CommentLimit.recordCommentApproval(
            updatedTask.noteUrl,
            authorToRecord,
            commentContent,
            updatedTask._id
          );
          console.log(`✅ [本地客户端] 评论限制记录成功: taskId=${taskId}`);
        } catch (error) {
          console.error(`❌ [本地客户端] 记录评论限制失败:`, error);
          // 记录失败不影响主流程，继续发放积分和佣金
        }
      } else {
        console.warn(`⚠️ [本地客户端] 无法记录评论限制: 缺少必要参数`, {
          authorToRecord,
          noteUrl: updatedTask.noteUrl,
          commentContent
        });
      }
    }

    // ==================== 积分和分销发放逻辑 ====================
    let pointsAwarded = false;
    let commissionAwarded = false;
    let awardDetails = {};

    // 只有评论类型且审核通过（评论已找到）且最终状态为completed才发放积分
    // 防止客户端误判exists导致错误发放积分
    if (updatedTask.imageType === 'comment' && exists && updatedTask.status === 'completed') {
      // 获取任务配置获取奖励积分
      const taskConfig = await TaskConfig.findOne({ type_key: 'comment', is_active: true });
      const rewardPoints = taskConfig ? Math.floor(taskConfig.price) : 0;

      // 检查是否已经发放过积分（使用 updatedTask 的 auditHistory）
      // 注意：由于我们原子性地更新了状态，这里的检查是安全的
      const hasRewarded = updatedTask.auditHistory?.some(h => h.action === 'points_reward');

      if (!hasRewarded && rewardPoints > 0) {
        // 【防重复发放】额外检查 Transaction 表中是否已发放
        const existingTransaction = await Transaction.findOne({
          imageReview_id: updatedTask._id,
          type: 'task_reward'
        });

        if (existingTransaction) {
          console.log(`⚠️ [本地客户端] 该任务已发放过积分（Transaction表检查），跳过: ${taskId}`);
          hasRewarded = true; // 标记为已奖励，跳过后续发放
        } else {
          // 发放用户积分（使用 $inc 确保原子性）
          const userResult = await User.findByIdAndUpdate(
            updatedTask.userId,
            { $inc: { points: rewardPoints } },
            { new: true }
          );

          if (userResult) {
            pointsAwarded = true;
            awardDetails.userPoints = rewardPoints;
            console.log(`💰 [本地客户端] 任务 ${taskId} 已发放用户积分: ${rewardPoints}`);

            // 创建用户积分交易记录
            await new Transaction({
              user_id: updatedTask.userId,
              type: 'task_reward',
              amount: rewardPoints,
              description: `评论审核完成 (${finalStatus === 'completed' ? '评论已找到' : '评论未找到'})`,
              status: 'completed',  // 积分已发放，交易状态为完成
              imageReview_id: updatedTask._id
            }).save();

            // 记录到 auditHistory
            await ImageReview.updateOne(
              { _id: taskId },
              {
                $push: {
                  auditHistory: {
                    operator: null,
                    operatorName: `本地客户端 (${clientId || 'unknown'})`,
                    action: 'points_reward',
                    comment: `发放积分 ${rewardPoints} (状态: ${finalStatus})`,
                    timestamp: now
                  }
                }
              }
            );
          }
        }
      }

      // ==================== 分销佣金发放 ====================
      // 只有未发放过佣金时才发放（且审核通过且状态为completed）
      const hasCommissionRewarded = updatedTask.auditHistory?.some(h =>
        h.action === 'commission_reward' || h.comment?.includes('佣金')
      );

      if (!hasCommissionRewarded && exists && updatedTask.status === 'completed') {
        // 一级佣金
        if (updatedTask.snapshotCommission1 > 0 && updatedTask.userId) {
          // 【防重复发放】检查一级佣金是否已发放
          const existingCommission1 = await Transaction.findOne({
            imageReview_id: updatedTask._id,
            type: 'referral_bonus_1'
          });

          if (!existingCommission1) {
            const user = await User.findById(updatedTask.userId);
            if (user && user.parent_id) {
              const parentUser = await User.findById(user.parent_id);
              if (parentUser && !parentUser.is_deleted) {
                await User.findByIdAndUpdate(parentUser._id, {
                  $inc: { points: updatedTask.snapshotCommission1 }
                });

                // 创建一级佣金交易记录
                await new Transaction({
                  user_id: parentUser._id,
                  type: 'referral_bonus_1',
                  amount: updatedTask.snapshotCommission1,
                  description: `一级分销佣金 (${user.nickname || user.username} 的评论审核)`,
                  status: 'completed',  // 佣金已发放，交易状态为完成
                  imageReview_id: updatedTask._id
                }).save();

                commissionAwarded = true;
                awardDetails.commission1 = updatedTask.snapshotCommission1;
                console.log(`💰 [本地客户端] 一级佣金: +${updatedTask.snapshotCommission1}积分 → ${parentUser.username || parentUser.nickname}`);
              }
            }
          }
        }

        // 二级佣金
        if (updatedTask.snapshotCommission2 > 0 && updatedTask.userId) {
          // 【防重复发放】检查二级佣金是否已发放
          const existingCommission2 = await Transaction.findOne({
            imageReview_id: updatedTask._id,
            type: 'referral_bonus_2'
          });

          if (!existingCommission2) {
            const user = await User.findById(updatedTask.userId);
            if (user && user.parent_id) {
              const parentUser = await User.findById(user.parent_id);
              if (parentUser && parentUser.parent_id) {
                const grandParentUser = await User.findById(parentUser.parent_id);
                if (grandParentUser && !grandParentUser.is_deleted) {
                  await User.findByIdAndUpdate(grandParentUser._id, {
                    $inc: { points: updatedTask.snapshotCommission2 }
                  });

                  // 创建二级佣金交易记录
                  await new Transaction({
                    user_id: grandParentUser._id,
                    type: 'referral_bonus_2',
                    amount: updatedTask.snapshotCommission2,
                    description: `二级分销佣金 (${user.nickname || user.username} 的评论审核)`,
                    status: 'completed',  // 佣金已发放，交易状态为完成
                    imageReview_id: updatedTask._id
                  }).save();

                  commissionAwarded = true;
                  awardDetails.commission2 = updatedTask.snapshotCommission2;
                  console.log(`💰 [本地客户端] 二级佣金: +${updatedTask.snapshotCommission2}积分 → ${grandParentUser.username || grandParentUser.nickname}`);
                }
              }
            }
          }
        }

        if (commissionAwarded) {
          // 记录佣金发放到 auditHistory
          await ImageReview.updateOne(
            { _id: taskId },
            {
              $push: {
                auditHistory: {
                  operator: null,
                  operatorName: `本地客户端 (${clientId || 'unknown'})`,
                  action: 'commission_reward',
                  comment: `发放分销佣金 (一级: ${awardDetails.commission1 || 0}, 二级: ${awardDetails.commission2 || 0})`,
                  timestamp: now
                }
              }
            }
          );
        }
      }
    }

    // ==================== 返回结果 ====================
    if (exists) {
      console.log(`✅ [本地客户端] 任务 ${taskId} 评论验证通过，自动完成，已发放积分和佣金`);
    } else {
      console.log(`❌ [本地客户端] 任务 ${taskId} 评论未找到，自动驳回，不发放积分和佣金`);
    }

    res.json({
      success: true,
      message: exists ? '评论验证通过，任务已完成' : '评论未找到，任务已驳回',
      data: {
        taskId: taskId,
        result: commentVerification.result,
        status: finalStatus,
        pointsAwarded: pointsAwarded,
        commissionAwarded: commissionAwarded,
        awardDetails: awardDetails
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端] 上报验证结果失败:', error);
    res.status(500).json({
      success: false,
      message: '上报验证结果失败',
      error: error.message
    });
  }
});

/**
 * 批量上报验证结果
 * POST /xiaohongshu/api/client/verify-batch
 */
router.post('/verify-batch', async (req, res) => {
  try {
    const { results } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        success: false,
        message: '结果列表为空'
      });
    }

    const updateResults = [];
    const rejectionReason = '当前帖子评论区无法检测到你的评论（请用其他号观察）';

    for (const result of results) {
      try {
        const task = await ImageReview.findById(result.taskId);

        if (task) {
          if (!task.aiReviewResult) {
            task.aiReviewResult = {};
          }

          const passed = result.exists || false;
          const finalStatus = passed ? 'completed' : 'rejected';
          const auditComment = passed
            ? '本地客户端验证：评论已找到'
            : '本地客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）';

          task.aiReviewResult.commentVerification = {
            verified: true,
            exists: passed,
            confidence: result.confidence || 0,
            verifiedAt: result.verifiedAt || new Date().toISOString(),
            verificationMethod: 'local-client-batch',
            foundComments: result.foundComments || [],
            pageComments: result.pageComments || [],
            commentCount: result.commentCount || 0,
            result: passed ? 'passed' : 'comment_not_found'
          };

          task.aiReviewResult.passed = passed;
          task.aiReviewResult.reasons = [auditComment];

          task.status = finalStatus;
          task.rejectionReason = passed ? null : rejectionReason;

          await task.save();

          // ==================== 记录评论限制（重要：防止重复提交） ====================
          // 当评论审核通过时，记录到CommentLimit数据库
          if (task.imageType === 'comment' && passed && finalStatus === 'completed') {
            // 获取作者昵称（优先使用aiParsedNoteInfo.author，其次使用userNoteInfo.author）
            const authorToRecord = task.aiParsedNoteInfo?.author || task.userNoteInfo?.author;
            const commentContent = task.userNoteInfo?.comment;

            if (authorToRecord && task.noteUrl && commentContent) {
              try {
                console.log(`📝 [本地客户端批量] 记录评论限制: 作者=${authorToRecord}, 链接=${task.noteUrl}`);
                await CommentLimit.recordCommentApproval(
                  task.noteUrl,
                  authorToRecord,
                  commentContent,
                  task._id
                );
                console.log(`✅ [本地客户端批量] 评论限制记录成功: taskId=${result.taskId}`);
              } catch (error) {
                console.error(`❌ [本地客户端批量] 记录评论限制失败:`, error);
                // 记录失败不影响主流程
              }
            } else {
              console.warn(`⚠️ [本地客户端批量] 无法记录评论限制: 缺少必要参数`, {
                authorToRecord,
                noteUrl: task.noteUrl,
                commentContent
              });
            }
          }

          updateResults.push({
            taskId: result.taskId,
            success: true
          });
        } else {
          updateResults.push({
            taskId: result.taskId,
            success: false,
            error: '任务不存在'
          });
        }
      } catch (err) {
        updateResults.push({
          taskId: result.taskId,
          success: false,
          error: err.message
        });
      }
    }

    const successCount = updateResults.filter(r => r.success).length;

    console.log(`📊 [本地客户端] 批量上报完成: ${successCount}/${results.length} 成功`);

    res.json({
      success: true,
      message: `批量上报完成: ${successCount}/${results.length} 成功`,
      data: {
        total: results.length,
        success: successCount,
        failed: results.length - successCount,
        results: updateResults
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端] 批量上报失败:', error);
    res.status(500).json({
      success: false,
      message: '批量上报失败',
      error: error.message
    });
  }
});

/**
 * 上报客户端状态
 * POST /xiaohongshu/api/client/status
 */
router.post('/status', async (req, res) => {
  try {
    const { type, ...statusData } = req.body;

    console.log(`📊 [本地客户端] 状态上报:`, type || 'general', statusData);

    res.json({
      success: true,
      message: '状态上报成功'
    });

  } catch (error) {
    console.error('❌ [本地客户端] 状态上报失败:', error);
    res.status(500).json({
      success: false,
      message: '状态上报失败'
    });
  }
});

/**
 * 上报错误日志
 * POST /xiaohongshu/api/client/log
 */
router.post('/log', async (req, res) => {
  try {
    const { type, error, timestamp } = req.body;

    if (type === 'error-log' && error) {
      console.error(`❌ [本地客户端] 客户端错误:`, error.message);
      console.error(`   Stack:`, error.stack);
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error('❌ [本地客户端] 日志上报失败:', error);
    res.status(500).json({
      success: false,
      message: '日志上报失败'
    });
  }
});

/**
 * Cookie 状态上报
 * POST /xiaohongshu/api/client/cookie-status
 */
router.post('/cookie-status', async (req, res) => {
  try {
    const { type, cookieId, reason } = req.body;

    if (type === 'cookie-invalid') {
      console.warn(`⚠️  [本地客户端] Cookie 失效上报: ${cookieId} - ${reason}`);

      // 可以在这里触发 Cookie 池的失效标记逻辑
      const simpleCookiePool = require('../services/SimpleCookiePool');
      if (cookieId && simpleCookiePool.markCookieInvalid) {
        simpleCookiePool.markCookieInvalid(cookieId, reason || '本地客户端上报失效');
      }
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error('❌ [本地客户端] Cookie 状态上报失败:', error);
    res.status(500).json({
      success: false,
      message: 'Cookie 状态上报失败'
    });
  }
});

/**
 * 上报任务失败
 * POST /xiaohongshu/api/client/task-failed
 *
 * 当客户端处理任务失败时调用，立即释放任务锁定并重置状态
 */
router.post('/task-failed', async (req, res) => {
  try {
    const { taskId, clientId, reason, error } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少任务ID'
      });
    }

    // 验证 taskId 格式
    if (!isValidObjectId(taskId)) {
      return res.status(400).json({
        success: false,
        message: '任务ID格式不正确'
      });
    }

    const now = new Date();

    // 查询任务
    const task = await ImageReview.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    // 验证客户端ID（如果提供了）
    if (clientId && task.processingLock?.clientId && task.processingLock.clientId !== clientId) {
      console.warn(`⚠️ [本地客户端] 客户端 ${clientId} 尝试释放不属于它的任务锁定: ${taskId}`);
      return res.status(403).json({
        success: false,
        message: '无权操作此任务'
      });
    }

    // 根据任务状态决定重置后的状态
    let resetStatus = 'pending';
    if (task.clientVerification) {
      resetStatus = 'client_verification_pending';
    }

    // 更新任务：清除锁定，重置状态，记录失败原因
    const updatedTask = await ImageReview.findByIdAndUpdate(
      taskId,
      {
        $set: {
          status: resetStatus,
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null,
          updatedAt: now
        },
        $push: {
          auditHistory: {
            operator: null,
            operatorName: `本地客户端 (${clientId || 'unknown'})`,
            action: 'task_failed',
            comment: reason || error || '客户端处理失败',
            timestamp: now
          }
        }
      },
      { new: true }
    );

    console.log(`❌ [本地客户端] 任务 ${taskId} 处理失败，已重置状态: ${task.status} → ${resetStatus}`);
    console.log(`   原因: ${reason || error || '未知'}`);

    res.json({
      success: true,
      message: '任务失败已上报，任务已重新排队',
      data: {
        taskId: taskId,
        previousStatus: task.status,
        newStatus: resetStatus,
        reason: reason || error
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端] 上报任务失败失败:', error);
    res.status(500).json({
      success: false,
      message: '上报任务失败失败',
      error: error.message
    });
  }
});

// ============================================================
// 本地审核客户端 AI分析 API
// ============================================================

/**
 * AI文意审核（供本地审核客户端调用）
 * POST /xiaohongshu/api/client/note/ai-analyze
 */
router.post('/note/ai-analyze', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: '缺少内容参数'
      });
    }

    console.log(`🤖 [本地客户端AI] 分析内容，长度: ${content?.length || 0}`);

    // 调用AI分析服务
    const AIContentAnalysisService = require('../services/aiContentAnalysisService');
    const aiService = new AIContentAnalysisService();
    const result = await aiService.analyzeVictimPost(content);

    res.json({
      success: true,
      data: {
        is_genuine_victim_post: result.is_genuine_victim_post,
        confidence_score: result.confidence_score,
        reason: result.reason,
        risk_level: result.risk_level
      }
    });

  } catch (error) {
    console.error('❌ [本地客户端AI] 分析失败:', error);
    // AI失败时返回默认通过（与客户端逻辑保持一致）
    res.json({
      success: true,
      data: {
        is_genuine_victim_post: true,
        confidence_score: 0.5,
        reason: 'AI分析服务不可用，自动通过',
        fallback: true
      }
    });
  }
});

// ============================================================
// 笔记自动发现 API（空闲采集功能）
// ============================================================

/**
 * 检查笔记是否已被发现
 * GET /xiaohongshu/api/client/discovery/check/:noteUrl
 *
 * 用于客户端在上报前查重
 */
router.get('/discovery/check/:noteUrl', async (req, res) => {
  try {
    const noteUrl = decodeURIComponent(req.params.noteUrl);

    console.log(`🔍 [笔记发现] 检查笔记是否存在: ${noteUrl.substring(0, 50)}...`);

    const existing = await DiscoveredNote.findOne({ noteUrl });

    if (existing) {
      console.log(`📋 [笔记发现] 笔记已存在，状态: ${existing.status}`);
    } else {
      console.log(`✅ [笔记发现] 笔记不存在，可以上报`);
    }

    res.json({
      success: true,
      exists: !!existing,
      data: existing
    });

  } catch (error) {
    console.error('❌ [笔记发现] 检查失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 上报发现的笔记
 * POST /xiaohongshu/api/client/discovery/report
 *
 * 客户端在空闲时采集到符合条件的笔记后上报
 */
router.post('/discovery/report', async (req, res) => {
  try {
    const {
      noteUrl,
      noteId,
      title,
      author,
      publishTime,
      keyword,
      lastCommentTime,  // 新增：笔记内最新评论时间
      aiAnalysis,
      clientId
    } = req.body;

    // 参数验证
    if (!noteUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: noteUrl'
      });
    }

    console.log(`📝 [笔记发现] 收到笔记上报: ${title?.substring(0, 30) || noteUrl.substring(0, 30)}...`);
    console.log(`   URL: ${noteUrl}`);
    console.log(`   关键词: ${keyword || 'N/A'}`);
    console.log(`   AI结果: ${aiAnalysis?.is_genuine_victim_post ? '通过' : '未通过'}`);
    if (lastCommentTime) {
      console.log(`   最新评论: ${new Date(lastCommentTime).toLocaleString('zh-CN')}`);
    }

    // 构建更新数据
    const updateData = {
      noteUrl,
      noteId,
      title: title || '',
      author: (author || '').replace(/关注$/, '').trim(),
      publishTime: publishTime ? new Date(publishTime) : null,
      keyword: keyword || '',
      aiAnalysis: aiAnalysis || {
        is_genuine_victim_post: false,
        confidence_score: 0,
        reason: ''
      },
      clientId: clientId || null,
      // 根据AI分析结果设置状态
      status: aiAnalysis?.is_genuine_victim_post ? 'verified' : 'discovered',
      discoverTime: new Date()
    };

    // 如果提供了最新评论时间，更新它
    if (lastCommentTime) {
      updateData.lastCommentTime = new Date(lastCommentTime);
    }

    // 使用 findOneAndUpdate 防止重复
    const note = await DiscoveredNote.findOneAndUpdate(
      { noteUrl },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 判断是否为新创建的记录（比较时间戳）
    const isNew = !note.createdAt ||
      (note.createdAt instanceof Date && note.updatedAt instanceof Date &&
       note.createdAt.getTime() === note.updatedAt.getTime());

    if (isNew) {
      console.log(`✅ [笔记发现] 新笔记已保存，ID: ${note._id}`);
    } else {
      console.log(`🔄 [笔记发现] 笔记已更新，ID: ${note._id}`);
    }

    res.json({
      success: true,
      isNew,
      data: {
        id: note._id,
        noteUrl: note.noteUrl,
        status: note.status,
        createdAt: note.createdAt
      }
    });

  } catch (error) {
    console.error('❌ [笔记发现] 上报失败:', error);

    // 检查是否是唯一键冲突（重复上报）
    if (error.code === 11000 || error.code === 11001) {
      return res.status(200).json({
        success: true,
        isNew: false,
        duplicate: true,
        message: '笔记已存在'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取已发现的笔记列表（可选，用于管理后台）
 * GET /xiaohongshu/api/client/discovery/list
 * 支持筛选：status, harvestPriority, hasShortUrl, noteStatus, canHarvest, keyword
 */
router.get('/discovery/list', async (req, res) => {
  try {
    const {
      status,
      limit = 50,
      skip = 0,
      converted,
      harvestPriority,
      hasShortUrl,
      noteStatus,
      canHarvest,
      keyword
    } = req.query;

    const query = {};

    // 基础状态筛选
    if (status) {
      query.status = status;
    }

    // 采集优先级筛选
    if (harvestPriority) {
      query.harvestPriority = parseInt(harvestPriority);
    }

    // 短链接筛选
    if (hasShortUrl === 'yes') {
      // 使用 $and 确保同时满足存在且非空
      query.$and = query.$and || [];
      query.$and.push({
        shortUrl: { $exists: true, $nin: ['', null] }
      });
    } else if (hasShortUrl === 'no') {
      query.$or = [
        { shortUrl: { $exists: false } },
        { shortUrl: null },
        { shortUrl: '' }
      ];
    }

    // 删除状态筛选
    if (noteStatus) {
      query.noteStatus = noteStatus;
    }

    // 使用数组收集所有需要 $and 组合的条件，避免 $or 被覆盖
    const andConditions = [];

    // 处理 hasShortUrl === 'no' 的情况（需要在 keyword 之前处理）
    if (hasShortUrl === 'no' && !keyword) {
      query.$or = [
        { shortUrl: { $exists: false } },
        { shortUrl: null },
        { shortUrl: '' }
      ];
    }

    // 关键词搜索（标题、作者、长链接、短链接）
    if (keyword) {
      const { escapeRegExp } = require('../utils/security');
      const escapedKeyword = escapeRegExp(keyword);
      const keywordRegex = { $regex: escapedKeyword, $options: 'i' };

      // 收集关键词搜索条件
      const keywordCondition = {
        $or: [
          { title: keywordRegex },
          { author: keywordRegex },
          { noteUrl: keywordRegex },
          { shortUrl: keywordRegex }
        ]
      };

      // 如果同时有 hasShortUrl='no'，需要组合条件
      if (hasShortUrl === 'no') {
        andConditions.push(
          { $or: [{ shortUrl: { $exists: false } }, { shortUrl: null }, { shortUrl: '' }] },
          keywordCondition
        );
      } else {
        andConditions.push(keywordCondition);
      }
    }

    // 可采集筛选（根据采集间隔和上次采集时间计算）
    if (canHarvest === 'yes' || canHarvest === 'no') {
      // 获取优先级间隔配置
      const SystemConfig = require('../models/SystemConfig');
      const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
      const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

      // 构建可采集条件
      const now = new Date();
      const canHarvestConditions = [];

      // 遍历每个优先级，构建对应的时间条件
      for (const [priority, minutes] of Object.entries(intervals)) {
        const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
        canHarvestConditions.push({
          harvestPriority: parseInt(priority),
          $or: [
            { commentsHarvestedAt: { $exists: false } },
            { commentsHarvestedAt: null },
            { commentsHarvestedAt: { $lte: cutoffTime } }
          ]
        });
      }

      // 添加默认优先级（1）的条件，用于没有设置优先级的笔记
      const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
      canHarvestConditions.push({
        harvestPriority: { $exists: false },
        $or: [
          { commentsHarvestedAt: { $exists: false } },
          { commentsHarvestedAt: null },
          { commentsHarvestedAt: { $lte: defaultCutoff } }
        ]
      });

      if (canHarvest === 'yes') {
        // 可采集：满足任一优先级的时间条件，添加到 andConditions
        andConditions.push({ $or: canHarvestConditions });
      } else if (canHarvest === 'no') {
        // 排队中：不满足任何优先级的时间条件
        andConditions.push({ $nor: canHarvestConditions });
      }
    }

    // 统一应用 $and 条件（如果有多个条件需要组合）
    if (andConditions.length > 0) {
      query.$and = query.$and || [];
      query.$and.push(...andConditions);
    }

    const notes = await DiscoveredNote.find(query)
      .sort({ discoverTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await DiscoveredNote.countDocuments(query);

    res.json({
      success: true,
      data: {
        notes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      }
    });

  } catch (error) {
    console.error('❌ [笔记发现] 获取列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取笔记发现统计
 * GET /xiaohongshu/api/client/discovery/stats
 */
router.get('/discovery/stats', async (req, res) => {
  try {
    const total = await DiscoveredNote.countDocuments();
    const verified = await DiscoveredNote.countDocuments({ status: 'verified' });

    // 获取优先级间隔配置
    const SystemConfig = require('../models/SystemConfig');
    const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
    const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

    // 待采集队列：删除状态正常 + 可加入队列（满足采集间隔条件）
    const now = new Date();
    const canHarvestConditions = [];
    for (const [priority, minutes] of Object.entries(intervals)) {
      const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
      canHarvestConditions.push({
        harvestPriority: parseInt(priority),
        $or: [
          { commentsHarvestedAt: { $exists: false } },
          { commentsHarvestedAt: null },
          { commentsHarvestedAt: { $lte: cutoffTime } }
        ]
      });
    }
    const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
    canHarvestConditions.push({
      harvestPriority: { $exists: false },
      $or: [
        { commentsHarvestedAt: { $exists: false } },
        { commentsHarvestedAt: null },
        { commentsHarvestedAt: { $lte: defaultCutoff } }
      ]
    });

    const pending = await DiscoveredNote.countDocuments({
      noteStatus: 'active',
      $or: canHarvestConditions
    });

    // 最近7天发现的笔记数量
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = await DiscoveredNote.countDocuments({
      discoverTime: { $gte: sevenDaysAgo }
    });

    // 在线采集设备数量（基于 ClientHeartbeat 心跳判断）
    // 只统计最近5分钟内有心跳的采集客户端（harvest 类型）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineHarvestDevices = await ClientHeartbeat.countDocuments({
      clientType: 'harvest',
      lastHeartbeat: { $gte: fiveMinutesAgo }
    });

    // 正在分发：已被锁定的笔记数量
    const processing = await DiscoveredNote.countDocuments({
      noteStatus: 'active',
      'harvestLock.lockedUntil': { $gt: now }
    });

    res.json({
      success: true,
      data: {
        total,
        verified,
        pending,
        recent,
        onlineHarvestDevices,
        pendingStats: {
          processing,  // 正在分发
          ready: pending // 可加入队列
        }
      }
    });

  } catch (error) {
    console.error('❌ [笔记发现] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取采集队列管理数据
 * GET /xiaohongshu/api/client/discovery/harvest-queue
 *
 * 用于管理后台的采集队列管理页面
 * 支持待采集队列和已完成队列的查询
 */
router.get('/discovery/harvest-queue', async (req, res) => {
  try {
    const {
      tab = 'pending',           // pending: 待采集, processing: 正在分发, completed: 已完成
      skip = 0,
      limit = 50,
      keyword
    } = req.query;

    const now = new Date();

    // 获取优先级间隔配置
    const SystemConfig = require('../models/SystemConfig');
    const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
    const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

    // 计算下次可采集时间的函数
    const getNextHarvestTime = (priority, lastHarvestAt) => {
      const minutes = intervals[priority] || intervals[1];
      return new Date(new Date(lastHarvestAt).getTime() + minutes * 60 * 1000);
    };

    // 构建 query 条件
    const query = {};

    if (tab === 'pending') {
      // 待采集队列：删除状态正常 + 可加入队列（满足采集间隔条件）
      query.noteStatus = 'active';

      // 构建可采集条件：满足任一优先级的时间间隔
      const canHarvestConditions = [];
      for (const [priority, minutes] of Object.entries(intervals)) {
        const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
        canHarvestConditions.push({
          harvestPriority: parseInt(priority),
          $or: [
            { commentsHarvestedAt: { $exists: false } },
            { commentsHarvestedAt: null },
            { commentsHarvestedAt: { $lte: cutoffTime } }
          ]
        });
      }

      // 添加默认优先级（1）的条件，用于没有设置优先级的笔记
      const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
      canHarvestConditions.push({
        harvestPriority: { $exists: false },
        $or: [
          { commentsHarvestedAt: { $exists: false } },
          { commentsHarvestedAt: null },
          { commentsHarvestedAt: { $lte: defaultCutoff } }
        ]
      });

      // 满足任一优先级的时间条件
      query.$or = canHarvestConditions;
    } else if (tab === 'processing') {
      // 正在分发：已被锁定的笔记
      query.noteStatus = 'active';
      query['harvestLock.lockedUntil'] = { $gt: now };
    } else if (tab === 'completed') {
      // 已完成队列：已采集过
      query.commentsHarvested = true;
    }

    // 关键词搜索
    if (keyword) {
      const { escapeRegExp } = require('../utils/security');
      const escapedKeyword = escapeRegExp(keyword);
      const keywordRegex = { $regex: escapedKeyword, $options: 'i' };
      const keywordCondition = {
        $or: [
          { title: keywordRegex },
          { author: keywordRegex },
          { noteUrl: keywordRegex },
          { shortUrl: keywordRegex }
        ]
      };

      // 如果待采集队列已有 $or 条件，需要用 $and 组合
      if (tab === 'pending') {
        query.$and = [
          { $or: query.$or },
          keywordCondition
        ];
        delete query.$or;
      } else {
        // processing 和 completed tab 使用 $and 组合
        query.$and = [
          { ...query },
          keywordCondition
        ];
      }
    }

    // 查询笔记
    const notes = await DiscoveredNote.find(query)
      .sort({ harvestPriority: -1, discoverTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await DiscoveredNote.countDocuments(query);

    // 计算 queueStatus 和 waitTime
    const enrichedNotes = notes.map(note => {
      let queueStatus = 'ready';
      let waitTime = '可立即采集';

      // 检查是否正在被采集
      if (note.harvestLock && note.harvestLock.lockedUntil && new Date(note.harvestLock.lockedUntil) > now) {
        queueStatus = 'processing';
        waitTime = '采集中...';
      } else if (tab === 'completed' && note.commentsHarvestedAt) {
        // 已完成队列显示最后采集时间
        const harvestedAt = new Date(note.commentsHarvestedAt);
        const nextTime = getNextHarvestTime(note.harvestPriority || 1, harvestedAt);
        if (nextTime > now) {
          const diffMs = nextTime - now;
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 60) {
            waitTime = `下次采集: ${diffMins}分钟后`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            waitTime = `下次采集: ${diffHours}小时后`;
          }
        } else {
          waitTime = '可再次采集';
        }
      } else if (tab === 'pending' && note.commentsHarvestedAt) {
        // 待采集队列但之前采集过（重新采集）
        const harvestedAt = new Date(note.commentsHarvestedAt);
        const nextTime = getNextHarvestTime(note.harvestPriority || 1, harvestedAt);
        if (nextTime > now) {
          queueStatus = 'waiting';
          const diffMs = nextTime - now;
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 60) {
            waitTime = `等待: ${diffMins}分钟`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            waitTime = `等待: ${diffHours}小时`;
          }
        }
      }

      return {
        ...note,
        queueStatus,
        waitTime
      };
    });

    // 统计数据
    let stats;
    if (tab === 'pending') {
      // 待采集队列统计
      const [readyTotal, processingTotal] = await Promise.all([
        // 可加入队列：满足采集间隔条件且没有被锁定
        (async () => {
          const canHarvestConditions = [];
          for (const [priority, minutes] of Object.entries(intervals)) {
            const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
            canHarvestConditions.push({
              harvestPriority: parseInt(priority),
              $or: [
                { commentsHarvestedAt: { $exists: false } },
                { commentsHarvestedAt: null },
                { commentsHarvestedAt: { $lte: cutoffTime } }
              ]
            });
          }
          const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
          canHarvestConditions.push({
            harvestPriority: { $exists: false },
            $or: [
              { commentsHarvestedAt: { $exists: false } },
              { commentsHarvestedAt: null },
              { commentsHarvestedAt: { $lte: defaultCutoff } }
            ]
          });
          return await DiscoveredNote.countDocuments({
            noteStatus: 'active',
            $or: canHarvestConditions,
            $or: [
              { harvestLock: { $exists: false } },
              { harvestLock: null },
              { 'harvestLock.lockedUntil': { $lte: now } },
              { 'harvestLock.lockedUntil': { $exists: false } }
            ]
          });
        })(),
        // 正在分发：有锁定且未过期
        DiscoveredNote.countDocuments({
          noteStatus: 'active',
          'harvestLock.lockedUntil': { $gt: now }
        })
      ]);

      stats = {
        processing: processingTotal,  // 正在分发
        ready: readyTotal             // 可加入队列
      };
    } else {
      // 已完成队列统计
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [completedTotal, todayTotal] = await Promise.all([
        // 已完成总数
        DiscoveredNote.countDocuments({
          commentsHarvested: true
        }),
        // 今日完成（今天采集的）
        DiscoveredNote.countDocuments({
          commentsHarvested: true,
          commentsHarvestedAt: { $gte: today }
        })
      ]);

      stats = {
        total: completedTotal,  // 已完成总数
        today: todayTotal       // 今日完成
      };
    }

    res.json({
      success: true,
      data: {
        notes: enrichedNotes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        },
        stats
      }
    });

  } catch (error) {
    console.error('❌ [采集队列] 获取队列数据失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新笔记的短链接
 * PUT /xiaohongshu/api/client/discovery/:id/short-url
 */
router.put('/discovery/:id/short-url', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { shortUrl } = req.body;

    console.log(`📝 [短链接更新] 笔记ID: ${id}, 短链接: ${shortUrl}`);

    // 验证笔记是否存在
    const note = await DiscoveredNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: '笔记不存在'
      });
    }

    // 验证短链接格式（可选）
    if (shortUrl && !shortUrl.startsWith('http')) {
      return res.status(400).json({
        success: false,
        message: '短链接格式错误，必须以 http:// 或 https:// 开头'
      });
    }

    // 更新短链接
    note.shortUrl = shortUrl || null;
    note.shortUrlConvertedAt = shortUrl ? new Date() : null;
    await note.save();

    console.log(`✅ [短链接更新] 成功: ${id}`);

    res.json({
      success: true,
      message: '短链接更新成功',
      data: {
        shortUrl: note.shortUrl
      }
    });

  } catch (error) {
    console.error('❌ [短链接更新] 失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 标记笔记评论已采集
 * POST /xiaohongshu/api/client/harvest/complete
 *
 * 客户端采集评论成功后调用
 *
 * 新增参数 lastCommentTime：笔记内最新评论的时间（用于计算下次采集间隔）
 */
router.post('/harvest/complete', async (req, res) => {
  try {
    const { noteUrl, commentCount = 0, lastCommentTime } = req.body;

    if (!noteUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少 noteUrl 参数'
      });
    }

    // 构建更新数据
    const updateData = {
      commentsHarvested: true,
      commentsHarvestedAt: new Date(),
      lastCommentCount: commentCount
    };

    // 如果提供了最新评论时间，更新它
    if (lastCommentTime) {
      updateData.lastCommentTime = new Date(lastCommentTime);
    }

    const result = await DiscoveredNote.updateOne(
      { noteUrl: noteUrl },
      updateData
    );

    if (result.matchedCount > 0) {
      const timeInfo = lastCommentTime ? ` (最新评论: ${new Date(lastCommentTime).toLocaleString('zh-CN')})` : '';
      console.log(`✅ [采集队列] 已标记评论采集完成: ${noteUrl.substring(0, 60)}... (${commentCount}条)${timeInfo}`);
    }

    res.json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('❌ [采集队列] 标记完成失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 评论线索管理 ====================

const CommentLead = require('../models/CommentLead');
const CommentBlacklist = require('../models/CommentBlacklist');

/**
 * 提交评论线索（客户端采集）
 * POST /xiaohongshu/api/client/comments/submit
 */
router.post('/comments/submit', async (req, res) => {
  try {
    const {
      noteUrl,
      noteId,
      noteTitle,
      noteAuthor,
      keyword,
      comments, // 评论数组 [{commentAuthor, commentAuthorId, commentContent, commentUrl, commentTime}]
      clientId
    } = req.body;

    if (!noteUrl || !comments || !Array.isArray(comments)) {
      return res.status(400).json({
        success: false,
        message: '参数错误'
      });
    }

    const results = {
      added: 0,
      blacklisted: 0,
      skipped: 0,
      details: []
    };

    // 获取当前有效的黑名单（未过期的）
    const blacklistedNicknames = await CommentBlacklist.find({
      expireAt: { $gt: new Date() }
    }).distinct('nickname');

    for (const comment of comments) {
      const { commentAuthor, commentAuthorId, commentContent, commentUrl, commentTime, commentId } = comment;

      // 检查是否在黑名单中
      if (blacklistedNicknames.includes(commentAuthor)) {
        results.blacklisted++;
        results.details.push({ nickname: commentAuthor, action: 'blacklisted' });
        continue;
      }

      // 检查是否已存在
      const existing = await CommentLead.findOne({
        noteUrl: noteUrl,
        commentAuthor: commentAuthor
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      // AI分析判断是否为潜在客户/引流/同行
      let aiResult;
      try {
        aiResult = await aiAnalysis.analyzeComment(commentContent, noteTitle);
      } catch (error) {
        console.error('AI分析评论失败，使用默认处理:', error.message);
        // AI失败时默认作为潜在客户保留
        aiResult = {
          isPotentialLead: true,
          category: 'uncertain',
          confidence_score: 0.3,
          reason: 'AI分析失败，默认保留',
          shouldContact: true,
          riskLevel: 'low'
        };
      }

      // 根据 AI 结果分类处理
      if (aiResult.category === 'spam') {
        // 引流 - 加入黑名单
        await CommentBlacklist.findOneAndUpdate(
          { nickname: commentAuthor },
          {
            nickname: commentAuthor,
            userId: commentAuthorId || '',
            reason: 'AI检测:引流',
            commentContent: commentContent,
            $inc: { reportCount: 1 },
            lastSeenAt: new Date(),
            clientId: clientId || null
          },
          { upsert: true, new: true }
        );
        results.blacklisted++;
        results.details.push({ nickname: commentAuthor, action: 'blacklisted', reason: aiResult.reason });
        continue;
      }

      if (aiResult.category === 'author') {
        // 作者回复 - 跳过
        results.skipped++;
        results.details.push({ nickname: commentAuthor, action: 'skipped', reason: `${aiResult.category}: ${aiResult.reason}` });
        continue;
      }

      // noise 也通过，保存为线索（只要不是引流或作者）

      // 保存潜在客户线索
      await CommentLead.create({
        noteUrl: noteUrl,
        noteId: noteId || '',
        noteTitle: noteTitle || '',
        noteAuthor: noteAuthor || '',
        keyword: keyword || '',
        commentAuthor: commentAuthor || '',
        commentAuthorId: commentAuthorId || '',
        commentContent: commentContent || '',
        commentId: commentId || '',
        commentUrl: commentUrl || '',
        commentTime: commentTime ? new Date(commentTime) : null,
        aiAnalysis: {
          isSpam: false,
          type: aiResult.category,
          reason: aiResult.reason,
          confidence: aiResult.confidence_score,
          shouldContact: aiResult.shouldContact,
          riskLevel: aiResult.riskLevel
        },
        clientId: clientId || null,
        discoverTime: new Date()
      });
      results.added++;
      results.details.push({ nickname: commentAuthor, action: 'added', aiCategory: aiResult.category });
    }

    console.log(`📝 [评论线索] 提交完成: 新增${results.added}, 黑名单${results.blacklisted}, 跳过${results.skipped}`);

    // 更新 DiscoveredNote 的评论采集状态
    if (results.added > 0 && noteUrl) {
      try {
        await DiscoveredNote.updateOne(
          { noteUrl: noteUrl },
          {
            commentsHarvested: true,
            commentsHarvestedAt: new Date(),
            lastCommentCount: results.added
          }
        );
        console.log(`✅ [采集队列] 已更新笔记评论采集状态: ${noteUrl.substring(0, 60)}... (${results.added}条)`);
      } catch (updateError) {
        console.error('⚠️ [采集队列] 更新笔记状态失败:', updateError.message);
        // 更新失败不影响主流程返回
      }
    }

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('❌ [评论线索] 提交失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * AI分析评论是否为引流/同行
 */
function analyzeCommentForSpam(content) {
  if (!content || typeof content !== 'string') {
    return { isSpam: false, reason: '', type: '', confidence: 0 };
  }

  const text = content.toLowerCase().trim();

  // 引流特征
  const spamPhrases = [
    '可以问我', '不会可以问', '来问我', '问我',
    '私信我', '加我', '联系我', '找我',
    '我有方法', '我有渠道', '我帮你', '帮你',
    '我成功了，可以问', '成功，可以问'
  ];

  // 同行/帮助者特征（已经成功的）
  const helperPhrases = [
    '我已经要回来了', '已经要回来了', '要回来了',
    '我成功退了', '成功退了', '我退了',
    '我已经退了', '已经退了',
    '我试过', '真的可以', '可以退',
    '不难的', '有记录就好了', '保留记录可以',
    '得亏最后', '幸好最后'
  ];

  // 检查引流
  for (const phrase of spamPhrases) {
    if (text.includes(phrase)) {
      return {
        isSpam: true,
        reason: `引流: "${phrase}"`,
        type: '引流',
        confidence: 0.95
      };
    }
  }

  // 检查同行/帮助者（已经成功的）
  for (const phrase of helperPhrases) {
    if (text.includes(phrase)) {
      return {
        isSpam: true,
        reason: `同行/帮助者: "${phrase}"`,
        type: '帮助者',
        confidence: 0.85
      };
    }
  }

  // 不是引流
  return {
    isSpam: false,
    reason: '',
    type: '',
    confidence: 0
  };
}

/**
 * 获取评论线索列表（支持筛选和搜索）
 * GET /xiaohongshu/api/client/comments/list
 */
router.get('/comments/list', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      keyword,
      startDate,
      endDate,
      skip = 0,
      limit = 50
    } = req.query;

    const query = {};

    // 状态筛选
    if (status) query.status = status;

    // 关键词搜索（搜索评论者和评论内容）
    if (keyword && keyword.trim()) {
      query.$or = [
        { commentAuthor: { $regex: keyword.trim(), $options: 'i' } },
        { commentContent: { $regex: keyword.trim(), $options: 'i' } },
        { noteTitle: { $regex: keyword.trim(), $options: 'i' } }
      ];
    }

    // 日期范围筛选
    if (startDate || endDate) {
      query.discoverTime = {};
      if (startDate) {
        // 开始日期：设置为当天 00:00:00
        query.discoverTime.$gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        // 结束日期：设置为当天 23:59:59
        query.discoverTime.$lte = new Date(endDate + 'T23:59:59');
      }
    }

    const total = await CommentLead.countDocuments(query);
    const leads = await CommentLead.find(query)
      .sort({ discoverTime: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        leads: leads,
        pagination: { total, skip: parseInt(skip), limit: parseInt(limit) }
      }
    });

  } catch (error) {
    console.error('❌ [评论线索] 获取列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取评论线索统计
 * GET /xiaohongshu/api/client/comments/stats
 */
router.get('/comments/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      total: await CommentLead.countDocuments(),
      pending: await CommentLead.countDocuments({ status: 'pending' }),
      contacted: await CommentLead.countDocuments({ status: 'contacted' }),
      converted: await CommentLead.countDocuments({ status: 'converted' }),
      today: await CommentLead.countDocuments({
        discoverTime: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('❌ [评论线索] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取黑名单列表（客户端专用，无需认证）
 * GET /xiaohongshu/api/client/comments/blacklist
 */
router.get('/comments/blacklist', async (req, res) => {
  try {
    const blacklist = await CommentBlacklist.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: blacklist
    });

  } catch (error) {
    console.error('❌ [评论黑名单] 获取失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 添加昵称到黑名单（客户端专用，无需认证）
 * POST /xiaohongshu/api/client/comments/blacklist
 */
router.post('/comments/blacklist', async (req, res) => {
  try {
    const { nickname, commentContent, reason } = req.body;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        message: '昵称不能为空'
      });
    }

    // 检查是否已存在
    const existing = await CommentBlacklist.findOne({ nickname });
    if (existing) {
      // 更新现有记录
      await CommentBlacklist.updateOne(
        { nickname },
        {
          $inc: { reportCount: 1 },
          commentContent: commentContent || existing.commentContent,
          reason: reason || existing.reason,
          lastSeenAt: new Date()
        }
      );
      return res.json({
        success: true,
        message: '黑名单记录已更新',
        data: { updated: true }
      });
    }

    // 创建新记录
    await CommentBlacklist.create({
      nickname,
      userId: '',
      commentContent: commentContent || '',
      reason: reason || '引流',
      reportCount: 1,
      lastSeenAt: new Date()
    });

    console.log(`🚫 [黑名单] 客户端添加: ${nickname} (${reason || '引流'})`);

    res.json({
      success: true,
      message: '已添加到黑名单',
      data: { added: true }
    });

  } catch (error) {
    console.error('❌ [黑名单] 添加失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 从黑名单删除（解封）
 * DELETE /xiaohongshu/api/client/comments/blacklist/:nickname
 */
router.delete('/comments/blacklist/:nickname', authenticateToken, async (req, res) => {
  try {
    const { nickname } = req.params;

    const result = await CommentBlacklist.deleteOne({ nickname });

    res.json({
      success: true,
      message: result.deletedCount > 0 ? '已从黑名单移除' : '未找到该用户',
      data: { deletedCount: result.deletedCount }
    });

  } catch (error) {
    console.error('❌ [评论黑名单] 删除失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新评论线索状态
 * PATCH /xiaohongshu/api/client/comments/:id/status
 */
router.patch('/comments/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const update = { status };
    if (notes) update['followUp.notes'] = notes;
    if (status === 'contacted') {
      update['followUp.contacted'] = true;
      update['followUp.contactedAt'] = new Date();
    }

    const lead = await CommentLead.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: '评论线索不存在'
      });
    }

    res.json({
      success: true,
      data: lead
    });

  } catch (error) {
    console.error('❌ [评论线索] 更新状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 短链接转换 API ====================

/**
 * 获取待转换短链接的笔记列表
 * GET /xiaohongshu/api/client/link-convert/pending
 */
router.get('/link-convert/pending', async (req, res) => {
  try {
    const { limit = 10, clientId } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10分钟

    // 清理超时的锁（超过10分钟）
    await DiscoveredNote.updateMany(
      {
        'shortUrlProcessingLock.lockedUntil': { $lt: now }
      },
      {
        $unset: { shortUrlProcessingLock: 1 }
      }
    );

    // 原子性地查询并锁定任务（防止竞态条件）
    const tasks = await DiscoveredNote.find({
      shortUrl: null,
      $or: [
        { shortUrlProcessingLock: { $exists: false } },
        { 'shortUrlProcessingLock.lockedUntil': { $lt: now } }
      ]
    })
    .sort({ createdAt: 1 })  // 按创建时间排序，优先处理旧笔记
    .limit(limitNum)
    .select('_id noteUrl title')
    .lean();

    if (tasks.length === 0) {
      return res.json({
        success: true,
        tasks: []
      });
    }

    // 使用 findOneAndUpdate 原子性地锁定每个任务
    const taskIds = tasks.map(t => t._id);
    const lockedTasks = [];

    for (const taskId of taskIds) {
      const locked = await DiscoveredNote.findOneAndUpdate(
        {
          _id: taskId,
          $or: [
            { shortUrlProcessingLock: { $exists: false } },
            { 'shortUrlProcessingLock.lockedUntil': { $lt: now } }
          ]
        },
        {
          $set: {
            shortUrlProcessingLock: {
              clientId: clientId || null,
              lockedAt: now,
              lockedUntil: lockedUntil
            }
          }
        },
        { new: true }
      );

      if (locked) {
        lockedTasks.push(locked);
      }
    }

    console.log(`📋 [短链接转换] 分配 ${lockedTasks.length} 个任务给客户端 ${clientId || 'unknown'}`);

    res.json({
      success: true,
      tasks: lockedTasks
    });

  } catch (error) {
    console.error('❌ [短链接转换] 获取任务失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 上传转换后的短链接
 * POST /xiaohongshu/api/client/link-convert/update
 */
router.post('/link-convert/update', async (req, res) => {
  try {
    const { noteId, shortUrl } = req.body;

    if (!noteId || !shortUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: noteId, shortUrl'
      });
    }

    // 验证短链接格式
    if (!shortUrl.includes('xhslink.com')) {
      return res.status(400).json({
        success: false,
        message: '短链接格式错误，必须包含 xhslink.com'
      });
    }

    const note = await DiscoveredNote.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: '笔记不存在'
      });
    }

    // 更新短链接
    note.shortUrl = shortUrl;
    note.shortUrlConvertedAt = new Date();
    // 移除锁定
    note.shortUrlProcessingLock = undefined;
    await note.save();

    console.log(`✅ [短链接转换] 笔记 ${noteId} 已转换为: ${shortUrl}`);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('❌ [短链接转换] 更新失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 上报短链接转换失败
 * POST /xiaohongshu/api/client/link-convert/fail
 */
router.post('/link-convert/fail', async (req, res) => {
  try {
    const { noteId, reason } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: noteId'
      });
    }

    const note = await DiscoveredNote.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: '笔记不存在'
      });
    }

    // 移除锁定，允许重试
    note.shortUrlProcessingLock = undefined;
    await note.save();

    console.warn(`⚠️ [短链接转换] 笔记 ${noteId} 转换失败: ${reason || '未知原因'}`);

    res.json({
      success: true
    });

  } catch (error) {
    console.error('❌ [短链接转换] 失败上报失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 新增：按客户端类型返回任务的接口 ====================

/**
 * 获取待采集评论的笔记列表
 * GET /xiaohongshu/api/client/harvest/pending
 *
 * 专用于 harvest-client（评论采集客户端）
 *
 * 采集优先级分级（根据笔记内最新评论时间）：
 * - 11小时内 → 最高级，每10分钟采集
 * - 12小时-3天 → 第二级，每1小时采集
 * - 3天-7天 → 第三级，每6小时采集
 * - 7天以上 → 最低级，每12小时采集
 */
router.get('/harvest/pending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // 计算10天前的时间点
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    // 查询所有需要采集的笔记
    const notes = await DiscoveredNote.find({
      needsCommentHarvest: true,
      noteStatus: 'active',
      createdAt: { $gte: tenDaysAgo }
    })
    .select('noteUrl noteId title author keyword commentsHarvestedAt lastCommentTime createdAt');

    // 根据每个笔记的优先级判断是否可以采集
    const now = new Date();
    const readyNotes = [];

    // 定义优先级计算函数
    const calculatePriority = (note) => {
      if (!note.lastCommentTime) return 1; // 没有评论时间记录，最低优先级

      const hoursSinceLastComment = (now - note.lastCommentTime) / (1000 * 60 * 60);

      if (hoursSinceLastComment <= 11) {
        return 10; // 最高级 - 11小时内
      } else if (hoursSinceLastComment <= 72) {
        return 5;  // 第二级 - 12小时到3天
      } else if (hoursSinceLastComment <= 168) {
        return 2;  // 第三级 - 3天到7天
      } else {
        return 1;  // 最低级 - 7天以上
      }
    };

    // 定义获取采集间隔（分钟）
    const getIntervalMinutes = (note) => {
      const priority = calculatePriority(note);
      switch (priority) {
        case 10: return 10;   // 10分钟
        case 5:  return 60;   // 1小时
        case 2:  return 360;  // 6小时
        default: return 720;  // 12小时
      }
    };

    for (const note of notes) {
      // 从未采集过，立即采集
      if (!note.commentsHarvestedAt) {
        readyNotes.push(note);
        continue;
      }

      // 根据最后评论时间计算采集间隔
      const intervalMinutes = getIntervalMinutes(note);
      const nextHarvestTime = new Date(note.commentsHarvestedAt.getTime() + intervalMinutes * 60 * 1000);

      // 检查是否到达采集时间
      if (now >= nextHarvestTime) {
        readyNotes.push(note);
      }
    }

    // 按优先级排序（高优先级在前）
    readyNotes.sort((a, b) => {
      const priorityA = calculatePriority(a);
      const priorityB = calculatePriority(b);
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      // 优先级相同时，按创建时间排序（旧的优先）
      return a.createdAt - b.createdAt;
    });

    // 限制返回数量
    const limitedNotes = readyNotes.slice(0, parseInt(limit));

    console.log(`📥 [采集客户端] 返回 ${limitedNotes.length} 个待采集评论的笔记 (查询了 ${notes.length} 个，准备就绪 ${readyNotes.length} 个)`);

    res.json({
      success: true,
      data: {
        notes: limitedNotes,
        count: limitedNotes.length
      }
    });

  } catch (error) {
    console.error('❌ [采集客户端] 获取失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取笔记发现任务（关键词列表）
 * GET /xiaohongshu/api/client/discovery/keywords
 *
 * 专用于 discovery-client（笔记发现客户端）
 */
router.get('/discovery/keywords', async (req, res) => {
  try {
    const { clientId, clientType } = req.query;
    const headerClientType = req.headers['x-client-type'];
    const finalClientType = clientType || headerClientType;

    // 验证客户端类型
    if (finalClientType && finalClientType !== 'discovery') {
      return res.status(400).json({
        success: false,
        message: `此接口仅限 discovery-client 使用`
      });
    }

    // 返回搜索关键词列表
    const keywords = [
      { keyword: '减肥被骗', priority: 1 },
      { keyword: '护肤被骗', priority: 1 },
      { keyword: '祛斑被骗', priority: 1 },
      { keyword: '美容院被骗', priority: 2 },
      { keyword: '整容被骗', priority: 2 },
      { keyword: '网购被骗', priority: 3 },
      { keyword: '微商被骗', priority: 3 }
    ];

    console.log(`📥 [发现客户端] 返回 ${keywords.length} 个搜索关键词`);

    res.json({
      success: true,
      data: {
        keywords: keywords,
        count: keywords.length
      }
    });

  } catch (error) {
    console.error('❌ [发现客户端] 获取关键词失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;