/**
 * 安全工具函数
 */

/**
 * 转义正则表达式特殊字符，防止 NoSQL 注入
 * @param {string} string - 需要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(string) {
  if (typeof string !== 'string') return string;
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 验证 ObjectId 格式
 * @param {string} id - 待验证的 ID
 * @returns {boolean} 是否有效
 */
function isValidObjectId(id) {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * 清理用户输入，移除危险字符
 * @param {string} input - 用户输入
 * @param {object} options - 选项
 * @returns {string} 清理后的输入
 */
function sanitizeInput(input, options = {}) {
  if (typeof input !== 'string') return input;

  const { maxLength = 1000, removeHTML = false } = options;

  let cleaned = input.trim();

  // 限制长度
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  // 移除 HTML 标签
  if (removeHTML) {
    cleaned = cleaned.replace(/<[^>]*>/g, '');
  }

  return cleaned;
}

/**
 * 验证搜索关键词，防止注入攻击
 * @param {string} keyword - 搜索关键词
 * @returns {object} { safe: boolean, escaped: string, error?: string }
 */
function validateSearchKeyword(keyword) {
  if (!keyword) {
    return { safe: true, escaped: '' };
  }

  if (typeof keyword !== 'string') {
    return { safe: false, escaped: '', error: '关键词必须是字符串' };
  }

  // 检查长度
  if (keyword.length > 200) {
    return { safe: false, escaped: '', error: '关键词过长' };
  }

  // 转义正则特殊字符
  const escaped = escapeRegExp(keyword);

  return { safe: true, escaped };
}

module.exports = {
  escapeRegExp,
  isValidObjectId,
  sanitizeInput,
  validateSearchKeyword
};
