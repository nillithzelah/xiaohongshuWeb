const mongoose = require('mongoose');

/**
 * ShortLinkPool - 短链接池模型
 *
 * 用于存储待审核的小红书短链接，由外部系统写入，审核客户端处理
 */
const shortLinkPoolSchema = new mongoose.Schema({
  // 短链接（唯一索引，格式如：https://xhslink.com/xxxxx）
  shortUrl: {
    type: String,
    required: true,
    unique: true
  },
  // 状态
  status: {
    type: String,
    enum: ['pending', 'processing', 'approved', 'rejected', 'failed'],
    default: 'pending',
    index: true
  },
  // 来源（外部系统标识，用于追踪短链接来源）
  source: {
    type: String,
    default: 'external'
  },
  // 备注信息（可选，外部系统可添加说明）
  remark: {
    type: String,
    default: null
  },
  // 审核成功后关联的笔记ID（从shortUrl解析或从页面提取）
  noteId: {
    type: String,
    default: null
  },
  // 审核结果
  auditResult: {
    is_genuine_victim_post: {
      type: Boolean,
      default: false
    },
    confidence_score: {
      type: Number,
      default: 0
    },
    reason: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    author: {
      type: String,
      default: ''
    },
    publishTime: {
      type: Date,
      default: null
    }
  },
  // 处理锁（防止多客户端重复处理）
  processingLock: {
    clientId: String,
    lockedAt: Date,
    lockedUntil: Date
  },
  // 处理该短链接的客户端ID
  processedBy: {
    type: String,
    default: null
  },
  // 重试次数
  retryCount: {
    type: Number,
    default: 0
  },
  // 错误信息
  errorMessage: {
    type: String,
    default: null
  },
  // 关联的DiscoveredNote记录ID（审核通过后填充）
  discoveredNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscoveredNote',
    default: null
  }
}, {
  timestamps: true
});

// 索引优化
shortLinkPoolSchema.index({ status: 1, createdAt: -1 });
shortLinkPoolSchema.index({ 'processingLock.lockedUntil': 1 });
shortLinkPoolSchema.index({ source: 1, createdAt: -1 });

module.exports = mongoose.model('ShortLinkPool', shortLinkPoolSchema);
