const mongoose = require('mongoose');

// 评论线索 - 存储高质量评论（真正需要帮助的受害者）
const commentLeadSchema = new mongoose.Schema({
  // 笔记信息
  noteUrl: { type: String, required: true, index: true },
  noteId: { type: String, index: true },
  noteTitle: { type: String, default: '' },
  noteAuthor: { type: String, default: '' },
  keyword: { type: String, default: '' }, // 发现笔记的关键词

  // 评论信息
  commentAuthor: { type: String, default: '' }, // 评论者昵称
  commentAuthorId: { type: String, default: '' }, // 评论者ID
  commentContent: { type: String, required: true },
  commentId: { type: String, default: '' }, // 评论ID (用于生成跳转链接 #comment-{id})
  commentUrl: { type: String, default: '' }, // 评论链接
  commentTime: { type: Date, default: null }, // 评论时间

  // AI分析
  aiAnalysis: {
    isSpam: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    type: { type: String, default: '' }, // '引流', '同行', '帮助者'
    confidence: { type: Number, default: 0 }
  },

  // 状态
  status: {
    type: String,
    enum: ['pending', 'processed', 'contacted', 'converted', 'invalid'],
    default: 'pending'
  },

  // 跟进信息
  followUp: {
    contacted: { type: Boolean, default: false },
    contactedAt: { type: Date, default: null },
    notes: { type: String, default: '' }
  },

  // 发现信息
  clientId: { type: String, default: null },
  discoverTime: { type: Date, default: Date.now },

  // 操作人员追踪
  lastOperatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastOperatedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// 复合索引
commentLeadSchema.index({ noteUrl: 1, commentAuthor: 1, commentContent: 1 }, { unique: true });
commentLeadSchema.index({ status: 1, discoverTime: -1 });
commentLeadSchema.index({ keyword: 1, discoverTime: -1 });

module.exports = mongoose.model('CommentLead', commentLeadSchema);
