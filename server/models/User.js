const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 导入用户角色常量
const { USER_ROLES, USER_ROLE_LIST } = require('../../shared/constants');

const userSchema = new mongoose.Schema({
  openid: {
    type: String,
    default: () => {
      // 使用加密安全的随机数生成器（修复：防止高并发时重复）
      const crypto = require('crypto');
      const randomBytes = crypto.randomBytes(8).toString('hex');
      return `admin_${Date.now()}_${randomBytes}`;
    },
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
      return [USER_ROLES.MENTOR, USER_ROLES.BOSS, USER_ROLES.FINANCE, USER_ROLES.MANAGER, USER_ROLES.HR].includes(this.role);
    }
  },
  avatar: {
    type: String,
    default: 'https://via.placeholder.com/120x120/E5E7EB/9CA3AF?text=用户'
  },
  role: {
    type: String,
    enum: USER_ROLE_LIST,
    default: USER_ROLES.PART_TIME
  },

  // 基本信息
  nickname: { type: String, maxLength: 50 },
  phone: {
    type: String,
    maxLength: 20,
    sparse: true // 允许多个null，但非null值必须唯一
  },
  wechat: { type: String, maxLength: 50 },
  notes: { type: String, maxLength: 500 },

  // 邀请码系统
  invitationCode: {
    type: String,
    unique: true,
    sparse: true // 允许为空值，但唯一
  },

  // 带教老师专属字段
  integral_w: { type: String, maxLength: 100 }, // 积分号W
  integral_z: { type: String, maxLength: 100 }, // 积分号Z

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
      type: String,
      maxLength: 100
    },
    real_name: {
      type: String,
      maxLength: 50
    },
    alipay_qr_code: {
      type: String,
      default: null,
      maxLength: 2000
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
    default: Date.now // 使用UTC时间存储
  },

  // 培训状态（仅兼职用户）
  training_status: {
    type: String,
    enum: [
      null,
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

  // 锁定状态（HR可以锁定兼职用户）
  isLocked: {
    type: Boolean,
    default: false
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lockedReason: {
    type: String,
    maxLength: 500,
    default: null
  },

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

// 索引定义
userSchema.index({ phone: 1 }, { unique: true, sparse: true }); // 手机号唯一索引（允许null）
userSchema.index({ username: 1 }, { unique: true, sparse: true }); // 用户名唯一索引（允许null）
userSchema.index({ is_deleted: 1, phone: 1 }); // 用于查找已删除的手机号

// 密码加密和邀请码生成中间件
userSchema.pre('save', async function(next) {
  try {
    // 自动去除字符串字段的首尾空格（防止手机号/用户名带空格导致登录失败）
    const stringFields = ['username', 'phone', 'wechat', 'nickname'];
    stringFields.forEach(field => {
      if (this[field] && typeof this[field] === 'string') {
        this[field] = this[field].trim();
      }
    });

    // 密码加密逻辑
    if (this.isModified('password') && this.password) {
      // 如果密码已经是bcrypt哈希，跳过加密
      if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
        // 密码已经是哈希格式，跳过
      } else {
        // 生成盐并加密密码
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
    }

    // 确保积分字段为整数（避免浮点数精度问题）
    if (this.isModified('points') && this.points !== undefined) {
      this.points = Math.round(this.points);
    }

    // 确保钱包金额字段为分单位整数（避免浮点数精度问题）
    if (this.isModified('wallet.total_withdrawn') && this.wallet?.total_withdrawn !== undefined) {
      this.wallet.total_withdrawn = Math.round(this.wallet.total_withdrawn);
    }

    // 自动生成邀请码（仅对新用户且没有邀请码时）
    if (this.isNew && !this.invitationCode && this.username) {
      // 使用用户名+时间戳后缀作为邀请码，确保唯一性
      const timestamp = Date.now().toString(36);
      this.invitationCode = `${this.username}_${timestamp}`;
      console.log('🎫 自动生成邀请码:', this.invitationCode);
    }

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