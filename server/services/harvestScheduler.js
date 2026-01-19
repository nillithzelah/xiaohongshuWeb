/**
 * 评论采集队列定时任务
 *
 * 功能：
 * 1. 每小时标记10天内创建/编辑的笔记为"待采集评论"
 * 2. 自动清理超过10天的笔记（移出采集队列）
 */

const cron = require('node-cron');
const DiscoveredNote = require('../models/DiscoveredNote');

class HarvestScheduler {
  constructor() {
    this.isRunning = false;
    this.task = null;
    // 默认配置：每小时执行一次
    this.cronPattern = '0 * * * *'; // 每小时的第0分钟执行
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

    // 设置定时任务
    this.task = cron.schedule(this.cronPattern, () => {
      this.markNotesForHarvest();
    });

    console.log('✅ [采集队列] 定时任务已启动，每小时执行一次');
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
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
