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
  createdAt: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// 移除有问题的中间件

module.exports = mongoose.model('TaskConfig', taskConfigSchema);