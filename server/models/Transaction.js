const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  imageReview_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageReview',
    required: function() {
      return this.type !== 'point_exchange'; // 积分兑换不需要审核记录
    },
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
    enum: ['task_reward', 'referral_bonus', 'referral_bonus_1', 'referral_bonus_2', 'withdrawal', 'point_exchange'],
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  paid_at: {
    type: Date
  },
  paid_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  paid_by_name: {
    type: String
  },
  // 阿里支付相关字段
  alipay_order_id: {
    type: String,
    index: true
  },
  alipay_pay_date: {
    type: String
  },
  payment_status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed'],
    default: 'pending'
  },
  payment_error: {
    type: String
  },
  payment_error_code: {
    type: String
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