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
  accountUrl: {
    type: String,
    trim: true,
    default: ''
  },
  assignedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'protected', 'frozen', 'reviewing'],
    default: 'offline'
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
  // 审核相关字段
  reviewStatus: {
    type: String,
    enum: ['pending', 'ai_approved', 'approved', 'rejected'],
    default: 'pending',
    comment: '审核状态：pending-待审核，ai_approved-AI审核通过，approved-人工审核通过，rejected-审核拒绝'
  },
  reviewImage: {
    type: String,
    trim: true,
    default: '',
    comment: '审核图片URL，小红薯个人页面截图'
  },
  reviewReason: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
    comment: '审核拒绝原因'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    comment: '审核人ID'
  },
  reviewedAt: {
    type: Date,
    default: null,
    comment: '审核时间'
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
    default: () => {
      const now = new Date();
      const beijingOffset = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）
      return new Date(now.getTime() + beijingOffset);
    }
  }
});

// 更新时间中间件
deviceSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  }
  next();
});

// 索引
deviceSchema.index({ accountName: 1 });
deviceSchema.index({ assignedUser: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Device', deviceSchema);