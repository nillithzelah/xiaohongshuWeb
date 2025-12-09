const express = require('express');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 创建线索（HR创建潜在客户）
router.post('/create-lead', authenticateToken, requireRole(['hr', 'boss']), async (req, res) => {
  try {
    const { nickname, phone, wechat, notes } = req.body;

    // 验证必填字段
    if (!nickname || !phone) {
      return res.status(400).json({
        success: false,
        message: '昵称和手机号为必填项'
      });
    }

    // 检查手机号是否已存在
    const existingUser = await User.findOne({
      phone,
      is_deleted: { $ne: true }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '该手机号已存在'
      });
    }

    // 检查昵称作为用户名是否已存在，如果存在则添加后缀
    let username = nickname;
    let counter = 1;
    while (await User.findOne({ username, is_deleted: { $ne: true } })) {
      username = `${nickname}_${counter}`;
      counter++;
    }

    // 创建线索用户
    const leadUser = new User({
      username, // 使用客户姓名作为用户名，如果重复则添加数字后缀
      nickname,
      phone,
      wechat,
      notes,
      role: 'part_time', // 关键：设置为兼职用户状态
      hr_id: req.user.id // 记录是哪个HR创建的
    });

    await leadUser.save();

    res.json({
      success: true,
      message: '线索创建成功',
      lead: {
        id: leadUser._id,
        nickname: leadUser.nickname,
        phone: leadUser.phone,
        wechat: leadUser.wechat,
        notes: leadUser.notes,
        role: leadUser.role,
        hr_id: leadUser.hr_id,
        createdAt: leadUser.createdAt
      }
    });

  } catch (error) {
    console.error('创建线索错误:', error);
    res.status(500).json({
      success: false,
      message: '创建线索失败'
    });
  }
});

// 获取HR创建的线索列表
router.get('/my-leads', authenticateToken, requireRole(['hr', 'boss']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let query = {
      hr_id: req.user.id,
      is_deleted: { $ne: true }
    };

    // 如果指定状态，添加过滤条件
    if (status) {
      if (status === 'active') {
        query.mentor_id = null; // 还在跟进的线索（未分配带教老师）
      } else if (status === 'assigned') {
        query.mentor_id = { $ne: null }; // 已分配带教老师的线索
      }
    }

    const leads = await User.find(query)
      .populate('mentor_id', 'username nickname') // 关联带教老师信息
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      leads: leads.map(lead => ({
        id: lead._id,
        nickname: lead.nickname,
        phone: lead.phone,
        wechat: lead.wechat,
        notes: lead.notes,
        role: lead.role,
        mentor_id: lead.mentor_id,
        createdAt: lead.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取线索列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取线索列表失败'
    });
  }
});

module.exports = router;