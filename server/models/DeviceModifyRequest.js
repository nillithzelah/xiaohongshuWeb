const mongoose = require('mongoose');

// 设备修改申请模型
const deviceModifyRequestSchema = new mongoose.Schema({
  // 关联的设备
  device: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  // 设备账号名（冗余存储，防止设备删除后无法查询）
  deviceAccountName: {
    type: String,
    required: true
  },
  // 申请人
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 修改类型：account_name, account_url 等
  modifyType: {
    type: String,
    enum: ['account_name', 'account_url'],
    default: 'account_name'
  },
  // 原值
  oldValue: {
    type: String,
    required: true
  },
  // 新值
  newValue: {
    type: String,
    required: true
  },
  // 申请原因
  reason: {
    type: String,
    trim: true,
    default: ''
  },
  // 审核状态：pending, approved, rejected
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // 审核人
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // 审核时间
  reviewedAt: {
    type: Date,
    default: null
  },
  // 拒绝原因
  rejectReason: {
    type: String,
    trim: true,
    default: ''
  },
  // 处理备注
  note: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true
});

// 索引
deviceModifyRequestSchema.index({ device: 1 });
deviceModifyRequestSchema.index({ applicant: 1 });
deviceModifyRequestSchema.index({ status: 1 });
deviceModifyRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeviceModifyRequest', deviceModifyRequestSchema);
