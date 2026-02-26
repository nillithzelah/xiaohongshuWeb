const mongoose = require('mongoose');

/**
 * SystemConfig - 系统配置模型
 *
 * 用于存储系统级配置，避免硬编码
 */
const systemConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'general'
  }
}, {
  timestamps: true
});

// 静态方法：获取配置值
systemConfigSchema.statics.getValue = async function(key, defaultValue = null) {
  const config = await this.findOne({ key });
  return config ? config.value : defaultValue;
};

// 静态方法：设置配置值
systemConfigSchema.statics.setValue = async function(key, value, description = '', category = 'general') {
  const config = await this.findOneAndUpdate(
    { key },
    { value, description, category },
    { upsert: true, new: true }
  );
  return config;
};

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
