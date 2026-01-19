const mongoose = require('mongoose');

const cookiePoolSchema = new mongoose.Schema({
  cookie: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'rate_limited', 'disabled'],
    default: 'active'
  },
  metadata: {
    a1: String,           // a1字段（用于快速识别）
    userId: String,       // 用户ID
    loadts: String,       // 时间戳
    source: String,       // 来源：手动添加/API导入
    addTime: Date,        // 添加时间
    lastUsed: Date,       // 最后使用时间
    lastCheck: Date,      // 最后检查时间
    expireTime: Date,     // 预计过期时间
    useCount: {           // 使用次数
      type: Number,
      default: 0
    },
    failCount: {          // 失败次数
      type: Number,
      default: 0
    },
    successCount: {       // 成功次数
      type: Number,
      default: 0
    }
  },
  performance: {
    avgResponseTime: Number,  // 平均响应时间(ms)
    successRate: Number,      // 成功率 (0-1)
    lastError: String,        // 最后一次错误
    lastErrorTime: Date       // 最后一次错误时间
  },
  notes: {
    type: String,
    maxlength: 500
  },
  priority: {
    type: Number,
    default: 0  // 优先级，数字越大越优先使用
  }
}, {
  timestamps: true
});

// 索引
cookiePoolSchema.index({ status: 1, priority: -1 });
cookiePoolSchema.index({ 'metadata.lastUsed': 1 });

module.exports = mongoose.model('CookiePool', cookiePoolSchema);
