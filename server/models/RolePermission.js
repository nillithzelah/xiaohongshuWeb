const mongoose = require('mongoose');

/**
 * 角色权限模型
 * 存储每个角色可访问的菜单项列表
 */
const rolePermissionSchema = new mongoose.Schema({
  // 角色名称
  role: {
    type: String,
    required: true,
    enum: ['part_time', 'mentor', 'boss', 'finance', 'manager', 'hr', 'lead', 'promoter'],
    unique: true
  },
  // 可访问的菜单key列表
  allowedMenus: [{
    type: String
  }],
  // 最后修改人
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // 最后修改时间
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引
rolePermissionSchema.index({ role: 1 });

// 保存前自动更新 updatedAt
rolePermissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
