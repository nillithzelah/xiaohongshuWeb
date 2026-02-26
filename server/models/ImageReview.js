const mongoose = require('mongoose');

// 导入常量
const {
  IMAGE_TYPES,
  IMAGE_TYPE_LIST,
  IMAGE_TYPE_PRICES,
  REVIEW_STATUS_LIST,
  DEVICE_STATUS_LIST
} = require('../../shared/constants');

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
    enum: IMAGE_TYPE_LIST,
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
      // 根据图片类型设置默认价格（使用常量配置）
      return IMAGE_TYPE_PRICES[this.imageType] || 0;
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
  // 本地客户端处理锁定（防止多设备重复处理）
  processingLock: {
    clientId: String,      // 客户端唯一标识
    lockedAt: Date,        // 锁定开始时间
    heartbeatAt: Date,     // 最后心跳时间
    lockedUntil: Date      // 锁定截止时间（超时自动释放）
  },
  status: {
    type: String,
    enum: REVIEW_STATUS_LIST,
    default: REVIEW_STATUS_LIST[0] // pending
  },
  // 客户端验证尝试信息（用于本地客户端验证流程）
  clientVerification: {
    attempt: {
      type: Number,
      default: 1,
      min: 1,
      max: 2
    },
    firstResult: {
      success: Boolean,
      verified: Boolean,
      comment: String,
      reason: String,         // 驳回原因（关键词+AI+评论验证）
      contentAudit: {        // 内容审核结果
        step: String,        // 审核步骤
        keywordReason: String, // 关键词检查原因
        aiReason: String,    // AI审核原因
        passed: Boolean      // 是否通过
      },
      verifiedAt: Date,
      screenshotUrl: String
    },
    secondResult: {
      success: Boolean,
      verified: Boolean,
      comment: String,
      reason: String,         // 驳回原因（关键词+AI+评论验证）
      contentAudit: {        // 内容审核结果
        step: String,        // 审核步骤
        keywordReason: String, // 关键词检查原因
        aiReason: String,    // AI审核原因
        passed: Boolean      // 是否通过
      },
      verifiedAt: Date,
      screenshotUrl: String
    },
    readyForSecondAttempt: {
      type: Boolean,
      default: false
    },
    secondAttemptReadyAt: {
      type: Date,
      default: null
    }
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
      enum: DEVICE_STATUS_LIST
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
      enum: ['submit', 'mentor_pass', 'mentor_reject', 'manager_approve', 'manager_reject', 'finance_process', 'ai_auto_approved', 'ai_auto_rejected', 'daily_check_passed', 'daily_check_failed', 'note_deleted', 'points_reward', 'commission_reward', 'local_client_passed', 'local_client_rejected',
        'skip_server_audit', 'review_start', 'review_wait_complete']  // 添加旧值以兼容历史数据
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
      enum: ['active', 'inactive', 'deleted', 'expired'], // active: 笔记存在，继续检查; inactive: 暂停检查; deleted: 笔记已删除，停止检查; expired: 超过检查期限
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
    default: Date.now // 使用UTC时间存储
  }
});

// 自定义验证器：限制数组最大长度为9，允许空数组
function arrayLimit(val) {
  return val.length <= 9;
}

// 确保noteUrl字段总是被包含在输出中
// imageReviewSchema.set('toJSON', { getters: true, virtuals: false });
// imageReviewSchema.set('toObject', { getters: true, virtuals: false });

// 索引 - 优化查询性能
imageReviewSchema.index({ userId: 1, createdAt: -1 });
imageReviewSchema.index({ status: 1 });
imageReviewSchema.index({ imageType: 1 });
imageReviewSchema.index({ 'imageUrls': 1 }); // 新增图片数组索引
imageReviewSchema.index({ 'imageMd5s': 1 }); // 新增MD5数组索引

// 用户账号评论限制查询索引
imageReviewSchema.index({ userId: 1, imageType: 1, noteUrl: 1, status: 1 });

// 昵称评论限制查询索引
imageReviewSchema.index({ 'aiParsedNoteInfo.author': 1, imageType: 1, noteUrl: 1, status: 1 });

// 审核相关索引 - 优化审核查询性能
imageReviewSchema.index({ 'mentorReview.reviewer': 1 });
imageReviewSchema.index({ 'auditHistory.operator': 1 });
imageReviewSchema.index({ 'auditHistory.action': 1 });
imageReviewSchema.index({ 'auditHistory.timestamp': -1 });

// AI自动审核索引
imageReviewSchema.index({ 'auditHistory.action': 1, 'auditHistory.timestamp': -1 });

// 复合索引 - 优化复杂查询
imageReviewSchema.index({ status: 1, userId: 1, createdAt: -1 });
imageReviewSchema.index({ status: 1, 'mentorReview.reviewer': 1 });

// 持续检查相关索引
imageReviewSchema.index({ 'continuousCheck.enabled': 1 });
imageReviewSchema.index({ 'continuousCheck.status': 1 });
imageReviewSchema.index({ 'continuousCheck.nextCheckTime': 1 });

module.exports = mongoose.model('ImageReview', imageReviewSchema);