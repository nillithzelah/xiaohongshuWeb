const express = require('express');
const crypto = require('crypto');
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

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

// 获取用户信息
router.get('/user/me', authenticateToken, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id)
      .populate('parent_id', 'username')
      .select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        openid: user.openid,
        username: user.username,
        avatar: user.avatar,
        wallet: user.wallet,
        parent: user.parent_id,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
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
    const { deviceId, imageType, imageUrls, imageMd5s, noteUrl } = req.body;

    // 验证参数
    if (!deviceId || !imageType || !imageUrls || !imageMd5s) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    // 验证笔记链接（笔记必填，评论选填）
    if (imageType === 'note' && (!noteUrl || noteUrl.trim() === '')) {
      return res.status(400).json({ success: false, message: '笔记类型必须填写小红书笔记链接' });
    }

    // 如果提供了链接，验证格式
    if (noteUrl && noteUrl.trim() !== '') {
      const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/.+/i;
      if (!xiaohongshuUrlPattern.test(noteUrl)) {
        return res.status(400).json({ success: false, message: '小红书笔记链接格式不正确' });
      }
    }

    if (imageUrls.length !== imageMd5s.length) {
      return res.status(400).json({ success: false, message: '图片和MD5数量不匹配' });
    }

    if (imageUrls.length === 0 || imageUrls.length > 9) {
      return res.status(400).json({ success: false, message: '图片数量必须在1-9张之间' });
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

    // 检查MD5重复（批量检查，兼容新格式）
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

    // 批量创建审核记录（使用新的多图格式）
    const reviews = await Promise.all(imageUrls.map((url, index) => {
      const reviewData = {
        userId: req.user._id,
        imageUrls: [url], // 多图格式：单图也存储为数组
        imageType: imageType,
        imageMd5s: [imageMd5s[index]], // 多图MD5格式：单MD5也存储为数组
        noteUrl: noteUrl && noteUrl.trim() ? noteUrl.trim() : null, // 直接在数据中包含noteUrl
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
          comment: '用户批量提交任务'
        }]
      };

      return new ImageReview(reviewData).save();
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