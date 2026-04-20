/**
 * XSS 防护中间件
 *
 * 全局输入清理，防止 XSS 攻击和 NoSQL 注入
 * 使用方式：在所有路由之前挂载 app.use(sanitizeMiddleware)
 */

const { sanitizeInput, escapeRegExp } = require('../utils/security');

/**
 * HTML 实体转义映射表
 */
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * 转义 HTML 特殊字符
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char]);
}

/**
 * 递归清理对象中的所有字符串值
 * @param {any} obj - 需要清理的对象
 * @param {Set} visited - 已访问对象集合（防止循环引用）
 * @returns {any} 清理后的对象
 */
function sanitizeObject(obj, visited = new Set()) {
  // 处理 null 和 undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 处理基本类型
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return escapeHtml(obj);
    }
    return obj;
  }

  // 防止循环引用
  if (visited.has(obj)) {
    return obj;
  }
  visited.add(obj);

  // 处理日期对象
  if (obj instanceof Date) {
    return obj;
  }

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, visited));
  }

  // 处理普通对象
  const sanitized = {};
  for (const key of Object.keys(obj)) {
    // 跳过以 $ 开头的键（防止 NoSQL 注入）
    if (key.startsWith('$')) {
      console.warn(`[安全警告] 检测到可能的 NoSQL 注入尝试: ${key}`);
      continue;
    }
    // 清理键名中的危险字符
    const cleanKey = key.replace(/[.$]/g, '_');
    sanitized[cleanKey] = sanitizeObject(obj[key], visited);
  }

  return sanitized;
}

/**
 * 轻量级清理（仅处理字符串，保留原始结构）
 * 用于性能敏感的场景
 * @param {any} obj - 需要清理的对象
 * @returns {any} 清理后的对象
 */
function lightSanitize(obj) {
  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(lightSanitize);
  }
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const result = {};
    for (const key of Object.keys(obj)) {
      if (!key.startsWith('$')) {
        result[key] = lightSanitize(obj[key]);
      }
    }
    return result;
  }
  return obj;
}

/**
 * 全局输入清理中间件
 * 自动清理 req.body, req.query, req.params 中的 XSS 内容
 *
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - Express next 函数
 */
function sanitizeMiddleware(req, res, next) {
  try {
    // 清理请求体
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // 清理查询参数
    if (req.query && typeof req.query === 'object') {
      req.query = lightSanitize(req.query);
    }

    // 清理路径参数
    if (req.params && typeof req.params === 'object') {
      req.params = lightSanitize(req.params);
    }

    next();
  } catch (error) {
    console.error('[安全中间件] 清理输入时出错:', error);
    // 发生错误时继续处理，不阻断请求
    next();
  }
}

/**
 * 严格模式中间件
 * 检测到可能的攻击时会拒绝请求
 */
function strictSanitizeMiddleware(req, res, next) {
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // script 标签
    /javascript:/gi,                                        // javascript 协议
    /on\w+\s*=/gi,                                          // 事件处理器
    /data:\s*text\/html/gi,                                 // data URL
    /vbscript:/gi,                                          // vbscript 协议
    /expression\s*\(/gi                                     // CSS expression
  ];

  const checkSuspicious = (obj, path = '') => {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          console.warn(`[安全警告] 检测到可疑输入: ${path}`);
          return true;
        }
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (checkSuspicious(obj[i], `${path}[${i}]`)) {
          return true;
        }
      }
    } else if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
      for (const key of Object.keys(obj)) {
        if (checkSuspicious(obj[key], `${path}.${key}`)) {
          return true;
        }
      }
    }
    return false;
  };

  // 检查请求体
  if (req.body && checkSuspicious(req.body, 'body')) {
    return res.status(400).json({
      success: false,
      message: '请求包含不安全的内容'
    });
  }

  // 检查查询参数
  if (req.query && checkSuspicious(req.query, 'query')) {
    return res.status(400).json({
      success: false,
      message: '请求参数包含不安全的内容'
    });
  }

  // 通过检查，继续清理
  sanitizeMiddleware(req, res, next);
}

/**
 * 清理特定字段的中间件工厂
 * @param {string[]} fields - 需要清理的字段名数组
 * @returns {Function} Express 中间件
 */
function sanitizeFields(fields) {
  return (req, res, next) => {
    if (!Array.isArray(fields)) {
      return next();
    }

    for (const field of fields) {
      // 清理 body 中的字段
      if (req.body && req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = escapeHtml(req.body[field]);
      }
      // 清理 query 中的字段
      if (req.query && req.query[field] && typeof req.query[field] === 'string') {
        req.query[field] = escapeHtml(req.query[field]);
      }
    }

    next();
  };
}

module.exports = {
  sanitizeMiddleware,
  strictSanitizeMiddleware,
  sanitizeFields,
  sanitizeObject,
  lightSanitize,
  escapeHtml
};
