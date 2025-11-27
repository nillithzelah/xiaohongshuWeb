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
  commission: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// 更新时自动更新updated_at
taskConfigSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

taskConfigSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});

module.exports = mongoose.model('TaskConfig', taskConfigSchema);