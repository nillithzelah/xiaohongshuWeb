# 小红书审核系统 - 重构技术细节文档

## 📋 技术细节补充

### 1. 路由文件拆分 - 具体实现

#### 1.1 工具函数提取 (utils.js)

```javascript
// server/routes/client/utils.js

/**
 * 计算两个字符串的相似度
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} 相似度百分比 (0-100)
 */
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

/**
 * 计算编辑距离
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 编辑距离
 */
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

/**
 * 验证小红书URL格式
 * @param {string} url - 要验证的URL
 * @returns {boolean} 是否为有效的小红书URL
 */
function isValidXiaohongshuUrl(url) {
  const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)*/i;
  return xiaohongshuUrlPattern.test(url);
}

/**
 * 生成设备虚拟ID
 * @param {string} deviceId - 设备ID
 * @returns {string} 虚拟设备ID
 */
function generateVirtualDeviceId(deviceId) {
  return `virtual_${deviceId}_${Date.now()}`;
}

module.exports = {
  compareStrings,
  levenshteinDistance,
  isValidXiaohongshuUrl,
  generateVirtualDeviceId
};
```

#### 1.2 任务提交路由拆分 (taskSubmission.js)

```javascript
// server/routes/client/taskSubmission.js

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const ImageReview = require('../../models/ImageReview');
const TaskConfig = require('../../models/TaskConfig');
const Device = require('../../models/Device');
const CommentLimit = require('../../models/CommentLimit');
const SubmissionTracker = require('../../models/SubmissionTracker');
const { authenticateToken } = require('../../middleware/auth');
const xiaohongshuService = require('../../services/xiaohongshuService');
const deviceNoteService = require('../../services/deviceNoteService');
const asyncAiReviewService = require('../../services/asyncAiReviewService');
const { isValidXiaohongshuUrl, generateVirtualDeviceId } = require('./utils');

console.log('📋 任务提交路由已加载');

/**
 * 提交单个任务
 */
router.post('/task/submit', authenticateToken, async (req, res) => {
  try {
    const { deviceId, imageType: taskType, image_url: imageUrl, imageMd5 } = req.body;

    // 参数验证
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

    // 设备验证和获取
    const deviceResult = await validateAndGetDevice(deviceId, req.user._id);
    if (!deviceResult.success) {
      return res.status(deviceResult.status).json({
        success: false,
        message: deviceResult.message
      });
    }

    // 任务类型验证
    const taskConfig = await TaskConfig.findOne({ type_key: taskType, is_active: true });
    if (!taskConfig) {
      return res.status(400).json({ success: false, message: '无效的任务类型' });
    }

    // MD5去重检查
    const existingReview = await ImageReview.findOne({
      imageMd5s: imageMd5,
      status: { $ne: 'rejected' }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: '该图片已被使用，请勿重复提交'
      });
    }

    // 创建审核记录
    const review = new ImageReview({
      userId: req.user._id,
      imageUrls: [imageUrl],
      imageType: taskType,
      imageMd5s: [imageMd5],
      snapshotPrice: taskConfig.price,
      snapshotCommission1: taskConfig.commission_1,
      snapshotCommission2: taskConfig.commission_2,
      deviceInfo: {
        accountName: deviceResult.device.accountName,
        status: deviceResult.device.status,
        influence: deviceResult.device.influence
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

/**
 * 批量提交任务
 */
router.post('/tasks/batch-submit', authenticateToken, async (req, res) => {
  try {
    const {
      deviceId = null,
      imageType,
      imageUrls,
      imageMd5s,
      noteUrl,
      noteAuthor,
      noteTitle,
      commentContent,
      customerPhone,
      customerWechat
    } = req.body;

    // 基础参数验证
    if (!imageType) {
      return res.status(400).json({ success: false, message: '参数不完整：缺少任务类型' });
    }

    // 任务类型特定验证
    const validationResult = await validateTaskTypeSpecific(imageType, {
      noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat
    });

    if (!validationResult.success) {
      return res.status(validationResult.status).json({
        success: false,
        message: validationResult.message
      });
    }

    // 设备验证
    const deviceResult = await validateDeviceForBatch(deviceId, req.user._id);
    if (!deviceResult.success) {
      return res.status(deviceResult.status).json({
        success: false,
        message: deviceResult.message
      });
    }

    // 任务配置验证
    const taskConfig = await TaskConfig.findOne({ type_key: imageType, is_active: true });
    if (!taskConfig) {
      return res.status(400).json({ success: false, message: '无效的任务类型' });
    }

    // MD5重复检查
    if (imageMd5s && imageMd5s.length > 0) {
      const existingReviews = await ImageReview.find({
        imageMd5s: { $in: imageMd5s },
        status: { $ne: 'rejected' }
      });

      if (existingReviews.length > 0) {
        const duplicateMd5s = [];
        existingReviews.forEach(review => {
          review.imageMd5s.forEach(existingMd5 => {
            if (imageMd5s.includes(existingMd5)) {
              duplicateMd5s.push(existingMd5);
            }
          });
        });

        return res.status(400).json({
          success: false,
          message: '部分图片已被使用，请勿重复提交',
          duplicates: [...new Set(duplicateMd5s)]
        });
      }
    }

    // 防作弊检查
    if ((imageType === 'note' || imageType === 'comment') && noteUrl && noteAuthor) {
      const antiCheatResult = await checkAntiCheat(noteUrl, noteAuthor);
      if (!antiCheatResult.success) {
        return res.status(antiCheatResult.status).json({
          success: false,
          message: antiCheatResult.message
        });
      }
    }

    // AI审核准备
    let aiReviewResult = null;
    if (imageType === 'note' || imageType === 'comment') {
      const basicValidation = await xiaohongshuService.validateNoteUrl(noteUrl);
      if (!basicValidation.valid) {
        return res.status(400).json({
          success: false,
          message: `链接验证失败：${basicValidation.reason}`,
          aiReview: basicValidation
        });
      }

      aiReviewResult = {
        valid: true,
        noteId: basicValidation.noteId,
        noteStatus: basicValidation.noteStatus,
        aiReview: {
          passed: true,
          confidence: 0.5,
          reasons: ['基础验证通过，等待后台AI审核'],
          riskLevel: 'low'
        }
      };
    }

    // 获取用户mentor信息
    const user = await require('../../models/User').findById(req.user._id);
    let mentorInfo = null;
    if (user && user.mentor_id) {
      mentorInfo = {
        reviewer: user.mentor_id
      };
    }

    // 批量创建审核记录
    const reviews = await Promise.all((imageUrls && imageUrls.length > 0 ? imageUrls : [null]).map(async (url, index) => {
      const reviewData = {
        userId: req.user._id,
        imageUrls: url ? [url] : [],
        imageType: imageType,
        imageMd5s: (imageMd5s && imageMd5s[index]) ? [imageMd5s[index]] : [],
        noteUrl: noteUrl && noteUrl.trim() ? noteUrl.trim() : null,
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
          accountName: deviceResult.device.accountName,
          status: deviceResult.device.status,
          influence: deviceResult.device.influence
        },
        mentorReview: mentorInfo,
        auditHistory: [{
          operator: req.user._id,
          operatorName: req.user.username,
          action: 'submit',
          comment: '用户批量提交任务'
        }]
      };

      // 添加AI审核结果
      if (aiReviewResult && aiReviewResult.aiReview) {
        reviewData.aiReviewResult = aiReviewResult.aiReview;
        if (aiReviewResult.contentMatch) {
          reviewData.aiParsedNoteInfo = {
            author: aiReviewResult.contentMatch.pageAuthor,
            title: aiReviewResult.contentMatch.pageTitle
          };
        }
      }

      const review = await new ImageReview(reviewData).save();

      // 加入AI审核队列
      if ((imageType === 'note' || imageType === 'comment') && review.status === 'pending') {
        try {
          asyncAiReviewService.addToQueue(review._id);
        } catch (queueError) {
          console.error('加入AI审核队列失败:', queueError);
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

/**
 * 验证设备并获取设备信息
 */
async function validateAndGetDevice(deviceId, userId) {
  try {
    // 首先尝试查找真实设备
    if (deviceId.match(/^[0-9a-fA-F]{24}$/)) {
      const device = await Device.findOne({
        _id: deviceId,
        assignedUser: userId,
        is_deleted: { $ne: true }
      });

      if (device) {
        return { success: true, device };
      }
    }

    // 开发环境允许模拟设备
    if (process.env.NODE_ENV !== 'production' && deviceId.startsWith('device_')) {
      const deviceNumber = deviceId.split('_')[1] || '001';
      const device = {
        _id: deviceId,
        accountName: `xiaohongshu_user_${deviceNumber}`,
        status: 'online',
        influence: ['new'],
        assignedUser: userId
      };
      return { success: true, device };
    }

    return { success: false, message: '无效的设备选择', status: 400 };
  } catch (error) {
    console.error('设备验证错误:', error);
    return { success: false, message: '设备验证失败', status: 500 };
  }
}

/**
 * 为批量提交验证设备
 */
async function validateDeviceForBatch(deviceId, userId) {
  if (!deviceId) {
    // 没有设备ID时创建虚拟设备
    const device = {
      _id: generateVirtualDeviceId('batch'),
      accountName: 'virtual_device',
      status: 'online',
      influence: ['new'],
      assignedUser: userId
    };
    return { success: true, device };
  }

  return await validateAndGetDevice(deviceId, userId);
}

/**
 * 验证任务类型特定要求
 */
async function validateTaskTypeSpecific(imageType, params) {
  const { noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat } = params;

  if (imageType === 'note') {
    if (!noteUrl || noteUrl.trim() === '') {
      return { success: false, message: '笔记类型必须填写笔记链接', status: 400 };
    }
    if (!noteAuthor || (Array.isArray(noteAuthor) && noteAuthor.length === 0) || (!Array.isArray(noteAuthor) && noteAuthor.trim() === '')) {
      return { success: false, message: '笔记类型必须填写作者昵称', status: 400 };
    }
    if (!noteTitle || noteTitle.trim() === '') {
      return { success: false, message: '笔记类型必须填写笔记标题', status: 400 };
    }
  } else if (imageType === 'comment') {
    if (!noteUrl || noteUrl.trim() === '') {
      return { success: false, message: '评论类型必须填写链接', status: 400 };
    }
    if (!noteAuthor || (Array.isArray(noteAuthor) && noteAuthor.length === 0) || (!Array.isArray(noteAuthor) && noteAuthor.trim() === '')) {
      return { success: false, message: '评论类型必须填写作者昵称', status: 400 };
    }
    if (!commentContent || commentContent.trim() === '') {
      return { success: false, message: '评论类型必须填写评论内容', status: 400 };
    }
  } else if (imageType === 'customer_resource') {
    const hasPhone = customerPhone && customerPhone.trim() !== '';
    const hasWechat = customerWechat && customerWechat.trim() !== '';

    if (!hasPhone && !hasWechat) {
      return { success: false, message: '客资类型必须填写客户电话或微信号', status: 400 };
    }
  }

  // URL格式验证
  if (noteUrl && noteUrl.trim() !== '') {
    if (!isValidXiaohongshuUrl(noteUrl)) {
      return { success: false, message: '笔记链接格式不正确', status: 400 };
    }
  }

  return { success: true };
}

/**
 * 防作弊检查
 */
async function checkAntiCheat(noteUrl, noteAuthor) {
  console.log('🛡️ 开始防作弊检查：昵称提交次数限制');

  const nicknames = Array.isArray(noteAuthor) ? noteAuthor : [noteAuthor];
  const validNicknames = nicknames.filter(n => n && typeof n === 'string' && n.trim());

  for (const nickname of validNicknames) {
    const tracker = await SubmissionTracker.findOne({
      noteUrl: noteUrl.trim(),
      nickname: nickname.trim()
    });

    if (tracker && tracker.count >= 2) {
      return {
        success: false,
        message: `违规提示：昵称 "${nickname.trim()}" 在该笔记下已提交过 ${tracker.count} 次，禁止再次提交！`,
        status: 403
      };
    }
  }

  console.log('✅ 防作弊检查通过');
  return { success: true };
}

module.exports = router;
```

#### 1.3 图片上传路由拆分 (imageUpload.js)

```javascript
// server/routes/client/imageUpload.js

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');

console.log('📋 图片上传路由已加载');

/**
 * 上传图片并计算MD5
 */
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, message: '没有图片数据' });
    }

    // 计算MD5
    const md5 = crypto.createHash('md5').update(imageData).digest('hex');

    // 检查OSS配置
    const ossConfig = checkOSSConfig();
    if (!ossConfig.hasKeys) {
      console.log('❌ OSS Key缺失，无法上传');
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
    console.log('📦 数据长度:', imageData.length);

    const result = await client.put(filename, Buffer.from(imageData, 'base64'));
    console.log('✅ OSS上传成功');

    // 返回HTTPS URL
    const httpsUrl = result.url.replace('http://', 'https://');

    res.json({
      success: true,
      imageUrl: httpsUrl,
      md5
    });

  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

/**
 * 检查OSS配置
 */
function checkOSSConfig() {
  const hasKeys = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET;

  console.log('🔑 OSS环境变量检查:', {
    OSS_ACCESS_KEY_ID: process.env.OSS_ACCESS_KEY_ID ? '***REDACTED***' : 'MISSING',
    OSS_ACCESS_KEY_SECRET: process.env.OSS_ACCESS_KEY_SECRET ? '***REDACTED***' : 'MISSING',
    OSS_BUCKET: process.env.OSS_BUCKET,
    OSS_REGION: process.env.OSS_REGION
  });

  return {
    hasKeys,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION
  };
}

module.exports = router;
```

#### 1.4 用户查询路由拆分 (userQueries.js)

```javascript
// server/routes/client/userQueries.js

const express = require('express');
const router = express.Router();
const ImageReview = require('../../models/ImageReview');
const Device = require('../../models/Device');
const { authenticateToken } = require('../../middleware/auth');

console.log('📋 用户查询路由已加载');

/**
 * 获取任务配置（显示给用户）
 */
router.get('/task-configs', async (req, res) => {
  try {
    const TaskConfig = require('../../models/TaskConfig');
    const configs = await TaskConfig.find({ is_active: true })
      .select('type_key name price commission_1 commission_2 daily_reward_points continuous_check_days')
      .sort({ type_key: 1 });

    // 确保所有字段都被正确返回
    const processedConfigs = configs.map(config => {
      const configObj = config.toObject();
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
 * 获取用户任务记录
 */
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

/**
 * 获取用户被分配的设备列表
 */
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

/**
 * 获取系统公告
 */
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

module.exports = router;
```

#### 1.5 主路由整合文件 (index.js)

```javascript
// server/routes/client/index.js

const express = require('express');
const router = express.Router();

// 导入子路由模块
const taskSubmissionRoutes = require('./taskSubmission');
const imageUploadRoutes = require('./imageUpload');
const userQueriesRoutes = require('./userQueries');
const batchOperationsRoutes = require('./batchOperations');

// 注册子路由
router.use('/', taskSubmissionRoutes);
router.use('/', imageUploadRoutes);
router.use('/', userQueriesRoutes);
router.use('/', batchOperationsRoutes);

console.log('📋 客户端路由整合完成');

module.exports = router;
```

### 2. 前端组件拆分 - 具体实现

#### 2.1 工具函数和常量 (utils/)

```javascript
// admin/src/pages/ReviewList/utils/constants.js

// 状态颜色映射
export const STATUS_COLORS = {
  pending: 'orange',
  mentor_approved: 'blue',
  manager_rejected: 'orange',
  manager_approved: 'purple',
  finance_processing: 'cyan',
  completed: 'green',
  rejected: 'red'
};

// 状态文本映射
export const STATUS_TEXTS = {
  pending: '待审核',
  mentor_approved: '待主管确认',
  manager_rejected: '主管驳回重审',
  manager_approved: '待财务处理',
  finance_processing: '财务处理中',
  completed: '已完成',
  rejected: '已拒绝'
};

// 任务类型映射
export const IMAGE_TYPE_TEXTS = {
  customer_resource: '客资',
  note: '笔记',
  comment: '评论'
};

// 操作颜色映射
export const ACTION_COLORS = {
  submit: '#1890ff',
  mentor_pass: '#52c41a',
  mentor_reject: '#ff4d4f',
  manager_approve: '#52c41a',
  manager_reject: '#ff4d4f',
  finance_process: '#fa8c16'
};

// 操作文本映射
export const ACTION_TEXTS = {
  submit: '提交审核',
  mentor_pass: '带教老师通过',
  mentor_reject: '带教老师驳回',
  manager_approve: '主管确认',
  manager_reject: '主管驳回',
  finance_process: '财务处理'
};

// 时间线颜色映射
export const TIMELINE_COLORS = {
  submit: 'blue',
  mentor_pass: 'green',
  mentor_reject: 'red',
  manager_approve: 'green',
  manager_reject: 'red',
  finance_process: 'orange'
};

// 设备状态映射
export const DEVICE_STATUS_TEXTS = {
  online: '在线',
  offline: '离线',
  protected: '保护',
  frozen: '冻结'
};

// 设备影响力映射
export const DEVICE_INFLUENCE_TEXTS = {
  new: '新号',
  old: '老号',
  real_name: '实名',
  opened_shop: '开店'
};
```

```javascript
// admin/src/pages/ReviewList/utils/reviewUtils.js

import { STATUS_COLORS, STATUS_TEXTS, IMAGE_TYPE_TEXTS, ACTION_COLORS, ACTION_TEXTS, TIMELINE_COLORS, DEVICE_STATUS_TEXTS, DEVICE_INFLUENCE_TEXTS } from './constants';

/**
 * 获取状态颜色
 */
export const getStatusColor = (status) => {
  return STATUS_COLORS[status] || 'default';
};

/**
 * 获取状态文本
 */
export const getStatusText = (status) => {
  return STATUS_TEXTS[status] || status;
};

/**
 * 获取任务类型文本
 */
export const getImageTypeText = (type) => {
  return IMAGE_TYPE_TEXTS[type] || type;
};

/**
 * 获取操作颜色
 */
export const getActionColor = (action) => {
  return ACTION_COLORS[action] || '#d9d9d9';
};

/**
 * 获取操作文本
 */
export const getActionText = (action) => {
  return ACTION_TEXTS[action] || action;
};

/**
 * 获取时间线颜色
 */
export const getTimelineColor = (action) => {
  return TIMELINE_COLORS[action] || 'gray';
};

/**
 * 获取设备状态文本
 */
export const getDeviceStatusText = (status) => {
  return DEVICE_STATUS_TEXTS[status] || status;
};

/**
 * 获取设备影响力文本
 */
export const getDeviceInfluenceText = (influence) => {
  return DEVICE_INFLUENCE_TEXTS[influence] || influence;
};

/**
 * 获取匹配颜色
 */
export const getMatchColor = (matchPercentage) => {
  if (matchPercentage >= 80) return '#52c41a'; // 绿色 - 高匹配
  if (matchPercentage >= 60) return '#fa8c16'; // 橙色 - 中等匹配
  return '#ff4d4f'; // 红色 - 低匹配
};

/**
 * 获取状态标签
 */
export const getStatusTag = (status, record) => {
  const statusConfig = {
    pending: { color: 'gold', text: record?.managerApproval ? '主管驳回重审' : '待审核' },
    mentor_approved: { color: 'blue', text: '待主管确认' },
    manager_rejected: { color: 'orange', text: '主管驳回重审' },
    manager_approved: { color: 'purple', text: '待财务处理' },
    finance_processing: { color: 'cyan', text: '财务处理中' },
    completed: { color: 'green', text: '已完成' },
    rejected: { color: 'red', text: '已拒绝' }
  };

  const config = statusConfig[status] || { color: 'default', text: status };
  return config;
};

/**
 * 格式化日期时间
 */
export const formatDateTime = (date) => {
  if (!date) return '未知时间';
  try {
    return new Date(date).toLocaleString('zh-CN');
  } catch (error) {
    return '时间格式错误';
  }
};

/**
 * 处理图片URL兼容性
 */
export const processImageUrls = (record) => {
  // 兼容旧数据格式和迁移后的数据
  let urls = [];

  if (record.imageUrls && Array.isArray(record.imageUrls)) {
    // 新格式：过滤掉null/undefined值
    urls = record.imageUrls.filter(url => url && typeof url === 'string' && url.trim());
  } else if (record.imageUrl && typeof record.imageUrl === 'string' && record.imageUrl.trim()) {
    // 旧格式：单图
    urls = [record.imageUrl];
  }

  return urls;
};
```

#### 2.2 自定义Hooks (hooks/)

```javascript
// admin/src/pages/ReviewList/hooks/useReviewData.js

import { useState, useEffect } from 'react';
import axios from 'axios';
import { message } from 'antd';

/**
 * 审核数据管理Hook
 */
export const useReviewData = (filters, pagination) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      // 添加筛选条件
      if (filters.status) params.status = filters.status;
      if (filters.userId) params.userId = filters.userId;
      if (filters.imageType) params.imageType = filters.imageType;
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.reviewer) params.reviewer = filters.reviewer;
      if (filters.deviceName) params.deviceName = filters.deviceName;

      const response = await axios.get('/reviews', { params });

      // 对审核列表进行排序：当前用户负责的待审核任务排在前面
      let sortedReviews = [...response.data.reviews];

      // 排序逻辑（根据用户角色）
      sortedReviews = sortReviewsByPriority(sortedReviews, filters);

      setReviews(sortedReviews);
      setTotal(response.data.pagination.total);
    } catch (error) {
      message.error('获取审核列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据用户角色和任务状态进行排序
  const sortReviewsByPriority = (reviews, filters) => {
    // 这里实现排序逻辑
    return reviews.sort((a, b) => {
      // 优先级排序逻辑
      const aIsMine = isHighPriorityTask(a, filters);
      const bIsMine = isHighPriorityTask(b, filters);

      if (aIsMine && !bIsMine) return -1;
      if (!aIsMine && bIsMine) return 1;
      return 0;
    });
  };

  // 判断是否为高优先级任务
  const isHighPriorityTask = (review, filters) => {
    // 根据用户角色和任务状态判断优先级
    // 实现具体的优先级判断逻辑
    return false;
  };

  useEffect(() => {
    fetchReviews();
  }, [filters, pagination]);

  return {
    reviews,
    loading,
    total,
    fetchReviews,
    setReviews
  };
};
```

```javascript
// admin/src/pages/ReviewList/hooks/useSearchFilters.js

import { useState } from 'react';

/**
 * 搜索筛选管理Hook
 */
export const useSearchFilters = () => {
  const [filters, setFilters] = useState({
    status: undefined,
    userId: undefined,
    imageType: undefined,
    keyword: '',
    reviewer: undefined,
    deviceName: ''
  });

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10
  });

  const handleSearch = (values) => {
    setFilters({
      status: values.status,
      userId: values.userId,
      imageType: values.imageType,
      keyword: values.keyword,
      reviewer: values.reviewer,
      deviceName: values.deviceName
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleReset = () => {
    setFilters({
      status: undefined,
      userId: undefined,
      imageType: undefined,
      keyword: '',
      reviewer: undefined,
      deviceName: ''
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const updatePagination = (newPagination) => {
    setPagination(newPagination);
  };

  return {
    filters,
    pagination,
    handleSearch,
    handleReset,
    updatePagination
  };
};
```

#### 2.3 表格组件 (components/ReviewTable.js)

```javascript
// admin/src/pages/ReviewList/components/ReviewTable.js

import React from 'react';
import { Table, Tag, Button, Image, Space } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import {
  getStatusTag,
  getImageTypeText,
  processImageUrls,
  getDeviceStatusText,
  getDeviceInfluenceText,
  formatDateTime
} from '../utils/reviewUtils';

const ReviewTable = ({
  reviews,
  loading,
  pagination,
  onPaginationChange,
  rowSelection,
  onReview,
  onViewHistory
}) => {

  const columns = [
    {
      title: '用户ID',
      dataIndex: ['userId', '_id'],
      key: 'userId',
      width: 100,
      render: (userId) => userId || '-'
    },
    {
      title: '昵称',
      dataIndex: ['userId', 'nickname'],
      key: 'nickname',
      render: (nickname, record) => nickname || record.userId?.username || '-'
    },
    {
      title: '图片',
      dataIndex: 'imageUrls',
      key: 'imageUrls',
      width: 120,
      render: (imageUrls, record) => {
        const urls = processImageUrls(record);

        if (!urls || urls.length === 0) {
          return <span style={{ color: '#999' }}>无图片</span>;
        }

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
            {urls.slice(0, 4).map((url, index) => (
              <Image
                key={index}
                width={25}
                height={25}
                src={url}
                alt={`图片${index + 1}`}
                style={{
                  objectFit: 'cover',
                  borderRadius: '2px',
                  border: '1px solid #d9d9d9'
                }}
                preview={{
                  src: url,
                  mask: `${index + 1}/${urls.length}`
                }}
                placeholder={
                  <div style={{
                    width: 25,
                    height: 25,
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px'
                  }}>
                    加载中...
                  </div>
                }
              />
            ))}
            {urls.length > 4 && (
              <div style={{
                width: 25,
                height: 25,
                backgroundColor: '#f0f0f0',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#666',
                border: '1px solid #d9d9d9'
              }}>
                +{urls.length - 4}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '设备号',
      dataIndex: 'deviceInfo',
      key: 'deviceInfo',
      render: (deviceInfo, record) => {
        if (!deviceInfo) {
          return (
            <div>
              <div style={{ color: '#999' }}>未分配设备</div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                用户: {record.userId?.nickname || record.userId?.username || '未知'}
              </div>
            </div>
          );
        }
        return (
          <div>
            <div>{deviceInfo.accountName}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {getDeviceStatusText(deviceInfo.status)} | {getDeviceInfluenceText(deviceInfo.influence)}
            </div>
          </div>
        );
      }
    },
    {
      title: '带教老师',
      dataIndex: 'mentorReview',
      key: 'mentorReviewer',
      render: (mentorReview) => {
        if (!mentorReview || !mentorReview.reviewer) return '--';
        return mentorReview.reviewer.nickname || mentorReview.reviewer.username;
      }
    },
    {
      title: '任务类型',
      dataIndex: 'imageType',
      key: 'imageType',
      render: getImageTypeText
    },
    {
      title: '作者',
      dataIndex: 'userNoteInfo',
      key: 'noteAuthor',
      render: (userNoteInfo, record) => {
        if (record.imageType !== 'note' && record.imageType !== 'comment') {
          return '--';
        }

        if (!userNoteInfo || !userNoteInfo.author) {
          return <span style={{ color: '#999' }}>未填写</span>;
        }

        return (
          <span
            style={{
              maxWidth: '120px',
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={userNoteInfo.author}
          >
            {userNoteInfo.author}
          </span>
        );
      }
    },
    {
      title:'笔记标题/评论/客资信息',
      dataIndex: 'userNoteInfo',
      key: 'noteTitle',
      render: (userNoteInfo, record) => {
        // 客资类型单独处理
        if (record.imageType === 'customer_resource') {
          const customerInfo = [];
          if (userNoteInfo?.customerPhone) {
            customerInfo.push(`📞${userNoteInfo.customerPhone}`);
          }
          if (userNoteInfo?.customerWechat) {
            customerInfo.push(`💬${userNoteInfo.customerWechat}`);
          }

          if (customerInfo.length === 0) {
            return <span style={{ color: '#999' }}>未填写</span>;
          }

          return (
            <div
              style={{
                maxWidth: '200px',
                wordBreak: 'break-word',
                lineHeight: '1.4'
              }}
              title={customerInfo.join(' ')}
            >
              <div style={{
                fontSize: '12px',
                color: '#fa8c16',
                fontWeight: '500'
              }}>
                {customerInfo.join(' ')}
              </div>
            </div>
          );
        }

        // 笔记和评论类型
        if (record.imageType !== 'note' && record.imageType !== 'comment') {
          return '--';
        }

        const content = record.imageType === 'comment'
          ? (userNoteInfo?.comment || null)
          : (userNoteInfo?.title || null);

        const customerInfo = [];
        if (userNoteInfo?.customerPhone) {
          customerInfo.push(`📞${userNoteInfo.customerPhone}`);
        }
        if (userNoteInfo?.customerWechat) {
          customerInfo.push(`💬${userNoteInfo.customerWechat}`);
        }

        const fullContent = content || '';
        const customerText = customerInfo.length > 0 ? ` [${customerInfo.join(' ')}]` : '';

        if (!fullContent && customerInfo.length === 0) {
          return <span style={{ color: '#999' }}>未填写</span>;
        }

        return (
          <div
            style={{
              maxWidth: '200px',
              wordBreak: 'break-word',
              lineHeight: '1.4'
            }}
            title={`${fullContent}${customerText}`}
          >
            {fullContent && (
              <div style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: customerInfo.length > 0 ? '2px' : '0'
              }}>
                {fullContent}
              </div>
            )}
            {customerInfo.length > 0 && (
              <div style={{
                fontSize: '12px',
                color: '#fa8c16',
                fontWeight: '500'
              }}>
                {customerInfo.join(' ')}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '小红书链接',
      dataIndex: 'noteUrl',
      key: 'noteUrl',
      render: (noteUrl, record) => {
        if (record.imageType !== 'note' && record.imageType !== 'comment') {
          return '--';
        }

        if (!noteUrl) {
          return <span style={{ color: '#999' }}>未填写</span>;
        }

        return (
          <a
            href={noteUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#1890ff',
              textDecoration: 'none',
              maxWidth: '200px',
              display: 'inline-block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={noteUrl}
            onClick={(e) => e.stopPropagation()}
          >
            查看链接
          </a>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record)
    },
    {
      title: '快照价格',
      dataIndex: 'snapshotPrice',
      key: 'snapshotPrice',
      render: (price) => {
        const numPrice = Number(price) || 0;
        return `${numPrice}`;
      }
    },
    {
      title: '佣金明细',
      key: 'commissionDetail',
      render: (_, record) => {
        const commission1 = Number(record.snapshotCommission1) || 0;
        const commission2 = Number(record.snapshotCommission2) || 0;

        if (commission1 > 0 || commission2 > 0) {
          const details = [];
          if (commission1 > 0) details.push(`一级: ${commission1}`);
          if (commission2 > 0) details.push(`二级: ${commission2}`);
          return details.join(' | ');
        }
        return '-';
      }
    },
    {
      title: '驳回原因',
      dataIndex: 'rejectionReason',
      key: 'rejectionReason',
      render: (reason) => {
        if (!reason) return '--';
        return (
          <div style={{
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
          title={reason}
          >
            {reason}
          </div>
        );
      }
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: formatDateTime
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => onViewHistory(record)}
        >
          查看详情
        </Button>
      )
    }
  ];

  return (
    <Table
      columns={columns}
      dataSource={reviews}
      rowKey="_id"
      loading={loading}
      rowSelection={rowSelection}
      pagination={{
        ...pagination,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
      }}
      onChange={onPaginationChange}
    />
  );
};

export default ReviewTable;
```

### 3. 测试策略补充

#### 3.1 单元测试示例

```javascript
// tests/routes/client/taskSubmission.test.js

const request = require('supertest');
const express = require('express');
const taskSubmissionRoutes = require('../../../server/routes/client/taskSubmission');
const ImageReview = require('../../../server/models/ImageReview');

// Mock 依赖
jest.mock('../../../server/models/ImageReview');
jest.mock('../../../server/models/TaskConfig');
jest.mock('../../../server/services/xiaohongshuService');

const app = express();
app.use(express.json());
app.use('/task-submission', taskSubmissionRoutes);

describe('Task Submission Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /task-submission/task/submit', () => {
    it('should submit task successfully', async () => {
      // Mock 数据
      const mockTaskConfig = {
        _id: 'task123',
        type_key: 'note',
        price: 10,
        commission_1: 1,
        commission_2: 0.5,
        is_active: true
      };

      const mockReview = {
        _id: 'review123',
        userId: 'user123',
        imageType: 'note',
        status: 'pending',
        createdAt: new Date()
      };

      // 设置mock返回值
      require('../../../server/models/TaskConfig').findOne.mockResolvedValue(mockTaskConfig);
      ImageReview.findOne.mockResolvedValue(null); // 没有重复
      ImageReview.prototype.save.mockResolvedValue(mockReview);

      const response = await request(app)
        .post('/task-submission/task/submit')
        .set('Authorization', 'Bearer valid-token')
        .send({
          deviceId: 'device123',
          imageType: 'note',
          image_url: 'http://example.com/image.jpg',
          imageMd5: 'md5hash123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('任务提交成功，等待审核');
    });

    it('should reject duplicate image MD5', async () => {
      const existingReview = { _id: 'existing123' };
      ImageReview.findOne.mockResolvedValue(existingReview);

      const response = await request(app)
        .post('/task-submission/task/submit')
        .set('Authorization', 'Bearer valid-token')
        .send({
          deviceId: 'device123',
          imageType: 'note',
          image_url: 'http://example.com/image.jpg',
          imageMd5: 'md5hash123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('该图片已被使用');
    });
  });
});
```

#### 3.2 组件测试示例

```javascript
// tests/components/ReviewTable.test.js

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewTable from '../../admin/src/pages/ReviewList/components/ReviewTable';

// Mock antd 组件
jest.mock('antd', () => ({
  Table: ({ columns, dataSource, onChange }) => (
    <div data-testid="table">
      {dataSource.map((item, index) => (
        <div key={item._id} data-testid={`table-row-${index}`}>
          {columns.map(col => (
            <div key={col.key} data-testid={`cell-${col.key}`}>
              {col.render ? col.render(item[col.dataIndex], item) : item[col.dataIndex]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
  Image: ({ src, alt }) => <img src={src} alt={alt} data-testid="image" />,
  Tag: ({ children, color }) => <span data-testid="tag" style={{ color }}>{children}</span>
}));

describe('ReviewTable', () => {
  const mockReviews = [
    {
      _id: 'review1',
      userId: { _id: 'user1', nickname: '测试用户' },
      imageUrls: ['http://example.com/image1.jpg'],
      imageType: 'note',
      status: 'pending',
      createdAt: '2024-01-01T00:00:00Z'
    }
  ];

  const mockProps = {
    reviews: mockReviews,
    loading: false,
    pagination: { current: 1, pageSize: 10 },
    onPaginationChange: jest.fn(),
    rowSelection: null,
    onReview: jest.fn(),
    onViewHistory: jest.fn()
  };

  it('should render review table with data', () => {
    render(<ReviewTable {...mockProps} />);

    expect(screen.getByTestId('table')).toBeInTheDocument();
    expect(screen.getByTestId('table-row-0')).toBeInTheDocument();
    expect(screen.getByText('测试用户')).toBeInTheDocument();
  });

  it('should display status tag correctly', () => {
    render(<ReviewTable {...mockProps} />);

    const statusTag = screen.getByTestId('tag');
    expect(statusTag).toBeInTheDocument();
    expect(statusTag).toHaveTextContent('待审核');
  });

  it('should render image preview', () => {
    render(<ReviewTable {...mockProps} />);

    const image = screen.getByTestId('image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'http://example.com/image1.jpg');
  });
});
```

### 4. 性能优化建议

#### 4.1 代码分割

```javascript
// admin/src/pages/ReviewList/index.js

import React, { Suspense, lazy } from 'react';
import { Spin } from 'antd';

// 懒加载子组件
const ReviewTable = lazy(() => import('./components/ReviewTable'));
const ReviewModal = lazy(() => import('./components/ReviewModal'));
const SearchFilters = lazy(() => import('./components/SearchFilters'));

const ReviewList = () => {
  return (
    <div>
      <Suspense fallback={<Spin size="large" />}>
        <SearchFilters />
        <ReviewTable />
        <ReviewModal />
      </Suspense>
    </div>
  );
};

export default ReviewList;
```

#### 4.2 虚拟滚动优化

```javascript
// 对于大数据表格，使用虚拟滚动
import { Table as VirtualTable } from 'react-window';

const VirtualizedReviewTable = ({ reviews, height = 400 }) => {
  // 实现虚拟化表格逻辑
  // ...
};
```

#### 4.3 API优化

```javascript
// 实现数据分页和缓存
const useReviewDataWithCache = () => {
  const [cache, setCache] = useState(new Map());

  const fetchReviews = async (params) => {
    const cacheKey = JSON.stringify(params);

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const data = await api.fetchReviews(params);
    setCache(prev => new Map(prev).set(cacheKey, data));

    return data;
  };

  return { fetchReviews };
};
```

## 📋 总结

这份技术细节文档提供了：

1. **完整的代码示例**：路由拆分、组件拆分的具体实现
2. **测试策略**：单元测试、组件测试的具体案例
3. **性能优化**：代码分割、虚拟滚动、API缓存的实现方案
4. **最佳实践**：错误处理、数据验证、状态管理的标准做法

这些细节确保了重构方案的可操作性和高质量实施。