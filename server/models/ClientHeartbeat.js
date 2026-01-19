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
  // 客户端类型: audit, harvest, discovery
  clientType: {
    type: String,
    default: 'audit',
    enum: ['audit', 'harvest', 'discovery', 'unknown']
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
