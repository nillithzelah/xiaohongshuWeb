const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  accountId: {
    type: String,
    trim: true,
    default: ''
  },
  accountName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'protected', 'frozen'],
    default: 'online'
  },
  influence: {
    type: [String],
    enum: ['new', 'old', 'real_name', 'opened_shop'],
    default: ['new'],
    validate: {
      validator: function(v) {
        // 确保数组不为空
        if (!Array.isArray(v) || v.length === 0) return false;
        // 检查新号和老号是否同时存在
        if (v.includes('new') && v.includes('old')) return false;
        return true;
      },
      message: '影响力至少选择一项，且新号和老号不能同时选择'
    }
  },
  onlineDuration: {
    type: Number,
    default: 0,
    min: 0
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  remark: {
    type: String,
    trim: true,
    default: ''
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// 索引
deviceSchema.index({ accountName: 1 });
deviceSchema.index({ assignedUser: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Device', deviceSchema);