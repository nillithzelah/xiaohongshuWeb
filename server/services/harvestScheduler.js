/**
 * 评论采集队列定时任务
 *
 * 功能：
 * 1. 每小时标记10天内创建/编辑的笔记为"待采集评论"
 * 2. 自动清理超过10天的笔记（移出采集队列）
 * 3. 每5分钟清理超时的任务锁定（防止客户端下线导致任务永久被锁）
 * 4. 每5分钟更新僵尸客户端状态（超过1小时无心跳设为offline）
 */

const cron = require('node-cron');
const DiscoveredNote = require('../models/DiscoveredNote');
const ImageReview = require('../models/ImageReview');
const SearchKeyword = require('../models/SearchKeyword');
const ShortLinkPool = require('../models/ShortLinkPool');
const ClientHeartbeat = require('../models/ClientHeartbeat');

class HarvestScheduler {
  constructor() {
    this.isRunning = false;
    this.task = null;
    this.lockCleanupTask = null;
    // 默认配置：每小时执行一次
    this.cronPattern = '0 * * * *'; // 每小时的第0分钟执行
    // 锁定超时时间（分钟）- 与 client.js 保持一致
    this.lockTimeoutMinutes = 15;
  }

  /**
   * 启动定时任务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  [采集队列] 定时任务已在运行');
      return;
    }

    this.isRunning = true;

    // 立即执行一次
    this.markNotesForHarvest();

    // 设置定时任务（每小时标记待采集笔记）
    this.task = cron.schedule(this.cronPattern, () => {
      this.markNotesForHarvest();
    });

    // 启动锁定清理任务（每5分钟执行一次）
    this.lockCleanupTask = cron.schedule('*/5 * * * *', () => {
      this.releaseExpiredLocks();
    });

    console.log('✅ [采集队列] 定时任务已启动，每小时执行一次');
    console.log('✅ [采集队列] 锁定清理任务已启动，每5分钟执行一次');
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    if (this.lockCleanupTask) {
      this.lockCleanupTask.stop();
      this.lockCleanupTask = null;
    }
    this.isRunning = false;
    console.log('⏹️  [采集队列] 定时任务已停止');
  }

  /**
   * 标记待采集评论的笔记
   *
   * 逻辑：
   * 1. 将10天内创建且未采集过的笔记标记为需要采集
   * 2. 超过10天的笔记不再需要采集（保持 commentsHarvested 状态或设为 false）
   */
  async markNotesForHarvest() {
    try {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 [采集队列] 开始标记待采集评论的笔记...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // 计算10天前的时间点
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      // 1. 标记10天内的笔记为"需要采集评论"
      const markResult = await DiscoveredNote.updateMany(
        {
          status: 'discovered',
          createdAt: { $gte: tenDaysAgo },
          commentsHarvested: { $ne: true } // 未采集过
        },
        {
          needsCommentHarvest: true
        }
      );

      console.log(`📝 [采集队列] 标记 ${markResult.modifiedCount} 个笔记为待采集评论`);

      // 2. 清理：超过10天的笔记不再需要采集
      const cleanupResult = await DiscoveredNote.updateMany(
        {
          needsCommentHarvest: true,
          createdAt: { $lt: tenDaysAgo }
        },
        {
          needsCommentHarvest: false
        }
      );

      if (cleanupResult.modifiedCount > 0) {
        console.log(`🧹 [采集队列] 移出队列: ${cleanupResult.modifiedCount} 个超过10天的笔记`);
      }

      // 3. 统计当前队列状态
      const pendingCount = await DiscoveredNote.countDocuments({
        needsCommentHarvest: true,
        commentsHarvested: { $ne: true },
        status: 'discovered'
      });

      const harvestedCount = await DiscoveredNote.countDocuments({
        commentsHarvested: true
      });

      console.log(`📊 [采集队列] 当前状态: 待采集 ${pendingCount} | 已采集 ${harvestedCount}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    } catch (error) {
      console.error('❌ [采集队列] 定时任务执行失败:', error);
    }
  }

  /**
   * 释放超时的任务锁定
   *
   * 防止客户端下线/崩溃导致任务永久被锁
   * 每5分钟自动执行一次
   */
  async releaseExpiredLocks() {
    try {
      const now = new Date();

      // 释放所有超时的锁定
      const result = await DiscoveredNote.updateMany(
        { 'harvestLock.lockedUntil': { $lt: now } },
        {
          $unset: { harvestLock: 1 }  // 完全删除锁定字段，避免留下空对象
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🔓 [采集队列] 自动释放 ${result.modifiedCount} 个超时锁定任务`);
      }

      // 可选：统计被锁定的任务数量
      const lockedCount = await DiscoveredNote.countDocuments({
        'harvestLock.lockedUntil': { $gt: now }
      });

      if (lockedCount > 0) {
        console.log(`📌 [采集队列] 当前仍有 ${lockedCount} 个任务被锁定处理中`);
      }

      // 清理空锁定对象（防御性编程，确保不会累积）
      await this.cleanupEmptyLocks();

      // 更新僵尸客户端状态（超过1小时无心跳）
      await this.updateZombieClients();

    } catch (error) {
      console.error('❌ [采集队列] 释放超时锁定失败:', error);
    }
  }

  /**
   * 更新僵尸客户端状态
   *
   * 将超过1小时无心跳的客户端状态设为 offline
   */
  async updateZombieClients() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const result = await ClientHeartbeat.updateMany(
        {
          lastHeartbeat: { $lt: oneHourAgo },
          status: { $ne: 'offline' }
        },
        {
          status: 'offline'
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 [僵尸客户端] 将 ${result.modifiedCount} 个超时客户端标记为离线`);
      }

    } catch (error) {
      console.error('❌ [僵尸客户端] 更新失败:', error);
    }
  }

  /**
   * 清理空锁定对象（防御性编程）
   *
   * 防止代码bug或边缘情况导致空锁定对象累积
   */
  async cleanupEmptyLocks() {
    try {
      // 清理 DiscoveredNote 中的空锁定
      const [harvestResult, blacklistResult, shortUrlResult] = await Promise.all([
        DiscoveredNote.updateMany({ harvestLock: { $eq: {} } }, { $unset: { harvestLock: 1 } }),
        DiscoveredNote.updateMany({ blacklistScanLock: { $eq: {} } }, { $unset: { blacklistScanLock: 1 } }),
        DiscoveredNote.updateMany({ shortUrlProcessingLock: { $eq: {} } }, { $unset: { shortUrlProcessingLock: 1 } })
      ]);

      // 清理 ImageReview 中的空 processingLock
      const imageReviewResult = await ImageReview.updateMany(
        { processingLock: { $eq: {} } },
        { $unset: { processingLock: 1 } }
      );

      // 清理 SearchKeyword 中的空 searchLock
      const searchKeywordResult = await SearchKeyword.updateMany(
        { searchLock: { $eq: {} } },
        { $unset: { searchLock: 1 } }
      );

      // 清理 ShortLinkPool 中的空 processingLock
      const shortLinkPoolResult = await ShortLinkPool.updateMany(
        { processingLock: { $eq: {} } },
        { $unset: { processingLock: 1 } }
      );

      const totalCleaned = harvestResult.modifiedCount + blacklistResult.modifiedCount +
                          shortUrlResult.modifiedCount + imageReviewResult.modifiedCount +
                          searchKeywordResult.modifiedCount + shortLinkPoolResult.modifiedCount;

      if (totalCleaned > 0) {
        console.log(`🧹 [空锁清理] DiscoveredNote(harvest:${harvestResult.modifiedCount}, blacklist:${blacklistResult.modifiedCount}, shortUrl:${shortUrlResult.modifiedCount}) | ImageReview(${imageReviewResult.modifiedCount}) | SearchKeyword(${searchKeywordResult.modifiedCount}) | ShortLinkPool(${shortLinkPoolResult.modifiedCount}) | 总计: ${totalCleaned}`);
      }

    } catch (error) {
      console.error('❌ [采集队列] 清理空锁定对象失败:', error);
    }
  }

  /**
   * 检查卡住的任务（健康检查）
   *
   * 检查锁定过久（超过30分钟）的任务，自动释放并记录异常
   */
  async checkStuckTasks() {
    try {
      const now = new Date();
      const stuckThreshold = new Date(now.getTime() - 30 * 60 * 1000); // 30分钟

      // 查找锁定已过期但仍有锁定字段的笔记
      const stuckTasks = await DiscoveredNote.find({
        'harvestLock.lockedUntil': { $lt: stuckThreshold },
        harvestLock: { $exists: true, $ne: {} }
      }).select('noteId title harvestLock status commentsHarvested noteUrl');

      if (stuckTasks.length > 0) {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⚠️  [健康检查] 发现 ${stuckTasks.length} 个卡住的任务（锁定超过30分钟）`);

        // 自动释放这些卡住的任务
        const releaseResult = await DiscoveredNote.updateMany(
          {
            'harvestLock.lockedUntil': { $lt: stuckThreshold },
            harvestLock: { $exists: true, $ne: {} }
          },
          {
            $unset: { harvestLock: 1 }
          }
        );

        console.log(`🔓 [健康检查] 自动释放 ${releaseResult.modifiedCount} 个卡住的任务`);

        // 详细记录每个卡住的任务
        for (const task of stuckTasks) {
          const lock = task.harvestLock;
          const age = Math.floor((now - lock.lockedAt) / 1000 / 60);
          console.log(`  - [${task.noteId}] 锁定者: ${lock.clientId} | 锁定时长: ${age}分钟 | 已采集: ${task.commentsHarvested || false}`);
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }

      return { stuck: stuckTasks.length, released: stuckTasks.length };

    } catch (error) {
      console.error('❌ [健康检查] 检查卡住任务失败:', error);
      return { stuck: 0, released: 0 };
    }
  }

  /**
   * 手动触发标记（用于测试或立即执行）
   */
  async trigger() {
    await this.markNotesForHarvest();
  }

  /**
   * 获取队列统计信息
   */
  async getStats() {
    try {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      const [pending, harvested, totalDiscovered] = await Promise.all([
        // 待采集评论
        DiscoveredNote.countDocuments({
          needsCommentHarvest: true,
          commentsHarvested: { $ne: true },
          status: 'discovered'
        }),
        // 已采集评论
        DiscoveredNote.countDocuments({
          commentsHarvested: true
        }),
        // 总发现的笔记
        DiscoveredNote.countDocuments({
          status: 'discovered'
        })
      ]);

      return {
        pending,
        harvested,
        totalDiscovered,
        harvestRate: totalDiscovered > 0 ? Math.round(harvested / totalDiscovered * 100) : 0
      };

    } catch (error) {
      console.error('❌ [采集队列] 获取统计失败:', error);
      return {
        pending: 0,
        harvested: 0,
        totalDiscovered: 0,
        harvestRate: 0
      };
    }
  }
}

// 创建单例实例
const harvestScheduler = new HarvestScheduler();

module.exports = harvestScheduler;
