const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 从环境变量获取JWT密钥，如果未设置则抛出错误
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET环境变量必须设置且至少32个字符');
}

// 验证JWT token中间件
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: '未提供访问令牌' });
  }

  try {
    // 不记录敏感信息到日志
    const decoded = jwt.verify(token, JWT_SECRET);

    // 从数据库获取真实用户信息
    let user;
    try {
      // 首先尝试按ObjectId查找
      user = await User.findById(decoded.userId).select('-password');
    } catch (error) {
      // 如果ObjectId查找失败，尝试按username查找（兼容旧数据）
      user = await User.findOne({ username: decoded.userId }).select('-password');
    }

    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    // 检查用户是否被软删除
    if (user.is_deleted) {
      return res.status(401).json({ success: false, message: '用户已被禁用' });
    }

    req.user = {
      _id: user._id,
      id: user._id.toString(), // 用户ID统一使用ObjectId字符串，便于权限比较
      username: user.username, // 用户名保留用于兼容
      role: user.role,
      nickname: user.nickname,
      parent_id: user.parent_id // 添加 parent_id 用于邀请关系检查
    };

    next();
  } catch (error) {
    // 不暴露详细错误信息
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