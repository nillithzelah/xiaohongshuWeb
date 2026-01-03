const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 验证JWT token中间件
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '未提供访问令牌' });
  }

  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'xiaohongshu_prod_jwt_secret_2025_v2_a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    console.log('🔐 验证token，使用的密钥:', JWT_SECRET.substring(0, 20) + '...');
    console.log('🔑 收到的token:', token);
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token验证成功:', decoded);

    // 从数据库获取真实用户信息
    let user;
    try {
      // 首先尝试按ObjectId查找
      user = await User.findById(decoded.userId).select('-password');
    } catch (error) {
      console.log('ObjectId查找失败:', error.message);
      // 如果ObjectId查找失败，尝试按username查找（兼容旧数据）
      console.log('尝试按username查找:', decoded.userId);
      user = await User.findOne({ username: decoded.userId }).select('-password');
    }

    if (!user) {
      console.log('用户不存在:', decoded.userId);
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    // 检查用户是否被软删除
    if (user.is_deleted) {
      return res.status(401).json({ success: false, message: '用户已被禁用' });
    }

    req.user = {
      _id: user._id,
      id: user.username, // 使用username作为id，与小程序兼容
      username: user.username,
      role: user.role,
      nickname: user.nickname
    };

    console.log('👤 用户信息:', { userId: user._id, username: user.username, role: user.role });

    next();
  } catch (error) {
    console.error('Token验证错误:', error);
    res.status(403).json({ success: false, message: '无效的访问令牌' });
  }
};

// 角色权限检查中间件
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: '未认证' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole
};