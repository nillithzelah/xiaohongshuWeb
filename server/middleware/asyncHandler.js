/**
 * 异步路由错误处理中间件
 *
 * 自动捕获异步路由函数中的错误，传递给全局错误处理器
 * 避免在每个路由中手动编写 try-catch
 *
 * 使用示例：
 * router.get('/data', asyncHandler(async (req, res) => {
 *   const data = await someAsyncOperation();
 *   res.json({ success: true, data });
 * }));
 */

/**
 * 包装异步路由函数，自动捕获错误
 *
 * @param {Function} fn - 异步路由函数 (req, res, next) => Promise
 * @returns {Function} Express 中间件函数
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 包装异步路由函数，提供自定义错误处理
 *
 * @param {Function} fn - 异步路由函数
 * @param {Function} errorHandler - 自定义错误处理函数 (error, req, res, next) => void
 * @returns {Function} Express 中间件函数
 */
function asyncHandlerWithError(fn, errorHandler) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      if (errorHandler && typeof errorHandler === 'function') {
        errorHandler(error, req, res, next);
      } else {
        next(error);
      }
    });
  };
}

/**
 * 创建带有特定错误类型的处理函数
 *
 * @param {Object} errorClasses - 错误类映射 { ErrorType: statusCode }
 * @returns {Function} Express 中间件函数
 */
function createTypedHandler(errorClasses) {
  return (fn) => {
    return asyncHandler(async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        // 检查是否是已定义的错误类型
        for (const [ErrorClass, statusCode] of Object.entries(errorClasses)) {
          if (error instanceof ErrorClass) {
            return res.status(statusCode).json({
              success: false,
              message: error.message || '操作失败'
            });
          }
        }
        // 未定义的错误类型，传递给全局错误处理器
        next(error);
      }
    });
  };
}

module.exports = {
  asyncHandler,
  asyncHandlerWithError,
  createTypedHandler
};
