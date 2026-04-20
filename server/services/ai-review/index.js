/**
 * AI审核服务 - 主入口
 *
 * 将原有的 asyncAiReviewService.js 拆分为多个模块：
 * - utils.js: 工具函数（字符串比较、错误分类等）
 * - content-extractor.js: 内容提取（页面内容、关键词检查等）
 * - commission.js: 佣金处理（积分发放、推荐佣金等）
 * - client-verification.js: 客户端验证（验证流程处理）
 *
 * 主服务类负责：
 * - 队列管理
 * - Cookie状态管理
 * - 审核流程协调
 */

const ImageReview = require('../../models/ImageReview');
const TaskConfig = require('../../models/TaskConfig');
const Device = require('../../models/Device');
const CommentLimit = require('../../models/CommentLimit');
const xiaohongshuService = require('../xiaohongshuService');
const deviceNoteService = require('../deviceNoteService');
const aiContentAnalysisService = require('../aiContentAnalysisService');

// 导入子模块
const utils = require('./utils');
const contentExtractor = require('./content-extractor');
const commission = require('./commission');
const clientVerification = require('./client-verification');

class AsyncAiReviewService {
  constructor() {
    // 队列状态
    this.isRunning = false;
    this.reviewQueue = [];
    this.maxConcurrentReviews = 15;
    this.activeReviews = 0;
    this.isLoadedPendingReviews = false;

    // 统计状态
    this.reviewStats = utils.createDefaultReviewStats();

    // 错误恢复状态
    this.errorRecovery = utils.createDefaultErrorRecoveryState();

    // Cookie状态
    this.cookieStatus = utils.createDefaultCookieStatus();

    // AI内容分析服务实例
    this.aiContentAnalysisService = aiContentAnalysisService;
  }

  // ==================== 队列管理 ====================

  /**
   * 从数据库加载所有pending状态的审核记录
   */
  async loadPendingReviews() {
    try {
      if (this.isLoadedPendingReviews) {
        console.log('⚠️ pending任务已经加载过，跳过重复加载');
        return;
      }

      console.log('🔄 开始加载pending状态的审核记录...');

      // 清空现有队列
      this.reviewQueue = [];
      this.activeReviews = 0;
      console.log('🧹 已清空审核队列，准备重新加载pending任务');

      // 查询所有pending状态的审核记录
      const pendingReviews = await ImageReview.find({
        status: { $in: ['pending', 'client_verification_pending'] },
        imageType: { $in: ['note', 'comment'] }
      }).select('_id createdAt imageType noteUrl status');

      console.log(`📊 找到 ${pendingReviews.length} 条pending状态的审核记录`);

      // 恢复客户端验证失败的任务
      const now = new Date();
      const failedReviewsToRecover = await ImageReview.find({
        status: 'client_verification_failed',
        'clientVerification.readyForSecondAttempt': true,
        'clientVerification.secondAttemptReadyAt': { $lte: now },
        imageType: { $in: ['note', 'comment'] }
      }).select('_id clientVerification reviewAttempt');

      console.log(`📊 找到 ${failedReviewsToRecover.length} 条待恢复的client_verification_failed任务`);

      // 恢复这些任务
      if (failedReviewsToRecover.length > 0) {
        const failedReviewIds = failedReviewsToRecover.map(r => r._id);
        const recoverResult = await ImageReview.updateMany(
          { _id: { $in: failedReviewIds } },
          {
            status: 'client_verification_pending',
            'clientVerification.readyForSecondAttempt': false,
            'clientVerification.attempt': 2
          }
        );
        console.log(`✅ 成功恢复 ${recoverResult.modifiedCount} 条client_verification_failed任务`);
      }

      if (pendingReviews.length === 0 && failedReviewsToRecover.length === 0) {
        console.log('✅ 没有pending状态的审核记录需要处理');
        this.isLoadedPendingReviews = true;
        return;
      }

      // 将所有pending记录的ID加入队列
      let loadedCount = 0;
      for (const review of pendingReviews) {
        if (!this.reviewQueue.includes(review._id.toString())) {
          this.reviewQueue.push(review._id.toString());
          loadedCount++;
          console.log(`📋 已将审核任务 ${review._id} (${review.imageType}) 加入队列`);
        }
      }

      console.log(`✅ 成功加载 ${loadedCount} 条pending审核记录到队列`);
      this.isLoadedPendingReviews = true;

      // 触发队列处理
      if (loadedCount > 0) {
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

        this.processReview(reviewId).finally(() => {
          this.activeReviews--;
          setTimeout(() => this.processQueue(), 1000);
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

      const review = await ImageReview.findById(reviewId).populate('userId');
      if (!review) {
        console.error(`❌ 审核记录不存在: ${reviewId}`);
        return;
      }

      // client_verification_pending 状态的任务由客户端处理
      if (review.status === 'client_verification_pending') {
        console.log(`⏳ 任务待客户端验证，跳过服务器审核: ${reviewId}`);
        return;
      }

      if (review.status !== 'pending') {
        console.log(`⚠️ 审核记录状态不是pending，跳过: ${review.status}`);
        return;
      }

      const { imageType, noteUrl, userNoteInfo } = review;

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

      if (!aiReviewResult) {
        await this.handleReviewError(review, 'system_error');
        return;
      }

      // 检查是否是重试标记
      if (aiReviewResult.needsRetry) {
        console.log(`🔄 审核需要重试: ${reviewId}`);
        if (aiReviewResult.cookieExpired) {
          console.log(`🍪 Cookie已过期，暂停审核任务: ${reviewId}`);
          return;
        }
        setTimeout(() => {
          if (!this.reviewQueue.includes(reviewId)) {
            this.reviewQueue.push(reviewId);
            console.log(`📋 重试任务已重新加入队列: ${reviewId}`);
            this.processQueue();
          }
        }, 180000);
        return;
      }

      // 检查是否标记为客户端验证
      if (aiReviewResult.markedForClient) {
        console.log(`✅ 任务已标记为客户端验证，等待客户端处理: ${reviewId}`);
        return;
      }

      // 检查是否标记为人工复审
      if (aiReviewResult.markedForReview) {
        console.log(`✅ 任务已标记为待人工复审，等待经理处理: ${reviewId}`);
        return;
      }

      // 根据审核结果更新记录
      await this.updateReviewWithAiResult(review, aiReviewResult);

      console.log(`✅ 异步AI审核完成: ${reviewId}, 结果: ${aiReviewResult.aiReview?.passed ? '通过' : '拒绝'}`);

    } catch (error) {
      // 重新查询review对象
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

      await this.handleReviewError(review, 'system_error', error);
    }
  }

  /**
   * 处理审核错误
   */
  async handleReviewError(review, failureReason, error = null) {
    const reviewId = review._id;

    // 错误分类
    const classifiedError = error ? utils.classifyError(error, {
      reviewId,
      imageType: review.imageType,
      attempt: review.reviewAttempt || 1
    }) : { type: failureReason, message: failureReason };

    console.error(`❌ 异步AI审核处理失败 ${reviewId} [${classifiedError.type}]:`, classifiedError.message);

    // 错误恢复处理
    const shouldContinue = this.handleErrorRecovery(classifiedError);
    if (!shouldContinue) {
      console.log(`🛑 错误恢复机制激活，跳过审核任务 ${reviewId}`);
      return;
    }

    // 智能重试决策
    const retryDecision = utils.shouldRetryReview(review, failureReason);
    if (retryDecision.shouldRetry) {
      console.log(`🔄 ${retryDecision.reason}，重新加入队列进行第${review.reviewAttempt + 1}次审核: ${reviewId}`);
      await ImageReview.findByIdAndUpdate(reviewId, {
        reviewAttempt: (review.reviewAttempt || 1) + 1,
        status: 'pending'
      });
      this.addToQueue(reviewId);
    } else {
      console.log(`❌ ${retryDecision.reason}，强制更新状态为rejected: ${reviewId}`);

      let specificReason = '审核过程中出现系统异常，审核未能正常完成，请联系客服处理';
      if (review.noteUrl) {
        specificReason += ` (笔记链接: ${review.noteUrl})`;
      }

      await ImageReview.findByIdAndUpdate(reviewId, {
        status: 'rejected',
        rejectionReason: specificReason,
        auditHistory: (review.auditHistory || []).concat([{
          operator: null,
          operatorName: '系统',
          action: 'system_error_rejected',
          comment: '审核系统异常：AI审核服务返回异常结果',
          timestamp: new Date()
        }])
      });
    }
  }

  // ==================== 审核处理 ====================

  /**
   * 执行完整的AI审核
   */
  async performFullAiReview(review) {
    const { imageType, noteUrl, userNoteInfo } = review;
    const reviewId = review._id;

    try {
      console.log(`🔍 执行审核延迟调度: ${imageType} - ${noteUrl}`);

      const reviewAttempt = review.reviewAttempt || 1;
      await this.addAuditHistory(reviewId, review, 'review_start', 'AI审核系统',
        `开始第${reviewAttempt}次审核（${imageType === 'note' ? '笔记' : '评论'}类型）`);

      // 评论类型：直接转客户端验证
      if (imageType === 'comment') {
        console.log(`💬 评论类型，跳过服务器端审核，直接转客户端验证: ${reviewId}`);
        await this.addAuditHistory(reviewId, review, 'skip_server_audit', 'AI审核系统',
          `评论类型任务，跳过服务器端关键词检查和AI文意审核，直接转客户端验证`);
        await clientVerification.markForClientVerification(review, 1);
        return {
          valid: true,
          markedForClient: true,
          message: '评论类型，已标记为待客户端验证'
        };
      }

      // 笔记类型：直接转人工复审
      if (imageType === 'note') {
        console.log(`📝 笔记类型，跳过服务器端AI审核，直接转人工复审: ${reviewId}`);
        await this.addAuditHistory(reviewId, review, 'skip_server_audit', 'AI审核系统',
          `笔记类型任务，跳过服务器端关键词检查和AI文意审核，直接转人工复审`);

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

      console.log(`⚠️ 未知的任务类型: ${imageType}，跳过处理`);
      return null;

    } catch (error) {
      const classifiedError = utils.classifyError(error, {
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
   * 根据AI审核结果更新审核记录
   */
  async updateReviewWithAiResult(review, aiReviewResult) {
    // 1. 验证评论数据一致性
    this.validateCommentVerificationData(aiReviewResult.commentVerification, review);

    // 2. 构建基础更新数据
    const updateData = this.buildUpdateData(review, aiReviewResult);

    // 3. 确定审核状态并构建审核历史
    const { status, rejectionReason, auditHistoryItems } = await this.determineReviewStatusAndHistory(review, aiReviewResult);
    updateData.status = status;
    if (rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    // 4. 添加审核历史
    if (auditHistoryItems.length > 0) {
      updateData.$push = { auditHistory: { $each: auditHistoryItems } };
    }

    // 5. 更新数据库
    await ImageReview.findByIdAndUpdate(review._id, updateData);

    // 6. 处理推荐佣金发放
    await commission.issueReferralCommissions(review, updateData);

    // 7. 记录评论限制信息
    await this.recordCommentLimitInfo(review, updateData, aiReviewResult);

    // 8. 记录设备笔记历史
    await this.recordDeviceNoteHistory(review);
  }

  /**
   * 构建审核更新数据
   */
  buildUpdateData(review, aiReviewResult) {
    const updateData = {};

    updateData.aiReviewResult = aiReviewResult.aiReview;

    if (aiReviewResult.aiAnalysis) {
      updateData.aiAnalysis = aiReviewResult.aiAnalysis;
    }

    if (aiReviewResult.contentMatch) {
      let author = aiReviewResult.contentMatch.pageAuthor;
      if (author && author.endsWith('关注')) {
        author = author.slice(0, -2).trim();
      }
      updateData.aiParsedNoteInfo = {
        author: author,
        title: aiReviewResult.contentMatch.pageTitle
      };
    }

    if (aiReviewResult.commentVerification) {
      const cv = aiReviewResult.commentVerification;
      updateData.aiReviewResult.commentVerification = cv;

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

    return updateData;
  }

  /**
   * 验证评论数据一致性
   */
  validateCommentVerificationData(commentVerification, review) {
    if (!commentVerification) return;

    if (commentVerification.exists === true && (!commentVerification.foundComments || commentVerification.foundComments.length === 0)) {
      console.error('❌ [数据验证] 检测到不一致的评论验证数据: exists=true 但 foundComments 为空');
      console.error('   链接:', review.noteUrl);
      console.error('   评论:', review.userNoteInfo?.comment);

      commentVerification.exists = false;
      console.warn('⚠️ [数据修正] 自动将 exists 设为 false');
    }
  }

  /**
   * 确定审核状态并构建审核历史
   */
  async determineReviewStatusAndHistory(review, aiReviewResult) {
    console.log(`📋 更新审核结果: passed=${aiReviewResult.aiReview.passed}, confidence=${aiReviewResult.aiReview.confidence}`);

    const auditHistoryItems = [];
    let status = 'pending';
    let rejectionReason = null;

    if (aiReviewResult.aiReview.passed && aiReviewResult.aiReview.confidence >= 0.7) {
      console.log('✅ 审核通过条件满足，执行通过逻辑');
      const approvalResult = await this.processApproval(review, aiReviewResult);

      if (approvalResult.approved) {
        if (review.imageType === 'note') {
          status = 'ai_approved';
        } else if (review.imageType === 'comment') {
          status = 'completed';
        }

        auditHistoryItems.push({
          operator: null,
          operatorName: 'AI审核系统',
          action: 'ai_auto_approved',
          comment: `AI自动审核通过 (信心度: ${(aiReviewResult.aiReview.confidence * 100).toFixed(1)}%)`,
          timestamp: new Date()
        });

        if (review.imageType === 'comment' && approvalResult.pointsReward > 0) {
          auditHistoryItems.push({
            operator: null,
            operatorName: 'AI审核系统',
            action: 'points_reward',
            comment: `发放积分 ${approvalResult.pointsReward} (评论审核通过)`,
            timestamp: new Date()
          });
        }

        console.log(`✅ 审核通过，状态设置为${status}`);
      } else {
        status = 'manager_rejected';
        rejectionReason = approvalResult.reason;
        auditHistoryItems.push({
          operator: null,
          operatorName: 'AI审核系统',
          action: 'ai_auto_rejected',
          comment: `AI自动审核拒绝：${approvalResult.reason}`,
          timestamp: new Date()
        });
        console.log(`❌ 审核被限制条件拒绝: ${approvalResult.reason}`);
      }
    } else {
      status = 'rejected';
      rejectionReason = aiReviewResult.aiReview.reasons && aiReviewResult.aiReview.reasons.length > 0
        ? aiReviewResult.aiReview.reasons.join('；')
        : '不符合笔记要求';
      auditHistoryItems.push({
        operator: null,
        operatorName: 'AI审核系统',
        action: 'ai_auto_rejected',
        comment: `AI自动审核失败：${rejectionReason}`,
        timestamp: new Date()
      });
      console.log(`❌ 审核失败，状态设置为rejected: ${rejectionReason}`);
    }

    return { status, rejectionReason, auditHistoryItems };
  }

  /**
   * 处理审核通过的逻辑
   */
  async processApproval(review, aiReviewResult) {
    try {
      const { imageType, userId, noteUrl, userNoteInfo } = review;

      // 笔记类型检查1天昵称限制
      let matchedAuthor = (imageType === 'note') ? aiReviewResult.contentMatch?.pageAuthor : null;

      if (!matchedAuthor || !matchedAuthor.trim()) {
        if (userNoteInfo?.author) {
          matchedAuthor = Array.isArray(userNoteInfo.author) ? userNoteInfo.author[0] : userNoteInfo.author;
        }
      }

      if (imageType === 'note' && matchedAuthor && matchedAuthor.trim()) {
        const cleanAuthorName = (name) => {
          if (!name) return '';
          return name.replace(/\s*关注\s*$/, '').trim();
        };

        const cleanedAuthor = cleanAuthorName(matchedAuthor.trim());
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const recentReview = await ImageReview.findOne({
          'aiParsedNoteInfo.author': cleanedAuthor,
          userId: userId._id,
          status: { $in: ['manager_approved', 'completed'] },
          $or: [
            { 'managerApproval.approvedAt': { $gte: oneDayAgo } },
            { 'financeProcess.processedAt': { $gte: oneDayAgo } }
          ]
        });

        if (recentReview) {
          return {
            approved: false,
            reason: `风控提示：昵称"${cleanedAuthor}"在1天内已被使用`
          };
        }
      }

      // 评论类型检查昵称+链接限制
      if (imageType === 'comment') {
        let authorToCheck = aiReviewResult.commentVerification?.foundComments?.[0]?.author;
        if (!authorToCheck) {
          if (Array.isArray(userNoteInfo?.author) && userNoteInfo.author.length > 0) {
            authorToCheck = userNoteInfo.author[0];
          } else if (typeof userNoteInfo?.author === 'string' && userNoteInfo.author.trim()) {
            authorToCheck = userNoteInfo.author.trim();
          }
        }

        if (authorToCheck) {
          const approvalCheck = await CommentLimit.checkCommentApproval(
            noteUrl,
            authorToCheck,
            userNoteInfo?.comment || ''
          );

          if (!approvalCheck.canApprove) {
            return {
              approved: false,
              reason: approvalCheck.reason || '评论审核限制'
            };
          }
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

      // 发放积分
      const pointsReward = await commission.awardPointsForApproval(review, userId, imageType);

      return {
        approved: true,
        pointsReward: imageType === 'comment' ? pointsReward : 0
      };

    } catch (error) {
      console.error('处理审核通过逻辑失败:', error);
      return {
        approved: false,
        reason: '审核通过处理失败'
      };
    }
  }

  // ==================== 历史记录 ====================

  /**
   * 添加审核历史记录
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
   * 提取评论作者
   */
  extractAuthorForCommentLimit(review, updateData, aiReviewResult) {
    let authorToRecord = updateData.aiParsedNoteInfo?.author;

    if (!authorToRecord && aiReviewResult.commentVerification?.foundComments?.[0]?.author) {
      authorToRecord = aiReviewResult.commentVerification.foundComments[0].author;
    }

    if (!authorToRecord && Array.isArray(review.userNoteInfo?.author)) {
      authorToRecord = review.userNoteInfo.author[0];
    } else if (!authorToRecord && typeof review.userNoteInfo?.author === 'string' && review.userNoteInfo.author.trim()) {
      const authorStr = review.userNoteInfo.author.trim();
      if (authorStr.includes(',') || authorStr.includes('，')) {
        authorToRecord = authorStr.split(/[,，]/)[0].trim();
      } else {
        authorToRecord = authorStr;
      }
    }

    if (!authorToRecord && aiReviewResult.commentVerification?.deviceNicknames?.length > 0) {
      authorToRecord = aiReviewResult.commentVerification.deviceNicknames[0];
    }

    return authorToRecord;
  }

  /**
   * 记录评论限制信息
   */
  async recordCommentLimitInfo(review, updateData, aiReviewResult) {
    if ((updateData.status !== 'ai_approved' && updateData.status !== 'manager_approved') || review.imageType !== 'comment') {
      return;
    }

    try {
      const authorToRecord = this.extractAuthorForCommentLimit(review, updateData, aiReviewResult);

      if (authorToRecord && review.noteUrl && review.userNoteInfo?.comment) {
        await CommentLimit.recordCommentApproval(
          review.noteUrl,
          authorToRecord,
          review.userNoteInfo.comment,
          review._id
        );
        console.log(`✅ 评论限制记录成功`);
      }
    } catch (error) {
      console.error('❌ 记录评论限制信息失败:', error);
    }
  }

  /**
   * 记录设备笔记发布历史
   */
  async recordDeviceNoteHistory(review) {
    if (review.imageType !== 'note') {
      return;
    }

    try {
      if (review.userId) {
        await deviceNoteService.recordDeviceNoteSubmission(
          review.deviceInfo?.accountName || 'unknown',
          review.userId._id,
          review.noteUrl,
          review.userNoteInfo?.title || '',
          review.userNoteInfo?.author || '',
          review._id
        );
      }
    } catch (error) {
      console.error('记录设备笔记发布历史失败:', error);
    }
  }

  // ==================== 错误恢复 ====================

  /**
   * 错误恢复机制
   */
  handleErrorRecovery(classifiedError) {
    const now = Date.now();

    if (classifiedError.severity === 'critical' || classifiedError.type === 'database_error') {
      this.errorRecovery.consecutiveFailures++;
      this.errorRecovery.lastErrorTime = now;
    } else {
      this.errorRecovery.consecutiveFailures = 0;
    }

    if (this.errorRecovery.consecutiveFailures >= 5) {
      this.errorRecovery.circuitBreaker = true;
      this.errorRecovery.circuitBreakerResetTime = now + (5 * 60 * 1000);
      console.error('🚨 熔断器激活：连续5次严重错误，暂停审核服务5分钟');
      return false;
    }

    if (this.errorRecovery.circuitBreaker && now > this.errorRecovery.circuitBreakerResetTime) {
      this.errorRecovery.circuitBreaker = false;
      this.errorRecovery.consecutiveFailures = 0;
      console.log('🔄 熔断器重置：审核服务恢复正常');
    }

    if (this.errorRecovery.circuitBreaker) {
      console.warn('⚠️ 熔断器激活中，跳过审核任务');
      return false;
    }

    return true;
  }

  // ==================== 状态管理 ====================

  /**
   * 获取服务状态
   */
  getStatus() {
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

  // ==================== Cookie管理 ====================

  /**
   * 标记Cookie为过期状态
   */
  markCookieAddedFailure(reason = 'unknown') {
    const now = Date.now();

    this.cookieStatus.recentFailures.push({ time: now, reason });

    const fiveMinutesAgo = now - 5 * 60 * 1000;
    this.cookieStatus.recentFailures = this.cookieStatus.recentFailures.filter(f => f.time > fiveMinutesAgo);

    const recentFailureCount = this.cookieStatus.recentFailures.length;
    this.cookieStatus.consecutiveFailures = recentFailureCount;

    console.log(`📊 [Cookie管理] 记录Cookie失败: ${reason}, 最近5分钟失败次数: ${recentFailureCount}`);

    const cooldownPassed = !this.cookieStatus.lastExpireMarkTime ||
                           (now - this.cookieStatus.lastExpireMarkTime) > this.cookieStatus.expireMarkCooldown;

    if (recentFailureCount >= 3 || (recentFailureCount >= 1 && cooldownPassed && !this.cookieStatus.isValid)) {
      if (!this.cookieStatus.isValid) {
        console.log('⚠️ Cookie已经处于过期状态，跳过重复标记');
        return false;
      }

      console.log('🚨 [Cookie管理] Cookie失效次数达到阈值，标记为过期状态');

      this.cookieStatus.isValid = false;
      this.cookieStatus.expiredAt = new Date();
      this.cookieStatus.lastCheckTime = now;
      this.cookieStatus.lastExpireMarkTime = now;

      const pausedCount = this.reviewQueue.length;
      this.reviewQueue = [];
      console.log(`📊 [Cookie管理] 已暂停 ${pausedCount} 个待审核任务`);

      return true;
    } else {
      console.log(`⏳ [Cookie管理] Cookie失效次数不足 (${recentFailureCount}/3)，暂不标记为过期`);
      return false;
    }
  }

  /**
   * 标记Cookie为过期状态（简化版本）
   * @deprecated 请使用 markCookieAddedFailure(reason) 代替
   */
  markCookieExpired() {
    return this.markCookieAddedFailure('direct_mark_expired');
  }

  /**
   * 重新激活Cookie状态
   */
  reactivateCookie() {
    if (this.cookieStatus.isValid) {
      console.log('✅ Cookie已经是有效状态，无需重新激活');
      return;
    }

    console.log('✅ [Cookie管理] Cookie已更新，重新激活AI审核');

    this.cookieStatus.isValid = true;
    this.cookieStatus.lastCheckTime = new Date();
    this.cookieStatus.expiredAt = null;
    this.cookieStatus.recentFailures = [];
    this.cookieStatus.consecutiveFailures = 0;

    this.loadPendingReviews();
  }

  /**
   * 清空Cookie失败记录
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

  // ==================== 客户端验证委托 ====================

  /**
   * 处理客户端验证结果（委托给client-verification模块）
   */
  async handleClientVerificationResult(reviewId, verifyResult) {
    return await clientVerification.handleClientVerificationResult(reviewId, verifyResult, this);
  }

  // ==================== 内容提取委托 ====================

  /**
   * 提取页面内容（委托给content-extractor模块）
   */
  async extractPageContent(noteUrl) {
    const cookieString = process.env.XIAOHONGSHU_COOKIE || '';
    return await contentExtractor.extractPageContent(noteUrl, cookieString);
  }

  /**
   * 进行关键词检查（委托给content-extractor模块）
   */
  async performKeywordCheck(title, content) {
    return await contentExtractor.performKeywordCheck(title, content, xiaohongshuService);
  }

  /**
   * 进行AI内容分析（委托给content-extractor模块）
   */
  async performAiContentAnalysis(content) {
    return await contentExtractor.performAiContentAnalysis(content, this.aiContentAnalysisService);
  }

  /**
   * 负面关键词检查（委托给utils模块）
   */
  performNegativeKeywordCheck(title, content) {
    return utils.performNegativeKeywordCheck(title, content);
  }

  // ==================== 工具方法委托 ====================

  /**
   * 字符串相似度比对
   */
  compareStrings(str1, str2) {
    return utils.compareStrings(str1, str2);
  }

  /**
   * 智能重试决策
   */
  shouldRetryReview(review, failureReason) {
    return utils.shouldRetryReview(review, failureReason);
  }

  /**
   * 错误分类
   */
  classifyError(error, context = {}) {
    return utils.classifyError(error, context);
  }
}

// 导出单例
module.exports = new AsyncAiReviewService();
