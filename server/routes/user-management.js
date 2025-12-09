const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// 获取用户资料
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // 从数据库获取真实用户信息
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        points: user.points || 0,
        totalEarnings: user.totalEarnings || 0,
        avatar: user.avatar,
        nickname: user.nickname || user.username,
        phone: user.phone,
        parentUser: user.parent_id,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('获取用户资料错误:', error);
    res.status(500).json({ success: false, message: '获取用户资料失败' });
  }
});

// 更新用户资料
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { nickname, phone, avatar } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { nickname, phone, avatar },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        points: user.points,
        totalEarnings: user.totalEarnings,
        avatar: user.avatar,
        nickname: user.nickname,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({ success: false, message: '更新用户资料失败' });
  }
});

// 更新用户资料（支持客服修改名下用户）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, phone, wechat, notes, integral_w, integral_z, role, hr_id, mentor_id, parent_id } = req.body;

    // 查找要更新的用户
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 权限检查
    let allowedFields = [];

    if (req.user.role === 'boss' || req.user.role === 'manager') {
      // 老板和主管可以修改所有字段
      allowedFields = ['nickname', 'phone', 'wechat', 'notes', 'integral_w', 'integral_z', 'role'];

      // 如果是编辑兼职用户，老板和主管可以分配HR和带教老师，以及上级用户
      if (targetUser.role === 'part_time') {
        allowedFields.push('hr_id', 'mentor_id', 'parent_id');
      }
    } else if (req.user.role === 'mentor' && targetUser.mentor_id?.toString() === req.user.id) {
      // 带教老师可以修改自己名下的用户，包括积分和上级用户
      allowedFields = ['integral_w', 'integral_z', 'parent_id'];
    } else if (req.user.id === id) {
      // 用户可以修改自己的基本信息
      allowedFields = ['nickname', 'phone', 'wechat', 'notes'];
    } else {
      return res.status(403).json({ success: false, message: '没有权限修改此用户' });
    }

    // 构建更新对象，只包含允许的字段
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // 特殊处理培训状态：老板、主管和带教老师（对其名下用户）可以编辑兼职用户的培训状态
    if (req.body.training_status !== undefined && targetUser.role === 'part_time') {
      const currentUserRole = req.user.role;
      if (currentUserRole === 'boss' || currentUserRole === 'manager' || (currentUserRole === 'mentor' && targetUser.mentor_id?.toString() === req.user.id)) {
        updateData.training_status = req.body.training_status;
      } else {
        return res.status(403).json({ success: false, message: '没有权限编辑培训状态' });
      }
    }

    // 如果是分配带教老师，自动设置分配时间（必须在注册时间之前）
    if (updateData.mentor_id !== undefined && updateData.mentor_id !== targetUser.mentor_id) {
      if (updateData.mentor_id) {
        // 分配给新的带教老师，设置分配时间为注册时间之前的一段时间
        const registrationTime = new Date(targetUser.createdAt);
        // 设置分配时间为注册时间前1-7天内的随机时间
        const daysBefore = Math.floor(Math.random() * 7) + 1; // 1-7天
        const assignmentTime = new Date(registrationTime.getTime() - daysBefore * 24 * 60 * 60 * 1000);
        updateData.assigned_to_mentor_at = assignmentTime;
      } else {
        // 取消分配，清空分配时间
        updateData.assigned_to_mentor_at = null;
      }
    }

    // 如果没有要更新的字段，返回错误
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: '没有有效的更新字段' });
    }

    // 执行更新
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: '用户更新成功',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        nickname: updatedUser.nickname,
        phone: updatedUser.phone,
        wechat: updatedUser.wechat,
        notes: updatedUser.notes,
        integral_w: updatedUser.integral_w,
        integral_z: updatedUser.integral_z,
        role: updatedUser.role,
        mentor_id: updatedUser.mentor_id,
        hr_id: updatedUser.hr_id,
        parent_id: updatedUser.parent_id,
        assigned_to_mentor_at: updatedUser.assigned_to_mentor_at,
        training_status: updatedUser.training_status
      }
    });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ success: false, message: '更新用户失败' });
  }
});

// 获取用户列表（管理员功能）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, keyword, managed_by, viewType, training_status } = req.query;

    let query = {};

    // 根据viewType限制查询范围
    if (viewType === 'staff') {
      // 只返回员工（非兼职用户）
      query.role = { $ne: 'part_time' };
    } else if (viewType === 'client') {
      // 只返回兼职用户
      query.role = 'part_time';
    }

    // 如果指定了role，进一步过滤
    if (role) query.role = role;

    if (keyword) {
      query.$or = [
        { username: { $regex: keyword, $options: 'i' } },
        { nickname: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } }
      ];
    }
    if (managed_by) query.mentor_id = managed_by;
    if (training_status) query.training_status = training_status;

    const users = await User.find({
      ...query,
      is_deleted: { $ne: true } // 只返回未删除的用户
    })
      .select('-password')
      .populate({
        path: 'parent_id',
        select: 'username nickname',
        populate: {
          path: 'parent_id',
          select: 'username nickname'
        }
      })
      .populate('hr_id', 'username nickname')
      .populate('mentor_id', 'username nickname')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // 为每个用户添加分配时间和培训状态信息
    const usersWithAssignmentTime = users.map(user => ({
      ...user.toObject(),
      assigned_to_mentor_at: user.assigned_to_mentor_at,
      training_status: user.training_status
    }));

    const total = await User.countDocuments({
      ...query,
      is_deleted: { $ne: true } // 只统计未删除的用户
    });

    res.json({
      success: true,
      users: usersWithAssignmentTime,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 删除用户（软删除 + 安全检查）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 1. Boss保护机制：禁止删除老板账号
    if (user.role === 'boss') {
      return res.status(400).json({ success: false, message: '老板账号无法删除' });
    }

    // 2. 资金安全锁：检查用户是否有积分
    if (user.points > 0) {
      return res.status(400).json({ success: false, message: '该用户账户仍有积分，无法删除' });
    }

    // 3. 软删除：标记为已删除
    await User.findByIdAndUpdate(id, {
      is_deleted: true,
      deleted_at: new Date()
    });

    res.json({
      success: true,
      message: '用户已成功删除'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

module.exports = router;