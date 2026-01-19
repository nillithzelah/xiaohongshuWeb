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
    default: Date.now // 使用UTC时间存储
  },
  // 更新时间
  updatedAt: {
    type: Date,
    default: Date.now // 使用UTC时间存储
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
 * 转义URL中的正则特殊字符，用于精确匹配
 */
function escapeRegexForUrl(url) {
  return url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 清理作者名字：移除常见的关注相关后缀，与CommentVerificationService保持一致
 */
function cleanAuthorName(name) {
  if (!name) return '';
  // 移除常见的关注相关后缀（关注、作者、等）
  let cleaned = name.replace(/\s*(关注|作者|等)$/, '').trim();
  // 移除全角空格
  cleaned = cleaned.replace(/[\u3000\u00A0]/g, ' ');
  // 合并多个空格为一个
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // 移除常见特殊符号后缀（如波浪号、星号等）
  cleaned = cleaned.replace(/[～~*★☆]+$/, '').trim();
  return cleaned;
}

/**
 * 检查评论是否可以提交/审核通过
 * @param {String} noteUrl - 笔记链接
 * @param {String} authorNickname - 评论者昵称
 * @param {String} commentContent - 评论内容
 * @param {Object} options - 选项 { checkPending: boolean, ImageReviewModel: Model }
 * @description
 * - checkPending=true: 提交时检查，包括待审核中的评论（防止超过2条限制）
 * - checkPending=false: 审核时检查，只检查已通过的评论
 */
commentLimitSchema.statics.checkCommentApproval = async function(noteUrl, authorNickname, commentContent, options = {}) {
  try {
    const { checkPending = false, ImageReviewModel } = options;
    const normalizedUrl = normalizeUrl(noteUrl);
    const cleanedAuthor = cleanAuthorName(authorNickname);

    console.log(`🔍 [CommentLimit检查] 输入参数: noteUrl="${noteUrl}", authorNickname="${authorNickname}"`);
    console.log(`🔍 [CommentLimit检查] 标准化后: normalizedUrl="${normalizedUrl}", cleanedAuthor="${cleanedAuthor}"`);

    const limitRecord = await this.findOne({
      noteUrl: normalizedUrl,
      authorNickname: cleanedAuthor
    });

    console.log(`🔍 [CommentLimit检查] CommentLimit记录:`, limitRecord ? `存在, approvedCommentCount=${limitRecord.approvedCommentCount}` : '不存在');

    // 基础计数：已审核通过的评论数
    let approvedCount = limitRecord ? limitRecord.approvedCommentCount : 0;

    // 如果需要检查待审核中的评论（提交时检查）
    let pendingCount = 0;
    if (checkPending && ImageReviewModel) {
      try {
        // 转义昵称中的正则特殊字符
        const escapedAuthor = cleanedAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 转义URL中的正则特殊字符，用于精确匹配（避免 abc123 匹配 abc123456）
        const escapedUrl = escapeRegexForUrl(normalizedUrl);

        // 计算该链接+昵称下待审核中的评论数
        // 需要匹配 aiParsedNoteInfo.author 或 userNoteInfo.author
        // 注意：userNoteInfo.author 可能是用逗号分隔的多个昵称，需要用正则匹配
        // URL使用 ^...$ 锚点进行精确匹配，避免部分匹配
        const pendingQuery = {
          imageType: 'comment',
          noteUrl: { $regex: `^${escapedUrl}$`, $options: 'i' },
          status: { $in: ['pending', 'processing', 'client_verification_pending', 'client_verification_failed'] }, // 所有非rejected状态
          $or: [
            { 'aiParsedNoteInfo.author': cleanedAuthor },
            { 'userNoteInfo.author': new RegExp(`(^|[,，])${escapedAuthor}([,，]|$)`) }  // 匹配逗号分隔字符串中的昵称
          ]
        };

        console.log(`🔍 [CommentLimit检查] 待审核查询:`, JSON.stringify(pendingQuery, null, 2));

        pendingCount = await ImageReviewModel.countDocuments(pendingQuery);
        console.log(`🔍 [CommentLimit检查] 待审核数量: pendingCount=${pendingCount}`);
      } catch (err) {
        console.warn('⚠️ [CommentLimit] 查询待审核评论失败:', err.message);
      }
    }

    // 总数 = 已通过 + 待审核中
    const totalCount = approvedCount + pendingCount;
    const canApproveByCount = totalCount < 2;

    // 检查内容是否重复（只检查已通过的评论）
    const isContentDuplicate = limitRecord && limitRecord.approvedComments.some(comment =>
      comment.content.trim().toLowerCase() === commentContent.trim().toLowerCase()
    );

    const canApprove = canApproveByCount && !isContentDuplicate;

    let reasons = [];
    if (!canApproveByCount) {
      if (pendingCount > 0) {
        reasons.push(`昵称"${cleanedAuthor}"在该链接下已有${approvedCount}条通过审核 + ${pendingCount}条待审核，共${totalCount}条评论，已达到最大允许数量2条`);
      } else {
        reasons.push(`昵称"${cleanedAuthor}"在该链接下已发布${approvedCount}条评论，已达到最大允许数量2条`);
      }
    }
    if (isContentDuplicate) {
      reasons.push('评论内容不能与该链接下的其他评论完全相同');
    }
    const reason = reasons.length > 0 ? reasons.join('; ') : null;

    return {
      canApprove,
      currentCount: approvedCount,
      pendingCount: pendingCount,
      totalCount: totalCount,
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
      pendingCount: 0,
      totalCount: 0,
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

    console.log(`📝 [CommentLimit记录] 输入参数: noteUrl="${noteUrl}", authorNickname="${authorNickname}", reviewId="${reviewId}"`);
    console.log(`📝 [CommentLimit记录] 标准化后: normalizedUrl="${normalizedUrl}"`);

    // 处理作者昵称：如果是逗号分隔的多个昵称，需要分别记录
    // 例如："张三, 李四" 需要为 "张三" 和 "李四" 各记录一次
    const authorsToRecord = [];
    if (typeof authorNickname === 'string' && (authorNickname.includes(',') || authorNickname.includes('，'))) {
      // 按中英文逗号分割
      const parts = authorNickname.split(/[,，]/);
      for (const part of parts) {
        const cleaned = cleanAuthorName(part);
        if (cleaned) {
          authorsToRecord.push(cleaned);
        }
      }
    } else {
      const cleaned = cleanAuthorName(authorNickname);
      if (cleaned) {
        authorsToRecord.push(cleaned);
      }
    }

    console.log(`📝 [CommentLimit记录] 需要记录的昵称列表:`, authorsToRecord);

    // 为每个昵称记录（如果有多个昵称，每个都计数）
    let results = [];
    for (const author of authorsToRecord) {
      // 【幂等性检查】防止重复记录同一个 reviewId
      const existingRecord = await this.findOne({
        noteUrl: normalizedUrl,
        authorNickname: author,
        'approvedComments.reviewId': reviewId
      });

      if (existingRecord) {
        console.log(`⚠️ 评论审核记录已存在，跳过重复记录: 昵称"${author}", reviewId: ${reviewId}`);
        results.push(existingRecord);
        continue;
      }

      const result = await this.findOneAndUpdate(
        {
          noteUrl: normalizedUrl,
          authorNickname: author
        },
        {
          $inc: { approvedCommentCount: 1 },
          $push: {
            approvedComments: {
              content: commentContent?.trim() || '',
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
      results.push(result);
      console.log(`✅ [CommentLimit记录] 更新成功: 昵称="${author}", 链接="${normalizedUrl}", 当前次数: ${result.approvedCommentCount}`);
    }

    return results;
  } catch (error) {
    console.error('❌ [CommentLimit记录] 失败:', error);
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