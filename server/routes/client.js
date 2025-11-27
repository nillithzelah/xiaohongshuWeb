const express = require('express');
const crypto = require('crypto');
const Submission = require('../models/Submission');
const TaskConfig = require('../models/TaskConfig');
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

// 上传图片并计算MD5
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    // 这里应该处理文件上传，暂时模拟
    // 实际实现需要multer处理文件
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ success: false, message: '没有图片数据' });
    }

    // 计算MD5
    const md5 = crypto.createHash('md5').update(imageData).digest('hex');

    // 模拟上传到OSS
    const imageUrl = `https://oss.example.com/images/${Date.now()}_${md5}.jpg`;

    res.json({
      success: true,
      imageUrl,
      md5
    });

  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

// 提交任务
router.post('/task/submit', authenticateToken, async (req, res) => {
  try {
    const { taskType, imageUrl, imageMd5 } = req.body;

    if (!taskType || !imageUrl || !imageMd5) {
      return res.status(400).json({ success: false, message: '参数不完整' });
    }

    // 检查任务类型是否存在且激活
    const taskConfig = await TaskConfig.findOne({ type_key: taskType, is_active: true });
    if (!taskConfig) {
      return res.status(400).json({ success: false, message: '无效的任务类型' });
    }

    // MD5去重检查：查找相同MD5且状态不为-1（驳回）的记录
    const existingSubmission = await Submission.findOne({
      image_md5: imageMd5,
      status: { $ne: -1 }
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: '该图片已被使用，请勿重复提交'
      });
    }

    // 创建提交记录，使用快照价格
    const submission = new Submission({
      user_id: req.user._id,
      task_type: taskType,
      image_url: imageUrl,
      image_md5: imageMd5,
      snapshot_price: taskConfig.price,
      snapshot_commission: taskConfig.commission,
      audit_history: [{
        operator_id: req.user._id,
        action: 'submit',
        comment: '用户提交任务'
      }]
    });

    await submission.save();

    res.json({
      success: true,
      message: '任务提交成功，等待审核',
      submission: {
        id: submission._id,
        task_type: submission.task_type,
        status: submission.status,
        created_at: submission.created_at
      }
    });

  } catch (error) {
    console.error('提交任务错误:', error);
    res.status(500).json({ success: false, message: '提交失败' });
  }
});

// 获取用户任务记录
router.get('/user/tasks', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const submissions = await Submission.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Submission.countDocuments({ user_id: req.user._id });

    res.json({
      success: true,
      submissions,
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
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

module.exports = router;