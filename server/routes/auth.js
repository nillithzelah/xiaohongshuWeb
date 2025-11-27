const express = require('express');
const jwt = require('jsonwebtoken');
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

    const user = new User({
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

module.exports = router;