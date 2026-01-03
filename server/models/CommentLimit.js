const mongoose = require('mongoose');

/**
 * 统一的评论限制模型
 * 整合了昵称+链接的评论次数限制和内容重复检查
 * 只在评论审核通过后记录，避免提交时和审核后的状态不一致
 */
const commentLimitSchema = new mongoose.Schema({
  // 评论链接（标准化，去除查询参数）
  noteUrl: {
    type: String,
    required: true,
    trim: true
  },
  // 评论者昵称
  authorNickname: {
    type: String,
    required: true,
    trim: true
  },
  // 该昵称在该链接下的已审核通过评论次数
  approvedCommentCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // 已审核通过的评论内容历史（用于检查内容重复）
  approvedComments: [{
    content: {
      type: String,
      required: true,
      trim: true
    },
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImageReview',
      required: true
    },
    approvedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // 最后审核通过时间
  lastApprovedAt: {
    type: Date,
    default: Date.now
  },
  // 创建时间
  createdAt: {
    type: Date,
    default: () => {
      const now = new Date();
      const beijingOffset = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）
      return new Date(now.getTime() + beijingOffset);
    }
  },
  // 更新时间
  updatedAt: {
    type: Date,
    default: () => {
      const now = new Date();
      const beijingOffset = 8 * 60 * 60 * 1000; // 北京时间偏移量（毫秒）
      return new Date(now.getTime() + beijingOffset);
    }
  }
});

// 复合唯一索引：链接+昵称（确保每对链接+昵称只有一条记录）
commentLimitSchema.index({
  noteUrl: 1,
  authorNickname: 1
}, {
  unique: true
});

// 单个字段索引
commentLimitSchema.index({ noteUrl: 1 });
commentLimitSchema.index({ authorNickname: 1 });
commentLimitSchema.index({ updatedAt: 1 });

// 更新updatedAt字段的中间件
commentLimitSchema.pre('save', function(next) {
  this.updatedAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  next();
});

/**
 * 标准化URL：去除查询参数和片段
 */
function normalizeUrl(url) {
  if (!url) return url;
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch (error) {
    // 如果URL格式无效，返回原值
    return url.trim();
  }
}

/**
 * 清理作者名字：移除常见的关注相关后缀，与CommentVerificationService保持一致
 */
function cleanAuthorName(name) {
  if (!name) return '';
  // 移除常见的关注相关后缀（关注、作者、等）
  return name.replace(/\s*(关注|作者|等)$/, '').trim();
}

/**
 * 检查评论是否可以审核通过
 * 只检查已审核通过的记录，避免与提交时的检查冲突
 */
commentLimitSchema.statics.checkCommentApproval = async function(noteUrl, authorNickname, commentContent) {
  try {
    const normalizedUrl = normalizeUrl(noteUrl);
    const cleanedAuthor = cleanAuthorName(authorNickname);

    const limitRecord = await this.findOne({
      noteUrl: normalizedUrl,
      authorNickname: cleanedAuthor
    });

    if (!limitRecord) {
      // 还没有记录，返回可以审核通过
      return {
        canApprove: true,
        currentCount: 0,
        maxAllowed: 2,
        isContentDuplicate: false,
        reason: null
      };
    }

    // 检查评论次数限制（最多2条）
    const canApproveByCount = limitRecord.approvedCommentCount < 2;

    // 检查内容是否重复
    const isContentDuplicate = limitRecord.approvedComments.some(comment =>
      comment.content.trim().toLowerCase() === commentContent.trim().toLowerCase()
    );

    const canApprove = canApproveByCount && !isContentDuplicate;

    let reasons = [];
    if (!canApproveByCount) {
      reasons.push(`"在该链接下已发布${limitRecord.approvedCommentCount}条评论，已达到最大允许数量2条`);

      // reasons.push(`昵称"${authorNickname}"在该链接下已发布${limitRecord.approvedCommentCount}条评论，已达到最大允许数量2条`);
    }
    if (isContentDuplicate) {
      reasons.push('评论内容不能与该链接下的其他评论完全相同');
    }
    const reason = reasons.length > 0 ? reasons.join('; ') : null;

    return {
      canApprove,
      currentCount: limitRecord.approvedCommentCount,
      maxAllowed: 2,
      isContentDuplicate,
      reason
    };
  } catch (error) {
    console.error('检查评论审核限制失败:', error);
    // 出错时允许审核通过，避免误拦截
    return {
      canApprove: true,
      currentCount: 0,
      maxAllowed: 2,
      isContentDuplicate: false,
      reason: null,
      error: error.message
    };
  }
};

/**
 * 记录评论审核通过
 * 在评论审核通过后调用，更新计数和内容历史
 */
commentLimitSchema.statics.recordCommentApproval = async function(noteUrl, authorNickname, commentContent, reviewId) {
  try {
    const normalizedUrl = normalizeUrl(noteUrl);
    const cleanedAuthor = cleanAuthorName(authorNickname);

    const result = await this.findOneAndUpdate(
      {
        noteUrl: normalizedUrl,
        authorNickname: cleanedAuthor
      },
      {
        $inc: { approvedCommentCount: 1 },
        $push: {
          approvedComments: {
            content: commentContent.trim(),
            reviewId: reviewId,
            approvedAt: new Date()
          }
        },
        $set: { lastApprovedAt: new Date() }
      },
      {
        upsert: true, // 如果不存在则创建
        new: true,    // 返回更新后的文档
        setDefaultsOnInsert: true
      }
    );

    console.log(`✅ 评论审核记录更新成功: 昵称"${authorNickname}", 链接${normalizedUrl}, 当前审核通过次数: ${result.approvedCommentCount}`);
    return result;
  } catch (error) {
    console.error('记录评论审核成功失败:', error);
    throw error;
  }
};

/**
 * 获取昵称在链接下的评论统计
 */
commentLimitSchema.statics.getCommentStats = async function(noteUrl, authorNickname) {
  try {
    const normalizedUrl = normalizeUrl(noteUrl);
    const cleanedAuthor = cleanAuthorName(authorNickname);

    const record = await this.findOne({
      noteUrl: normalizedUrl,
      authorNickname: cleanedAuthor
    });

    if (!record) {
      return {
        approvedCount: 0,
        maxAllowed: 2,
        canComment: true,
        comments: []
      };
    }

    return {
      approvedCount: record.approvedCommentCount,
      maxAllowed: 2,
      canComment: record.approvedCommentCount < 2,
      lastApprovedAt: record.lastApprovedAt,
      comments: record.approvedComments.map(c => ({
        content: c.content,
        approvedAt: c.approvedAt
      }))
    };
  } catch (error) {
    console.error('获取评论统计失败:', error);
    return {
      approvedCount: 0,
      maxAllowed: 2,
      canComment: true,
      comments: [],
      error: error.message
    };
  }
};

/**
 * 清理过期记录（保留最近90天的记录）
 */
commentLimitSchema.statics.cleanupOldRecords = async function() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // 删除90天前没有更新的记录
    const result = await this.deleteMany({
      updatedAt: { $lt: ninetyDaysAgo }
    });

    console.log(`🧹 清理了 ${result.deletedCount} 条过期的评论限制记录`);
    return result;
  } catch (error) {
    console.error('清理过期评论限制记录失败:', error);
  }
};

module.exports = mongoose.model('CommentLimit', commentLimitSchema);