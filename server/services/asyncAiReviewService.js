// 异步AI审核服务
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const CommentLimit = require('../models/CommentLimit');
const xiaohongshuService = require('./xiaohongshuService');
const deviceNoteService = require('./deviceNoteService');
const aiContentAnalysisService = require('./aiContentAnalysisService');
const cookiePoolService = require('./CookiePoolService');

class AsyncAiReviewService {
  constructor() {
    this.isRunning = false;
    this.reviewQueue = [];
    this.maxConcurrentReviews = 15; // 提高并发数，减少队列等待
    this.activeReviews = 0;
    this.reviewStats = {
      totalProcessed: 0,
      totalPassed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      lastProcessedTime: null
    };
    this.errorRecovery = {
      consecutiveFailures: 0,
      lastErrorTime: null,
      circuitBreaker: false,
      circuitBreakerResetTime: null
    };
    this.isLoadedPendingReviews = false; // 标记是否已加载过pending任务

    // Cookie状态管理 - 优化版本
    //
    // Cookie失效检测说明：
    // - 笔记内容：公开可访问，无需Cookie即可读取
    // - 评论区：需要Cookie才能加载
    // - Cookie失效只有一种情况：页面出现密码输入框（登录页）
    //
    // 确认机制：需要连续3次检测到密码输入框，才真正标记Cookie为失效
    // 这可以防止网络波动或临时问题导致的误判
    this.cookieStatus = {
      isValid: true,
      expiredAt: null,
      checkCount: 0,
      lastCheckTime: null,
      // 新增：失败计数和冷却机制
      recentFailures: [], // 记录最近的失败时间戳
      consecutiveFailures: 0, // 连续失败次数
      lastExpireMarkTime: null, // 上次标记过期的时间
      expireMarkCooldown: 60000 // 标记过期的冷却时间：60秒
    };

    // 初始化AI内容分析服务实例
    this.aiContentAnalysisService = new aiContentAnalysisService();
  }

  /**
   * 从数据库加载所有pending状态的审核记录并重新加入队列
   * 服务器重启时调用此方法，确保pending任务不会丢失
   */
  async loadPendingReviews() {
    try {
      // 【安全保护】防止重复加载
      if (this.isLoadedPendingReviews) {
        console.log('⚠️ pending任务已经加载过，跳过重复加载');
        return;
      }

      console.log('🔄 开始加载pending状态的审核记录...');

      // 【新增】清空现有队列，避免重复添加
      this.reviewQueue = [];
      this.activeReviews = 0;
      console.log('🧹 已清空审核队列，准备重新加载pending任务');

      // 查询所有pending状态的审核记录（包括待客户端验证的任务）
      const pendingReviews = await ImageReview.find({
        status: { $in: ['pending', 'client_verification_pending'] },
        imageType: { $in: ['note', 'comment'] } // 只处理笔记和评论类型
      }).select('_id createdAt imageType noteUrl status');

      console.log(`📊 找到 ${pendingReviews.length} 条pending状态的审核记录`);

      // 【新增】恢复客户端验证失败的任务（服务重启导致定时器丢失）
      const now = new Date();
      const failedReviewsToRecover = await ImageReview.find({
        status: 'client_verification_failed',
        'clientVerification.readyForSecondAttempt': true,
        'clientVerification.secondAttemptReadyAt': { $lte: now }, // 已到第二次验证时间
        imageType: { $in: ['note', 'comment'] }
      }).select('_id clientVerification reviewAttempt');

      console.log(`📊 找到 ${failedReviewsToRecover.length} 条待恢复的client_verification_failed任务`);

      // 恢复这些任务到待验证状态
      let recoveredCount = 0;
      for (const failedReview of failedReviewsToRecover) {
        try {
          await ImageReview.findByIdAndUpdate(failedReview._id, {
            status: 'client_verification_pending',
            'clientVerification.readyForSecondAttempt': false,
            'clientVerification.attempt': 2
          });
          recoveredCount++;
          console.log(`🔄 已恢复任务 ${failedReview._id} 到待验证状态`);
        } catch (err) {
          console.error(`❌ 恢复任务失败 ${failedReview._id}:`, err);
        }
      }
      console.log(`✅ 成功恢复 ${recoveredCount} 条client_verification_failed任务`);

      if (pendingReviews.length === 0 && recoveredCount === 0) {
        console.log('✅ 没有pending状态的审核记录需要处理');
        this.isLoadedPendingReviews = true;
        return;
      }

      // 将所有pending记录的ID加入队列（包括刚恢复的）
      let loadedCount = 0;
      for (const review of pendingReviews) {
        // 检查是否已经在队列中，避免重复
        if (!this.reviewQueue.includes(review._id.toString())) {
          this.reviewQueue.push(review._id.toString());
          loadedCount++;
          console.log(`📋 已将审核任务 ${review._id} (${review.imageType}) 加入队列`);
        }
      }

      console.log(`✅ 成功加载 ${loadedCount} 条pending审核记录到队列`);

      // 标记已完成加载
      this.isLoadedPendingReviews = true;

      // 触发队列处理
      if (loadedCount > 0 || recoveredCount > 0) {
        console.log('🚀 开始处理队列中的审核任务...');
        this.processQueue();
      }

    } catch (error) {
      console.error('❌ 加载pending审核记录失败:', error);
    }
  }

  /**
   * 添加审核任务到队列
   */
  addToQueue(reviewId) {
    if (!this.reviewQueue.includes(reviewId)) {
      this.reviewQueue.push(reviewId);
      console.log(`📋 审核任务 ${reviewId} 已添加到队列，当前队列长度: ${this.reviewQueue.length}`);
      this.processQueue();
    }
  }

  /**
   * 处理审核队列
   */
  async processQueue() {
    if (this.isRunning || this.activeReviews >= this.maxConcurrentReviews || this.reviewQueue.length === 0) {
      return;
    }

    this.isRunning = true;

    try {
      while (this.reviewQueue.length > 0 && this.activeReviews < this.maxConcurrentReviews) {
        const reviewId = this.reviewQueue.shift();
        this.activeReviews++;

        // 异步处理单个审核任务
        this.processReview(reviewId).finally(() => {
          this.activeReviews--;
          // 继续处理队列中的下一个任务
          setTimeout(() => this.processQueue(), 1000); // 短暂延迟避免过度并发
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 处理单个审核任务
   */
  async processReview(reviewId) {
    try {
      console.log(`🤖 开始异步AI审核任务: ${reviewId}`);

      // 获取审核记录
      const review = await ImageReview.findById(reviewId).populate('userId');
      if (!review) {
        console.error(`❌ 审核记录不存在: ${reviewId}`);
        return;
      }

      // client_verification_pending 状态的任务由客户端处理，跳过服务器审核
      if (review.status === 'client_verification_pending') {
        console.log(`⏳ 任务待客户端验证，跳过服务器审核: ${reviewId}`);
        return;
      }

      if (review.status !== 'pending') {
        console.log(`⚠️ 审核记录状态不是pending，跳过: ${review.status}`);
        return;
      }

      const { imageType, noteUrl, userNoteInfo } = review;

      // 只处理笔记和评论类型
      if (imageType !== 'note' && imageType !== 'comment') {
        console.log(`⚠️ 跳过非笔记/评论类型任务: ${imageType}`);
        return;
      }

      if (!noteUrl) {
        console.log(`⚠️ 任务没有笔记链接，跳过审核`);
        return;
      }

      // 执行完整的AI审核
      const aiReviewResult = await this.performFullAiReview(review);

      console.log(`📊 performFullAiReview 返回结果: ${aiReviewResult ? '有结果' : '无结果 (undefined)'}`);
      if (aiReviewResult) {
        console.log(`📊 aiReviewResult 详情: valid=${aiReviewResult.valid}, passed=${aiReviewResult.aiReview?.passed}, confidence=${aiReviewResult.aiReview?.confidence}`);
      }

      if (!aiReviewResult) {
        console.error(`❌ AI审核失败 (返回undefined): ${reviewId} - 可能是第一次审核失败，检查是否需要重试`);

        // 智能重试逻辑：基于失败原因决定是否重试
        const retryDecision = this.shouldRetryReview(review, 'system_error');
        if (retryDecision.shouldRetry) {
          console.log(`🔄 ${retryDecision.reason}，重新加入队列进行第${review.reviewAttempt + 1}次审核: ${reviewId}`);
          // 修复：重试前必须先更新数据库中的reviewAttempt计数器
          await ImageReview.findByIdAndUpdate(reviewId, {
            reviewAttempt: (review.reviewAttempt || 1) + 1,
            status: 'pending' // 确保状态保持为pending
          });
          this.addToQueue(reviewId);
        } else {
          // 达到最大重试次数或不适合重试，强制更新状态为rejected
          console.log(`❌ ${retryDecision.reason}，强制更新状态为rejected: ${reviewId}`);

          // 构建更具体的错误信息
          let specificReason = '审核过程中出现系统异常，审核未能正常完成，请联系客服处理';
          if (review.noteUrl) {
            specificReason += ` (笔记链接: ${review.noteUrl})`;
          }
          if (review.userNoteInfo?.author) {
            const authorInfo = Array.isArray(review.userNoteInfo.author)
              ? review.userNoteInfo.author.join(', ')
              : review.userNoteInfo.author;
            specificReason += ` (昵称: ${authorInfo})`;
          }

          await ImageReview.findByIdAndUpdate(reviewId, {
            status: 'rejected',
            rejectionReason: specificReason,
            auditHistory: (review.auditHistory || []).concat([{
              operator: null,
              operatorName: '系统',
              action: 'system_error_rejected',
              comment: '审核系统异常：AI审核服务返回异常结果，可能是网络或服务故障',
              timestamp: new Date()
            }])
          });
        }
        return;
      }

      // 检查是否是重试标记
      if (aiReviewResult.needsRetry) {
        console.log(`🔄 审核需要重试: ${reviewId}`);
        // 如果是Cookie过期导致的，不要重新加入队列（会导致无限循环）
        // Cookie更新后，loadPendingReviews会自动加载这些任务
        if (aiReviewResult.cookieExpired) {
          console.log(`🍪 Cookie已过期，暂停审核任务: ${reviewId}`);
          console.log(`💡 请更新Cookie后，系统将自动恢复审核（不重新加入队列避免无限循环）`);
          // 不重新加入队列，避免无限循环
          // Cookie更新后，通过loadPendingReviews或手动触发处理
          return;
        }
        // 非Cookie过期的重试，延迟后重新加入队列
        console.log(`⏳ 延迟180秒后重新加入队列: ${reviewId}`);
        setTimeout(() => {
          if (!this.reviewQueue.includes(reviewId)) {
            this.reviewQueue.push(reviewId);
            console.log(`📋 重试任务已重新加入队列: ${reviewId}`);
            this.processQueue();
          }
        }, 180000); // 3分钟后重试
        return;
      }

      // 检查是否标记为客户端验证
      if (aiReviewResult.markedForClient) {
        console.log(`✅ 任务已标记为客户端验证，等待客户端处理: ${reviewId}`);
        return;
      }

      // 检查是否标记为人工复审（笔记类型直接转人工复审）
      if (aiReviewResult.markedForReview) {
        console.log(`✅ 任务已标记为待人工复审，等待经理处理: ${reviewId}`);
        return;
      }

      // 根据审核结果更新记录
      await this.updateReviewWithAiResult(review, aiReviewResult);

      console.log(`✅ 异步AI审核完成: ${reviewId}, 结果: ${aiReviewResult.aiReview?.passed ? '通过' : '拒绝'}`);

    } catch (error) {
  // 重新查询review对象，确保数据完整性
  let review;
  try {
    review = await ImageReview.findById(reviewId);
  } catch (queryError) {
    console.error(`❌ 无法查询审核记录 ${reviewId}:`, queryError);
    return;
  }

  if (!review) {
    console.error(`❌ 审核记录不存在: ${reviewId}`);
    return;
  }

  // 错误分类和处理
  const classifiedError = this.classifyError(error, {
    reviewId,
    imageType: review.imageType,
    attempt: review.reviewAttempt || 1
  });

  console.error(`❌ 异步AI审核处理失败 ${reviewId} [${classifiedError.type}]:`, classifiedError.message);

  // 错误恢复处理
  const shouldContinue = this.handleErrorRecovery(classifiedError);
  if (!shouldContinue) {
    console.log(`🛑 错误恢复机制激活，跳过审核任务 ${reviewId}`);
    return;
  }

  // 如果是第二次审核失败，确保状态被正确更新为拒绝
  if (review.reviewAttempt >= 2 && review.status === 'pending') {
    console.log(`🔧 检测到第二次审核处理异常，强制更新状态为拒绝: ${reviewId}`);
    try {
      await ImageReview.findByIdAndUpdate(reviewId, {
        status: 'rejected',
        rejectionReason: `审核系统异常：第二次审核处理失败，错误类型：${classifiedError.type}，错误信息：${classifiedError.message}`,
        auditHistory: (review.auditHistory || []).concat([{
          operator: null,
          operatorName: '系统',
          action: 'system_error_rejected',
          comment: `审核系统异常：第二次审核过程中发生${classifiedError.type}错误，可能是${classifiedError.retryable ? '临时' : '永久'}故障。错误详情：${classifiedError.message}`,
          timestamp: new Date()
        }])
      });
    } catch (updateError) {
      console.error(`❌ 强制更新审核状态失败 ${reviewId}:`, updateError);
      // 记录更新失败的错误
      this.classifyError(updateError, { action: 'status_update', reviewId });
    }
  }
}

  }

  /**
   * 添加审核历史记录（辅助方法）
   */
  async addAuditHistory(reviewId, review, action, operatorName, comment, extraData = {}) {
    try {
      const historyItem = {
        operator: null,
        operatorName: operatorName,
        action: action,
        comment: comment,
        timestamp: new Date(),
        ...extraData
      };
      await ImageReview.findByIdAndUpdate(reviewId, {
        $push: { auditHistory: historyItem }
      });
    } catch (error) {
      console.error(`❌ 添加审核历史失败:`, error);
    }
  }

  /**
   * 执行完整的AI审核（新流程：延迟后转客户端验证）
   */
  async performFullAiReview(review) {
    const { imageType, noteUrl, userNoteInfo } = review;
    const reviewId = review._id; // 添加reviewId定义

    try {
      console.log(`🔍 执行审核延迟调度: ${imageType} - ${noteUrl}`);

      // 记录审核开始
      const reviewAttempt = review.reviewAttempt || 1;
      await this.addAuditHistory(reviewId, review, 'review_start', 'AI审核系统',
        `开始第${reviewAttempt}次审核（${imageType === 'note' ? '笔记' : '评论'}类型）`);

      // 【根据类型执行不同的审核延迟】
      if (imageType === 'note' && userNoteInfo) {
        // 笔记类型：不延迟，直接处理
        console.log(`📝 笔记类型，直接处理（无延迟）`);
      } else if (imageType === 'comment' && userNoteInfo) {
        // 评论类型：不延迟，直接处理
        console.log(`💬 评论类型，直接处理（无延迟）`);
      } else {
        console.log(`⚠️ 跳过非笔记/评论类型任务: ${imageType}`);
        return null;
      }

      // 记录审核延迟完成
      await this.addAuditHistory(reviewId, review, 'review_wait_complete', 'AI审核系统',
        `审核等待完成，开始内容分析`);

      // 【评论类型】直接转客户端验证，不做服务器端审核
      if (imageType === 'comment') {
        console.log(`💬 评论类型，跳过服务器端审核，直接转客户端验证: ${reviewId}`);
        await this.addAuditHistory(reviewId, review, 'skip_server_audit', 'AI审核系统',
          `评论类型任务，跳过服务器端关键词检查和AI文意审核，直接转客户端验证`);
        await this.markForClientVerification(review, 1);
        return {
          valid: true,
          markedForClient: true,
          message: '评论类型，已标记为待客户端验证'
        };
      }

      // 【笔记类型】直接转人工复审，不做服务器端AI审核
      if (imageType === 'note') {
        console.log(`📝 笔记类型，跳过服务器端AI审核，直接转人工复审: ${reviewId}`);
        await this.addAuditHistory(reviewId, review, 'skip_server_audit', 'AI审核系统',
          `笔记类型任务，跳过服务器端关键词检查和AI文意审核，直接转人工复审`);

        // 直接标记为待人工复审状态
        await ImageReview.findByIdAndUpdate(reviewId, {
          status: 'ai_approved',
          'aiReviewResult.passed': true,
          'aiReviewResult.reasons': ['提交成功，等待人工复审']
        });

        return {
          valid: true,
          markedForReview: true,
          message: '笔记类型，已标记为待人工复审'
        };
      }

      // 未知类型，不应该到达这里
      console.log(`⚠️ 未知的任务类型: ${imageType}，跳过处理`);
      return null;

    } catch (error) {
      const classifiedError = this.classifyError(error, {
        service: 'xiaohongshu',
        action: 'review_delay_schedule',
        imageType,
        noteUrl
      });

      console.error(`❌ 审核延迟调度失败 [${classifiedError.type}]:`, classifiedError.message);

      return {
        valid: false,
        error: classifiedError.message,
        needsRetry: classifiedError.retryable
      };
    }
  }

  /**
   * 等待审核延迟时间（从任务提交开始计算）
   */
  async waitForReviewDelay(review, requiredSeconds) {
    const now = new Date();
    const timeSinceSubmission = now.getTime() - review.createdAt.getTime();
    const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

    console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
    console.log(`⏱️ 当前时间: ${now.toISOString()}`);
    console.log(`⏱️ 距离提交已过: ${timeSinceSubmissionSeconds}秒，需要等待: ${requiredSeconds}秒`);

    if (timeSinceSubmissionSeconds < requiredSeconds) {
      const remainingTime = (requiredSeconds - timeSinceSubmissionSeconds) * 1000;
      const remainingSeconds = Math.floor(remainingTime / 1000);
      console.log(`⏳ 审核延迟，还需等待${remainingSeconds}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      console.log('✅ 审核延迟完成');
    } else {
      console.log(`✅ 已超过所需延迟时间，直接进入客户端验证`);
    }
  }

  /**
   * 标记任务为待客户端验证状态
   */
  async markForClientVerification(review, attempt) {
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
   * @param {boolean} verifyResult.success - 验证是否成功
   * @param {boolean} verifyResult.verified - 内容是否验证存在
   * @param {string} verifyResult.comment - 验证说明
   */
  async handleClientVerificationResult(reviewId, verifyResult) {
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

      // 早期检查：如果任务已经完成（rejected/completed/ai_approved），拒绝重复处理
      if (review.status === 'rejected' || review.status === 'completed' || review.status === 'ai_approved') {
        console.log(`⚠️ 该任务已完成(${review.status})，不再处理验证结果: ${reviewId}`);
        return { success: false, message: '任务已完成' };
      }

      // 记录当前验证结果（保存完整的 reason 和 contentAudit）
      const resultData = {
        success: verifyResult.success,
        verified: verifyResult.verified !== undefined ? verifyResult.verified : verifyResult.success,
        comment: verifyResult.comment || (verifyResult.success ? '客户端验证通过' : '客户端验证失败'),
        reason: verifyResult.reason || null,  // 完整的驳回原因（关键词+AI+评论验证）
        contentAudit: verifyResult.contentAudit || null,  // 内容审核结果
        verifiedAt: new Date(),
        screenshotUrl: verifyResult.screenshotUrl || null
      };

      if (clientVerification.attempt === 1) {
        clientVerification.firstResult = resultData;

        // 如果第一次验证成功，直接通过
        if (verifyResult.success && verifyResult.verified !== false) {
          console.log(`✅ 第一次客户端验证成功，任务通过: ${reviewId}`);
          await this.processClientVerificationSuccess(review, clientVerification);
          return { success: true, message: '验证成功，任务已通过' };
        }

        // 第一次验证失败，准备第二次验证
        console.log(`⚠️ 第一次客户端验证失败，准备第二次验证: ${reviewId}`);

        // 检查是否已达到最大尝试次数
        if (review.reviewAttempt >= 2) {
          console.log(`❌ 已达到最大验证次数，最终驳回: ${reviewId}`);
          await this.processClientVerificationFinalReject(review, clientVerification);
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
        setTimeout(async () => {
          try {
            // 防御性检查：确保任务状态仍然需要第二次验证
            const currentReview = await ImageReview.findById(reviewId);
            if (!currentReview) return;

            // 如果任务已经完成或已超过最大尝试次数，不再调度
            // 注意：reviewAttempt=2 表示正在进行第二次验证，应该允许调度
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
            this.addToQueue(reviewId);
          } catch (err) {
            console.error(`❌ 激活第二次验证失败: ${reviewId}`, err);
          }
        }, 300 * 1000);

        return { success: true, message: '第一次验证失败，将在300秒后进行第二次验证' };

      } else {
        // 第二次验证结果（使用相同的 resultData 结构）
        clientVerification.secondResult = resultData;

        if (verifyResult.success && verifyResult.verified !== false) {
          console.log(`✅ 第二次客户端验证成功，任务通过: ${reviewId}`);
          await this.processClientVerificationSuccess(review, clientVerification);
          return { success: true, message: '第二次验证成功，任务已通过' };
        } else {
          console.log(`❌ 第二次客户端验证也失败，最终驳回: ${reviewId}`);
          // 先递增 reviewAttempt 防止重复处理
          await ImageReview.findByIdAndUpdate(reviewId, {
            reviewAttempt: 3
          });
          await this.processClientVerificationFinalReject(review, clientVerification);
          return { success: true, message: '第二次验证失败，任务已驳回' };
        }
      }

    } catch (error) {
      console.error(`❌ 处理客户端验证结果失败: ${reviewId}`, error);
      return { success: false, message: '处理验证结果失败' };
    }
  }

  /**
   * 处理客户端验证成功的情况
   */
  async processClientVerificationSuccess(review, clientVerification) {
    const updateData = {
      status: review.imageType === 'note' ? 'ai_approved' : 'completed',
      clientVerification: clientVerification
    };

    updateData.auditHistory = review.auditHistory || [];

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

    updateData.auditHistory.push({
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
    });

    await ImageReview.findByIdAndUpdate(review._id, updateData);

    // 如果是评论类型，直接发放积分
    if (review.imageType === 'comment') {
      await this.awardPointsForClientVerification(review);
    }

    console.log(`✅ 客户端验证成功，状态已更新: ${review._id}`);
  }

  /**
   * 处理客户端验证最终驳回的情况
   */
  async processClientVerificationFinalReject(review, clientVerification) {
    const firstResult = clientVerification.firstResult;
    const secondResult = clientVerification.secondResult;

    // 优先使用完整的 reason（包含关键词检查、AI审核、评论验证）
    // 如果 reason 不存在，则使用 comment 作为后备
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

    const updateData = {
      status: 'rejected',
      rejectionReason: finalReason,  // 使用完整的 reason
      clientVerification: clientVerification
    };

    updateData.auditHistory = review.auditHistory || [];
    updateData.auditHistory.push({
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
    });

    await ImageReview.findByIdAndUpdate(review._id, updateData);

    console.log(`❌ 客户端验证最终驳回: ${review._id}, 原因: ${finalReason}`);
  }

  /**
   * 为客户端验证成功的任务发放积分
   */
  async awardPointsForClientVerification(review) {
    try {
      const TaskConfig = require('../models/TaskConfig');
      const User = require('../models/User');
      const Transaction = require('../models/Transaction');

      // 【防重复发放】检查是否已经发放过该任务的积分
      const existingReward = await Transaction.findOne({
        imageReview_id: review._id,
        type: 'task_reward'
      });

      if (existingReward) {
        console.log(`⚠️ [客户端验证] 该任务已发放过积分，跳过重复发放: ${review._id}`);
        // 仍然需要处理佣金（可能之前只发了积分没发佣金）
        await this.processCommissionForClientVerification(review);
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
        }

        // 处理佣金（如果有的话）
        await this.processCommissionForClientVerification(review);
      }
    } catch (error) {
      console.error('❌ 发放积分失败:', error);
    }
  }

  /**
   * 为客户端验证成功的任务处理佣金
   */
  async processCommissionForClientVerification(review) {
    try {
      if (!review.snapshotCommission1 || review.snapshotCommission1 <= 0) {
        return;
      }

      const User = require('../models/User');
      const Transaction = require('../models/Transaction');

      const populatedReview = await ImageReview.findById(review._id).populate('userId');

      if (populatedReview.userId?.parent_id) {
        // 【防重复发放】检查一级佣金是否已发放
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
            // 【防重复发放】检查二级佣金是否已发放
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
   * 根据AI审核结果更新审核记录
   */
  async updateReviewWithAiResult(review, aiReviewResult) {
    const updateData = {};

    // 保存AI审核结果
    updateData.aiReviewResult = aiReviewResult.aiReview;
    // 保存AI分析结果（新增）
    if (aiReviewResult.aiAnalysis) {
      updateData.aiAnalysis = aiReviewResult.aiAnalysis;
    }
    if (aiReviewResult.contentMatch) {
      let author = aiReviewResult.contentMatch.pageAuthor;
      // 删除最后的"关注"两个字
      if (author && author.endsWith('关注')) {
        author = author.slice(0, -2).trim();
      }
      updateData.aiParsedNoteInfo = {
        author: author,
        title: aiReviewResult.contentMatch.pageTitle
      };
    }

    // 保存评论验证结果
    if (aiReviewResult.commentVerification) {
      // 🔥 数据一致性验证：防止保存 commentVerification.exists=true 但 foundComments 为空的不一致数据
      const cv = aiReviewResult.commentVerification;
      if (cv.exists === true && (!cv.foundComments || cv.foundComments.length === 0)) {
        console.error('❌ [数据验证] 检测到不一致的评论验证数据: exists=true 但 foundComments 为空');
        console.error('   链接:', review.noteUrl);
        console.error('   评论:', review.userNoteInfo?.comment);
        console.error('   commentVerification:', JSON.stringify(cv));

        // 强制修正：如果 foundComments 为空，exists 应该为 false
        cv.exists = false;
        console.warn('⚠️ [数据修正] 自动将 exists 设为 false');
      }

      updateData.aiReviewResult.commentVerification = cv;

      // 设置评论昵称信息
      if (review.imageType === 'comment') {
        let authorToSet = null;

        if (aiReviewResult.commentVerification?.foundComments?.length > 0) {
          authorToSet = aiReviewResult.commentVerification.foundComments[0].author;
        }

        if (!authorToSet && Array.isArray(review.userNoteInfo?.author) && review.userNoteInfo.author.length > 0) {
          authorToSet = review.userNoteInfo.author[0].trim();
        }

        if (authorToSet) {
          updateData.aiParsedNoteInfo = updateData.aiParsedNoteInfo || {};
          updateData.aiParsedNoteInfo.author = authorToSet;
        }
      }
    }

    // 根据审核结果决定状态
    console.log(`📋 更新审核结果: passed=${aiReviewResult.aiReview.passed}, confidence=${aiReviewResult.aiReview.confidence}, reasons=${JSON.stringify(aiReviewResult.aiReview.reasons)}`);

    if (aiReviewResult.aiReview.passed && aiReviewResult.aiReview.confidence >= 0.7) {
      console.log('✅ 审核通过条件满足，执行通过逻辑');
      // 审核通过，执行后续逻辑
      const approvalResult = await this.processApproval(review, aiReviewResult);

      if (approvalResult.approved) {
        // 笔记需要人工复审，评论直接通过
        if (review.imageType === 'note') {
          updateData.status = 'ai_approved'; // AI审核通过，待人工复审
        } else if (review.imageType === 'comment') {
          updateData.status = 'completed'; // 评论AI审核通过，直接完成
        }

        updateData.auditHistory = review.auditHistory || [];
        updateData.auditHistory.push({
          operator: null,
          operatorName: 'AI审核系统',
          action: 'ai_auto_approved',
          comment: `AI自动审核通过 (信心度: ${(aiReviewResult.aiReview.confidence * 100).toFixed(1)}%)，${review.imageType === 'note' ? '等待人工复审通过后发放积分' : `已发放${approvalResult.pointsReward}积分`}`,
          timestamp: new Date()
        });

        // 评论类型：添加积分发放记录到 auditHistory
        if (review.imageType === 'comment' && approvalResult.pointsReward > 0) {
          updateData.auditHistory.push({
            operator: null,
            operatorName: 'AI审核系统',
            action: 'points_reward',
            comment: `发放积分 ${approvalResult.pointsReward} (评论审核通过)`,
            timestamp: new Date()
          });
        }

        console.log(`✅ 审核通过，状态设置为${updateData.status} (${review.imageType === 'note' ? '待人工复审' : '直接通过'})`);
      } else {
        // 审核被限制条件拒绝
        updateData.status = 'manager_rejected';
        updateData.rejectionReason = approvalResult.reason;
        updateData.auditHistory = review.auditHistory || [];
        updateData.auditHistory.push({
          operator: null,
          operatorName: 'AI审核系统',
          action: 'ai_auto_rejected',
          comment: `AI自动审核拒绝：${approvalResult.reason}`,
          timestamp: new Date()
        });
        console.log(`❌ 审核被限制条件拒绝，状态设置为manager_rejected: ${approvalResult.reason}`);
      }
    } else {
      // 审核失败
      updateData.status = 'rejected';
      // 使用具体的审核失败原因
      updateData.rejectionReason = aiReviewResult.aiReview.reasons && aiReviewResult.aiReview.reasons.length > 0
        ? aiReviewResult.aiReview.reasons.join('；')
        : '不符合笔记要求';
      updateData.auditHistory = review.auditHistory || [];
      updateData.auditHistory.push({
        operator: null,
        operatorName: 'AI审核系统',
        action: 'ai_auto_rejected',
        comment: `AI自动审核失败：${updateData.rejectionReason}`,
        timestamp: new Date()
      });
      console.log(`❌ 审核失败，状态设置为rejected: ${updateData.rejectionReason}`);
    }

    // 更新审核记录
    await ImageReview.findByIdAndUpdate(review._id, updateData);

    // AI自动审核通过后，自动发放两级推荐佣金（仅对评论直接通过的情况）
    // 【注意】新流程下评论走客户端验证，这段代码理论上不会被执行，但保留防重复检查
    if (updateData.status === 'manager_approved' && review.imageType === 'comment' && review.snapshotCommission1 > 0) {
      try {
        const User = require('../models/User');
        const Transaction = require('../models/Transaction');
        const populatedReview = await ImageReview.findById(review._id).populate('userId');

        // 【防重复发放】检查一级佣金是否已发放
        const existingCommission1 = await Transaction.findOne({
          imageReview_id: review._id,
          type: 'referral_bonus_1'
        });

        console.log(`🔍 [AI佣金] reviewId: ${review._id}, commission: ${review.snapshotCommission1}`);
        console.log(`🔍 [AI佣金] userId.parent_id: ${populatedReview.userId?.parent_id}`);
        if (existingCommission1) {
          console.log(`⚠️ [AI佣金] 一级佣金已发放，跳过: ${review._id}`);
        }

        if (populatedReview.userId?.parent_id && !existingCommission1) {
          // 一级佣金：直接增加上级积分
          const parentUser = await User.findById(populatedReview.userId.parent_id);
          if (parentUser && !parentUser.is_deleted) {
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

            // 二级佣金
            if (parentUser.parent_id && review.snapshotCommission2 > 0) {
              // 【防重复发放】检查二级佣金是否已发放
              const existingCommission2 = await Transaction.findOne({
                imageReview_id: review._id,
                type: 'referral_bonus_2'
              });

              if (existingCommission2) {
                console.log(`⚠️ [AI佣金] 二级佣金已发放，跳过: ${review._id}`);
              } else {
                const grandParentUser = await User.findById(parentUser.parent_id);
                if (grandParentUser && !grandParentUser.is_deleted) {
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
              }
            }
          } else {
            console.log(`⚠️ [AI佣金] 上级用户不存在或已删除`);
          }
        } else {
          console.log(`⚠️ [AI佣金] userId.parent_id 不存在`);
        }
      } catch (error) {
        console.error('❌ [AI佣金] 发放佣金失败:', error);
      }
    }

    // 如果审核通过且是评论类型，记录评论限制信息
    // 评论AI审核通过后直接记录，不需要等待人工复审
    // 注意：评论通过后状态是 manager_approved，笔记通过后状态是 ai_approved
    if ((updateData.status === 'ai_approved' || updateData.status === 'manager_approved') && review.imageType === 'comment') {
      try {
        console.log(`🔍 [CommentLimit调试] 开始记录评论限制，reviewId: ${review._id}`);
        console.log(`🔍 [CommentLimit调试] updateData.aiParsedNoteInfo:`, updateData.aiParsedNoteInfo);
        console.log(`🔍 [CommentLimit调试] aiReviewResult.commentVerification:`, aiReviewResult.commentVerification);
        console.log(`🔍 [CommentLimit调试] review.userNoteInfo:`, review.userNoteInfo);

        let authorToRecord = updateData.aiParsedNoteInfo?.author;
        console.log(`🔍 [CommentLimit调试] 初始作者来源1 (aiParsedNoteInfo.author): ${authorToRecord}`);

        // 如果AI解析的作者为空，优先使用评论验证找到的作者
        if (!authorToRecord && aiReviewResult.commentVerification?.foundComments?.[0]?.author) {
          authorToRecord = aiReviewResult.commentVerification.foundComments[0].author;
          console.log(`📝 [CommentLimit调试] 使用评论验证作者来源2: ${authorToRecord}`);
        } else if (!authorToRecord) {
          console.log(`⚠️ [CommentLimit调试] 评论验证作者为空或不存在: foundComments=${JSON.stringify(aiReviewResult.commentVerification?.foundComments)}`);
        }

        // 如果还是为空，使用用户提交的作者
        if (!authorToRecord && Array.isArray(review.userNoteInfo?.author)) {
          authorToRecord = review.userNoteInfo.author[0];
          console.log(`📝 [CommentLimit调试] 使用用户提交作者来源3: ${authorToRecord} (数组格式)`);
        } else if (!authorToRecord && typeof review.userNoteInfo?.author === 'string' && review.userNoteInfo.author.trim()) {
          // 【修复】支持字符串格式的作者信息
          // 如果是逗号分隔的多个昵称，取第一个
          const authorStr = review.userNoteInfo.author.trim();
          if (authorStr.includes(',') || authorStr.includes('，')) {
            // 支持中英文逗号分隔
            authorToRecord = authorStr.split(/[,，]/)[0].trim();
            console.log(`📝 [CommentLimit调试] 使用用户提交作者来源3: ${authorToRecord} (字符串格式，从多个昵称中取第一个)`);
          } else {
            authorToRecord = authorStr;
            console.log(`📝 [CommentLimit调试] 使用用户提交作者来源3: ${authorToRecord} (字符串格式)`);
          }
        } else if (!authorToRecord) {
          console.log(`⚠️ [CommentLimit调试] 用户未提交作者信息`);
        }

        // 如果还是为空，尝试从评论验证结果中获取设备昵称
        if (!authorToRecord && aiReviewResult.commentVerification?.deviceNicknames?.length > 0) {
          authorToRecord = aiReviewResult.commentVerification.deviceNicknames[0];
          console.log(`📝 [CommentLimit调试] 使用设备昵称来源4: ${authorToRecord}`);
        } else if (!authorToRecord) {
          console.log(`⚠️ [CommentLimit调试] 无设备昵称可用: deviceNicknames=${JSON.stringify(aiReviewResult.commentVerification?.deviceNicknames)}`);
        }

        console.log(`📝 [CommentLimit调试] 最终记录评论限制: 作者=${authorToRecord}, 链接=${review.noteUrl}, 评论=${review.userNoteInfo?.comment?.substring(0, 20)}...`);

        const hasAuthor = !!authorToRecord;
        const hasNoteUrl = !!review.noteUrl;
        const hasComment = !!review.userNoteInfo?.comment;

        console.log(`📝 [CommentLimit调试] 记录条件检查: hasAuthor=${hasAuthor}, hasNoteUrl=${hasNoteUrl}, hasComment=${hasComment}`);

        if (authorToRecord && review.noteUrl && review.userNoteInfo?.comment) {
          console.log(`✅ [CommentLimit调试] 开始记录评论限制: 作者=${authorToRecord}, 链接=${review.noteUrl}`);
          await CommentLimit.recordCommentApproval(
            review.noteUrl,
            authorToRecord,
            review.userNoteInfo.comment,
            review._id
          );
          console.log(`✅ [CommentLimit调试] 评论限制记录成功`);
        } else {
          console.warn('⚠️ [CommentLimit调试] 无法记录评论限制: 缺少必要信息', {
            authorToRecord,
            noteUrl: review.noteUrl,
            comment: review.userNoteInfo?.comment?.substring(0, 20),
            aiParsedAuthor: updateData.aiParsedNoteInfo?.author,
            commentVerificationAuthor: aiReviewResult.commentVerification?.foundComments?.[0]?.author,
            userSubmittedAuthor: Array.isArray(review.userNoteInfo?.author) ? review.userNoteInfo.author[0] : review.userNoteInfo?.author,
            deviceNicknames: aiReviewResult.commentVerification?.deviceNicknames,
            conditionCheck: { hasAuthor, hasNoteUrl, hasComment }
          });
        }
      } catch (error) {
        console.error('❌ [CommentLimit调试] 记录评论限制信息失败:', error);
      }
    }

    // 如果是笔记类型，记录设备笔记发布历史
    if (review.imageType === 'note') {
      try {
        // 【修复】检查 userId 是否存在，避免访问 null._id 导致错误
        if (review.userId) {
          await deviceNoteService.recordDeviceNoteSubmission(
            review.deviceInfo?.accountName || 'unknown',
            review.userId._id,
            review.noteUrl,
            review.userNoteInfo?.title || '',
            review.userNoteInfo?.author || '',
            review._id
          );
        } else {
          console.warn('⚠️ 记录设备笔记历史失败：审核任务没有关联用户');
        }
      } catch (error) {
        console.error('记录设备笔记发布历史失败:', error);
      }
    }
  }

  /**
   * 处理审核通过的逻辑（检查各种限制条件）
   */
  async processApproval(review, aiReviewResult) {
    try {
      const { imageType, userId, noteUrl, userNoteInfo } = review;

      // 【仅笔记类型】检查昵称1天使用限制
      // 评论类型不需要1天昵称限制，只需要检查昵称+链接限制
      let matchedAuthor = (imageType === 'note') ? aiReviewResult.contentMatch?.pageAuthor : null;

      // 如果AI未能解析到昵称，尝试使用用户提交的昵称
      if (!matchedAuthor || !matchedAuthor.trim()) {
        if (userNoteInfo?.author) {
          matchedAuthor = Array.isArray(userNoteInfo.author) ? userNoteInfo.author[0] : userNoteInfo.author;
          console.log(`⚠️ AI未能解析页面昵称，使用用户提交的昵称进行1天检查: "${matchedAuthor}"`);
        } else {
          console.log(`⚠️ 既无AI解析昵称也无用户提交昵称，跳过1天昵称检查`);
        }
      }

      // 【仅笔记】检查1天昵称限制
      if (imageType === 'note' && matchedAuthor && matchedAuthor.trim()) {
        // 清理昵称格式（与保存时保持一致）
        const cleanAuthorName = (name) => {
          if (!name) return '';
          // 移除常见的关注相关后缀
          return name.replace(/\s*关注\s*$/, '').trim();
        };

        const cleanedAuthor = cleanAuthorName(matchedAuthor.trim());

        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        console.log(`🔍 检查昵称 "${cleanedAuthor}" 的1天使用限制，用户: ${userId._id}, 时间范围: ${oneDayAgo.toISOString()} ~ ${new Date().toISOString()}`);

        // 查找最近1天内使用过该昵称的记录
        // 优先使用人工复审通过时间（managerApproval.approvedAt），其次使用财务处理时间
        const recentReview = await ImageReview.findOne({
          'aiParsedNoteInfo.author': cleanedAuthor,
          userId: userId._id,
          status: { $in: ['manager_approved', 'completed'] },
          $or: [
            { 'managerApproval.approvedAt': { $gte: oneDayAgo } }, // 人工复审通过时间
            { 'financeProcess.processedAt': { $gte: oneDayAgo } } // 财务处理时间（兼容老数据）
          ]
        });

        if (recentReview) {
          const lastUsedTime = recentReview.managerApproval?.approvedAt || recentReview.financeProcess?.processedAt || recentReview.createdAt;
          console.log(`🛡️ 1天昵称限制触发: 昵称"${cleanedAuthor}"在1天内已被使用，上次人工复审通过时间: ${lastUsedTime.toISOString()}`);
          return {
            approved: false,
            reason: `风控提示：昵称"${cleanedAuthor}"在1天内已被使用（上次人工复审通过: ${new Date(lastUsedTime).toLocaleDateString('zh-CN')}），无法重复提交审核`
          };
        } else {
          console.log(`✅ 1天昵称检查通过: 昵称"${cleanedAuthor}"在1天内未被使用`);
        }
      } else {
        console.log(`⚠️ 无有效昵称信息，跳过1天昵称检查`);
      }

      // 评论类型检查昵称+链接限制
      if (imageType === 'comment') {
        let authorToCheck = aiReviewResult.commentVerification?.foundComments?.[0]?.author;
        if (!authorToCheck) {
          // 支持字符串或数组格式的作者信息
          if (Array.isArray(userNoteInfo?.author) && userNoteInfo.author.length > 0) {
            authorToCheck = userNoteInfo.author[0];
          } else if (typeof userNoteInfo?.author === 'string' && userNoteInfo.author.trim()) {
            authorToCheck = userNoteInfo.author.trim();
          }
        }

        if (authorToCheck) {
          console.log(`🔍 检查评论限制: 作者=${authorToCheck}, 链接=${noteUrl}`);
          const approvalCheck = await CommentLimit.checkCommentApproval(
            noteUrl,
            authorToCheck,
            userNoteInfo?.comment || ''
          );

          if (!approvalCheck.canApprove) {
            console.log(`❌ 评论限制检查失败: ${approvalCheck.reason}`);
            return {
              approved: false,
              reason: approvalCheck.reason || '评论审核限制'
            };
          } else {
            console.log(`✅ 评论限制检查通过`);
          }
        } else {
          console.warn('⚠️ 无法获取评论作者信息，跳过评论限制检查');
        }
      }

      // 笔记类型检查设备发布限制
      if (imageType === 'note' && matchedAuthor) {
        const matchedDevice = await Device.findOne({
          accountName: matchedAuthor,
          assignedUser: userId._id,
          is_deleted: { $ne: true }
        });

        if (matchedDevice) {
          const deviceNoteCheck = await deviceNoteService.checkDeviceNoteSubmission(matchedDevice._id);
          if (!deviceNoteCheck.canSubmit) {
            return {
              approved: false,
              reason: deviceNoteCheck.message
            };
          }
        }
      }

      // 审核通过，给用户增加积分
      // 注意：笔记类型AI审核通过时不给积分，需要人工复审通过后才给
      // 评论类型AI审核通过时直接给积分（评论无需人工复审）
      const taskConfig = await TaskConfig.findOne({ type_key: imageType, is_active: true });
      const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

      // 只有评论类型才在AI审核通过时发放积分
      if (pointsReward > 0 && imageType === 'comment') {
        const User = require('../models/User');
        const Transaction = require('../models/Transaction');

        // 【防重复发放】检查是否已经发放过该任务的积分
        const existingReward = await Transaction.findOne({
          imageReview_id: review._id,
          type: 'task_reward'
        });

        if (existingReward) {
          console.log(`⚠️ [AI审核-评论] 该任务已发放过积分，跳过重复发放: ${review._id}`);
        } else {
          // 发放用户积分
          await User.findByIdAndUpdate(userId._id, {
            $inc: { points: pointsReward }
          });

          // 创建交易记录（包含 imageReview_id 用于重复检查）
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
        }
      } else if (imageType === 'note') {
        console.log(`⏳ [AI审核] 笔记类型审核通过，暂不发放积分，等待人工复审通过`);
      }

      return {
        approved: true,
        pointsReward: imageType === 'comment' ? pointsReward : 0 // 笔记类型返回0积分
      };

    } catch (error) {
      console.error('处理审核通过逻辑失败:', error);
      return {
        approved: false,
        reason: '审核通过处理失败'
      };
    }
  }

  /**
   * 字符串相似度比对
   */
  compareStrings(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    if (s1.includes(s2) || s2.includes(s1)) return 90;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return Math.round((longer.length - editDistance) / longer.length * 100);
  }

  /**
   * 计算编辑距离
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 错误分类和处理
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   * @returns {Object} 分类后的错误信息
   */
  classifyError(error, context = {}) {
    const errorMessage = error.message || 'Unknown error';
    const errorStack = error.stack;

    // 网络相关错误
    if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
      return {
        type: 'network_error',
        severity: 'medium',
        retryable: true,
        message: `网络错误: ${errorMessage}`,
        context
      };
    }

    // 解析相关错误
    if (errorMessage.includes('parse') || errorMessage.includes('cheerio') ||
        errorMessage.includes('HTML') || errorMessage.includes('selector')) {
      return {
        type: 'parse_error',
        severity: 'high',
        retryable: true,
        message: `内容解析错误: ${errorMessage}`,
        context
      };
    }

    // 数据库相关错误
    if (errorMessage.includes('Mongo') || errorMessage.includes('database') ||
        errorMessage.includes('findById') || errorMessage.includes('save')) {
      return {
        type: 'database_error',
        severity: 'critical',
        retryable: false,
        message: `数据库错误: ${errorMessage}`,
        context
      };
    }

    // 小红书服务相关错误
    if (errorMessage.includes('Xiaohongshu') || errorMessage.includes('note') ||
        errorMessage.includes('comment') || context.service === 'xiaohongshu') {
      return {
        type: 'service_error',
        severity: 'high',
        retryable: true,
        message: `小红书服务错误: ${errorMessage}`,
        context
      };
    }

    // 关键词检查错误
    if (errorMessage.includes('keyword') || context.check === 'keyword') {
      return {
        type: 'keyword_error',
        severity: 'low',
        retryable: false,
        message: `关键词检查错误: ${errorMessage}`,
        context
      };
    }

    // 默认错误类型
    return {
      type: 'unknown_error',
      severity: 'medium',
      retryable: true,
      message: `未知错误: ${errorMessage}`,
      context,
      stack: errorStack
    };
  }

  /**
   * 错误恢复机制
   * @param {Object} classifiedError - 分类后的错误
   * @returns {boolean} 是否应该继续处理
   */
  handleErrorRecovery(classifiedError) {
    const now = Date.now();

    // 更新连续失败计数
    if (classifiedError.severity === 'critical' || classifiedError.type === 'database_error') {
      this.errorRecovery.consecutiveFailures++;
      this.errorRecovery.lastErrorTime = now;
    } else {
      // 非严重错误，重置计数
      this.errorRecovery.consecutiveFailures = 0;
    }

    // 熔断器逻辑：连续5次严重错误，启动熔断器
    if (this.errorRecovery.consecutiveFailures >= 5) {
      this.errorRecovery.circuitBreaker = true;
      this.errorRecovery.circuitBreakerResetTime = now + (5 * 60 * 1000); // 5分钟后重置
      console.error('🚨 熔断器激活：连续5次严重错误，暂停审核服务5分钟');
      return false;
    }

    // 检查熔断器是否应该重置
    if (this.errorRecovery.circuitBreaker && now > this.errorRecovery.circuitBreakerResetTime) {
      this.errorRecovery.circuitBreaker = false;
      this.errorRecovery.consecutiveFailures = 0;
      console.log('🔄 熔断器重置：审核服务恢复正常');
    }

    // 如果熔断器激活，不继续处理
    if (this.errorRecovery.circuitBreaker) {
      console.warn('⚠️ 熔断器激活中，跳过审核任务');
      return false;
    }

    return true;
  }

  /**
   * 智能重试决策
   * @param {Object} review - 审核记录
   * @param {string} failureReason - 失败原因类型
   * @returns {Object} 重试决策结果
   */
  shouldRetryReview(review, failureReason) {
    const currentAttempt = review.reviewAttempt || 1;
    const maxAttempts = 2; // 最大尝试次数（初始1次 + 重试1次）

    // 如果已经达到最大尝试次数，不再重试
    // 当 reviewAttempt = 2 时，说明已经做过2次尝试，不再允许重试
    if (currentAttempt >= maxAttempts) {
      return {
        shouldRetry: false,
        reason: `已达到最大尝试次数(${maxAttempts})`
      };
    }

    // 根据失败原因决定是否重试
    switch (failureReason) {
      case 'system_error':
        // 系统错误（如网络超时、解析失败）可以重试
        return {
          shouldRetry: true,
          reason: '系统错误，值得重试'
        };

      case 'keyword_check_failed':
        // 关键词检查失败通常不值得重试，因为内容不会改变
        return {
          shouldRetry: false,
          reason: '关键词检查失败，不适合重试'
        };

      case 'content_parse_failed':
        // 内容解析失败可能因为临时网络问题，可以重试
        return {
          shouldRetry: true,
          reason: '内容解析失败，值得重试'
        };

      case 'comment_verification_error':
        // 评论验证错误可以重试
        return {
          shouldRetry: true,
          reason: '评论验证出错，值得重试'
        };

      case 'comment_not_found':
        // 评论不存在通常不值得重试，因为评论不会突然出现
        return {
          shouldRetry: false,
          reason: '评论不存在，不适合重试'
        };

      default:
        // 默认情况下，对于未知错误，可以重试一次
        return {
          shouldRetry: currentAttempt < 2,
          reason: `未知错误类型${currentAttempt < 2 ? '，尝试重试' : '，不再重试'}`
        };
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    // 获取AI服务状态
    const aiServiceStatus = this.aiContentAnalysisService.getStatus();

    return {
      isRunning: this.isRunning,
      queueLength: this.reviewQueue.length,
      activeReviews: this.activeReviews,
      maxConcurrentReviews: this.maxConcurrentReviews,
      reviewStats: this.reviewStats,
      performance: {
        utilizationRate: this.activeReviews / this.maxConcurrentReviews,
        queueEfficiency: this.reviewQueue.length > 0 ? Math.min(1, this.activeReviews / this.maxConcurrentReviews) : 1
      },
      errorRecovery: {
        ...this.errorRecovery,
        circuitBreakerActive: this.errorRecovery.circuitBreaker,
        timeUntilReset: this.errorRecovery.circuitBreakerResetTime ?
          Math.max(0, this.errorRecovery.circuitBreakerResetTime - Date.now()) : 0
      },
      aiService: {
        isRunning: aiServiceStatus.isRunning,
        stats: aiServiceStatus.stats,
        cache: aiServiceStatus.cache,
        performance: aiServiceStatus.performance,
        errorRecovery: aiServiceStatus.errorRecovery
      }
    };
  }

  /**
   * 标记Cookie为过期状态（优化版本 - 带确认机制）
   *
   * 当检测到小红书页面出现密码输入框时调用
   *
   * Cookie失效检测说明：
   * - 笔记内容：公开可访问，无需Cookie
   * - 评论区：需要Cookie才能加载
   * - Cookie失效只有一种情况：页面出现密码输入框（登录页）
   *
   * 确认机制（防止误判）：
   * 1. 需要连续3次检测到密码输入框（5分钟内）
   * 2. 添加冷却期，防止频繁切换状态
   * 3. 记录失败原因和时间戳，便于分析
   *
   * @param {string} reason - 失败原因
   * @returns {boolean} 是否真正标记为过期（false表示只是记录但未真正标记）
   */
  markCookieAddedFailure(reason = 'unknown') {
    const now = Date.now();

    // 记录本次失败
    this.cookieStatus.recentFailures.push({ time: now, reason });

    // 清理5分钟之前的失败记录
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    this.cookieStatus.recentFailures = this.cookieStatus.recentFailures.filter(f => f.time > fiveMinutesAgo);

    // 统计最近5分钟内的失败次数
    const recentFailureCount = this.cookieStatus.recentFailures.length;
    this.cookieStatus.consecutiveFailures = recentFailureCount;

    console.log(`📊 [Cookie管理] 记录Cookie失败: ${reason}, 最近5分钟失败次数: ${recentFailureCount}`);

    // 【优化】只有在满足以下条件之一时才真正标记为过期：
    // 1. 最近5分钟内连续失败 >= 3次（防止单次误判）
    // 2. 或者距离上次标记已过冷却期（60秒）
    const cooldownPassed = !this.cookieStatus.lastExpireMarkTime ||
                           (now - this.cookieStatus.lastExpireMarkTime) > this.cookieStatus.expireMarkCooldown;

    if (recentFailureCount >= 3 || (recentFailureCount >= 1 && cooldownPassed && !this.cookieStatus.isValid)) {
      // 真正标记为过期
      if (!this.cookieStatus.isValid) {
        console.log('⚠️ Cookie已经处于过期状态，跳过重复标记');
        return false;
      }

      console.log('🚨 [Cookie管理] Cookie失效次数达到阈值，标记为过期状态');
      console.log(`📋 [Cookie管理] 失败次数: ${recentFailureCount}, 过期时间: ${new Date().toLocaleString('zh-CN')}`);

      this.cookieStatus.isValid = false;
      this.cookieStatus.expiredAt = new Date();
      this.cookieStatus.lastCheckTime = now;
      this.cookieStatus.lastExpireMarkTime = now;

      // 清空队列，避免重复处理
      const pausedCount = this.reviewQueue.length;
      this.reviewQueue = [];
      console.log(`📊 [Cookie管理] 已暂停 ${pausedCount} 个待审核任务`);

      return true; // 返回true表示真正标记为过期了
    } else {
      // 失败次数不足，暂时不标记为过期
      console.log(`⏳ [Cookie管理] Cookie失效次数不足 (${recentFailureCount}/3)，暂不标记为过期`);
      return false; // 返回false表示未真正标记
    }
  }

  /**
   * 标记Cookie为过期状态（简化版本 - 兼容旧代码）
   * @deprecated 请使用 markCookieAddedFailure(reason) 代替
   */
  markCookieExpired() {
    return this.markCookieAddedFailure('direct_mark_expired');
  }

  /**
   * 重新激活Cookie状态（优化版本）
   * 当Cookie更新后调用，恢复AI审核
   */
  reactivateCookie() {
    if (this.cookieStatus.isValid) {
      console.log('✅ Cookie已经是有效状态，无需重新激活');
      return;
    }

    console.log('✅ [Cookie管理] Cookie已更新，重新激活AI审核');
    console.log('📋 [Cookie管理] 激活时间:', new Date().toLocaleString('zh-CN'));
    console.log('▶️ [Cookie管理] 开始恢复待审核任务处理');

    // 重置所有状态
    this.cookieStatus.isValid = true;
    this.cookieStatus.lastCheckTime = new Date();
    this.cookieStatus.expiredAt = null;
    this.cookieStatus.recentFailures = []; // 清空失败记录
    this.cookieStatus.consecutiveFailures = 0; // 重置连续失败计数

    // 重新加载pending任务到队列
    this.loadPendingReviews();
  }

  /**
   * 清空Cookie失败记录（用于Cookie更新后调用）
   * 主动清除失败计数，让系统重新开始计数
   */
  clearCookieFailures() {
    const clearedCount = this.cookieStatus.recentFailures.length;
    this.cookieStatus.recentFailures = [];
    this.cookieStatus.consecutiveFailures = 0;
    console.log(`🧹 [Cookie管理] 已清空 ${clearedCount} 条Cookie失败记录`);
  }

  /**
   * 获取Cookie状态
   */
  getCookieStatus() {
    return {
      ...this.cookieStatus,
      queuePaused: !this.cookieStatus.isValid,
      pendingTasks: this.reviewQueue.length
    };
  }

  /**
   * 提取小红书页面内容（用于AI审核）
   * @param {string} noteUrl - 笔记链接
   * @returns {Promise<Object>} 页面标题和内容
   */
  async extractPageContent(noteUrl) {
    try {
      console.log('📄 开始提取页面内容...', noteUrl);

      // 使用 xiaohongshuService 获取页面内容
      const axios = require('axios');
      const cheerio = require('cheerio');

      // 获取Cookie（SimpleCookiePool 导出的是实例，不是类，不能用 new）
      const simpleCookiePool = require('./SimpleCookiePool');
      const cookieString = simpleCookiePool.getCookieString() || process.env.XIAOHONGSHU_COOKIE || '';

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      };

      if (cookieString) {
        headers['Cookie'] = cookieString;
      }

      const response = await axios.get(noteUrl, {
        headers,
        timeout: 15000,
        maxRedirects: 5
      }).catch(err => {
        // 如果请求失败，尝试不使用Cookie
        console.log('⚠️ 使用Cookie请求失败，尝试不使用Cookie...');
        delete headers['Cookie'];
        return axios.get(noteUrl, {
          headers,
          timeout: 15000,
          maxRedirects: 5
        });
      });

      const $ = cheerio.load(response.data);

      // 提取标题
      let title = '';
      const ogTitle = $('meta[property="og:title"]').attr('content');
      if (ogTitle) {
        title = ogTitle;
      } else {
        title = $('title').text() || '';
      }

      // 提取正文内容（使用多个选择器尝试）
      let content = '';
      let source = '';

      // 尝试多个选择器，按优先级排序
      const selectors = [
        '.note-text',           // 原始选择器
        '.desc',                // 备用选择器1
        '.content',             // 备用选择器2
        '[class*="note"]',      // 包含note的class
        '[class*="content"]',   // 包含content的class
        'article',              // article标签
        '.rich-text'            // 富文本选择器
      ];

      for (const selector of selectors) {
        const text = $(selector).first().text();
        if (text && text.length > 20) {  // 至少20个字符才认为有效
          content = text;
          source = selector;
          break;
        }
      }

      // 如果所有选择器都失败，使用meta描述
      if (!content) {
        const metaDesc = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content') || '';
        if (metaDesc && metaDesc.length > 10) {
          content = metaDesc;
          source = 'meta';
        }
      }

      // 限制内容长度
      if (content && content.length > 2000) {
        content = content.substring(0, 2000);
      }

      console.log(`📄 提取完成 - 标题: ${title?.substring(0, 50)}...}, 内容来源: ${source || '(无)'}, 内容长度: ${content?.length || 0}`);

      return { title: title || '', content: content || '' };
    } catch (error) {
      console.error('❌ 提取页面内容出错:', error.message);
      return { title: '', content: '' };
    }
  }

  /**
   * 进行关键词检查（必须通过）
   * @param {string} title - 页面标题
   * @param {string} content - 页面内容
   * @returns {Promise<Object>} 检查结果
   */
  async performKeywordCheck(title, content) {
    try {
      console.log('🔑 开始关键词检查...');

      // 检查内容是否为空
      if ((!title || title.trim() === '') && (!content || content.trim() === '')) {
        console.log('⚠️ 页面内容为空，无法进行关键词检查');
        return { passed: false, reason: '页面内容为空', score: 0 };
      }

      const cheerio = require('cheerio');
      // 构建模拟HTML用于关键词检查
      const html = `<title>${title}</title><meta name="description" content="${content.substring(0, 200)}"><body>${content}</body>`;
      const $ = cheerio.load(html);

      // 调用关键词检查（xiaohongshuService 是已导入的实例，不是类）
      const result = await xiaohongshuService.checkContentKeywords($, title);

      console.log(`🔑 关键词检查结果: ${result.passed ? '✅ 找到维权关键词' : '❌ 未找到维权关键词'}, 分数: ${result.score}`);

      return result;
    } catch (error) {
      console.error('❌ 关键词检查出错:', error);
      // 出错时拒绝（页面无法访问或解析失败）
      return { passed: false, reason: '关键词检查异常: ' + error.message, score: 0 };
    }
  }

  /**
   * 负面关键词检查 - 过滤教程类非维权内容
   * @param {string} title - 页面标题
   * @param {string} content - 页面内容
   * @returns {Object} 检查结果
   */
  performNegativeKeywordCheck(title, content) {
    // 教程类内容的特征关键词
    const tutorialKeywords = [
      // 教程类标题特征
      '保姆级流程', '手把手教你', '零基础入门', '从零开始', '新手必看',
      '一看就会', '超级详细', '超简单', '超详细', '超全', '超完整',
      '步骤详解', '操作指南', '实操教程', '实战教程', '入门教程',
      // 办事流程类
      '营业执照', '注册公司', '公司注册', '办理流程', '办理指南',
      '备案流程', '申请流程', '资质办理', '许可证办理',
      // 知识科普类
      '什么是', '如何选择', '怎么选择', '注意事项', '科普',
      '知识分享', '干货分享', '知识点', '小知识',
      // 产品介绍类（非维权）
      '产品功能', '产品优势', '产品介绍', '产品特点',
      // 正常商业推广
      '官方', '旗舰店', '正品', '官方正品', '官方旗舰店',
      // 中性经验分享（非维权）
      '经验之谈', '个人经验', '分享一下', '分享经验'
    ];

    // 教程类内容的组合特征（更强信号）
    const tutorialPatterns = [
      /流程.*指南|指南.*流程/,
      /如何.*办理|怎么.*办理/,
      /.*教程|新手.*教程|入门.*教程/,
      /.*步骤|操作.*步骤/,
      /.*备案|.*注册.*公司/,
      /保姆级|手把手|零基础|从零开始/
    ];

    const fullText = `${title || ''} ${content || ''}`.toLowerCase();

    // 检查单个关键词（需要多个才判断为教程）
    let tutorialKeywordCount = 0;
    const matchedKeywords = [];

    for (const keyword of tutorialKeywords) {
      if (fullText.includes(keyword.toLowerCase())) {
        tutorialKeywordCount++;
        matchedKeywords.push(keyword);
      }
    }

    // 检查组合模式（任一模式匹配即为教程内容）
    for (const pattern of tutorialPatterns) {
      if (pattern.test(fullText)) {
        return {
          isTutorialContent: true,
          reason: `检测到教程类内容模式: "${pattern.source}"`,
          matchedPattern: pattern.source,
          matchedKeywords: matchedKeywords
        };
      }
    }

    // 如果匹配到3个或以上教程关键词，也判断为教程内容
    if (tutorialKeywordCount >= 3) {
      return {
        isTutorialContent: true,
        reason: `检测到多个教程类关键词: ${matchedKeywords.slice(0, 3).join('、')}`,
        matchedKeywords: matchedKeywords,
        matchCount: tutorialKeywordCount
      };
    }

    return {
      isTutorialContent: false,
      matchedKeywords: matchedKeywords,
      matchCount: tutorialKeywordCount
    };
  }

  /**
   * 进行AI文意审核（可选，失败跳过）
   * @param {string} content - 页面内容
   * @returns {Promise<Object>} 审核结果
   */
  async performAiContentAnalysis(content) {
    try {
      console.log('🤖 开始AI文意审核...');

      // 设置15秒超时
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ skip: true, reason: 'AI审核超时，跳过' }), 15000);
      });

      // 竞速：AI审核 vs 超时
      const result = await Promise.race([
        this.aiContentAnalysisService.analyzeVictimPost(content, '维权内容'),
        timeoutPromise
      ]);

      if (result.skip) {
        console.log('⏱️ AI审核跳过:', result.reason);
      } else {
        console.log(`🤖 AI审核结果: ${result.is_genuine_victim_post ? '✅ 通过' : '❌ 不通过'}, 置信度: ${result.confidence_score}`);
      }

      return result;
    } catch (error) {
      console.log('⚠️ AI审核失败，跳过:', error.message);
      return { skip: true, reason: 'AI审核异常: ' + error.message };
    }
  }
}

module.exports = new AsyncAiReviewService();