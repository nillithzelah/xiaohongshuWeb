const mongoose = require('mongoose');

/**
 * DiscoveredNote - 自动发现的笔记模型
 *
 * 用于存储客户端自动采集发现的维权笔记
 */
const discoveredNoteSchema = new mongoose.Schema({
  // 笔记URL（可能包含动态参数xsec_token，不作为唯一标识）
  noteUrl: {
    type: String,
    required: true
  },
  // 笔记ID（从小红书URL提取，作为唯一标识进行查重）
  noteId: {
    type: String,
    index: true,
    unique: true
  },
  // 笔记标题
  title: {
    type: String,
    default: ''
  },
  // 笔记作者
  author: {
    type: String,
    default: ''
  },
  // 发布时间
  publishTime: {
    type: Date,
    default: null
  },
  // 搜索关键词（通过哪个关键词发现的）
  keyword: {
    type: String,
    default: ''
  },
  // AI分析结果（discovery客户端采集时的分析）
  aiAnalysis: {
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
    scam_category: {
      type: String,
      default: ''
    }
  },
  // 删除检测客户端的AI分析结果（独立于discovery的分析）
  deletionCheckAnalysis: {
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
    scam_category: {
      type: String,
      default: ''
    },
    checkedAt: {
      type: Date,
      default: null
    },
    // 使用的AI提示词版本（用于追踪分析结果）
    prompt_version: {
      type: String,
      default: ''
    }
  },
  // 删除复审客户端的AI分析结果（独立验证）
  deletionRecheckAnalysis: {
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
    scam_category: {
      type: String,
      default: ''
    },
    checkedAt: {
      type: Date,
      default: null
    },
    // 使用的AI提示词版本（用于追踪分析结果）
    prompt_version: {
      type: String,
      default: ''
    }
  },
  // 笔记状态
  status: {
    type: String,
    enum: ['discovered', 'verified', 'rejected'],
    default: 'discovered',
    index: true
  },
  // 发现该笔记的客户端ID
  clientId: {
    type: String,
    default: null
  },
  // 发现时间
  discoverTime: {
    type: Date,
    default: Date.now
  }
  // ==================== 评论采集相关字段 ====================
  // 是否需要采集评论（由定时任务设置）
  , needsCommentHarvest: {
    type: Boolean,
    default: true,
    index: true
  }
  // 是否已采集过评论
  , commentsHarvested: {
    type: Boolean,
    default: false,
    index: true
  }
  // 评论采集时间
  , commentsHarvestedAt: {
    type: Date,
    default: null
  }
  // 采集到的评论数量
  , lastCommentCount: {
    type: Number,
    default: 0
  }

  // ==================== 短链接转换相关字段 ====================
  // 手机端短链接（xhslink.com 格式，永久有效）
  , shortUrl: {
    type: String,
    default: null
  }
  // 短链接转换时间
  , shortUrlConvertedAt: {
    type: Date,
    default: null
  }
  // 短链接状态（用于标记笔记无效情况）
  , shortUrlStatus: {
    type: String,
    enum: ['pending', 'completed', 'deleted', 'invalid'],
    default: 'pending'
  }
  // 短链接转换锁（防止多客户端重复处理）
  , shortUrlProcessingLock: {
    clientId: String,
    lockedAt: Date,
    lockedUntil: Date
  }
  // 短链接获取锁定（供外部API使用，防止多客户端重复获取同一条）
  , lockedBy: {
    type: String,
    default: null
  }
  , lockedAt: {
    type: Date,
    default: null
  }

  // ==================== 采集任务锁定相关字段 ====================
  // 采集任务锁（防止多客户端重复采集同一笔记）
  , harvestLock: {
    clientId: String,
    lockedAt: Date,
    lockedUntil: Date
  }

  // ==================== 黑名单扫描相关字段 ====================
  // 是否已扫描过黑名单昵称
  , blacklistSearched: {
    type: Boolean,
    default: false,
    index: true
  }
  // 黑名单扫描时间
  , blacklistSearchedAt: {
    type: Date,
    default: null
  }
  // 黑名单扫描锁（防止多客户端重复扫描）
  , blacklistScanLock: {
    clientId: String,
    lockedAt: Date,
    lockedUntil: Date
  }

  // ==================== 采集优先级相关字段 ====================
  // 采集优先级（根据评论新鲜度自动计算）
  // 10分=10分钟, 5分=1小时, 2分=6小时, 1分=24小时
  , harvestPriority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }

  // ==================== 采集失败计数相关字段 ====================
  // 采集连续失败次数（用于自动删除无效笔记）
  , harvestFailureCount: {
    type: Number,
    default: 0
  }
  // 最后一次失败原因
  , lastFailureReason: {
    type: String,
    default: null
  }
  // 最后一次失败时间
  , lastFailureAt: {
    type: Date,
    default: null
  }
  // 笔记无效标记（404/已删除/账号封禁等）
  , noteStatus: {
    type: String,
    enum: ['active', 'deleted', 'ai_rejected'],
    default: 'active'
  }
  // 删除时间
  , deletedAt: {
    type: Date,
    default: null
  }
  // 删除时通知的客户端ID
  , deletedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt
});

// 索引优化
discoveredNoteSchema.index({ status: 1, createdAt: -1 });
discoveredNoteSchema.index({ keyword: 1, discoverTime: -1 });
// 评论采集索引
discoveredNoteSchema.index({ needsCommentHarvest: 1, commentsHarvested: 1, createdAt: -1 });
// 短链接转换索引
discoveredNoteSchema.index({ shortUrl: 1 });
discoveredNoteSchema.index({ 'shortUrlProcessingLock.lockedUntil': 1 });
// 采集任务锁定索引
discoveredNoteSchema.index({ 'harvestLock.lockedUntil': 1 });
// 黑名单扫描索引
discoveredNoteSchema.index({ blacklistSearched: 1, createdAt: -1 });
discoveredNoteSchema.index({ 'blacklistScanLock.lockedUntil': 1 });
// 删除状态索引（用于管理后台筛选）
discoveredNoteSchema.index({ noteStatus: 1, createdAt: -1 });
// 采集优先级索引（用于采集任务排序）
discoveredNoteSchema.index({ commentsHarvestedAt: -1, harvestPriority: -1 });

module.exports = mongoose.model('DiscoveredNote', discoveredNoteSchema);
