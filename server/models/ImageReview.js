const mongoose = require('mongoose');

const imageReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // AI识别的真实昵称（用于评论限制和小程序显示）
  nickname: {
    type: String,
    default: null
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
        'customer_resource': 10,
        'note': 8,
        'comment': 3
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
    author: String,     // 用户填写的作者昵称
    title: String,      // 用户填写的笔记标题
    comment: String,    // 用户填写的评论内容（评论类型专用）
    customerPhone: String, // 客户手机号
    customerWechat: String // 客户微信号
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
    },
    commentVerification: {  // 评论验证结果（仅评论类型）
      exists: Boolean,      // 评论是否存在
      confidence: Number,   // 验证信心度 (0-1)
      reason: String,       // 验证结果说明
      pageCommentCount: Number, // 页面评论总数
      scannedComments: Number,  // 扫描的评论数
      foundComments: [{     // 找到的匹配评论
        text: String,       // 评论文本
        author: String,     // 评论作者
        contentMatch: Number, // 内容匹配度
        authorMatch: Number   // 作者匹配度
      }],
      pageComments: [{      // 页面评论列表（用于显示）
        text: String,       // 评论文本
        author: String      // 评论作者
      }]
    }
  },
  // 第一次审核失败原因（用于第二次审核失败时保持一致的原因描述）
  firstReviewFailureReason: {
    type: String,
    default: null
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
      enum: ['online', 'offline', 'protected', 'frozen', 'reviewing']
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
      enum: ['submit', 'mentor_pass', 'mentor_reject', 'manager_approve', 'manager_reject', 'finance_process', 'ai_auto_approved', 'daily_check_passed', 'daily_check_failed', 'note_deleted']
    },
    comment: String, // 操作意见
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // 持续存在性检查相关字段（仅对笔记类型）
  continuousCheck: {
    enabled: {
      type: Boolean,
      default: false // 是否启用持续检查
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'], // active: 笔记存在，继续检查; inactive: 暂停检查; deleted: 笔记已删除，停止检查
      default: 'inactive'
    },
    lastCheckTime: Date, // 最后检查时间
    nextCheckTime: Date, // 下次检查时间（每天9点）
    checkHistory: [{ // 检查历史记录
      checkTime: Date, // 检查时间
      result: {
        type: String,
        enum: ['success', 'failed', 'error']
      },
      noteExists: Boolean, // 笔记是否存在
      rewardPoints: Number, // 奖励积分（0.3）
      errorMessage: String // 错误信息
    }]
  },
  // 审核尝试次数（用于延迟重试机制）
  reviewAttempt: {
    type: Number,
    default: 1,
    min: 1,
    max: 2,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 1 && v <= 2;
      },
      message: '审核尝试次数必须是1或2'
    },
    comment: '审核尝试次数，1表示第一次尝试，2表示第二次尝试'
  },
  createdAt: {
    type: Date,
    default: () => {
      const now = new Date();
      const beijingOffset = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）
      return new Date(now.getTime() + beijingOffset);
    }
  }
});

// 自定义验证器：限制数组最大长度为9，允许空数组
function arrayLimit(val) {
  return val.length <= 9;
}

// 确保noteUrl字段总是被包含在输出中
// imageReviewSchema.set('toJSON', { getters: true, virtuals: false });
// imageReviewSchema.set('toObject', { getters: true, virtuals: false });

// 索引
imageReviewSchema.index({ userId: 1, createdAt: -1 });
imageReviewSchema.index({ status: 1 });
imageReviewSchema.index({ 'imageUrls': 1 }); // 新增图片数组索引
imageReviewSchema.index({ 'imageMd5s': 1 }); // 新增MD5数组索引
// 用户账号评论限制查询索引
imageReviewSchema.index({ userId: 1, imageType: 1, noteUrl: 1, status: 1 });
// 昵称评论限制查询索引
imageReviewSchema.index({ 'aiParsedNoteInfo.author': 1, imageType: 1, noteUrl: 1, status: 1 });
// 持续检查相关索引
imageReviewSchema.index({ 'continuousCheck.enabled': 1 });
imageReviewSchema.index({ 'continuousCheck.status': 1 });
imageReviewSchema.index({ 'continuousCheck.nextCheckTime': 1 });

module.exports = mongoose.model('ImageReview', imageReviewSchema);