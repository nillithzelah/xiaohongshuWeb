const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  openid: {
    type: String,
    default: () => `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    unique: true // 确保唯一性
  },
  username: {
    type: String,
    required: function() {
      return this.role !== 'lead'; // lead状态下可以为空
    }
  },
  password: {
    type: String,
    required: function() {
      return ['mentor', 'boss', 'finance', 'manager', 'hr'].includes(this.role);
    }
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['part_time', 'mentor', 'boss', 'finance', 'manager', 'hr', 'lead'],
    default: 'part_time'
  },

  // 基本信息
  nickname: String,
  phone: String,
  wechat: String,
  notes: String,

  // 带教老师专属字段
  integral_w: String, // 积分号W
  integral_z: String, // 积分号Z

  // 层级管理字段
  hr_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // 该用户归属于哪个HR
  },
  mentor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // 哪个带教老师在跟进这个用户
  },
  assigned_to_mentor_at: {
    type: Date,
    default: null // 分配给带教老师的时间
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // 上级用户（推荐人）
  },

  // 财务账户信息
  wallet: {
    alipay_account: {
      type: String
    },
    real_name: {
      type: String
    },
    total_income: {
      type: Number,
      default: 0
    }
  },

  // 兼容旧字段（后续可移除）
  points: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },

  // 持续检查积分（笔记存在性奖励）
  continuousCheckPoints: {
    type: Number,
    default: 0, // 累计获得的持续检查积分
    min: 0
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  // 培训状态（仅兼职用户）
  training_status: {
    type: String,
    enum: [
      '已筛选',
      '培训中',
      '业务实操',
      '评论能力培养',
      '发帖能力培养',
      '素人已申请发帖内容',
      '持续跟进',
      '已结业',
      '未通过',
      '中止'
    ],
    default: null // 默认为null，表示未设置
  },

  // 软删除相关字段
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: {
    type: Date,
    default: null
  }
});

// 密码加密中间件 (上帝模式下暂时移除)

// 索引
userSchema.index({ continuousCheckPoints: 1 });

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  // 开发环境下，如果密码看起来是明文的（不是bcrypt哈希），直接比较
  if (this.password && !this.password.startsWith('$2a$') && !this.password.startsWith('$2b$') && !this.password.startsWith('$2y$')) {
    return candidatePassword === this.password;
  }
  // 生产环境下，使用bcrypt比较
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);