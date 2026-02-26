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
    // 首先尝试按ObjectId查找
    let user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      // 兼容旧数据：尝试按 username 查找
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

// ==================== 权限辅助函数 ====================

/**
 * 角色判断函数（用于路由内部的条件判断）
 */
const Role = {
  /** 是否为兼职 */
  isPartTime: (req) => req.user?.role === 'part_time',

  /** 是否为带教老师 */
  isMentor: (req) => req.user?.role === 'mentor',

  /** 是否为HR */
  isHr: (req) => req.user?.role === 'hr',

  /** 是否为经理 */
  isManager: (req) => req.user?.role === 'manager',

  /** 是否为财务 */
  isFinance: (req) => req.user?.role === 'finance',

  /** 是否为老板 */
  isBoss: (req) => req.user?.role === 'boss',

  /** 是否为管理员（老板或经理） */
  isAdmin: (req) => req.user?.role === 'boss' || req.user?.role === 'manager',

  /** 是否为审核人员（老板、经理或财务） */
  isAuditor: (req) => ['boss', 'manager', 'finance'].includes(req.user?.role)
};

/**
 * 获取角色对应的审核状态查询条件
 * @param {string} role - 用户角色
 * @returns {Object|string} MongoDB查询条件
 */
const getStatusQueryForRole = (role) => {
  // 兼职和HR只能看到pending状态
  if (['part_time', 'hr'].includes(role)) {
    return 'pending';
  }
  // 带教可以看到pending、ai_approved、mentor_approved
  if (role === 'mentor') {
    return { $in: ['pending', 'ai_approved', 'mentor_approved'] };
  }
  // 管理员可以看到所有状态
  return { $in: ['pending', 'ai_approved', 'mentor_approved', 'approved', 'rejected'] };
};

/**
 * 获取角色对应的有效状态列表
 * @param {string} role - 用户角色
 * @returns {string[]} 有效状态数组
 */
const getValidStatusesForRole = (role) => {
  if (['part_time', 'hr'].includes(role)) {
    return ['pending'];
  }
  if (role === 'mentor') {
    return ['pending', 'ai_approved', 'mentor_approved'];
  }
  return ['pending', 'ai_approved', 'mentor_approved', 'approved', 'rejected'];
};

/**
 * 检查是否为用户自己（用于资源所有权检查）
 * @param {Object} req - 请求对象
 * @param {string} userId - 目标用户ID
 */
const isOwnResource = (req, userId) => {
  return req.user?.id === userId || req.user?._id?.toString() === userId;
};

/**
 * 检查是否为下属用户（HR/带教的下属）
 * @param {Object} req - 请求对象
 * @param {Object} targetUser - 目标用户对象
 */
const isSubordinate = (req, targetUser) => {
  if (!req.user || !targetUser) return false;

  // HR可以管理自己的兼职用户
  if (req.user.role === 'hr' && targetUser.hr_id?.toString() === req.user.id) {
    return true;
  }

  // 带教可以管理自己的兼职用户
  if (req.user.role === 'mentor' && targetUser.mentor_id?.toString() === req.user.id) {
    return true;
  }

  return false;
};

/**
 * 检查是否有权管理目标用户
 * @param {Object} req - 请求对象
 * @param {Object} targetUser - 目标用户对象
 */
const canManageUser = (req, targetUser) => {
  if (!req.user || !targetUser) return false;

  // 管理员可以管理所有人
  if (Role.isAdmin(req)) return true;

  // HR可以管理兼职用户
  if (Role.isHr(req) && targetUser.role === 'part_time') return true;

  // 带教可以管理兼职用户
  if (Role.isMentor(req) && targetUser.role === 'part_time') return true;

  // 检查是否为直接下属
  return isSubordinate(req, targetUser);
};

module.exports = {
  authenticateToken,
  requireRole,
  Role,
  getStatusQueryForRole,
  getValidStatusesForRole,
  isOwnResource,
  isSubordinate,
  canManageUser
};