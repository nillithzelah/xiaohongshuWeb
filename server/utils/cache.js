/**
 * 缓存工具
 *
 * 提供内存缓存功能，用于缓存权限、配置等频繁访问的数据
 * 使用 node-cache 实现，支持 TTL（过期时间）
 */

const NodeCache = require('node-cache');

/**
 * 权限缓存
 * - TTL: 5 分钟（300秒）
 * - 用途: 缓存用户权限、角色权限映射
 */
const permissionCache = new NodeCache({
  stdTTL: 300,           // 默认 5 分钟过期
  checkperiod: 60,       // 每 60 秒检查一次过期键
  useClones: false,      // 不克隆对象，提高性能
  maxKeys: 1000          // 最多缓存 1000 个键
});

/**
 * 静态数据缓存
 * - TTL: 10 分钟（600秒）
 * - 用途: 缓存公告、配置、关键词等不常变化的数据
 */
const staticCache = new NodeCache({
  stdTTL: 600,           // 默认 10 分钟过期
  checkperiod: 120,      // 每 120 秒检查一次过期键
  useClones: false,
  maxKeys: 500
});

/**
 * API 响应缓存
 * - TTL: 30 秒
 * - 用途: 缓存频繁请求的 API 响应（如统计数据）
 */
const apiCache = new NodeCache({
  stdTTL: 30,            // 默认 30 秒过期
  checkperiod: 15,
  useClones: false,
  maxKeys: 200
});

/**
 * AI 审核结果缓存
 * - TTL: 1 小时（3600秒）
 * - 用途: 缓存相同内容的 AI 审核结果，减少 API 调用
 */
const aiCache = new NodeCache({
  stdTTL: 3600,          // 默认 1 小时过期
  checkperiod: 300,
  useClones: false,
  maxKeys: 1000
});

/**
 * 生成缓存键
 * @param {string} prefix - 前缀
 * @param {...any} parts - 键的组成部分
 * @returns {string} 缓存键
 */
function cacheKey(prefix, ...parts) {
  return [prefix, ...parts.map(p => String(p))].join(':');
}

/**
 * 获取或设置缓存（自动回源）
 * @param {Object} cache - NodeCache 实例
 * @param {string} key - 缓存键
 * @param {Function} fetcher - 数据获取函数（当缓存不存在时调用）
 * @param {number} [ttl] - 可选的自定义 TTL
 * @returns {Promise<any>} 缓存或获取的数据
 */
async function getOrSet(cache, key, fetcher, ttl) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const data = await fetcher();
  if (data !== undefined && data !== null) {
    if (ttl) {
      cache.set(key, data, ttl);
    } else {
      cache.set(key, data);
    }
  }

  return data;
}

/**
 * 缓存中间件工厂
 * @param {Object} cache - NodeCache 实例
 * @param {Function} keyGenerator - 生成缓存键的函数 (req) => string
 * @param {number} [ttl] - 可选的自定义 TTL
 * @returns {Function} Express 中间件
 */
function cacheMiddleware(cache, keyGenerator, ttl) {
  return async (req, res, next) => {
    const key = keyGenerator(req);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return res.json(cached);
    }

    // 保存原始 res.json 方法
    const originalJson = res.json.bind(res);

    // 重写 res.json 方法以缓存响应
    res.json = (data) => {
      if (data && data.success) {
        if (ttl) {
          cache.set(key, data, ttl);
        } else {
          cache.set(key, data);
        }
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * 清除指定前缀的所有缓存
 * @param {Object} cache - NodeCache 实例
 * @param {string} prefix - 缓存键前缀
 */
function clearByPrefix(cache, prefix) {
  const keys = cache.keys();
  const keysToDelete = keys.filter(key => key.startsWith(prefix));
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
    console.log(`[缓存] 已清除 ${keysToDelete.length} 个以 "${prefix}" 开头的缓存`);
  }
}

/**
 * 获取缓存统计信息
 * @returns {Object} 各缓存的统计信息
 */
function getStats() {
  return {
    permission: {
      keys: permissionCache.keys().length,
      stats: permissionCache.getStats()
    },
    static: {
      keys: staticCache.keys().length,
      stats: staticCache.getStats()
    },
    api: {
      keys: apiCache.keys().length,
      stats: apiCache.getStats()
    },
    ai: {
      keys: aiCache.keys().length,
      stats: aiCache.getStats()
    }
  };
}

/**
 * 清除所有缓存
 */
function clearAll() {
  permissionCache.flushAll();
  staticCache.flushAll();
  apiCache.flushAll();
  aiCache.flushAll();
  console.log('[缓存] 已清除所有缓存');
}

/**
 * 权限缓存键前缀
 */
const CACHE_KEYS = {
  // 权限相关
  USER_PERMISSIONS: 'user:permissions',
  ROLE_PERMISSIONS: 'role:permissions',
  MENU_DEFINITIONS: 'menu:definitions',

  // 静态数据
  ANNOUNCEMENTS: 'announcements',
  KEYWORDS: 'keywords',
  AI_PROMPTS: 'ai:prompts',
  SYSTEM_CONFIG: 'system:config',

  // API 缓存
  DASHBOARD_STATS: 'dashboard:stats',
  MONITORING_DATA: 'monitoring:data',
  USER_STATS: 'user:stats',

  // AI 缓存
  AI_REVIEW_RESULT: 'ai:review'
};

module.exports = {
  // 缓存实例
  permissionCache,
  staticCache,
  apiCache,
  aiCache,

  // 工具函数
  cacheKey,
  getOrSet,
  cacheMiddleware,
  clearByPrefix,
  getStats,
  clearAll,

  // 常量
  CACHE_KEYS
};
