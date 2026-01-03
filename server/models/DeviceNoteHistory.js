const mongoose = require('mongoose');

const deviceNoteHistorySchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  noteUrl: {
    type: String,
    required: true,
    trim: true
  },
  noteTitle: {
    type: String,
    required: true,
    trim: true
  },
  noteAuthor: {
    type: String,
    required: true,
    trim: true
  },
  imageReviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImageReview',
    required: true
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

// 索引
deviceNoteHistorySchema.index({ deviceId: 1, createdAt: -1 });
deviceNoteHistorySchema.index({ userId: 1, createdAt: -1 });
deviceNoteHistorySchema.index({ noteUrl: 1 });

module.exports = mongoose.model('DeviceNoteHistory', deviceNoteHistorySchema);