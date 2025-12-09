const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true,
    index: true
  },
  task_type: {
    type: String,
    required: true,
    index: true
  },
  image_url: {
    type: String,
    required: true
  },
  image_md5: {
    type: String,
    required: true,
    index: true
  },

  // 核心风控字段：快照价格和佣金
  snapshot_price: {
    type: Number,
    required: true,
    min: 0
  },
  snapshot_commission_1: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  snapshot_commission_2: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  status: {
    type: Number,
    default: 0,
    index: true,
    enum: [-1, 0, 1, 2, 3] // -1:驳回, 0:待审核, 1:待主管确认, 2:待财务打款, 3:已完成
  },

  // 审核痕迹
  audit_history: [{
    operator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      enum: ['submit', 'mentor_pass', 'mentor_reject', 'manager_confirm', 'manager_reject', 'finance_pay']
    },
    comment: {
      type: String
    },
    time: {
      type: Date,
      default: Date.now
    }
  }],

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// 复合索引优化查询
submissionSchema.index({ user_id: 1, createdAt: -1 });
submissionSchema.index({ status: 1, createdAt: -1 });
submissionSchema.index({ task_type: 1, status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);