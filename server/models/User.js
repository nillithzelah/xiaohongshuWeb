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
    total_withdrawn: {
      type: Number,
      default: 0,
      min: 0
    }
  },

  // 积分系统（用于兑换余额）
  points: {
    type: Number,
    default: 0,
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

  // 小红书账号信息（HR创建线索时录入）
  xiaohongshuAccounts: [{
    account: {
      type: String,
      required: true
    },
    nickname: {
      type: String,
      required: true
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'active'],
      default: 'pending'
    }
  }],

  // 软删除相关字段
  is_deleted: {
    type: Boolean,
    default: false
  },
  deleted_at: {
    type: Date,
    default: null
  },
  deleted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  // 只有在密码被修改时才加密
  if (!this.isModified('password')) return next();

  // 如果密码已经是bcrypt哈希，跳过加密
  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$'))) {
    return next();
  }

  try {
    // 生成盐并加密密码
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 索引

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  // 检查密码是否存在
  if (!this.password) {
    return false;
  }

  // 如果密码是bcrypt哈希格式，使用bcrypt比较
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  // 如果密码不是哈希格式（兼容旧数据），直接比较
  // 但这种情况应该很少见，新注册的用户都会被哈希
  console.warn('警告：发现未哈希的密码，请检查数据迁移');
  return candidatePassword === this.password;
};

module.exports = mongoose.model('User', userSchema);