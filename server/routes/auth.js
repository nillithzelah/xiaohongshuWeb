const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const router = express.Router();

// 生成JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// 微信小程序登录/注册
router.post('/wechat-login', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: '缺少code参数' });
    }

    // =========== 🕵️‍♂️ 开启上帝模式 (新增代码) ===========
    if (code && code.startsWith('TEST_')) {
      // 如果传来的 code 是以 TEST_ 开头，直接模拟登录，不找微信了
      const mockOpenId = `mock_openid_${code}`;

      let user = await User.findOne({ openid: mockOpenId });
      if (!user) {
        let role = 'user';
        let username = `测试用户_${code.split('_')[1]}`;

        // 根据code设置角色
        if (code === 'TEST_CS') {
          role = 'cs';
          username = '测试客服';
        } else if (code === 'TEST_BOSS') {
          role = 'boss';
          username = '测试老板';
        } else if (code === 'TEST_FINANCE') {
          role = 'finance';
          username = '测试财务';
        } else if (code.startsWith('TEST_USER_')) {
          username = `测试用户_${code.split('_')[2]}`;
        }

        user = new User({
          openid: mockOpenId,
          username: username,
          role: role,
          parent_id: null
        });
        await user.save();
      }

      const token = generateToken(user._id);
      return res.json({
        success: true,
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          balance: user.balance,
          totalEarnings: user.totalEarnings
        }
      });
    }
    // =========== 上帝模式结束 ===========

    // 这里应该调用微信API获取openid，暂时模拟
    // 实际项目中需要调用微信API: https://api.weixin.qq.com/sns/jscode2session
    const openid = `wx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 查找或创建用户
    let user = await User.findOne({ openid });

    if (!user) {
      // 自动注册新用户
      user = new User({
        username: `user_${openid.substr(-8)}`,
        openid,
        role: 'user'
      });
      await user.save();
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        totalEarnings: user.totalEarnings
      }
    });

  } catch (error) {
    console.error('微信登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 注册（仅管理员使用）
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    // 为管理员创建的用户生成唯一的openid
    const openid = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user = new User({
      openid,
      username,
      password,
      role: role || 'user'
    });

    await user.save();

    res.json({
      success: true,
      message: '注册成功',
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ success: false, message: '注册失败' });
  }
});

// 管理员登录接口 (账号密码登录)
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Admin login attempt:', username, password);

    // 检查数据库连接
    const dbState = mongoose.connection.readyState;
    console.log('MongoDB connection state:', dbState); // 1 = connected

    // 查找用户
    console.log('Searching for username:', username);
    const user = await User.findOne({ username });
    console.log('Query result type:', typeof user);
    console.log('Query result:', user);
    console.log('User found:', user ? { username: user.username, role: user.role, _id: user._id } : 'null');

    // 也试试查找所有用户
    const allUsers = await User.find({}, 'username role _id').limit(10);
    console.log('All users in DB:', allUsers.map(u => ({ username: u.username, role: u.role, id: u._id })));

    // 特别查找TEST用户
    const testUsers = await User.find({ username: { $in: ['TEST_BOSS', 'TEST_CS', 'TEST_FINANCE'] } });
    console.log('TEST users in DB:', testUsers.map(u => ({ username: u.username, role: u.role })));

    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    // 检查角色权限 (必须是管理员角色)
    console.log('User role:', user.role, 'Allowed roles:', ['cs', 'boss', 'finance']);
    if (!['cs', 'boss', 'finance'].includes(user.role)) {
      return res.status(403).json({ success: false, message: `权限不足，当前角色: ${user.role}` });
    }

    // 简单密码验证 (开发环境用固定密码)
    const isValidPassword = password === 'admin123';
    console.log('Password check:', isValidPassword);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: '密码错误' });
    }

    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        balance: user.balance,
        totalEarnings: user.totalEarnings
      }
    });

  } catch (error) {
    console.error('管理员登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

module.exports = router;