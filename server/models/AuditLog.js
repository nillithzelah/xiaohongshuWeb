const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // 操作类型
  operation: {
    type: String,
    required: true,
    enum: [
      'finance_process',    // 财务处理
      'finance_pay',        // 财务打款
      'ai_auto_approved',   // AI自动审核
      'user_login',         // 用户登录
      'admin_login',        // 管理员登录
      'review_submit',      // 审核提交
      'review_mentor',      // 带教审核
      'review_manager',     // 主管审核
      'error'              // 错误记录
    ]
  },

  // 操作者信息
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // AI操作可能没有操作者
  },

  operatorName: {
    type: String,
    required: true
  },

  // 目标对象ID
  targetId: {
    type: String,
    required: true
  },

  // 具体操作
  action: {
    type: String,
    required: true
  },

  // 操作详情
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // 操作前状态
  beforeState: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // 操作后状态
  afterState: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // 结果状态
  result: {
    type: String,
    enum: ['success', 'failed', 'partial'],
    default: 'success'
  },

  // 错误信息（如果有）
  errorMessage: {
    type: String,
    default: ''
  },

  // 网络信息
  ip: {
    type: String,
    default: ''
  },

  userAgent: {
    type: String,
    default: ''
  },

  // 时间戳
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// 索引优化
auditLogSchema.index({ operation: 1, timestamp: -1 });
auditLogSchema.index({ operator: 1, timestamp: -1 });
auditLogSchema.index({ targetId: 1, timestamp: -1 });

// 静态方法：清理过期日志（保留最近6个月）
auditLogSchema.statics.cleanupOldLogs = async function() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const result = await this.deleteMany({
    timestamp: { $lt: sixMonthsAgo }
  });

  console.log(`清理了 ${result.deletedCount} 条过期审计日志`);
  return result;
};

// 实例方法：格式化日志
auditLogSchema.methods.formatLog = function() {
  return {
    id: this._id,
    operation: this.operation,
    operator: this.operatorName,
    action: this.action,
    targetId: this.targetId,
    result: this.result,
    timestamp: this.timestamp,
    details: this.details,
    errorMessage: this.errorMessage
  };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);