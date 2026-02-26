/**
 * 统一 API 响应格式工具
 *
 * 使用方式：
 * const { success, error, notFound, unauthorized, forbidden } = require('../utils/response');
 *
 * // 成功响应
 * success(res, data, { message: '操作成功' });
 *
 * // 错误响应
 * error(res, '操作失败');
 * error(res, '操作失败', { details: '...' });
 *
 * // HTTP 状态码快捷方式
 * notFound(res, '资源不存在');
 * unauthorized(res, '请先登录');
 * forbidden(res, '权限不足');
 */

/**
 * 成功响应
 * @param {Object} res - Express 响应对象
 * @param {Object} data - 响应数据
 * @param {Object} options - 额外选项 { message, meta }
 */
function success(res, data = null, options = {}) {
  const response = {
    success: true
  };

  if (data !== null) {
    response.data = data;
  }

  if (options.message) {
    response.message = options.message;
  }

  if (options.meta) {
    response.meta = options.meta;
  }

  return res.json(response);
}

/**
 * 错误响应
 * @param {Object} res - Express 响应对象
 * @param {string} message - 错误消息
 * @param {Object} options - 额外选项 { code, details, status }
 */
function error(res, message, options = {}) {
  const response = {
    success: false,
    message
  };

  if (options.details) {
    response.details = options.details;
  }

  if (options.code) {
    response.code = options.code;
  }

  const status = options.status || 400;
  return res.status(status).json(response);
}

/**
 * 400 Bad Request
 */
function badRequest(res, message = '请求参数错误') {
  return res.status(400).json({ success: false, message });
}

/**
 * 401 Unauthorized
 */
function unauthorized(res, message = '未授权，请先登录') {
  return res.status(401).json({ success: false, message });
}

/**
 * 403 Forbidden
 */
function forbidden(res, message = '权限不足') {
  return res.status(403).json({ success: false, message });
}

/**
 * 404 Not Found
 */
function notFound(res, message = '请求的资源不存在') {
  return res.status(404).json({ success: false, message });
}

/**
 * 409 Conflict
 */
function conflict(res, message = '资源冲突') {
  return res.status(409).json({ success: false, message });
}

/**
 * 500 Internal Server Error
 */
function serverError(res, message = '服务器内部错误') {
  return res.status(500).json({ success: false, message });
}

/**
 * 分页响应
 * @param {Object} res - Express 响应对象
 * @param {Array} items - 数据列表
 * @param {Object} pagination - 分页信息 { page, limit, total, pages }
 */
function paginated(res, items, pagination) {
  return res.json({
    success: true,
    data: items,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages
    }
  });
}

/**
 * 异步路由错误包装器
 * 自动捕获异常并返回统一格式的错误响应
 *
 * 使用方式：
 * router.get('/path', asyncHandler(async (req, res) => {
 *   // 你的代码
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error('未捕获的异常:', err);
      // 如果已经设置了响应头，说明已经发送过响应
      if (res.headersSent) {
        return next(err);
      }
      // 根据错误类型返回不同的状态码
      const status = err.status || 500;
      const message = err.message || '服务器内部错误';
      res.status(status).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  };
}

/**
 * 全局错误处理中间件
 * 放在所有路由之后使用
 */
function errorHandler(err, req, res, next) {
  console.error('错误处理中间件捕获:', err);

  // 如果已经发送了响应
  if (res.headersSent) {
    return next(err);
  }

  // 根据错误类型返回不同的状态码
  let status = 500;
  let message = '服务器内部错误';

  if (err.name === 'ValidationError') {
    status = 400;
    message = '数据验证失败';
  } else if (err.name === 'CastError') {
    status = 400;
    message = '无效的数据格式';
  } else if (err.code === 11000) {
    status = 409;
    message = '数据已存在';
  } else if (err.status) {
    status = err.status;
    message = err.message;
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.details
    })
  });
}

module.exports = {
  // 基础函数
  success,
  error,
  paginated,

  // HTTP 状态码快捷方式
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,

  // 中间件
  asyncHandler,
  errorHandler
};
