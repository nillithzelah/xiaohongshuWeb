const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  openid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String
  },
  avatar: {
    type: String
  },
  role: {
    type: String,
    enum: ['user', 'cs', 'boss', 'finance'],
    default: 'user'
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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
  password: String,
  balance: Number,
  totalEarnings: Number,
  nickname: String,
  phone: String,

  created_at: {
    type: Date,
    default: Date.now
  }
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);