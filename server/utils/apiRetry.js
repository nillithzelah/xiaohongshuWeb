/**
 * API 重试工具
 *
 * 为外部 API 调用提供带指数退避的重试机制，提高系统稳定性
 *
 * 使用示例：
 * const apiRetry = require('../utils/apiRetry');
 *
 * // 基本用法
 * const result = await apiRetry.withRetry(async () => {
 *   return await axios.get('https://api.example.com/data');
 * });
 *
 * // 带配置
 * const result = await apiRetry.withRetry(async () => {
 *   return await externalApiCall();
 * }, {
 *   maxRetries: 5,
 *   delay: 1000,
 *   onRetry: (attempt, error) => {
 *     console.log(`重试第 ${attempt} 次，错误: ${error.message}`);
 *   }
 * });
 */

const axios = require('axios');

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  delay: 1000,           // 初始延迟（毫秒）
  maxDelay: 30000,       // 最大延迟（毫秒）
  backoffMultiplier: 2,  // 退避倍数
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'EPIPE',
    'EAI_AGAIN'
  ],
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  shouldRetry: null      // 自定义重试判断函数
};

/**
 * 判断错误是否可重试
 *
 * @param {Error} error - 错误对象
 * @param {Object} config - 配置对象
 * @returns {boolean} 是否可重试
 */
function isRetryableError(error, config) {
  // 优先使用自定义判断函数
  if (config.shouldRetry && typeof config.shouldRetry === 'function') {
    return config.shouldRetry(error);
  }

  // 检查 Axios 网络错误
  if (error.code) {
    return config.retryableErrors.includes(error.code);
  }

  // 检查 HTTP 状态码
  if (error.response && error.response.status) {
    return config.retryableStatuses.includes(error.response.status);
  }

  // 默认不重试
  return false;
}

/**
 * 计算退避延迟时间（指数退避）
 *
 * @param {number} attempt - 当前尝试次数（从 1 开始）
 * @param {Object} config - 配置对象
 * @returns {number} 延迟时间（毫秒）
 */
function calculateDelay(attempt, config) {
  const delay = config.delay * Math.pow(config.backoffMultiplier, attempt - 1);

  // 添加随机抖动（±25%），避免同时重试导致的惊群效应
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);

  return Math.min(Math.max(delay + jitter, 0), config.maxDelay);
}

/**
 * 延迟函数
 *
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带重试的异步函数执行器
 *
 * @param {Function} fn - 要执行的异步函数
 * @param {Object} options - 配置选项
 * @returns {Promise<any>} 函数执行结果
 *
 * @throws {Error} 所有重试失败后的最后一个错误
 */
async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  let lastError = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      // 执行函数
      const result = await fn();

      // 如果有重试，记录成功日志
      if (attempt > 0) {
        console.log(`✅ [API重试] 第 ${attempt + 1} 次尝试成功`);
      }

      return result;

    } catch (error) {
      lastError = error;

      // 检查是否可重试
      if (attempt < config.maxRetries && isRetryableError(error, config)) {
        const delay = calculateDelay(attempt + 1, config);

        console.warn(`⚠️ [API重试] 第 ${attempt + 1} 次失败，${delay}ms 后重试...`,
          error.message || error.code || 'Unknown error');

        // 调用重试回调
        if (config.onRetry && typeof config.onRetry === 'function') {
          try {
            await config.onRetry(attempt + 1, error);
          } catch (callbackError) {
            console.error('❌ [API重试] onRetry 回调执行失败:', callbackError);
          }
        }

        // 等待后重试
        await sleep(delay);
        continue;
      }

      // 不可重试或达到最大重试次数，抛出错误
      console.error(`❌ [API重试] 第 ${attempt + 1} 次失败，不再重试:`,
        error.message || error.code || 'Unknown error');

      throw error;
    }
  }

  // 理论上不会到达这里，但为了类型安全
  throw lastError;
}

/**
 * Axios 实例包装器，自动为所有请求添加重试能力
 *
 * @param {Object} axiosInstance - Axios 实例（可选，默认创建新实例）
 * @param {Object} retryConfig - 重试配置
 * @returns {Object} 带重试能力的 Axios 实例
 */
function wrapAxios(axiosInstance = null, retryConfig = {}) {
  const instance = axiosInstance || axios.create();

  // 请求拦截器
  instance.interceptors.request.use(
    config => {
      config.metadata = { startTime: Date.now() };
      return config;
    },
    error => Promise.reject(error)
  );

  // 响应拦截器（重试逻辑）
  instance.interceptors.response.use(
    response => {
      const duration = Date.now() - response.config.metadata?.startTime;
      if (retryConfig.logDuration && duration > retryConfig.slowThreshold) {
        console.warn(`⚠️ [慢请求] ${response.config.url} 耗时 ${duration}ms`);
      }
      return response;
    },
    async error => {
      const config = error.config;

      // 如果没有配置元数据，说明已经被拦截过，直接抛出
      if (!config || !config.metadata) {
        return Promise.reject(error);
      }

      // 设置重试计数
      config.metadata.retryCount = config.metadata.retryCount || 0;

      // 检查是否可重试
      if (config.metadata.retryCount < (retryConfig.maxRetries || DEFAULT_CONFIG.maxRetries) &&
          isRetryableError(error, DEFAULT_CONFIG)) {

        config.metadata.retryCount++;

        const delay = calculateDelay(config.metadata.retryCount, DEFAULT_CONFIG);
        console.warn(`⚠️ [Axios重试] ${config.url} 第 ${config.metadata.retryCount} 次失败，${delay}ms 后重试...`);

        await sleep(delay);

        // 重试请求
        return instance(config);
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * 预定义的 HTTP 状态码重试条件
 */
const RetryConditions = {
  // 网络错误重试
  isNetworkError: (error) => {
    return !error.response && !!error.code;
  },

  // 服务器错误重试 (5xx)
  isServerError: (error) => {
    return error.response && error.response.status >= 500;
  },

  // 速率限制重试 (429)
  isRateLimited: (error) => {
    return error.response && error.response.status === 429;
  },

  // 超时重试
  isTimeout: (error) => {
    return error.code === 'ETIMEDOUT' ||
           error.code === 'ESOCKETTIMEDOUT' ||
           (error.response && error.response.status === 408);
  },

  // DeepSeek API 特定错误
  isDeepSeekRetriable: (error) => {
    if (!error.response) return false;
    const status = error.response.status;
    // DeepSeek API: 429(速率限制), 500(服务器错误), 502(网关错误), 503(服务不可用)
    return [429, 500, 502, 503, 504].includes(status);
  },

  // 小红书特定错误
  isXiaohongshuRetriable: (error) => {
    if (!error.response) {
      // 网络错误可重试
      return ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error.code);
    }
    const status = error.response.status;
    return [408, 429, 500, 502, 503, 504].includes(status);
  }
};

/**
 * 预定义的重试配置
 */
const RetryPresets = {
  // 快速重试（用于非关键操作）
  fast: {
    maxRetries: 2,
    delay: 500,
    backoffMultiplier: 1.5
  },

  // 标准重试（默认）
  standard: {
    maxRetries: 3,
    delay: 1000,
    backoffMultiplier: 2
  },

  // 激进重试（用于关键操作）
  aggressive: {
    maxRetries: 5,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 60000
  },

  // DeepSeek API 配置
  deepseek: {
    maxRetries: 3,
    delay: 2000,
    backoffMultiplier: 2,
    shouldRetry: RetryConditions.isDeepSeekRetriable
  },

  // 小红书 API 配置
  xiaohongshu: {
    maxRetries: 2,
    delay: 1500,
    backoffMultiplier: 2,
    shouldRetry: RetryConditions.isXiaohongshuRetriable
  }
};

module.exports = {
  withRetry,
  wrapAxios,
  RetryConditions,
  RetryPresets,
  DEFAULT_CONFIG
};
