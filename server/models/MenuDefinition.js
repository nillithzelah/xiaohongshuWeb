const mongoose = require('mongoose');

/**
 * 菜单定义模型
 * 存储系统中所有可用的菜单项及其层级结构
 */
const menuDefinitionSchema = new mongoose.Schema({
  // 菜单唯一标识（用于权限配置）
  key: {
    type: String,
    required: true,
    unique: true
  },
  // 菜单显示名称
  label: {
    type: String,
    required: true
  },
  // 菜单图标（Ant Design Icon名称）
  icon: {
    type: String,
    default: null
  },
  // 路由路径
  path: {
    type: String,
    default: null
  },
  // 父菜单key（null表示顶级菜单）
  parentKey: {
    type: String,
    default: null
  },
  // 排序序号（同级菜单按此排序）
  sortOrder: {
    type: Number,
    default: 0
  },
  // 是否为分组标题（不可点击，仅用于组织子菜单）
  isGroup: {
    type: Boolean,
    default: false
  },
  // 是否启用（禁用的菜单不会显示）
  enabled: {
    type: Boolean,
    default: true
  },
  // 菜单分类（便于管理和分组）
  category: {
    type: String,
    enum: ['dashboard', 'review', 'monitoring', 'content', 'user', 'device', 'financial', 'system'],
    default: 'system'
  },
  // 描述
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// 索引
menuDefinitionSchema.index({ key: 1 });
menuDefinitionSchema.index({ parentKey: 1 });
menuDefinitionSchema.index({ sortOrder: 1 });
menuDefinitionSchema.index({ enabled: 1 });

module.exports = mongoose.model('MenuDefinition', menuDefinitionSchema);
