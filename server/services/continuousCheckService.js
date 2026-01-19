// 持续检查服务：每天检查笔记存在性并奖励积分（持续7天检查周期，昵称提交限制已改为1天）
const schedule = require('node-schedule');
const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const XiaohongshuService = require('./xiaohongshuService');

class ContinuousCheckService {
  constructor() {
    this.job = null;
    this.isRunning = false;
  }

  /**
   * 启动定时任务服务
   */
  start() {
    if (this.isRunning) {
      console.log('⏰ 持续检查服务已在运行中');
      return;
    }

    // 每分钟执行一次，检查是否有到期的笔记需要检查
    const rule = new schedule.RecurrenceRule();
    rule.second = 0; // 每分钟的0秒执行
    // 不指定hour、minute等其他字段，表示每分钟执行

    console.log('⏰ 启动持续检查定时任务：每分钟检查待处理的笔记');

    this.job = schedule.scheduleJob(rule, async () => {
      await this.performPeriodicChecks();
    });

    this.isRunning = true;
    console.log('✅ 持续检查服务启动成功');
  }

  /**
   * 停止定时任务服务
   */
  stop() {
    if (this.job) {
      this.job.cancel();
      this.job = null;
      this.isRunning = false;
      console.log('🛑 持续检查服务已停止');
    }
  }

  /**
   * 执行定期检查 - 每分钟检查是否有到期的笔记
   */
   async performPeriodicChecks() {
     const checkStartTime = Date.now();
     try {
       const now = new Date();

       console.log(`⏰ [持续检查] 开始执行定期检查 - ${now.toLocaleString()}`);

       // 查找所有启用持续检查且下次检查时间已到的笔记审核记录（评论不需要定时检查）
       const reviewsToCheck = await ImageReview.find({
         'continuousCheck.enabled': true,
         'continuousCheck.status': 'active',
         'continuousCheck.nextCheckTime': { $lte: now },
         imageType: 'note', // 只检查笔记类型
         noteUrl: { $ne: null }, // 必须有笔记链接
         status: 'manager_approved' // 只检查人工复审通过的记录
       });

       // 获取持续检查天数配置
       const TaskConfig = require('../models/TaskConfig');
       const noteConfig = await TaskConfig.findOne({ type_key: 'note' });
       const maxCheckDays = noteConfig ? noteConfig.continuous_check_days : 7;

       // 过滤掉超过检查期限的笔记
       const validReviewsToCheck = [];
       for (const review of reviewsToCheck) {
         const createdAt = new Date(review.createdAt);
         const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

         if (daysSinceCreation <= maxCheckDays) {
           validReviewsToCheck.push(review);
         } else {
           // 超过检查期限，停止持续检查
           console.log(`⏰ [持续检查] 笔记 ${review._id} 已超过${maxCheckDays}天检查期限 (${daysSinceCreation}天)，停止检查`);
           await ImageReview.findByIdAndUpdate(review._id, {
             'continuousCheck.status': 'expired',
             'continuousCheck.endReason': `超过${maxCheckDays}天检查期限`
           });
         }
       }

      if (validReviewsToCheck.length === 0) {
        console.log(`📭 [持续检查] 没有需要检查的笔记，跳过本次检查`);
        return; // 没有需要检查的笔记
      }

      console.log(`🔍 [持续检查] 找到 ${validReviewsToCheck.length} 条到期需要检查的笔记`);

      let successCount = 0;
      let failCount = 0;
      let errorCount = 0;
      let totalRewardPoints = 0;

      for (let i = 0; i < validReviewsToCheck.length; i++) {
        const review = validReviewsToCheck[i];
        const noteStartTime = Date.now();

        try {
          console.log(`📋 [持续检查] 处理第 ${i + 1}/${validReviewsToCheck.length} 条笔记 (ID: ${review._id})`);
          const result = await this.checkSingleNote(review);

          if (result.success) {
            successCount++;
            totalRewardPoints += result.rewardPoints;
          } else {
            failCount++;
          }

          const noteDuration = Date.now() - noteStartTime;
          console.log(`✅ [持续检查] 笔记 ${review._id} 处理完成，耗时: ${noteDuration}ms`);

          // 添加延迟避免请求过快
          if (i < validReviewsToCheck.length - 1) { // 不是最后一条时才延迟
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

        } catch (error) {
          const noteDuration = Date.now() - noteStartTime;
          console.error(`❌ [持续检查] 检查笔记 ${review._id} 失败 (耗时: ${noteDuration}ms):`, error.message);
          errorCount++;

          // 记录检查失败
          await this.recordCheckResult(review._id, {
            result: 'error',
            noteExists: false,
            rewardPoints: 0,
            errorMessage: error.message
          });
        }
      }

      const totalDuration = Date.now() - checkStartTime;
      console.log(`✅ [持续检查] 定期检查完成 - 成功: ${successCount}, 失败: ${failCount}, 错误: ${errorCount}, 总奖励积分: ${totalRewardPoints}, 总耗时: ${totalDuration}ms`);

    } catch (error) {
      const totalDuration = Date.now() - checkStartTime;
      console.error(`❌ [持续检查] 执行定期检查失败 (耗时: ${totalDuration}ms):`, error);
    }
  }

  /**
   * 检查单个笔记（带重试机制）
   */
  async checkSingleNote(review) {
    const startTime = Date.now();
    const maxRetries = 2;
    let lastError = null;

    // 重试逻辑：网络错误重试，笔记不存在不重试
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [持续检查] 开始检查笔记: ${review.noteUrl} (尝试 ${attempt}/${maxRetries}, 用户: ${review.userId}, 审核ID: ${review._id})`);

        // 使用XiaohongshuService验证笔记链接
        const validationResult = await XiaohongshuService.validateNoteUrl(review.noteUrl);
        const checkDuration = Date.now() - startTime;

        const noteExists = validationResult.valid;
        let rewardPoints = 0;

        if (noteExists) {
          // 从笔记任务配置中获取每日奖励积分
          const TaskConfig = require('../models/TaskConfig');
          const noteConfig = await TaskConfig.findOne({ type_key: 'note' });
          rewardPoints = noteConfig?.daily_reward_points ?? 30; // 使用 ?? 确保至少为30，而非undefined

          // 【防重复发放】检查今天是否已发放过该笔记的每日奖励
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date();
          todayEnd.setHours(23, 59, 59, 999);

          const existingReward = await Transaction.findOne({
            imageReview_id: review._id,
            type: 'task_reward',
            description: /每日存在性检查奖励/,
            createdAt: { $gte: todayStart, $lte: todayEnd }
          });

          if (existingReward) {
            console.log(`⚠️ [持续检查] 该笔记今天已发放过积分，跳过重复发放: ${review._id}`);
            // 不发放积分，但仍记录检查结果并更新下次检查时间
            await this.recordCheckResult(review._id, {
              result: 'success',
              noteExists: true,
              rewardPoints: 0,
              checkDuration: checkDuration,
              attempt: attempt,
              skipped: true,
              reason: '今日已发放'
            });
            return { success: true, rewardPoints: 0, skipped: true };
          }

          console.log(`✅ [持续检查] 笔记存在，奖励用户 ${review.userId} ${rewardPoints} 积分，检查耗时: ${checkDuration}ms`);

          // 更新用户积分（直接使用$inc避免重复查询）
          await User.findByIdAndUpdate(review.userId, {
            $inc: { points: rewardPoints }
          });

          // 创建每日检查奖励交易记录
          await new Transaction({
            user_id: review.userId,
            type: 'task_reward',
            amount: rewardPoints,
            description: `每日存在性检查奖励`,
            status: 'completed',
            imageReview_id: review._id,
            createdAt: new Date()
          }).save();

          // 记录成功检查
          await this.recordCheckResult(review._id, {
            result: 'success',
            noteExists: true,
            rewardPoints: rewardPoints,
            checkDuration: checkDuration,
            attempt: attempt
          });

          // 添加审核历史（优化：使用$push而非查询+保存）
          await ImageReview.findByIdAndUpdate(review._id, {
            $push: {
              auditHistory: {
                operator: null,
                operatorName: '系统',
                action: 'daily_check_passed',
                comment: `每日存在性检查通过，奖励 ${rewardPoints} 积分`,
                timestamp: new Date()
              }
            }
          });

          return { success: true, rewardPoints };

        } else {
          // 笔记不存在，停止后续检查（不重试）
          const reason = validationResult.reason || '笔记不存在或已被删除';
          console.log(`❌ [持续检查] 笔记不存在，停止后续检查: ${review.noteUrl} (用户: ${review.userId})，原因: ${reason}，检查耗时: ${checkDuration}ms`);

          // 更新状态为deleted并记录失败检查（合并操作）
          await ImageReview.findByIdAndUpdate(review._id, {
            'continuousCheck.status': 'deleted',
            'continuousCheck.endReason': reason
          });

          // 记录失败检查
          await this.recordCheckResult(review._id, {
            result: 'failed',
            noteExists: false,
            rewardPoints: 0,
            errorMessage: reason,
            checkDuration: checkDuration
          });

          // 添加审核历史（优化：使用$push而非查询+保存）
          await ImageReview.findByIdAndUpdate(review._id, {
            $push: {
              auditHistory: {
                operator: null,
                operatorName: '系统',
                action: 'note_deleted',
                comment: `笔记不存在，停止持续检查。原因: ${reason}`,
                timestamp: new Date()
              }
            }
          });

          return { success: false, rewardPoints: 0 };
        }

      } catch (error) {
        lastError = error;
        const checkDuration = Date.now() - startTime;

        // 判断是否为可重试的错误
        const isRetryableError = this.isRetryableError(error);

        console.error(`❌ [持续检查] 检查笔记失败 (尝试 ${attempt}/${maxRetries}, 耗时: ${checkDuration}ms):`, error.message);

        if (isRetryableError && attempt < maxRetries) {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        } else if (!isRetryableError) {
          // 不可重试的错误（如笔记确实不存在），直接返回
          console.log(`⚠️ [持续检查] 不可重试的错误，停止检查: ${error.message}`);
          await this.recordCheckResult(review._id, {
            result: 'error',
            noteExists: false,
            rewardPoints: 0,
            errorMessage: error.message,
            errorType: 'non_retryable'
          });
          return { success: false, rewardPoints: 0, error: error.message };
        }
      }
    }

    // 所有重试都失败
    console.error(`❌ [持续检查] 检查笔记失败，已重试${maxRetries}次:`, {
      reviewId: review._id,
      userId: review.userId,
      noteUrl: review.noteUrl,
      error: lastError?.message
    });

    // 记录错误但不停止检查（下次继续尝试）
    await this.recordCheckResult(review._id, {
      result: 'error',
      noteExists: false,
      rewardPoints: 0,
      errorMessage: lastError?.message || '未知错误',
      errorType: 'retry_exhausted'
    });

    return { success: false, rewardPoints: 0, error: lastError?.message };
  }

  /**
   * 判断错误是否可重试
   */
  isRetryableError(error) {
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNABORTED',
      'ENOTFOUND',
      'timeout',
      '网络错误',
      '请求超时',
      'ECONNREFUSED'
    ];

    const errorMessage = error.message || error.code || '';
    return retryablePatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * 记录检查结果（优化：不再查询完整review对象）
   */
  async recordCheckResult(reviewId, checkResult) {
    // 使用当前时间计算下次检查时间（从明天00:00开始）
    const nextCheckTime = this.getNextCheckTime();

    const updateData = {
      'continuousCheck.lastCheckTime': new Date(),
      'continuousCheck.nextCheckTime': nextCheckTime,
      $push: {
        'continuousCheck.checkHistory': {
          checkTime: new Date(),
          ...checkResult
        }
      }
    };

    await ImageReview.findByIdAndUpdate(reviewId, updateData);
  }

  /**
   * 获取下次检查时间（从当前时间起24小时后，每天检查一次）
   * 修复：使用当前时间而非传入的lastCheckTime，避免服务停机后累积延迟
   */
  getNextCheckTime() {
    const nextCheck = new Date();
    nextCheck.setDate(nextCheck.getDate() + 1); // 加1天，每天检查一次
    nextCheck.setHours(0, 0, 0, 0); // 设置为当天00:00:00，确保每天只检查一次
    return nextCheck;
  }

  /**
   * 为审核完成的笔记启用持续检查
   */
  async enableContinuousCheck(reviewId) {
    try {
      const updateData = {
        'continuousCheck.enabled': true,
        'continuousCheck.status': 'active',
        'continuousCheck.nextCheckTime': this.getNextCheckTime()
      };

      await ImageReview.findByIdAndUpdate(reviewId, updateData);
      console.log(`✅ 已为审核记录 ${reviewId} 启用持续检查`);
    } catch (error) {
      console.error('❌ 启用持续检查失败:', error);
    }
  }

  /**
   * 手动触发检查（用于测试）
   */
  async triggerManualCheck() {
    console.log('🔧 手动触发每日检查...');
    await this.performPeriodicChecks();
  }
}

module.exports = new ContinuousCheckService();