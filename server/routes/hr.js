const express = require('express');
const User = require('../models/User');
const Device = require('../models/Device');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 创建线索（HR创建潜在客户）
router.post('/create-lead', authenticateToken, requireRole(['hr', 'boss']), async (req, res) => {
  try {
    const { nickname, phone, wechat, notes, xiaohongshuAccounts } = req.body;

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

    // 验证小红书账号数据
    if (!xiaohongshuAccounts || !Array.isArray(xiaohongshuAccounts) || xiaohongshuAccounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: '至少需要提供一个小红书账号信息'
      });
    }

    // 验证每个账号的完整性
    for (const account of xiaohongshuAccounts) {
      if (!account.account || !account.nickname) {
        return res.status(400).json({
          success: false,
          message: '每个小红书账号必须包含账号名和昵称'
        });
      }
    }

    // 为每个小红书账号创建设备记录
    // 注意：phone 是客户联系电话，xiaohongshuAccounts[].account 才是小红书账号
    const devices = [];
    for (const account of xiaohongshuAccounts) {
      // 检查设备是否已存在（按小红书昵称查询）
      const existingDevice = await Device.findOne({ accountName: account.nickname.trim() });
      if (existingDevice) {
        // 设备已存在，只记录ID
        devices.push(existingDevice._id);
      } else {
        // 创建设备 - accountName 使用小红书昵称
        const device = new Device({
          accountName: account.nickname.trim(),  // 小红书昵称
          accountId: account.account.trim(),     // 小红书账号ID
          assignedUser: null,
          status: 'online',
          influence: ['new'], // 默认新号
          createdBy: req.user._id
        });
        await device.save();
        devices.push(device._id);
      }
    }

    // 创建线索用户
    const leadUser = new User({
      username, // 使用客户姓名作为用户名，如果重复则添加数字后缀
      nickname,
      phone,
      wechat,
      notes,
      role: 'part_time', // 关键：设置为兼职用户状态
      training_status: '已筛选', // 默认培训状态
      hr_id: req.user._id, // 记录是哪个HR创建的
      xiaohongshuAccounts: xiaohongshuAccounts.map((account, index) => ({
        account: account.account.trim(),
        nickname: account.nickname.trim(),
        status: 'pending',
        deviceId: devices[index] // 关联设备ID
      }))
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
router.get('/my-leads', authenticateToken, requireRole(['hr', 'boss', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    let query = {
      role: 'part_time', // 只查询兼职用户（线索）
      is_deleted: { $ne: true }
    };

    // HR只能看到自己创建的线索，主管和老板可以看到所有线索
    if (req.user.role === 'hr') {
      query.hr_id = req.user.id;
    }

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
        _id: lead._id,
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

// 删除线索（软删除）
router.delete('/delete-lead/:id', authenticateToken, requireRole(['hr', 'boss', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;

    // 查找线索
    const lead = await User.findById(id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: '线索不存在'
      });
    }

    // 权限检查：HR只能删除自己创建的线索，主管和老板可以删除所有线索
    if (req.user.role === 'hr' && lead.hr_id && lead.hr_id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权删除此线索'
      });
    }

    // 检查是否已分配给带教老师，如果已分配则不能删除
    if (lead.mentor_id) {
      return res.status(400).json({
        success: false,
        message: '已分配给带教老师的线索不能删除'
      });
    }

    // 软删除：设置is_deleted字段
    lead.is_deleted = true;
    lead.deleted_at = new Date();
    lead.deleted_by = req.user._id;

    await lead.save();

    res.json({
      success: true,
      message: '线索删除成功'
    });

  } catch (error) {
    console.error('删除线索错误:', error);
    res.status(500).json({
      success: false,
      message: '删除线索失败'
    });
  }
});

module.exports = router;