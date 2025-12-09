const mongoose = require('mongoose');

const imageReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  imageType: {
    type: String,
    enum: ['customer_resource', 'note', 'comment'],
    required: true
  },
  snapshotPrice: {
    type: Number,
    required: true,
    default: function() {
      // 根据图片类型设置默认价格
      const priceMap = {
        'customer_resource': 10.00,
        'note': 8.00,
        'comment': 3.00
      };
      return priceMap[this.imageType] || 0;
    }
  },
  snapshotCommission1: {
    type: Number,
    default: 0
  },
  snapshotCommission2: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'mentor_approved', 'manager_rejected', 'manager_approved', 'finance_processing', 'completed', 'rejected'],
    default: 'pending'
  },
  mentorReview: {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approved: Boolean,
    comment: String,
    reviewedAt: Date
  },
  managerApproval: {
    approved: Boolean,
    comment: String,
    approvedAt: Date
  },
  financeProcess: {
    amount: Number,
    commission: Number, // 佣金
    processedAt: Date
  },
  rejectionReason: String, // 保留向后兼容
  deviceInfo: {
    accountName: String,
    status: {
      type: String,
      enum: ['online', 'offline', 'protected', 'frozen']
    },
    influence: {
      type: [String],
      enum: ['new', 'old', 'real_name', 'opened_shop'],
      default: ['new']
    }
  },
  auditHistory: [{
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    operatorName: String, // 操作人姓名
    action: {
      type: String,
      enum: ['submit', 'mentor_pass', 'mentor_reject', 'manager_approve', 'manager_reject', 'finance_process']
    },
    comment: String, // 操作意见
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
imageReviewSchema.index({ userId: 1, createdAt: -1 });
imageReviewSchema.index({ status: 1 });

module.exports = mongoose.model('ImageReview', imageReviewSchema);