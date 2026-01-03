const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'resolved', 'closed'],
    default: 'pending'
  },
  adminResponse: {
    type: String,
    trim: true
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  respondedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: () => {
      const now = new Date();
      const beijingOffset = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）
      return new Date(now.getTime() + beijingOffset);
    }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 更新时间中间件
complaintSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 索引
complaintSchema.index({ userId: 1, createdAt: -1 });
complaintSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Complaint', complaintSchema);