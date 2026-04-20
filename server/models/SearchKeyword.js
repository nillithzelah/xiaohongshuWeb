const mongoose = require('mongoose');

/**
 * SearchKeyword - 搜索关键词模型
 *
 * 用于存储笔记发现功能使用的搜索关键词
 * 支持多设备协同搜索，避免重复
 */
const searchKeywordSchema = new mongoose.Schema({
  // 关键词
  keyword: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 分类
  category: {
    type: String,
    default: ''
  },
  // 状态
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // 搜索锁定信息（用于多设备协同，避免重复搜索同一关键词）
  searchLock: {
    isLocked: { type: Boolean, default: false },
    lockedBy: { type: String, default: null },      // 锁定的客户端ID
    lockedAt: { type: Date, default: null },        // 锁定时间
    lockedUntil: { type: Date, default: null }     // 锁定过期时间（防止死锁）
  },
  // 统计信息
  searchCount: { type: Number, default: 0 },        // 被搜索次数
  lastSearchAt: { type: Date, default: null }       // 最后搜索时间
}, {
  timestamps: true
});

// 索引优化
searchKeywordSchema.index({ status: 1 });
searchKeywordSchema.index({ category: 1 });
searchKeywordSchema.index({ 'searchLock.isLocked': 1 });  // 用于快速查找未锁定的关键词

// 自动清理过期锁定的静态方法
searchKeywordSchema.statics.releaseExpiredLocks = async function() {
  const now = new Date();
  const result = await this.updateMany(
    { 'searchLock.lockedUntil': { $lt: now } },
    {
      $set: {
        'searchLock.isLocked': false,
        'searchLock.lockedBy': null,
        'searchLock.lockedAt': null,
        'searchLock.lockedUntil': null
      }
    }
  );
  return result.modifiedCount;
};

module.exports = mongoose.model('SearchKeyword', searchKeywordSchema);
