const mongoose = require('mongoose');

// 评论黑名单 - 存储引流用户昵称
const commentBlacklistSchema = new mongoose.Schema({
  // 用户信息
  nickname: { type: String, required: true, unique: true, index: true },
  userId: { type: String, default: '', index: true }, // 小红书用户ID

  // 黑名单原因
  reason: {
    type: String,
    enum: ['引流', '同行', '帮助者', '广告'],
    default: '引流'
  },
  commentContent: { type: String, default: '' }, // 触发黑名单的评论内容

  // 统计
  reportCount: { type: Number, default: 1 }, // 被举报次数
  noteCount: { type: Number, default: 1 }, // 涉及笔记数

  // 过期时间（默认一周后可重新查询）
  expireAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后
    },
    index: { expireAfterSeconds: 0 }
  },

  // 发现信息
  lastSeenAt: { type: Date, default: Date.now },
  clientId: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('CommentBlacklist', commentBlacklistSchema);
