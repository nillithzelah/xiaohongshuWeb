/**
 * 防重复提交服务
 * 用于防止用户在短时间内重复提交相同的任务
 */

const crypto = require('crypto');

// 内存缓存：存储最近的提交记录
// 格式: { fingerprint: { timestamp, userId } }
const submitCache = new Map();

// 清理过期缓存的时间间隔（毫秒）
const CLEANUP_INTERVAL = 60000; // 1分钟

// 请求指纹的有效期（毫秒）
const FINGERPRINT_TTL = 5000; // 5秒

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [fingerprint, data] of submitCache.entries()) {
    if (now - data.timestamp > FINGERPRINT_TTL) {
      submitCache.delete(fingerprint);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 [防重复提交] 清理了 ${cleanedCount} 条过期记录`);
  }
}, CLEANUP_INTERVAL);

/**
 * 生成请求指纹
 * @param {Object} params - 请求参数
 * @param {string} params.userId - 用户ID
 * @param {string} params.imageType - 任务类型
 * @param {string} params.noteUrl - 笔记链接
 * @param {string} params.commentContent - 评论内容
 * @param {string} params.noteTitle - 笔记标题
 * @param {string} params.customerPhone - 客户电话
 * @param {string} params.customerWechat - 客户微信
 * @returns {string} 请求指纹
 */
function generateFingerprint(params) {
  const {
    userId,
    imageType,
    noteUrl,
    commentContent,
    noteTitle,
    customerPhone,
    customerWechat
  } = params;

  // 标准化参数
  const normalizedParams = {
    userId: String(userId),
    imageType: String(imageType || ''),
    noteUrl: String(noteUrl || '').trim().toLowerCase(),
    commentContent: String(commentContent || '').trim(),
    noteTitle: String(noteTitle || '').trim(),
    customerPhone: String(customerPhone || '').trim(),
    customerWechat: String(customerWechat || '').trim()
  };

  // 根据任务类型选择关键内容
  let keyContent = '';
  if (imageType === 'comment') {
    keyContent = `${normalizedParams.noteUrl}|${normalizedParams.commentContent}`;
  } else if (imageType === 'note') {
    keyContent = `${normalizedParams.noteUrl}|${normalizedParams.noteTitle}`;
  } else if (imageType === 'customer_resource') {
    keyContent = `${normalizedParams.customerPhone}|${normalizedParams.customerWechat}`;
  }

  // 生成指纹
  const fingerprintData = `${normalizedParams.userId}|${normalizedParams.imageType}|${keyContent}`;
  return crypto.createHash('md5').update(fingerprintData).digest('hex');
}

/**
 * 检查是否为重复提交
 * @param {Object} params - 请求参数
 * @returns {Object} { isDuplicate: boolean, fingerprint: string, reason?: string }
 */
function checkDuplicate(params) {
  const fingerprint = generateFingerprint(params);
  const now = Date.now();
  const cached = submitCache.get(fingerprint);

  if (cached) {
    const timeDiff = now - cached.timestamp;
    if (timeDiff < FINGERPRINT_TTL) {
      console.log(`⚠️ [防重复提交] 检测到重复提交: 用户=${params.userId}, 指纹=${fingerprint.substring(0, 8)}..., 时间间隔=${timeDiff}ms`);
      return {
        isDuplicate: true,
        fingerprint,
        reason: `请勿重复提交，请在 ${Math.ceil((FINGERPRINT_TTL - timeDiff) / 1000)} 秒后重试`
      };
    }
  }

  // 记录新的提交
  submitCache.set(fingerprint, {
    timestamp: now,
    userId: params.userId
  });

  return {
    isDuplicate: false,
    fingerprint
  };
}

/**
 * 清理指定用户的提交记录（用于测试或特殊情况）
 * @param {string} userId - 用户ID
 */
function clearUserRecords(userId) {
  let clearedCount = 0;
  for (const [fingerprint, data] of submitCache.entries()) {
    if (data.userId === String(userId)) {
      submitCache.delete(fingerprint);
      clearedCount++;
    }
  }
  console.log(`🧹 [防重复提交] 清理了用户 ${userId} 的 ${clearedCount} 条记录`);
  return clearedCount;
}

/**
 * 获取当前缓存状态（用于调试）
 * @returns {Object} 缓存统计信息
 */
function getCacheStats() {
  return {
    totalRecords: submitCache.size,
    ttl: FINGERPRINT_TTL,
    cleanupInterval: CLEANUP_INTERVAL
  };
}

module.exports = {
  generateFingerprint,
  checkDuplicate,
  clearUserRecords,
  getCacheStats
};
