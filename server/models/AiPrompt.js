const mongoose = require('mongoose');

/**
 * AI 提示词模型
 * 用于管理系统中使用的各种 AI 提示词
 */
const aiPromptSchema = new mongoose.Schema({
  // 提示词名称/标识（唯一）
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // 提示词显示名称
  displayName: {
    type: String,
    required: true
  },

  // 提示词描述
  description: {
    type: String,
    default: ''
  },

  // 提示词类型
  type: {
    type: String,
    enum: ['note_audit', 'comment_classification', 'other'],
    required: true
  },

  // 系统提示词（system role）
  systemPrompt: {
    type: String,
    default: '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。'
  },

  // 用户提示词模板（user role）
  userPromptTemplate: {
    type: String,
    required: true
  },

  // API 配置
  apiConfig: {
    model: {
      type: String,
      default: 'deepseek-chat'
    },
    temperature: {
      type: Number,
      default: 0.3,
      min: 0,
      max: 2
    },
    maxTokens: {
      type: Number,
      default: 1000,
      min: 1,
      max: 32000
    }
  },

  // 输出格式说明（JSON schema）
  outputFormat: {
    type: String,
    default: ''
  },

  // 是否启用
  enabled: {
    type: Boolean,
    default: true
  },

  // 版本号
  version: {
    type: String,
    default: '1.0.0'
  },

  // 变量说明（用于前端显示哪些变量可用）
  variables: [{
    name: String,
    description: String,
    example: String
  }],

  // 最后修改人
  updatedBy: {
    type: String,
    default: null
  },

  // 最后修改时间
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// 索引
aiPromptSchema.index({ name: 1 });
aiPromptSchema.index({ type: 1 });
aiPromptSchema.index({ enabled: 1 });

module.exports = mongoose.model('AiPrompt', aiPromptSchema);
