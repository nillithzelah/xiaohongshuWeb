const mongoose = require('mongoose');

const taskConfigSchema = new mongoose.Schema({
  type_key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  commission_1: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  commission_2: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  daily_reward_points: {
    type: Number,
    default: 30
  },
  continuous_check_days: {
    type: Number,
    default: 7,
    min: 1,
    max: 365
  },
  createdAt: {
    type: Date,
    default: () => {
      const now = new Date();
      const beijingOffset = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）
      return new Date(now.getTime() + beijingOffset);
    }
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// 移除有问题的中间件

module.exports = mongoose.model('TaskConfig', taskConfigSchema);