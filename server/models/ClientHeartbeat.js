const mongoose = require('mongoose');

/**
 * 客户端心跳模型
 * 用于追踪客户端在线状态
 */
const clientHeartbeatSchema = new mongoose.Schema({
  // 客户端唯一标识
  clientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // 客户端类型: audit, harvest, discovery, short-link, blacklist-scan
  clientType: {
    type: String,
    default: 'audit',
    enum: ['audit', 'harvest', 'discovery', 'short-link', 'blacklist-scan', 'unknown']
  },
  // 客户端描述（用于标识客户端用途）
  description: {
    type: String,
    default: ''
  },
  // 客户端备注（人工输入，用于记忆）
  remark: {
    type: String,
    default: ''
  },
  // 客户端状态: online, idle, offline
  status: {
    type: String,
    default: 'online',
    enum: ['online', 'idle', 'offline']
  },
  // 最后心跳时间
  lastHeartbeat: {
    type: Date,
    default: Date.now,
    index: true
  },
  // 正在处理的任务ID列表
  taskIds: [{
    type: String
  }],
  // 首次发现时间
  firstSeenAt: {
    type: Date,
    default: Date.now
  }

  // ==================== 任务分发健康度追踪 ====================
  // 上次成功上传时间
  , lastSuccessUploadAt: {
    type: Date,
    default: null
  }
  // 上次上传的评论数量
  , lastUploadCount: {
    type: Number,
    default: 0
  }
  // 连续失败次数（上传0条或失败）
  , consecutiveFailures: {
    type: Number,
    default: 0
  }
  // 累计成功上传次数
  , totalSuccessCount: {
    type: Number,
    default: 0
  }
  // 累计失败次数
  , totalFailureCount: {
    type: Number,
    default: 0
  }
  // 是否暂停任务分发（当连续失败过多时自动暂停）
  , taskDistributionPaused: {
    type: Boolean,
    default: false
  }
  // 暂停原因
  , pauseReason: {
    type: String,
    default: null
  }
  // 暂停时间
  , pausedAt: {
    type: Date,
    default: null
  }

  // ==================== 累计统计（按客户端类型）====================
  // 发现客户端：发现的笔记数
  , totalNotesDiscovered: {
    type: Number,
    default: 0
  }
  // 采集客户端：处理的笔记数（不管是否产生有效线索）
  , totalNotesProcessed: {
    type: Number,
    default: 0
  }
  // 采集客户端：采集的评论数
  , totalCommentsCollected: {
    type: Number,
    default: 0
  }
  // 采集客户端：合格的线索评论数
  , totalValidLeads: {
    type: Number,
    default: 0
  }
  // 黑名单扫描客户端：扫描的评论数
  , totalCommentsScanned: {
    type: Number,
    default: 0
  }
  // 黑名单扫描客户端：添加到黑名单的用户数
  , totalBlacklisted: {
    type: Number,
    default: 0
  }
  // 审核客户端：完成的审核任务数
  , totalReviewsCompleted: {
    type: Number,
    default: 0
  }
  // 今日统计（每日重置）
  , todayNotesDiscovered: {
    type: Number,
    default: 0
  }
  // 采集客户端：今日处理的笔记数
  , todayNotesProcessed: {
    type: Number,
    default: 0
  }
  , todayCommentsCollected: {
    type: Number,
    default: 0
  }
  , todayValidLeads: {
    type: Number,
    default: 0
  }
  , todayCommentsScanned: {
    type: Number,
    default: 0
  }
  , todayBlacklisted: {
    type: Number,
    default: 0
  }
  , todayReviewsCompleted: {
    type: Number,
    default: 0
  }
  , todayDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  }

}, {
  timestamps: true
});

// 复合索引：查询在线客户端
clientHeartbeatSchema.index({ lastHeartbeat: -1 });

// 清理过期数据（7天前的心跳记录）
clientHeartbeatSchema.statics.cleanupOldHeartbeats = async function() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await this.deleteMany({
    lastHeartbeat: { $lt: sevenDaysAgo }
  });
  return result.deletedCount;
};

module.exports = mongoose.model('ClientHeartbeat', clientHeartbeatSchema);
