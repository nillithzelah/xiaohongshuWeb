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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: '用户不存在' });
    }

    req.user = user;
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