/*
 * 此模型已被废弃，已由 CommentLimit 模型替代
 * CommentLimit 提供更完善的评论限制和重复检查功能
 * 只在审核通过后记录，避免提交时和审核后的状态不一致
 */

/*
const mongoose = require('mongoose');

const submissionTrackerSchema = new mongoose.Schema({
  noteUrl: {
    type: String,
    required: true,
    index: true
  },
  nickname: {
    type: String,
    required: true,
    index: true
  },
  count: {
    type: Number,
    default: 1
  },
  comments: [{
    type: String,
    trim: true
  }],
  lastSubmissionTime: {
    type: Date,
    default: Date.now
  }
});

// 建立复合索引，让查询快到飞起
submissionTrackerSchema.index({ noteUrl: 1, nickname: 1 }, { unique: true });

module.exports = mongoose.model('SubmissionTracker', submissionTrackerSchema);
*/