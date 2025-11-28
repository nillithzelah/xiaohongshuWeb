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
    enum: ['login_qr', 'note', 'comment'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'cs_review', 'boss_approved', 'finance_done', 'completed', 'rejected'],
    default: 'pending'
  },
  csReview: {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approved: Boolean,
    comment: String,
    reviewedAt: Date
  },
  bossApproval: {
    approved: Boolean,
    comment: String,
    approvedAt: Date
  },
  financeProcess: {
    amount: Number,
    commission: Number, // 佣金
    processedAt: Date
  },
  rejectionReason: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 索引
imageReviewSchema.index({ userId: 1, createdAt: -1 });
imageReviewSchema.index({ status: 1 });

module.exports = mongoose.model('ImageReview', imageReviewSchema);