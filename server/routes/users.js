const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// 获取用户资料
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('parent_id', 'username');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        totalEarnings: user.totalEarnings,
        avatar: user.avatar,
        nickname: user.nickname,
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
        balance: user.balance,
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

// 更新用户（管理员功能）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, phone, role } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { nickname, phone, role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        totalEarnings: user.totalEarnings,
        avatar: user.avatar,
        nickname: user.nickname,
        phone: user.phone
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
    const { page = 1, limit = 10, role, search } = req.query;

    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find({
      ...query,
      is_deleted: { $ne: true } // 只返回未删除的用户
    })
      .select('-password')
      .populate('parent_id', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
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

    // 2. 资金安全锁：检查用户是否有余额
    if (user.balance > 0) {
      return res.status(400).json({ success: false, message: '该用户账户仍有余额，无法删除' });
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