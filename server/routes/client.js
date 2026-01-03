const express = require('express');
const crypto = require('crypto');
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const CommentLimit = require('../models/CommentLimit');
const { authenticateToken } = require('../middleware/auth');
const xiaohongshuService = require('../services/xiaohongshuService');
const deviceNoteService = require('../services/deviceNoteService');
const asyncAiReviewService = require('../services/asyncAiReviewService');
const router = express.Router();

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
    if (!device && process.env.NODE_ENV !== 'production' && deviceId.startsWith('device_')) {
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

    // MD5去重检查：查找相同MD5且状态不为'rejected'的记录（兼容新格式）
    const existingReview = await ImageReview.findOne({
      imageMd5s: imageMd5, // 检查MD5数组中是否包含
      status: { $ne: 'rejected' }
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

      // 检查该设备的昵称是否在7天内被使用过
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentReview = await ImageReview.findOne({
        'aiParsedNoteInfo.author': device.accountName,
        userId: req.user._id,
        status: { $in: ['manager_approved', 'completed'] },
        createdAt: { $gte: sevenDaysAgo }
      });

      if (recentReview) {
        // 计算还有多少天不能使用
        const daysSinceLastUse = Math.floor((Date.now() - recentReview.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        const remainingDays = 7 - daysSinceLastUse;

        deviceObj.nicknameLimitStatus = {
          canUse: false,
          reason: 'id限制中',
          remainingDays: Math.max(0, remainingDays),
          lastUsed: recentReview.createdAt
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

// 获取系统公告
router.get('/announcements', async (req, res) => {
  try {
    // 模拟公告数据，实际应该从数据库获取
    const announcements = [
      "📢 今日笔记任务单价上调至 12 元！",
      "🎉 恭喜用户小明提现 100 元！",
      "💡 上传高质量截图可加快审核速度",
      "🔥 新用户注册赠送 5 元体验金",
      "⚡ 审核通过率提升至 95%，快来提交任务吧！"
    ];

    res.json({
      success: true,
      announcements
    });
  } catch (error) {
    console.error('获取公告错误:', error);
    res.status(500).json({ success: false, message: '获取公告失败' });
  }
});

// 批量提交多图任务
router.post('/tasks/batch-submit', authenticateToken, async (req, res) => {
  try {
    const { deviceId = null, imageType, imageUrls, imageMd5s, noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat } = req.body;

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

      // 注释掉提交时的设备检查，因为提交时无法确定具体设备
      // 检查逻辑将在审核通过时执行，当确定具体设备后
      // const deviceNoteCheck = await deviceNoteService.checkDeviceNoteSubmission(deviceId);
      // if (!deviceNoteCheck.canSubmit) {
      //   return res.status(400).json({
      //     success: false,
      //     message: deviceNoteCheck.message,
      //     lastNoteDate: deviceNoteCheck.lastNoteDate
      //   });
      // }
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
      if (!device && process.env.NODE_ENV !== 'production' && deviceId.startsWith('device_')) {
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
    if (imageMd5s && imageMd5s.length > 0) {
      const existingReviews = await ImageReview.find({
        imageMd5s: { $in: imageMd5s }, // 检查MD5数组中是否包含
        status: { $ne: 'rejected' }
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
          normalizedCommentContent
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
    let aiReviewResult = null;
    if (imageType === 'note' || imageType === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记和评论类型必须提供小红书链接' });
      }

      // 基础链接验证（快速验证）
      console.log('🔗 开始基础链接验证...');
      const basicValidation = await xiaohongshuService.validateNoteUrl(noteUrl);

      if (!basicValidation.valid) {
        return res.status(400).json({
          success: false,
          message: `链接验证失败：${basicValidation.reason}`,
          aiReview: basicValidation
        });
      }

      // 设置基础AI审核结果，后续异步处理
      aiReviewResult = {
        valid: true,
        noteId: basicValidation.noteId,
        noteStatus: basicValidation.noteStatus,
        aiReview: {
          passed: true, // 基础验证通过，后续异步审核
          confidence: 0.5,
          reasons: ['基础验证通过，等待后台AI审核'],
          riskLevel: 'low'
        }
      };

      console.log('✅ 基础验证通过，任务将进入后台AI审核队列');
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

module.exports = router;