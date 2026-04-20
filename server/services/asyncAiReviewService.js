/**
 * 异步AI审核服务 - 转发模块
 *
 * ⚠️ 此文件已重构为模块化结构
 *
 * 原有的 2,235 行代码已拆分为以下子模块：
 * - ai-review/index.js: 主入口，服务协调
 * - ai-review/utils.js: 工具函数（字符串比较、错误分类等）
 * - ai-review/content-extractor.js: 内容提取（页面内容、关键词检查等）
 * - ai-review/commission.js: 佣金处理（积分发放、推荐佣金等）
 * - ai-review/client-verification.js: 客户端验证（验证流程处理）
 *
 * 为保持向后兼容性，此文件直接转发到新模块。
 * 所有现有代码的 require('./asyncAiReviewService') 无需修改。
 *
 * @deprecated 请直接使用 require('./ai-review') 导入
 */

module.exports = require('./ai-review');
