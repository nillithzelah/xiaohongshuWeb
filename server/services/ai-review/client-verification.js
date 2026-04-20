/**
 * AI审核服务 - 客户端验证模块
 * 负责处理客户端验证相关逻辑
 */

const ImageReview = require('../../models/ImageReview');
const commission = require('./commission');

/**
 * 标记任务为待客户端验证状态
 * @param {Object} review - 审核记录
 * @param {number} attempt - 尝试次数
 * @returns {Promise<void>}
 */
async function markForClientVerification(review, attempt) {
  const reviewId = review._id;

  // 检查是否已达到最大尝试次数
  if ((review.reviewAttempt || 0) >= 2) {
    console.log(`⚠️ 该任务已达到最大尝试次数(${review.reviewAttempt})，不再调度客户端验证: ${reviewId}`);
    return;
  }

  // 初始化 clientVerification 对象
  const clientVerification = review.clientVerification || {
    attempt: 1,
    firstResult: null,
    secondResult: null,
    readyForSecondAttempt: false,
    secondAttemptReadyAt: null
  };

  clientVerification.attempt = attempt;

  await ImageReview.findByIdAndUpdate(reviewId, {
    status: 'client_verification_pending',
    clientVerification: clientVerification,
    reviewAttempt: attempt
  });

  console.log(`✅ 任务 ${reviewId} 已标记为待客户端验证（第${attempt}次尝试）`);
}

/**
 * 处理客户端验证结果
 * @param {string} reviewId - 审核任务ID
 * @param {Object} verifyResult - 客户端验证结果
 * @param {Object} service - 主服务实例（用于回调）
 * @returns {Promise<Object>} 处理结果
 */
async function handleClientVerificationResult(reviewId, verifyResult, service) {
  try {
    console.log(`📥 收到客户端验证结果: ${reviewId}`, verifyResult);

    const review = await ImageReview.findById(reviewId);
    if (!review) {
      console.error(`❌ 审核任务不存在: ${reviewId}`);
      return { success: false, message: '审核任务不存在' };
    }

    const clientVerification = review.clientVerification || {
      attempt: 1,
      firstResult: null,
      secondResult: null,
      readyForSecondAttempt: false,
      secondAttemptReadyAt: null
    };

    // 早期检查：如果任务已经完成，拒绝重复处理
    if (review.status === 'rejected' || review.status === 'completed' || review.status === 'ai_approved') {
      console.log(`⚠️ 该任务已完成(${review.status})，不再处理验证结果: ${reviewId}`);
      return { success: false, message: '任务已完成' };
    }

    // 记录当前验证结果
    const resultData = {
      success: verifyResult.success,
      verified: verifyResult.verified !== undefined ? verifyResult.verified : verifyResult.success,
      comment: verifyResult.comment || (verifyResult.success ? '客户端验证通过' : '客户端验证失败'),
      reason: verifyResult.reason || null,
      contentAudit: verifyResult.contentAudit || null,
      verifiedAt: new Date(),
      screenshotUrl: verifyResult.screenshotUrl || null
    };

    if (clientVerification.attempt === 1) {
      clientVerification.firstResult = resultData;

      // 如果第一次验证成功，直接通过
      if (verifyResult.success && verifyResult.verified !== false) {
        console.log(`✅ 第一次客户端验证成功，任务通过: ${reviewId}`);
        await processClientVerificationSuccess(review, clientVerification);
        return { success: true, message: '验证成功，任务已通过' };
      }

      // 第一次验证失败，准备第二次验证
      console.log(`⚠️ 第一次客户端验证失败，准备第二次验证: ${reviewId}`);

      // 检查是否已达到最大尝试次数
      if (review.reviewAttempt >= 2) {
        console.log(`❌ 已达到最大验证次数，最终驳回: ${reviewId}`);
        await processClientVerificationFinalReject(review, clientVerification);
        return { success: true, message: '已达到最大验证次数，任务已驳回' };
      }

      // 标记为待第二次验证
      clientVerification.readyForSecondAttempt = true;
      clientVerification.secondAttemptReadyAt = new Date(Date.now() + 300 * 1000); // 300秒后

      await ImageReview.findByIdAndUpdate(reviewId, {
        status: 'client_verification_failed',
        clientVerification: clientVerification,
        reviewAttempt: 2
      });

      // 300秒后自动转为待验证状态
      scheduleSecondAttempt(reviewId, service);

      return { success: true, message: '第一次验证失败，将在300秒后进行第二次验证' };

    } else {
      // 第二次验证结果
      clientVerification.secondResult = resultData;

      if (verifyResult.success && verifyResult.verified !== false) {
        console.log(`✅ 第二次客户端验证成功，任务通过: ${reviewId}`);
        await processClientVerificationSuccess(review, clientVerification);
        return { success: true, message: '第二次验证成功，任务已通过' };
      } else {
        console.log(`❌ 第二次客户端验证也失败，最终驳回: ${reviewId}`);
        // 先递增 reviewAttempt 防止重复处理
        await ImageReview.findByIdAndUpdate(reviewId, {
          reviewAttempt: 3
        });
        await processClientVerificationFinalReject(review, clientVerification);
        return { success: true, message: '第二次验证失败，任务已驳回' };
      }
    }

  } catch (error) {
    console.error(`❌ 处理客户端验证结果失败: ${reviewId}`, error);
    return { success: false, message: '处理验证结果失败' };
  }
}

/**
 * 调度第二次验证
 * @param {string} reviewId - 审核任务ID
 * @param {Object} service - 主服务实例
 */
function scheduleSecondAttempt(reviewId, service) {
  setTimeout(async () => {
    try {
      // 防御性检查：确保任务状态仍然需要第二次验证
      const currentReview = await ImageReview.findById(reviewId);
      if (!currentReview) return;

      // 如果任务已经完成或已超过最大尝试次数，不再调度
      if (currentReview.status !== 'client_verification_failed' ||
          currentReview.reviewAttempt > 2 ||
          (currentReview.clientVerification && currentReview.clientVerification.attempt > 2)) {
        console.log(`⚠️ 任务状态已变更或已超过最大尝试次数，跳过调度: ${reviewId}, status=${currentReview.status}, reviewAttempt=${currentReview.reviewAttempt}`);
        return;
      }

      await ImageReview.findByIdAndUpdate(reviewId, {
        status: 'client_verification_pending',
        'clientVerification.readyForSecondAttempt': false,
        'clientVerification.attempt': 2
      });
      console.log(`✅ 第二次验证已就绪，任务重新进入队列: ${reviewId}`);
      // 重新加入队列
      service.addToQueue(reviewId);
    } catch (err) {
      console.error(`❌ 激活第二次验证失败: ${reviewId}`, err);
    }
  }, 300 * 1000);
}

/**
 * 处理客户端验证成功的情况
 * @param {Object} review - 审核记录
 * @param {Object} clientVerification - 客户端验证信息
 * @returns {Promise<void>}
 */
async function processClientVerificationSuccess(review, clientVerification) {
  // 构建详细的验证成功消息
  const currentResult = clientVerification.attempt === 1
    ? clientVerification.firstResult
    : clientVerification.secondResult;

  let successComment = `✅ 客户端验证通过（第${clientVerification.attempt}次尝试）`;
  if (currentResult?.comment) {
    successComment += `\n验证说明: ${currentResult.comment}`;
  }
  if (currentResult?.screenshotUrl) {
    successComment += `\n截图已保存`;
  }
  if (review.imageType === 'comment') {
    successComment += `\n已自动发放积分奖励`;
  }

  const historyItem = {
    operator: null,
    operatorName: '客户端验证系统',
    action: 'local_client_passed',
    comment: successComment,
    timestamp: new Date(),
    verificationData: {
      attempt: clientVerification.attempt,
      success: currentResult?.success,
      verified: currentResult?.verified,
      screenshotUrl: currentResult?.screenshotUrl
    }
  };

  // 使用 $push 追加审核历史，避免覆盖现有记录
  await ImageReview.findByIdAndUpdate(review._id, {
    $set: {
      status: review.imageType === 'note' ? 'ai_approved' : 'completed',
      clientVerification: clientVerification
    },
    $push: { auditHistory: historyItem }
  });

  // 如果是评论类型，直接发放积分
  if (review.imageType === 'comment') {
    await commission.awardPointsForClientVerification(review, commission.processCommissionForClientVerification);
  }

  console.log(`✅ 客户端验证成功，状态已更新: ${review._id}`);
}

/**
 * 处理客户端验证最终驳回的情况
 * @param {Object} review - 审核记录
 * @param {Object} clientVerification - 客户端验证信息
 * @returns {Promise<void>}
 */
async function processClientVerificationFinalReject(review, clientVerification) {
  const firstResult = clientVerification.firstResult;
  const secondResult = clientVerification.secondResult;

  // 优先使用完整的 reason
  const finalReason = secondResult?.reason || firstResult?.reason ||
                     secondResult?.comment || firstResult?.comment ||
                     '客户端验证未找到相关内容';

  // 构建详细的失败消息
  let failureComment = `❌ 客户端验证失败\n`;
  failureComment += `第1次验证: ${firstResult?.success ? '成功' : '失败'} - ${firstResult?.comment || '无说明'}\n`;
  if (secondResult) {
    failureComment += `第2次验证: ${secondResult?.success ? '成功' : '失败'} - ${secondResult?.comment || '无说明'}\n`;
  }
  failureComment += `最终结果: 验证未通过，任务驳回`;

  const historyItem = {
    operator: null,
    operatorName: '客户端验证系统',
    action: 'local_client_rejected',
    comment: failureComment,
    timestamp: new Date(),
    verificationData: {
      attempt: clientVerification.attempt,
      firstResult: {
        success: firstResult?.success,
        comment: firstResult?.comment,
        reason: firstResult?.reason,
        contentAudit: firstResult?.contentAudit
      },
      secondResult: secondResult ? {
        success: secondResult?.success,
        comment: secondResult?.comment,
        reason: secondResult?.reason,
        contentAudit: secondResult?.contentAudit
      } : null
    }
  };

  // 使用 $push 追加审核历史，避免覆盖现有记录
  await ImageReview.findByIdAndUpdate(review._id, {
    $set: {
      status: 'rejected',
      rejectionReason: finalReason,
      clientVerification: clientVerification
    },
    $push: { auditHistory: historyItem }
  });

  console.log(`❌ 客户端验证最终驳回: ${review._id}, 原因: ${finalReason}`);
}

module.exports = {
  markForClientVerification,
  handleClientVerificationResult,
  processClientVerificationSuccess,
  processClientVerificationFinalReject
};
