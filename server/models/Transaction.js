const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  imageReview_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageReview',
    required: true,
    index: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    required: true,
    enum: ['task_reward', 'referral_bonus', 'referral_bonus_1', 'referral_bonus_2'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'paid'],
    default: 'pending',
    index: true
  },
  paid_at: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// 复合索引优化查询
transactionSchema.index({ user_id: 1, status: 1 });
transactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);