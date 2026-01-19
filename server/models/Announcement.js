const mongoose = require('mongoose');

/**
 * 公告模型
 * 用于首页顶部公告栏，支持富文本内容滚动显示
 */
const AnnouncementSchema = new mongoose.Schema({
  // 公告标题（简短标题，用于管理后台显示）
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // 公告内容（富文本HTML，用于详情展示）
  content: {
    type: String,
    required: true
  },

  // 字体颜色
  textColor: {
    type: String,
    default: '#ffffff'
  },

  // 字体大小
  fontSize: {
    type: String,
    default: '28'
  },

  // 公告类型：info-信息, success-成功, warning-警告, error-错误
  type: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },

  // 排序顺序（数字越小越靠前）
  order: {
    type: Number,
    default: 0
  },

  // 是否启用
  enabled: {
    type: Boolean,
    default: true
  },

  // 是否置顶
  isPinned: {
    type: Boolean,
    default: false
  },

  // 点击后跳转类型：none-无操作, link-链接, page-页面
  actionType: {
    type: String,
    enum: ['none', 'link', 'page'],
    default: 'none'
  },

  // 跳转链接/页面路径
  actionData: {
    type: String,
    default: ''
  },

  // 创建者
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // 更新者
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true // 自动添加 createdAt 和 updatedAt
});

// 索引
AnnouncementSchema.index({ enabled: 1, order: 1 });
AnnouncementSchema.index({ isPinned: -1, order: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
