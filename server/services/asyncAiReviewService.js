// 异步AI审核服务
const ImageReview = require('../models/ImageReview');
const TaskConfig = require('../models/TaskConfig');
const Device = require('../models/Device');
const CommentLimit = require('../models/CommentLimit');
const xiaohongshuService = require('./xiaohongshuService');
const deviceNoteService = require('./deviceNoteService');

class AsyncAiReviewService {
  constructor() {
    this.isRunning = false;
    this.reviewQueue = [];
    this.maxConcurrentReviews = 5; // 增加最大并发审核数到5，提高效率
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
        return; // 不更新记录，等待重试
      }

      // 根据审核结果更新记录
      await this.updateReviewWithAiResult(review, aiReviewResult);

      console.log(`✅ 异步AI审核完成: ${reviewId}, 结果: ${aiReviewResult.aiReview.passed ? '通过' : '拒绝'}`);

    } catch (error) {
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
      try {
        const failedReview = await ImageReview.findById(reviewId);
        if (failedReview && failedReview.reviewAttempt >= 2 && failedReview.status === 'pending') {
          console.log(`🔧 检测到第二次审核处理异常，强制更新状态为拒绝: ${reviewId}`);
          await ImageReview.findByIdAndUpdate(reviewId, {
            status: 'rejected',
            rejectionReason: `审核系统异常：第二次审核处理失败，错误类型：${classifiedError.type}，错误信息：${classifiedError.message}`,
            auditHistory: (failedReview.auditHistory || []).concat([{
              operator: null,
              operatorName: '系统',
              action: 'system_error_rejected',
              comment: `审核系统异常：第二次审核过程中发生${classifiedError.type}错误，可能是${classifiedError.retryable ? '临时' : '永久'}故障。错误详情：${classifiedError.message}`,
              timestamp: new Date()
            }])
          });
        }
      } catch (updateError) {
        console.error(`❌ 强制更新审核状态失败 ${reviewId}:`, updateError);
        // 记录更新失败的错误
        this.classifyError(updateError, { action: 'status_update', reviewId });
      }
    }
  }

  /**
   * 执行完整的AI审核
   */
  async performFullAiReview(review) {
    const { imageType, noteUrl, userNoteInfo } = review;

    try {
      console.log(`🔍 执行完整AI审核: ${imageType} - ${noteUrl}`);

      // 首先验证链接有效性
      const linkValidation = await xiaohongshuService.validateNoteUrl(noteUrl);
      if (!linkValidation.valid) {
        return {
          valid: false,
          aiReview: {
            passed: false,
            confidence: 0.1,
            reasons: [`链接验证失败：${linkValidation.reason}`],
            riskLevel: 'high'
          }
        };
      }

      let aiReviewResult = {
        valid: true,
        noteId: linkValidation.noteId,
        noteStatus: linkValidation.noteStatus,
        aiReview: {
          passed: true,
          confidence: 0.8,
          reasons: ['链接验证通过'],
          riskLevel: 'low'
        }
      };

      // 根据类型执行不同的审核逻辑
      if (imageType === 'note' && userNoteInfo) {
        // 获取审核尝试次数，默认为1
        const reviewAttempt = review.reviewAttempt || 1;

        console.log(`🤖 笔记审核 - 尝试次数: ${reviewAttempt}`);

        // 【修改】计算从任务提交开始的延迟时间（统一使用北京时间）
        const now = new Date();
        const beijingOffset = 8 * 60 * 60 * 1000;
        const nowBeijing = new Date(now.getTime() + beijingOffset);
        const timeSinceSubmission = nowBeijing.getTime() - review.createdAt.getTime();
        const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

        console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
        console.log(`⏱️ 当前北京时间: ${nowBeijing.toISOString()}`);
        console.log(`⏱️ 当前时间距离提交: ${timeSinceSubmissionSeconds}秒`);

        // 根据尝试次数设置延迟时间（从任务提交时间算起）
        if (reviewAttempt === 1) {
          if (timeSinceSubmissionSeconds < 1) {
            const remainingTime = (1 - timeSinceSubmissionSeconds) * 1000;
            console.log(`⏳ 笔记第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          } else {
            console.log(`✅ 笔记第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
          }
        } else if (reviewAttempt === 2) {
          // 第二次审核从任务提交开始计时，等待2秒
          if (timeSinceSubmissionSeconds < 2) {
            const remainingTime = (2 - timeSinceSubmissionSeconds) * 1000;
            console.log(`⏳ 笔记第二次审核，从任务提交开始计时，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          } else {
            console.log(`✅ 笔记第二次审核，从任务提交开始计时，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
          }
        }

        // 笔记类型：解析内容并比对
        console.log(`🔍 笔记审核 - 解析内容: ${noteUrl}`);
        const contentResult = await xiaohongshuService.parseNoteContent(noteUrl);
        console.log(`📊 内容解析结果: success=${contentResult.success}, author=${contentResult.author}, title=${contentResult.title?.substring(0,50)}...`);

        if (contentResult.success && (contentResult.author || contentResult.title)) {
          // 【新增】关键词检查 - 在任何其他审核之前进行
          console.log(`🔍 关键词检查: keywordCheck=${!!contentResult.keywordCheck}, passed=${contentResult.keywordCheck?.passed}, attempt=${reviewAttempt}`);
          if (!contentResult.keywordCheck || !contentResult.keywordCheck.passed) {
            console.log(`❌ 关键词检查失败 (attempt=${reviewAttempt}):`, contentResult.keywordCheck?.reason);

            const retryDecision = this.shouldRetryReview(review, 'keyword_check_failed');
            if (retryDecision.shouldRetry && reviewAttempt < 2) {
              // 关键词检查失败，且未达到最大重试次数，标记为需要重试
              console.log(`📋 ${retryDecision.reason}，准备第${review.reviewAttempt + 1}次审核`);
              await ImageReview.findByIdAndUpdate(review._id, {
                reviewAttempt: (review.reviewAttempt || 1) + 1,
                status: 'pending'
              });
              // 返回重试标记，让processReview知道需要重新加入队列
              return { needsRetry: true };
            } else {
              // 不适合重试或已达到最大重试次数，最终驳回
              console.log(`❌ ${retryDecision.reason}，最终驳回 (不再检查其他项)`);
              aiReviewResult.aiReview.passed = false;
              aiReviewResult.aiReview.confidence = 0.1;
              aiReviewResult.aiReview.reasons.push('帖子内容和工作要求匹配度过低');
              aiReviewResult.aiReview.riskLevel = 'high';
              console.log(`📋 关键词检查失败，已设置passed=false, confidence=0.1`);
            }
          } else {
            // 关键词检查通过，继续其他审核逻辑
            console.log(`✅ 关键词检查通过 (attempt=${reviewAttempt}):`, contentResult.keywordCheck.message);
            console.log(`🔄 关键词检查通过，开始检查下一项：内容匹配`);

            // 记录关键词检查结果
            aiReviewResult.keywordCheck = contentResult.keywordCheck;

            // 进行内容比对
            let userAuthor = userNoteInfo.author || '';
            let pageAuthor = contentResult.author || '';

            // 清理双方作者名字中的"关注"字样（更全面的清理）
            const cleanAuthorName = (name) => {
              if (!name) return '';
              // 移除常见的关注相关后缀
              return name.replace(/\s*关注\s*$/, '').trim();
            };

            userAuthor = cleanAuthorName(userAuthor);
            pageAuthor = cleanAuthorName(pageAuthor);

            const authorMatch = this.compareStrings(userAuthor, pageAuthor);
            const titleMatch = this.compareStrings(
              userNoteInfo.title || '',
              contentResult.title || ''
            );

            aiReviewResult.contentMatch = {
              authorMatch,
              titleMatch,
              pageAuthor: contentResult.author,
              pageTitle: contentResult.title
            };

            // 审核逻辑
            if (!contentResult.author && !contentResult.title) {
              aiReviewResult.aiReview.passed = false;
              aiReviewResult.aiReview.confidence = 0.1;
              aiReviewResult.aiReview.reasons.push('无法解析笔记内容，疑似无效链接');
              aiReviewResult.aiReview.riskLevel = 'high';
            } else if ((contentResult.author && authorMatch < 30) || (contentResult.title && titleMatch < 30)) {
              aiReviewResult.aiReview.passed = false;
              aiReviewResult.aiReview.confidence = 0.2;

              // 更具体的拒绝原因
              if (contentResult.author && authorMatch < 30 && contentResult.title && titleMatch < 30) {
                aiReviewResult.aiReview.reasons.push('笔记作者和标题与提交信息匹配度均过低，疑似虚假提交');
              } else if (contentResult.author && authorMatch < 30) {
                aiReviewResult.aiReview.reasons.push('笔记作者与提交信息匹配度过低，疑似虚假提交');
              } else if (contentResult.title && titleMatch < 30) {
                aiReviewResult.aiReview.reasons.push('笔记标题与提交信息匹配度过低，疑似虚假提交');
              }

              aiReviewResult.aiReview.riskLevel = 'high';
            } else if (authorMatch >= 80 && titleMatch >= 80) {
              aiReviewResult.aiReview.confidence += 0.3;
              aiReviewResult.aiReview.reasons.push('内容匹配度很高，信息一致');
            }
          }
        } else {
          aiReviewResult.aiReview.passed = false;
          aiReviewResult.aiReview.confidence = 0.1;
          aiReviewResult.aiReview.reasons.push('无法验证笔记内容，疑似无效链接');
          aiReviewResult.aiReview.riskLevel = 'high';
        }

      } else if (imageType === 'comment' && userNoteInfo) {
        // 获取审核尝试次数，默认为1
        const reviewAttempt = review.reviewAttempt || 1;

        console.log(`🤖 评论审核 - 尝试次数: ${reviewAttempt}`);

        // 【修改】计算从任务提交开始的延迟时间（统一使用北京时间）
        const now = new Date();
        const beijingOffset = 8 * 60 * 60 * 1000;
        const nowBeijing = new Date(now.getTime() + beijingOffset);
        const timeSinceSubmission = nowBeijing.getTime() - review.createdAt.getTime();
        const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

        console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
        console.log(`⏱️ 当前北京时间: ${nowBeijing.toISOString()}`);
        console.log(`⏱️ 当前时间距离提交: ${timeSinceSubmissionSeconds}秒`);

        // 根据尝试次数设置延迟时间（从任务提交时间算起）
        if (reviewAttempt === 1) {
          if (timeSinceSubmissionSeconds < 1) {
            const remainingTime = (1 - timeSinceSubmissionSeconds) * 1000;
            console.log(`⏳ 评论第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          } else {
            console.log(`✅ 评论第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
          }
        } else if (reviewAttempt === 2) {
          // 第二次审核从一开始就计时，等待150秒
          if (timeSinceSubmissionSeconds < 2) {
            const remainingTime = (2 - timeSinceSubmissionSeconds) * 1000;
            console.log(`⏳ 评论第二次审核，从任务提交开始计时，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
            await new Promise(resolve => setTimeout(resolve, remainingTime));
          } else {
            console.log(`✅ 评论第二次审核，从任务提交开始计时，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
          }
        }

        // 评论类型：验证评论真实性

        // 【新增】首先进行关键词检查 - 在评论审核前进行
        console.log(`🔍 评论审核 - 解析内容并检查关键词: ${noteUrl}`);
        const contentResult = await xiaohongshuService.parseNoteContent(noteUrl);
        console.log(`📊 评论审核内容解析结果: success=${contentResult.success}, author=${contentResult.author}, title=${contentResult.title?.substring(0,50)}...`);

        if (contentResult.success && (contentResult.author || contentResult.title)) {
          // 【新增】关键词检查 - 在任何其他审核之前进行
          console.log(`🔍 评论审核关键词检查: keywordCheck=${!!contentResult.keywordCheck}, passed=${contentResult.keywordCheck?.passed}, attempt=${reviewAttempt}`);
          if (!contentResult.keywordCheck || !contentResult.keywordCheck.passed) {
            console.log(`❌ 评论审核关键词检查失败 (attempt=${reviewAttempt}):`, contentResult.keywordCheck?.reason);

            const retryDecision = this.shouldRetryReview(review, 'keyword_check_failed');
            if (retryDecision.shouldRetry && reviewAttempt < 2) {
              // 关键词检查失败，标记为需要重试
              console.log(`📋 ${retryDecision.reason}，准备第${review.reviewAttempt + 1}次审核`);
              await ImageReview.findByIdAndUpdate(review._id, {
                reviewAttempt: (review.reviewAttempt || 1) + 1,
                status: 'pending'
              });
              // 返回重试标记，让processReview知道需要重新加入队列
              return { needsRetry: true };
            } else {
              // 不适合重试或已达到最大重试次数，最终驳回
              console.log(`❌ ${retryDecision.reason}，最终驳回 (不再检查其他项)`);
              aiReviewResult.aiReview.passed = false;
              aiReviewResult.aiReview.confidence = 0.1;
              aiReviewResult.aiReview.reasons.push('帖子内容和工作要求匹配度过低');
              aiReviewResult.aiReview.riskLevel = 'high';
              console.log(`📋 关键词检查失败，已设置passed=false, confidence=0.1`);
            }
          } else {
            // 关键词检查通过，继续其他审核逻辑
            console.log(`✅ 评论审核关键词检查通过 (attempt=${reviewAttempt}):`, contentResult.keywordCheck.message);
            console.log(`🔄 评论审核关键词检查通过，开始检查下一项：评论验证`);

            // 记录关键词检查结果
            aiReviewResult.keywordCheck = contentResult.keywordCheck;
          }
        }

        const userDevices = await Device.find({
          assignedUser: review.userId._id,
          is_deleted: { $ne: true },
          reviewStatus: { $in: ['ai_approved', 'approved'] } // 只使用审核通过的设备昵称
        }).select('accountName');

        const deviceNicknames = userDevices.map(device => device.accountName).filter(name => name && name.trim());

        const cookieString = process.env.XIAOHONGSHU_COOKIE;

        const commentVerification = await xiaohongshuService.performCommentAIReview(
          noteUrl,
          userNoteInfo.comment || '',
          deviceNicknames.length > 0 ? deviceNicknames : null,
          cookieString
        );

        console.log(`🔍 评论验证结果 (attempt=${reviewAttempt}): error=${!!commentVerification.error}, passed=${commentVerification.passed}, reasons=${commentVerification.reasons?.join(', ')}`);

        if (commentVerification.error) {
          console.log(`❌ 评论验证出错 (attempt=${reviewAttempt}): ${commentVerification.error}`);
          const retryDecision = this.shouldRetryReview(review, 'comment_verification_error');
          if (retryDecision.shouldRetry && reviewAttempt < 2) {
            // 评论验证出错，且未达到最大重试次数，标记为需要重试
            console.log(`📋 ${retryDecision.reason}，准备第${review.reviewAttempt + 1}次审核`);
            await ImageReview.findByIdAndUpdate(review._id, {
              reviewAttempt: (review.reviewAttempt || 1) + 1,
              status: 'pending'
            });
            // 返回重试标记，让processReview知道需要重新加入队列
            return { needsRetry: true };
          } else {
            // 不适合重试或已达到最大重试次数，最终驳回
            console.log(`❌ ${retryDecision.reason}，最终驳回`);
            aiReviewResult.aiReview.passed = false;
            aiReviewResult.aiReview.confidence = 0.1;
            aiReviewResult.aiReview.reasons.push('评论验证过程出错，无法检测评论');
            aiReviewResult.aiReview.riskLevel = 'high';
          }
        } else if (commentVerification.passed) {
          console.log(`✅ 评论验证通过 (attempt=${reviewAttempt})`);
          aiReviewResult.aiReview.confidence += 0.2;
          aiReviewResult.aiReview.reasons.push('评论验证通过，确认真实存在且内容完全一致');
        } else {
          console.log(`❌ 评论验证失败但无错误 (attempt=${reviewAttempt}): ${commentVerification.reasons?.join(', ')}`);
          const retryDecision = this.shouldRetryReview(review, 'comment_not_found');
          if (retryDecision.shouldRetry && reviewAttempt < 2) {
            // 评论不存在，且未达到最大重试次数，标记为需要重试
            console.log(`📋 ${retryDecision.reason}，准备第${review.reviewAttempt + 1}次审核`);
            await ImageReview.findByIdAndUpdate(review._id, {
              reviewAttempt: (review.reviewAttempt || 1) + 1,
              status: 'pending'
            });
            // 返回重试标记，让processReview知道需要重新加入队列
            return { needsRetry: true };
          } else {
            // 不适合重试或已达到最大重试次数，最终驳回
            console.log(`❌ ${retryDecision.reason}，最终驳回`);
            aiReviewResult.aiReview.passed = false;
            aiReviewResult.aiReview.confidence = 0.1;
            // 使用与第一次审核相同的原因描述
            if (commentVerification.reason) {
              aiReviewResult.aiReview.reasons.push(commentVerification.reason);
            } else {
              aiReviewResult.aiReview.reasons.push('当前帖子评论区无法检测到你的评论（请用其他号观察）');
            }
            aiReviewResult.aiReview.riskLevel = 'high';
          }
        }

        aiReviewResult.commentVerification = commentVerification;
      }

      return aiReviewResult;

    } catch (error) {
      const classifiedError = this.classifyError(error, {
        service: 'xiaohongshu',
        action: 'full_ai_review',
        imageType,
        noteUrl
      });

      console.error(`❌ AI审核执行失败 [${classifiedError.type}]:`, classifiedError.message);

      return {
        valid: false,
        aiReview: {
          passed: false,
          confidence: 0,
          reasons: [`AI审核过程出错: ${classifiedError.message}`],
          riskLevel: 'high',
          error: classifiedError.message,
          errorType: classifiedError.type,
          errorSeverity: classifiedError.severity,
          retryable: classifiedError.retryable
        }
      };
    }
  }

  /**
   * 根据AI审核结果更新审核记录
   */
  async updateReviewWithAiResult(review, aiReviewResult) {
    const updateData = {};

    // 保存AI审核结果
    updateData.aiReviewResult = aiReviewResult.aiReview;
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
      updateData.aiReviewResult.commentVerification = aiReviewResult.commentVerification;

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
        updateData.status = 'manager_approved';
        updateData.auditHistory = review.auditHistory || [];
        updateData.auditHistory.push({
          operator: null,
          operatorName: 'AI审核系统',
          action: 'ai_auto_approved',
          comment: `AI自动审核通过 (信心度: ${(aiReviewResult.aiReview.confidence * 100).toFixed(1)}%)，奖励${approvalResult.pointsReward}积分，等待财务确认`,
          timestamp: new Date()
        });

        // 如果是笔记类型，启用持续检查
        if (review.imageType === 'note') {
          const firstCheckTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
          updateData.continuousCheck = {
            enabled: true,
            status: 'active',
            nextCheckTime: firstCheckTime
          };
        }
        console.log(`✅ 审核通过，状态设置为manager_approved`);
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
      updateData.rejectionReason = aiReviewResult.aiReview.reasons.join('; ');
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

    // 如果审核通过且是评论类型，记录评论限制信息
    if (updateData.status === 'manager_approved' && review.imageType === 'comment') {
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
        await deviceNoteService.recordDeviceNoteSubmission(
          review.deviceInfo?.accountName || 'unknown',
          review.userId._id,
          review.noteUrl,
          review.userNoteInfo?.title || '',
          review.userNoteInfo?.author || '',
          review._id
        );
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

      // 检查昵称7天使用限制
      let matchedAuthor = aiReviewResult.contentMatch?.pageAuthor;

      // 如果AI未能解析到昵称，尝试使用用户提交的昵称
      if (!matchedAuthor || !matchedAuthor.trim()) {
        if (userNoteInfo?.author) {
          matchedAuthor = Array.isArray(userNoteInfo.author) ? userNoteInfo.author[0] : userNoteInfo.author;
          console.log(`⚠️ AI未能解析页面昵称，使用用户提交的昵称进行7天检查: "${matchedAuthor}"`);
        } else {
          console.log(`⚠️ 既无AI解析昵称也无用户提交昵称，跳过7天昵称检查`);
        }
      }

      if (matchedAuthor && matchedAuthor.trim()) {
        // 清理昵称格式（与保存时保持一致）
        const cleanAuthorName = (name) => {
          if (!name) return '';
          // 移除常见的关注相关后缀
          return name.replace(/\s*关注\s*$/, '').trim();
        };

        const cleanedAuthor = cleanAuthorName(matchedAuthor.trim());

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        console.log(`🔍 检查昵称 "${cleanedAuthor}" 的7天使用限制，用户: ${userId._id}, 时间范围: ${sevenDaysAgo.toISOString()} ~ ${new Date().toISOString()}`);

        const recentReview = await ImageReview.findOne({
          'aiParsedNoteInfo.author': cleanedAuthor,
          userId: userId._id,
          status: { $in: ['manager_approved', 'completed'] },
          createdAt: { $gte: sevenDaysAgo }
        });

        if (recentReview) {
          console.log(`🛡️ 7天昵称限制触发: 昵称"${cleanedAuthor}"在7天内已被使用，上次使用时间: ${recentReview.createdAt.toISOString()}`);
          return {
            approved: false,
            reason: `风控提示：昵称"${cleanedAuthor}"在7天内已被使用，无法重复提交审核`
          };
        } else {
          console.log(`✅ 7天昵称检查通过: 昵称"${cleanedAuthor}"在7天内未被使用`);
        }
      } else {
        console.log(`⚠️ 无有效昵称信息，跳过7天昵称检查`);
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
      const taskConfig = await TaskConfig.findOne({ type_key: imageType, is_active: true });
      const pointsReward = taskConfig ? Math.floor(taskConfig.price) : 0;

      if (pointsReward > 0) {
        const User = require('../models/User');
        await User.findByIdAndUpdate(userId._id, {
          $inc: { points: pointsReward }
        });
      }

      return {
        approved: true,
        pointsReward
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
    const maxAttempts = 2; // 最大重试次数

    // 如果已经达到最大重试次数，不再重试
    if (currentAttempt >= maxAttempts) {
      return {
        shouldRetry: false,
        reason: `已达到最大重试次数(${maxAttempts})`
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
      }
    };
  }
}

module.exports = new AsyncAiReviewService();