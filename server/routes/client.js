const express = require('express');
const crypto = require('crypto');
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const { authenticateToken } = require('../middleware/auth');
const xiaohongshuService = require('../services/xiaohongshuService');
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
      .select('type_key name price')
      .sort({ type_key: 1 });

    res.json({
      success: true,
      configs
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
      is_deleted: { $ne: true }
    })
    .select('accountName status influence onlineDuration points')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      devices
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
    const { deviceId, imageType, imageUrls, imageMd5s, noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat } = req.body;

    // 验证参数
    if (!deviceId || !imageType) {
      return res.status(400).json({ success: false, message: '参数不完整：缺少设备或任务类型' });
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
      if (!noteAuthor || noteAuthor.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记类型必须填写作者昵称' });
      }
      if (!noteTitle || noteTitle.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记类型必须填写笔记标题' });
      }
    } else if (imageType === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '评论类型必须填写链接' });
      }
      if (!noteAuthor || noteAuthor.trim() === '') {
        return res.status(400).json({ success: false, message: '评论类型必须填写作者昵称' });
      }
      if (!commentContent || commentContent.trim() === '') {
        return res.status(400).json({ success: false, message: '评论类型必须填写评论内容' });
      }
      // 评论类型也需要提供图片作为证据
      if (!imageUrls || imageUrls.length === 0) {
        return res.status(400).json({ success: false, message: '评论类型必须上传评论截图作为证据' });
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
      const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/.+/i;
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

    // AI审核逻辑（仅对笔记和评论类型）
    let aiReviewResult = null;
    if (imageType === 'note' || imageType === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        return res.status(400).json({ success: false, message: '笔记和评论类型必须提供小红书链接' });
      }
      console.log('🤖 开始AI审核笔记链接和内容...');

      // 首先验证链接有效性
      aiReviewResult = await xiaohongshuService.validateNoteUrl(noteUrl);

      if (!aiReviewResult.valid) {
        return res.status(400).json({
          success: false,
          message: `AI审核失败：${aiReviewResult.reason}`,
          aiReview: aiReviewResult
        });
      }

      // 如果是笔记类型，进行内容比对
      if (imageType === 'note' && noteAuthor && noteTitle) {
        console.log('🔍 开始解析笔记内容并比对...');

        const contentResult = await xiaohongshuService.parseNoteContent(noteUrl);

        if (contentResult.success && (contentResult.author || contentResult.title)) {
          console.log('📄 解析到的笔记内容:', {
            title: contentResult.title,
            author: contentResult.author
          });

          // 进行内容比对
          const authorMatch = contentResult.author ? compareStrings(noteAuthor, contentResult.author) : 0;
          const titleMatch = contentResult.title ? compareStrings(noteTitle, contentResult.title) : 0;

          console.log('🔍 比对结果:', {
            authorMatch: `${authorMatch}%`,
            titleMatch: `${titleMatch}%`,
            userAuthor: noteAuthor,
            pageAuthor: contentResult.author,
            userTitle: noteTitle,
            pageTitle: contentResult.title
          });

          // 更新AI审核结果
          aiReviewResult.contentMatch = {
            authorMatch,
            titleMatch,
            pageAuthor: contentResult.author,
            pageTitle: contentResult.title
          };

          // 严格的审核逻辑：如果无法解析内容或匹配度过低，则不通过
          if (!contentResult.author && !contentResult.title) {
            // 完全无法解析内容
            aiReviewResult.aiReview.passed = false;
            aiReviewResult.aiReview.confidence = 0.1;
            aiReviewResult.aiReview.reasons.push('无法解析笔记内容，疑似无效链接');
            aiReviewResult.aiReview.riskLevel = 'high';
          } else if ((contentResult.author && authorMatch < 30) || (contentResult.title && titleMatch < 30)) {
            // 内容匹配度过低
            aiReviewResult.aiReview.passed = false;
            aiReviewResult.aiReview.confidence = 0.2;
            aiReviewResult.aiReview.reasons.push('内容匹配度过低，可能为虚假信息');
            aiReviewResult.aiReview.riskLevel = 'high';
          } else if (authorMatch >= 80 && titleMatch >= 80) {
            // 内容匹配度很高
            aiReviewResult.aiReview.confidence += 0.3;
            aiReviewResult.aiReview.reasons.push('内容匹配度很高，信息一致');
          } else if (authorMatch >= 60 || titleMatch >= 60) {
            // 内容匹配度中等
            aiReviewResult.aiReview.confidence += 0.1;
            aiReviewResult.aiReview.reasons.push('内容匹配度中等，需要人工复核');
            aiReviewResult.aiReview.riskLevel = 'medium';
          } else {
            // 内容匹配度较低
            aiReviewResult.aiReview.passed = false;
            aiReviewResult.aiReview.confidence *= 0.3;
            aiReviewResult.aiReview.reasons.push('内容匹配度较低，疑似刷单行为');
            aiReviewResult.aiReview.riskLevel = 'high';
          }
        } else {
          console.log('⚠️ 内容解析失败或无内容:', contentResult.reason);
          // 无法解析内容，严格审核
          aiReviewResult.aiReview.passed = false;
          aiReviewResult.aiReview.confidence = 0.1;
          aiReviewResult.aiReview.reasons.push('无法验证笔记内容，疑似无效链接');
          aiReviewResult.aiReview.riskLevel = 'high';
        }
      } else if (imageType === 'comment' && commentContent) {
        // 评论类型：使用浏览器自动化验证评论真实性
        console.log('🔍 开始验证评论内容和真实性...');

        // 评论内容长度检查
        if (commentContent.length < 5) {
          aiReviewResult.aiReview.passed = false;
          aiReviewResult.aiReview.confidence = 0.3;
          aiReviewResult.aiReview.reasons.push('评论内容过短，疑似无效评论');
          aiReviewResult.aiReview.riskLevel = 'high';
        } else if (commentContent.length > 200) {
          aiReviewResult.aiReview.confidence += 0.1;
          aiReviewResult.aiReview.reasons.push('评论内容详细，质量较高');
        } else {
          aiReviewResult.aiReview.confidence += 0.05;
          aiReviewResult.aiReview.reasons.push('评论内容长度适中');
        }

        // 检查是否包含关键词（可选的额外验证）
        const positiveKeywords = ['好', '不错', '喜欢', '支持', '棒'];
        const hasPositiveWords = positiveKeywords.some(word => commentContent.includes(word));

        if (hasPositiveWords) {
          aiReviewResult.aiReview.confidence += 0.1;
          aiReviewResult.aiReview.reasons.push('评论包含正面评价');
        }

        // 检查是否重复内容（简单的重复检测）
        const words = commentContent.split('');
        const uniqueWords = new Set(words);
        const repetitionRatio = uniqueWords.size / words.length;

        if (repetitionRatio < 0.3) {
          aiReviewResult.aiReview.passed = false;
          aiReviewResult.aiReview.confidence *= 0.5;
          aiReviewResult.aiReview.reasons.push('评论内容重复度过高，疑似刷单');
          aiReviewResult.aiReview.riskLevel = 'high';
        }

        // **新增**: 浏览器自动化评论验证
        console.log('🔍 开始验证评论是否真实存在...');
        try {
          // 从环境变量获取Cookie
          const cookieString = process.env.XIAOHONGSHU_COOKIE;
          console.log('🍪 Cookie配置状态:', {
            exists: !!cookieString,
            length: cookieString ? cookieString.length : 0
          });

          const commentVerification = await xiaohongshuService.performCommentAIReview(
            noteUrl,
            commentContent,
            null, // 评论验证不需要作者信息，因为我们只验证评论内容是否存在
            cookieString // 传递Cookie用于登录状态
          );

          if (commentVerification.error) {
            // 验证服务出错，不直接影响审核结果，但降低信心度
            aiReviewResult.aiReview.confidence *= 0.8;
            aiReviewResult.aiReview.reasons.push('评论验证服务暂时不可用，使用基础审核');
          } else if (commentVerification.passed) {
            aiReviewResult.aiReview.confidence += 0.15;
            aiReviewResult.aiReview.reasons.push('评论验证通过，确认真实存在');
          } else {
            aiReviewResult.aiReview.passed = false;
            aiReviewResult.aiReview.confidence = Math.min(aiReviewResult.aiReview.confidence, 0.3);
            aiReviewResult.aiReview.reasons.push(`评论验证失败: ${commentVerification.reasons.join(', ')}`);
            aiReviewResult.aiReview.riskLevel = 'high';
          }

          // 评论验证结果已经包含在aiReviewResult中

        } catch (verificationError) {
          console.error('评论验证过程出错:', verificationError);
          // 验证失败不影响整体审核，但记录错误
          aiReviewResult.aiReview.confidence *= 0.9;
          aiReviewResult.aiReview.reasons.push('评论验证过程出错，使用基础审核');
        }
      }

      console.log('🤖 最终AI审核结果:', aiReviewResult);
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
        userNoteInfo: ((imageType === 'note' && noteAuthor && noteTitle) || (imageType === 'comment' && commentContent) || (imageType === 'customer_resource' && (customerPhone || customerWechat))) ? {
          author: noteAuthor && noteAuthor.trim() ? noteAuthor.trim() : null,
          title: noteTitle && noteTitle.trim() ? noteTitle.trim() : null,
          comment: commentContent && commentContent.trim() ? commentContent.trim() : null,
          customerPhone: customerPhone && customerPhone.trim() ? customerPhone.trim() : null,
          customerWechat: customerWechat && customerWechat.trim() ? customerWechat.trim() : null
        } : null,
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
        }
      }

      // 如果AI审核通过且信心度足够高，直接设置为完成状态
      if (aiReviewResult && aiReviewResult.aiReview && aiReviewResult.aiReview.passed && aiReviewResult.aiReview.confidence >= 0.9) {
        console.log('🎉 AI审核通过，自动完成审核');

        // 更新审核记录为完成状态
        reviewData.status = 'completed';
        reviewData.financeProcess = {
          amount: taskConfig.price,
          commission: 0,
          processedAt: new Date()
        };

        // 添加AI审核历史
        reviewData.auditHistory.push({
          operator: null, // AI审核
          operatorName: 'AI审核系统',
          action: 'ai_auto_approved',
          comment: `AI自动审核通过 (信心度: ${(aiReviewResult.aiReview.confidence * 100).toFixed(1)}%)`,
          timestamp: new Date()
        });

        // 如果是笔记类型，启用持续存在性检查（评论不需要定时检查）
        if (imageType === 'note') {
          // 计算第一次检查时间：创建时间 + 24小时
          const firstCheckTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
          reviewData.continuousCheck = {
            enabled: true,
            status: 'active',
            nextCheckTime: firstCheckTime
          };
          console.log(`⏰ 已为笔记启用持续存在性检查，首次检查时间: ${firstCheckTime.toLocaleString()}`);
        }
      }

      const review = await new ImageReview(reviewData).save();

      // 如果是AI自动审核通过的，需要更新用户积分
      if (reviewData.status === 'completed') {
        const user = await require('../models/User').findById(req.user._id);
        if (user) {
          user.points += taskConfig.price;
          user.totalEarnings += taskConfig.price;
          await user.save();
          console.log(`💰 用户 ${user.username} 获得 ${taskConfig.price} 积分`);
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

module.exports = router;