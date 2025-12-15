const mongoose = require('mongoose');

const imageReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // 支持多图：将单图字段改为数组
  imageUrls: {
    type: [String],
    required: true,
    validate: [arrayLimit, '最多只能上传9张图片']
  },
  imageType: {
    type: String,
    enum: ['customer_resource', 'note', 'comment'],
    required: true
  },
  // 支持多图MD5：将单图MD5改为数组
  imageMd5s: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length === this.imageUrls.length;
      },
      message: '图片和MD5数量必须匹配'
    }
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
  // 小红书笔记链接（笔记必填，评论选填）
  noteUrl: {
    type: String,
    required: false,
    default: null,
    set: function(v) {
      // 确保即使是null值也会被保存
      return v === undefined ? null : v;
    }
  },
  // 用户提供的笔记信息（用于AI审核比对）
  userNoteInfo: {
    author: String, // 用户填写的作者昵称
    title: String   // 用户填写的笔记标题
  },
  // AI审核解析的笔记信息
  aiParsedNoteInfo: {
    author: String,      // 从页面解析的作者昵称
    title: String,       // 从页面解析的标题
    publishTime: Date,   // 发布时间
    likes: Number,       // 点赞数
    collects: Number,    // 收藏数
    comments: Number     // 评论数
  },
  // AI审核结果
  aiReviewResult: {
    passed: Boolean,        // 是否通过
    confidence: Number,     // 信心度 (0-1)
    riskLevel: String,      // 风险等级: low, medium, high
    reasons: [String],      // 审核理由
    contentMatch: {         // 内容匹配结果
      authorMatch: Number,  // 作者匹配度 (0-100)
      titleMatch: Number,   // 标题匹配度 (0-100)
      pageAuthor: String,   // 页面解析的作者
      pageTitle: String     // 页面解析的标题
    }
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
      enum: ['submit', 'mentor_pass', 'mentor_reject', 'manager_approve', 'manager_reject', 'finance_process', 'ai_auto_approved']
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

// 自定义验证器：限制数组最大长度为9
function arrayLimit(val) {
  return val.length <= 9 && val.length > 0;
}

// 确保noteUrl字段总是被包含在输出中
// imageReviewSchema.set('toJSON', { getters: true, virtuals: false });
// imageReviewSchema.set('toObject', { getters: true, virtuals: false });

// 索引
imageReviewSchema.index({ userId: 1, createdAt: -1 });
imageReviewSchema.index({ status: 1 });
imageReviewSchema.index({ 'imageUrls': 1 }); // 新增图片数组索引
imageReviewSchema.index({ 'imageMd5s': 1 }); // 新增MD5数组索引

module.exports = mongoose.model('ImageReview', imageReviewSchema);