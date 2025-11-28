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
  balance: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  nickname: String,
  phone: String,

  created_at: {
    type: Date,
    default: Date.now
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

// 验证密码方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);