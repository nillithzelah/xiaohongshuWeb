const mongoose = require('mongoose');

/**
 * DiscoveredNote - 自动发现的笔记模型
 *
 * 用于存储客户端自动采集发现的维权笔记
 */
const discoveredNoteSchema = new mongoose.Schema({
  // 笔记URL（唯一标识）
  noteUrl: {
    type: String,
    required: true,
    unique: true
  },
  // 笔记ID（从小红书URL提取）
  noteId: {
    type: String,
    index: true
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
  // AI分析结果
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
  // 短链接转换锁（防止多客户端重复处理）
  , shortUrlProcessingLock: {
    clientId: String,
    lockedAt: Date,
    lockedUntil: Date
  }

  // ==================== 采集优先级相关字段 ====================
  // 最后评论时间（用于计算采集优先级）
  , lastCommentTime: {
    type: Date,
    default: null
  }
  // 评论数量（用于评估笔记热度）
  , lastCommentCount: {
    type: Number,
    default: 0
  }
  // 采集优先级（根据评论新鲜度自动计算）
  // 10分=10分钟, 5分=1小时, 2分=6小时, 1分=12小时
  , harvestPriority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  }
  // 采集间隔（分钟）
  , harvestInterval: {
    type: Number,
    default: 720  // 默认12小时
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

module.exports = mongoose.model('DiscoveredNote', discoveredNoteSchema);
