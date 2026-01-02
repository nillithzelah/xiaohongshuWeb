// 持续检查服务：每天检查笔记存在性并奖励积分（持续7天，与昵称提交限制一致）
const schedule = require('node-schedule');
const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
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
         status: 'completed' // 只检查已完成的审核
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
        const review = reviewsToCheck[i];
        const noteStartTime = Date.now();

        try {
          console.log(`📋 [持续检查] 处理第 ${i + 1}/${reviewsToCheck.length} 条笔记 (ID: ${review._id})`);
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
          if (i < reviewsToCheck.length - 1) { // 不是最后一条时才延迟
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
   * 检查单个笔记
   */
  async checkSingleNote(review) {
    const startTime = Date.now();
    try {
      console.log(`🔍 [持续检查] 开始检查笔记: ${review.noteUrl} (用户: ${review.userId}, 审核ID: ${review._id})`);

      // 使用XiaohongshuService验证笔记链接
      const validationResult = await XiaohongshuService.validateNoteUrl(review.noteUrl);
      const checkDuration = Date.now() - startTime;

      const noteExists = validationResult.valid;
      let rewardPoints = 0;

      if (noteExists) {
        // 从笔记任务配置中获取每日奖励积分
        const TaskConfig = require('../models/TaskConfig');
        const noteConfig = await TaskConfig.findOne({ type_key: 'note' });
        rewardPoints = noteConfig ? noteConfig.daily_reward_points : 0;

        console.log(`✅ [持续检查] 笔记存在，奖励用户 ${review.userId} ${rewardPoints} 积分，检查耗时: ${checkDuration}ms`);

        // 更新用户积分
        const user = await User.findById(review.userId);
        if (user) {
          // 确保用户有有效的积分字段
          const currentPoints = user.points || 0;
          const newPoints = currentPoints + rewardPoints;

          await User.findByIdAndUpdate(review.userId, {
            $set: { points: newPoints }
          });

          console.log(`✅ [持续检查] 笔记存在，奖励用户 ${review.userId} ${rewardPoints} 积分，检查耗时: ${checkDuration}ms`);

          // 计算并发放上级佣金（按比例）
          // 一级佣金：直接上级
          if (user.parent_id && review.snapshotCommission1 > 0) {
            const parentUser = await User.findById(user.parent_id);
            if (parentUser) {
              const parentCommission = rewardPoints * (review.snapshotCommission1 / review.snapshotPrice); // 按比例计算佣金
              await User.findByIdAndUpdate(user.parent_id, {
                $inc: { points: parentCommission }
              });

              console.log(`💰 [持续检查] 发放一级佣金: ${parentUser._id} 获得 ${parentCommission} 积分`);

              // 记录一级佣金发放事务
              const Transaction = require('../models/Transaction');
              await new Transaction({
                imageReview_id: review._id,
                user_id: parentUser._id,
                amount: parentCommission,
                type: 'continuous_check_commission_1',
                description: `持续检查一级推荐佣金 - 来自用户 ${user.username || user.nickname}`
              }).save();
            }
          }

          // 二级佣金：上级的上级
          if (user.parent_id && review.snapshotCommission2 > 0) {
            const parentUser = await User.findById(user.parent_id);
            if (parentUser && parentUser.parent_id) {
              const grandParentUser = await User.findById(parentUser.parent_id);
              if (grandParentUser) {
                const grandParentCommission = rewardPoints * (review.snapshotCommission2 / review.snapshotPrice); // 按比例计算佣金
                await User.findByIdAndUpdate(parentUser.parent_id, {
                  $inc: { points: grandParentCommission }
                });

                console.log(`💰 [持续检查] 发放二级佣金: ${grandParentUser._id} 获得 ${grandParentCommission} 积分`);

                // 记录二级佣金发放事务
                const Transaction = require('../models/Transaction');
                await new Transaction({
                  imageReview_id: review._id,
                  user_id: grandParentUser._id,
                  amount: grandParentCommission,
                  type: 'continuous_check_commission_2',
                  description: `持续检查二级推荐佣金 - 来自用户 ${user.username || user.nickname}`
                }).save();
              }
            }
          }
        }

        // 记录成功检查
        await this.recordCheckResult(review._id, {
          result: 'success',
          noteExists: true,
          rewardPoints: rewardPoints
        });

        // 添加审核历史
        review.auditHistory.push({
          operator: null,
          operatorName: '系统',
          action: 'daily_check_passed',
          comment: `每日存在性检查通过，奖励 ${rewardPoints} 积分，检查耗时: ${checkDuration}ms`,
          timestamp: new Date()
        });

      } else {
        // 笔记不存在，停止后续检查
        console.log(`❌ [持续检查] 笔记不存在，停止后续检查: ${review.noteUrl} (用户: ${review.userId})，检查耗时: ${checkDuration}ms`);

        // 更新状态为deleted
        await ImageReview.findByIdAndUpdate(review._id, {
          'continuousCheck.status': 'deleted'
        });

        // 记录失败检查
        await this.recordCheckResult(review._id, {
          result: 'failed',
          noteExists: false,
          rewardPoints: 0,
          errorMessage: '笔记不存在或已被删除'
        });

        // 添加审核历史
        review.auditHistory.push({
          operator: null,
          operatorName: '系统',
          action: 'note_deleted',
          comment: '笔记不存在，停止持续检查',
          timestamp: new Date()
        });
      }

      await review.save();

      console.log(`📊 [持续检查] 检查完成 - 结果: ${noteExists ? '存在' : '不存在'}, 奖励: ${rewardPoints}积分，耗时: ${checkDuration}ms`);
      return { success: noteExists, rewardPoints };

    } catch (error) {
      const checkDuration = Date.now() - startTime;
      console.error(`❌ [持续检查] 检查笔记失败 (耗时: ${checkDuration}ms):`, {
        reviewId: review._id,
        userId: review.userId,
        noteUrl: review.noteUrl,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 记录检查结果
   */
  async recordCheckResult(reviewId, checkResult) {
    // 获取当前笔记的下次检查时间
    const review = await ImageReview.findById(reviewId);
    const nextCheckTime = this.getNextCheckTime(review.continuousCheck.nextCheckTime);

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
   * 获取下次检查时间（24小时后，每天检查一次）
   */
  getNextCheckTime(lastCheckTime) {
    const nextCheck = new Date(lastCheckTime);
    nextCheck.setDate(nextCheck.getDate() + 1); // 加1天，每天检查一次
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