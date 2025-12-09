const express = require('express');
const Device = require('../models/Device');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 设备管理权限：mentor, manager, boss 均可访问
const deviceRoles = ['mentor', 'manager', 'boss'];

// 获取设备列表
router.get('/', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, assignedUser, keyword, reviewer } = req.query;
    const skip = (page - 1) * limit;

    let query = {
      isLocked: { $ne: true } // 默认不显示锁定的设备
    };

    // 状态过滤
    if (status) {
      query.status = status;
    }

    // 分配用户过滤
    if (assignedUser) {
      query.assignedUser = assignedUser;
    }

    // 按客服筛选：找到该客服名下的用户，然后筛选这些用户分配的设备
    if (reviewer) {
      const csUsers = await User.find({ managed_by: reviewer }).select('_id');
      const userIds = csUsers.map(user => user._id);
      query.assignedUser = { $in: userIds };
    }

    // 搜索设备账号名
    if (keyword) {
      query.accountName = { $regex: keyword, $options: 'i' };
    }

    const devices = await Device.find(query)
      .populate({
        path: 'assignedUser',
        select: 'username nickname',
        populate: {
          path: 'hr_id',
          select: 'username nickname'
        }
      })
      .populate('createdBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Device.countDocuments(query);

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({ success: false, message: '获取设备列表失败' });
  }
});

// 获取单个设备详情
router.get('/:id', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)
      .populate('assignedUser', 'username nickname')
      .populate('createdBy', 'username nickname');

    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    res.json({ success: true, data: device });
  } catch (error) {
    console.error('获取设备详情失败:', error);
    res.status(500).json({ success: false, message: '获取设备详情失败' });
  }
});

// 创建设备
router.post('/', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const { phone, accountId, accountName, assignedUser, status, influence, onlineDuration, points, remark } = req.body;

    // 验证必填字段
    if (!accountName) {
      return res.status(400).json({ success: false, message: '设备账号名不能为空' });
    }

    // 检查账号名是否已存在
    const existingDevice = await Device.findOne({ accountName });
    if (existingDevice) {
      return res.status(400).json({ success: false, message: '设备账号名已存在' });
    }

    // 字段级权限控制：积分字段
    let deviceData = {
      phone,
      accountId,
      accountName,
      assignedUser,
      status,
      influence,
      onlineDuration,
      remark,
      createdBy: req.user._id
    };

    // 如果是带教老师创建，强制积分设为0，忽略前端传的值
     if (req.user.role === 'mentor') {
       deviceData.points = 0;
     } else {
       // manager 和 boss 可以设置初始积分
       deviceData.points = points || 0;
     }

    const device = new Device(deviceData);
    await device.save();

    // 重新查询以获取关联数据
    const populatedDevice = await Device.findById(device._id)
      .populate({
        path: 'assignedUser',
        select: 'username nickname',
        populate: {
          path: 'hr_id',
          select: 'username nickname'
        }
      })
      .populate('createdBy', 'username nickname');

    res.json({
      success: true,
      message: '设备创建成功',
      data: populatedDevice
    });
  } catch (error) {
    console.error('创建设备失败:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: '设备账号名已存在' });
    } else {
      res.status(500).json({ success: false, message: '创建设备失败' });
    }
  }
});

// 更新设备
router.put('/:id', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const { phone, accountId, accountName, assignedUser, status, influence, onlineDuration, points, remark } = req.body;

    console.log('🔄 更新设备请求:', {
      id: req.params.id,
      body: req.body,
      user: req.user?.username
    });

    // 查找设备
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 准备更新数据
    let updateData = {
      phone,
      accountId,
      accountName,
      assignedUser,
      status,
      influence,
      onlineDuration,
      remark
    };

    // 字段级权限控制：积分字段
     if (req.user.role === 'mentor') {
       // 带教老师更新时，剔除points字段，防止他们修改积分
       // 积分保持原值不变
     } else {
       // manager 和 boss 可以修改积分
       updateData.points = points;
     }

    console.log('📝 准备更新数据:', updateData);

    // 如果要修改账号名，检查是否与其他设备重复
    if (accountName && accountName !== device.accountName) {
      const existingDevice = await Device.findOne({
        accountName,
        _id: { $ne: req.params.id }
      });
      if (existingDevice) {
        return res.status(400).json({ success: false, message: '设备账号名已存在' });
      }
    }

    const result = await Device.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    console.log('✅ 数据库更新结果:', result);

    // 重新查询以获取更新后的数据
    const updatedDevice = await Device.findById(req.params.id)
      .populate({
        path: 'assignedUser',
        select: 'username nickname',
        populate: {
          path: 'hr_id',
          select: 'username nickname'
        }
      })
      .populate('createdBy', 'username nickname');

    console.log('📤 返回数据:', updatedDevice);

    res.json({
      success: true,
      message: '设备更新成功',
      data: updatedDevice
    });
  } catch (error) {
    console.error('❌ 更新设备失败:', error);
    console.error('❌ 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (error.code === 11000) {
      res.status(400).json({ success: false, message: '设备账号名已存在' });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: '数据验证失败',
        details: Object.values(error.errors).map(e => e.message)
      });
    } else {
      res.status(500).json({
        success: false,
        message: '更新设备失败',
        error: error.message
      });
    }
  }
});

// 锁定/解锁设备 (仅manager和boss可以操作)
router.put('/:id/toggle-lock', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 切换锁定状态
    device.isLocked = !device.isLocked;
    await device.save();

    const action = device.isLocked ? '锁定' : '解锁';
    res.json({
      success: true,
      message: `设备${action}成功`,
      data: { isLocked: device.isLocked }
    });
  } catch (error) {
    console.error('锁定/解锁设备失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 增加设备积分
router.put('/:id/add-points', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { pointsToAdd } = req.body;

    if (!pointsToAdd || pointsToAdd <= 0) {
      return res.status(400).json({ success: false, message: '积分数量必须大于0' });
    }

    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 只有在线设备才能增加积分
    if (device.status !== 'online') {
      return res.status(400).json({ success: false, message: '只有在线设备才能增加积分' });
    }

    // 更新积分 - 使用原子操作避免并发问题
    const updatedDevice = await Device.findByIdAndUpdate(
      req.params.id,
      { $inc: { points: pointsToAdd } },
      { new: true, runValidators: true }
    );

    if (!updatedDevice) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    res.json({
      success: true,
      message: `成功增加 ${pointsToAdd} 积分`,
      data: {
        deviceId: updatedDevice._id,
        newPoints: updatedDevice.points
      }
    });
  } catch (error) {
    console.error('增加积分失败:', error);
    res.status(500).json({ success: false, message: '增加积分失败' });
  }
});

// 获取用户列表（用于分配设备）
router.get('/users/list', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const users = await User.find({
      role: 'user',
      is_deleted: { $ne: true }
    })
    .select('username nickname phone wechat')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

module.exports = router;
