/**
 * AI审核服务 - 佣金处理模块
 * 负责积分发放和推荐佣金处理
 */

const ImageReview = require('../../models/ImageReview');
const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const TaskConfig = require('../../models/TaskConfig');
const CommentLimit = require('../../models/CommentLimit');

/**
 * 为客户端验证成功的任务发放积分
 * @param {Object} review - 审核记录
 * @param {Function} processCommission - 佣金处理回调
 * @returns {Promise<void>}
 */
async function awardPointsForClientVerification(review, processCommission) {
  try {
    // 防重复发放检查
    const existingReward = await Transaction.findOne({
      imageReview_id: review._id,
      type: 'task_reward'
    });

    if (existingReward) {
      console.log(`⚠️ [客户端验证] 该任务已发放过积分，跳过重复发放: ${review._id}`);
      // 仍然需要处理佣金
      if (processCommission) {
        await processCommission(review);
      }
      return;
    }

    const taskConfig = await TaskConfig.findOne({ type_key: review.imageType, is_active: true });
    const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

    if (pointsReward > 0) {
      // 发放用户积分
      await User.findByIdAndUpdate(review.userId, {
        $inc: { points: pointsReward }
      });

      // 创建交易记录
      await new Transaction({
        user_id: review.userId,
        type: 'task_reward',
        amount: pointsReward,
        description: `任务奖励 - 客户端验证通过（${review.imageType === 'note' ? '笔记' : '评论'}）`,
        status: 'completed',
        imageReview_id: review._id,
        createdAt: new Date()
      }).save();

      console.log(`💰 [客户端验证] 已发放积分: ${pointsReward}`);

      // 如果是评论类型，记录评论限制信息
      if (review.imageType === 'comment') {
        await recordCommentLimitInfo(review);
      }

      // 处理佣金
      if (processCommission) {
        await processCommission(review);
      }
    }
  } catch (error) {
    console.error('❌ 发放积分失败:', error);
  }
}

/**
 * 记录评论限制信息
 * @param {Object} review - 审核记录
 * @returns {Promise<void>}
 */
async function recordCommentLimitInfo(review) {
  try {
    let authorToRecord = null;

    // 优先从 aiReviewResult 获取作者
    if (review.aiReviewResult?.aiParsedNoteInfo?.author) {
      authorToRecord = review.aiReviewResult.aiParsedNoteInfo.author;
    }
    // 其次从 userNoteInfo 获取作者
    else if (review.userNoteInfo?.author) {
      if (Array.isArray(review.userNoteInfo.author) && review.userNoteInfo.author.length > 0) {
        authorToRecord = review.userNoteInfo.author[0];
      } else if (typeof review.userNoteInfo.author === 'string' && review.userNoteInfo.author.trim()) {
        authorToRecord = review.userNoteInfo.author.trim();
      }
    }

    if (authorToRecord && review.noteUrl && review.userNoteInfo?.comment) {
      console.log(`📝 [客户端验证] 记录评论限制: 作者=${authorToRecord}, 链接=${review.noteUrl}`);
      await CommentLimit.recordCommentApproval(
        review.noteUrl,
        authorToRecord,
        review.userNoteInfo.comment,
        review._id
      );
      console.log(`✅ [客户端验证] 评论限制记录成功`);
    }
  } catch (error) {
    console.error('❌ 记录评论限制失败:', error);
  }
}

/**
 * 为客户端验证成功的任务处理佣金
 * @param {Object} review - 审核记录
 * @returns {Promise<void>}
 */
async function processCommissionForClientVerification(review) {
  try {
    if (!review.snapshotCommission1 || review.snapshotCommission1 <= 0) {
      return;
    }

    const populatedReview = await ImageReview.findById(review._id).populate('userId');

    if (populatedReview.userId?.parent_id) {
      // 防重复发放检查
      const existingCommission1 = await Transaction.findOne({
        imageReview_id: review._id,
        type: 'referral_bonus_1'
      });

      // 一级佣金
      const parentUser = await User.findById(populatedReview.userId.parent_id);
      if (parentUser && !parentUser.is_deleted) {
        if (!existingCommission1) {
          await User.findByIdAndUpdate(parentUser._id, {
            $inc: { points: review.snapshotCommission1 }
          });

          await new Transaction({
            user_id: parentUser._id,
            type: 'referral_bonus_1',
            amount: review.snapshotCommission1,
            description: `一级推荐佣金 - 来自用户 ${populatedReview.userId.username}（客户端验证）`,
            status: 'completed',
            imageReview_id: review._id,
            createdAt: new Date()
          }).save();
          console.log(`💰 [客户端验证] 已发放一级佣金: ${review.snapshotCommission1} → ${parentUser.username}`);
        } else {
          console.log(`⚠️ [客户端验证] 一级佣金已发放，跳过: ${review._id}`);
        }

        // 二级佣金
        if (parentUser.parent_id && review.snapshotCommission2 > 0) {
          const existingCommission2 = await Transaction.findOne({
            imageReview_id: review._id,
            type: 'referral_bonus_2'
          });

          const grandParentUser = await User.findById(parentUser.parent_id);
          if (grandParentUser && !grandParentUser.is_deleted) {
            if (!existingCommission2) {
              await User.findByIdAndUpdate(grandParentUser._id, {
                $inc: { points: review.snapshotCommission2 }
              });

              await new Transaction({
                user_id: grandParentUser._id,
                type: 'referral_bonus_2',
                amount: review.snapshotCommission2,
                description: `二级推荐佣金 - 来自用户 ${populatedReview.userId.username}（客户端验证）`,
                status: 'completed',
                imageReview_id: review._id,
                createdAt: new Date()
              }).save();
              console.log(`💰 [客户端验证] 已发放二级佣金: ${review.snapshotCommission2} → ${grandParentUser.username}`);
            } else {
              console.log(`⚠️ [客户端验证] 二级佣金已发放，跳过: ${review._id}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ 处理佣金失败:', error);
  }
}

/**
 * 发放推荐佣金（仅对评论直接通过的情况）
 * @param {Object} review - 审核记录
 * @param {Object} updateData - 更新数据
 * @returns {Promise<void>}
 */
async function issueReferralCommissions(review, updateData) {
  // AI自动审核通过后，自动发放两级推荐佣金（仅对评论直接通过的情况）
  if (updateData.status !== 'manager_approved' || review.imageType !== 'comment' || review.snapshotCommission1 <= 0) {
    return;
  }

  try {
    const populatedReview = await ImageReview.findById(review._id).populate('userId');

    // 防重复发放检查
    const existingCommission1 = await Transaction.findOne({
      imageReview_id: review._id,
      type: 'referral_bonus_1'
    });

    console.log(`🔍 [AI佣金] reviewId: ${review._id}, commission: ${review.snapshotCommission1}`);
    console.log(`🔍 [AI佣金] userId.parent_id: ${populatedReview.userId?.parent_id}`);

    if (existingCommission1) {
      console.log(`⚠️ [AI佣金] 一级佣金已发放，跳过: ${review._id}`);
      return;
    }

    if (!populatedReview.userId?.parent_id) {
      console.log(`⚠️ [AI佣金] userId.parent_id 不存在`);
      return;
    }

    // 发放一级佣金
    await issueFirstLevelCommission(populatedReview, review);
    // 发放二级佣金
    await issueSecondLevelCommission(populatedReview, review);

  } catch (error) {
    console.error('❌ [AI佣金] 发放佣金失败:', error);
  }
}

/**
 * 发放一级推荐佣金
 * @param {Object} populatedReview - 带用户信息的审核记录
 * @param {Object} review - 原始审核记录
 * @returns {Promise<void>}
 */
async function issueFirstLevelCommission(populatedReview, review) {
  const parentUser = await User.findById(populatedReview.userId.parent_id);
  if (!parentUser || parentUser.is_deleted) {
    console.log(`⚠️ [AI佣金] 上级用户不存在或已删除`);
    return;
  }

  await User.findByIdAndUpdate(parentUser._id, {
    $inc: { points: review.snapshotCommission1 }
  });
  console.log(`💰 [AI佣金] 一级: +${review.snapshotCommission1}积分 → ${parentUser.username}`);

  // 创建一级佣金交易记录
  await new Transaction({
    user_id: parentUser._id,
    type: 'referral_bonus_1',
    amount: review.snapshotCommission1,
    description: `一级推荐佣金 - 来自用户 ${populatedReview.userId.username}`,
    status: 'completed',
    imageReview_id: review._id,
    createdAt: new Date()
  }).save();
  console.log(`📝 [AI佣金] 已创建一级佣金交易记录`);
}

/**
 * 发放二级推荐佣金
 * @param {Object} populatedReview - 带用户信息的审核记录
 * @param {Object} review - 原始审核记录
 * @returns {Promise<void>}
 */
async function issueSecondLevelCommission(populatedReview, review) {
  // 获取一级推荐人（父用户）
  const parentUser = await User.findById(populatedReview.userId.parent_id);
  if (!parentUser?.parent_id || review.snapshotCommission2 <= 0) {
    return;
  }

  // 防重复发放检查
  const existingCommission2 = await Transaction.findOne({
    imageReview_id: review._id,
    type: 'referral_bonus_2'
  });

  if (existingCommission2) {
    console.log(`⚠️ [AI佣金] 二级佣金已发放，跳过: ${review._id}`);
    return;
  }

  const grandParentUser = await User.findById(parentUser.parent_id);
  if (!grandParentUser || grandParentUser.is_deleted) {
    return;
  }

  await User.findByIdAndUpdate(grandParentUser._id, {
    $inc: { points: review.snapshotCommission2 }
  });
  console.log(`💰 [AI佣金] 二级: +${review.snapshotCommission2}积分 → ${grandParentUser.username}`);

  // 创建二级佣金交易记录
  await new Transaction({
    user_id: grandParentUser._id,
    type: 'referral_bonus_2',
    amount: review.snapshotCommission2,
    description: `二级推荐佣金 - 来自用户 ${populatedReview.userId.username}`,
    status: 'completed',
    imageReview_id: review._id,
    createdAt: new Date()
  }).save();
  console.log(`📝 [AI佣金] 已创建二级佣金交易记录`);
}

/**
 * 发放评论审核通过的积分
 * @param {Object} review - 审核记录
 * @param {Object} userId - 用户ID对象
 * @param {string} imageType - 图片类型
 * @returns {Promise<number>} 发放的积分数
 */
async function awardPointsForApproval(review, userId, imageType) {
  const taskConfig = await TaskConfig.findOne({ type_key: imageType, is_active: true });
  const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

  // 只有评论类型才在AI审核通过时发放积分
  if (pointsReward > 0 && imageType === 'comment') {
    // 防重复发放检查
    const existingReward = await Transaction.findOne({
      imageReview_id: review._id,
      type: 'task_reward'
    });

    if (existingReward) {
      console.log(`⚠️ [AI审核-评论] 该任务已发放过积分，跳过重复发放: ${review._id}`);
      return 0;
    }

    // 发放用户积分
    await User.findByIdAndUpdate(userId._id, {
      $inc: { points: pointsReward }
    });

    // 创建交易记录
    await new Transaction({
      user_id: userId._id,
      type: 'task_reward',
      amount: pointsReward,
      description: `任务奖励 - 评论审核通过`,
      status: 'completed',
      imageReview_id: review._id,
      createdAt: new Date()
    }).save();

    console.log(`💰 [AI审核] 评论类型审核通过，已发放积分: ${pointsReward}`);
    return pointsReward;
  } else if (imageType === 'note') {
    console.log(`⏳ [AI审核] 笔记类型审核通过，暂不发放积分，等待人工复审通过`);
    return 0;
  }

  return 0;
}

module.exports = {
  awardPointsForClientVerification,
  processCommissionForClientVerification,
  issueReferralCommissions,
  issueFirstLevelCommission,
  issueSecondLevelCommission,
  awardPointsForApproval,
  recordCommentLimitInfo
};
