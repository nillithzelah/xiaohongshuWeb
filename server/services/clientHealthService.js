/**
 * 客户端健康度服务
 *
 * 功能：
 * 1. 自动更新客户端在线状态 (每5分钟)
 * 2. 重置今日统计 (每日凌晨)
 * 3. 记录任务成功/失败并更新统计
 * 4. 检测僵尸客户端
 */

const cron = require('node-cron');
const ClientHeartbeat = require('../models/ClientHeartbeat');
const TimeUtils = require('../utils/timeUtils');

class ClientHealthService {
  constructor() {
    this.isRunning = false;
    // 连续失败阈值
    this.MAX_CONSECUTIVE_FAILURES = 3;
    // 保存 cron 任务引用（用于停止）
    this.tasks = [];
  }

  /**
   * 启动服务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  [客户端健康度] 服务已在运行');
      return;
    }

    this.isRunning = true;
    this.tasks = []; // 清空旧任务引用

    // 每5分钟更新在线状态
    const statusTask = cron.schedule('*/5 * * * *', () => this.updateClientStatus());
    this.tasks.push(statusTask);

    // 每日凌晨0:05重置今日统计 (使用北京时间)
    const statsTask = cron.schedule('5 0 * * *', () => this.resetDailyStats(), {
      timezone: 'Asia/Shanghai'
    });
    this.tasks.push(statsTask);

    // 每小时检测僵尸客户端
    const zombieTask = cron.schedule('0 * * * *', () => this.detectZombieClients());
    this.tasks.push(zombieTask);

    console.log('✅ [客户端健康度] 定时任务已启动');
    console.log('   - 每5分钟: 更新在线状态');
    console.log('   - 每日0:05: 重置今日统计');
    console.log('   - 每小时:   检测僵尸客户端');
  }

  /**
   * 停止服务
   */
  stop() {
    if (!this.isRunning) return;

    // 停止所有定时任务
    this.tasks.forEach(task => {
      if (task && typeof task.stop === 'function') {
        task.stop();
      }
    });
    this.tasks = [];
    this.isRunning = false;
    console.log('⏹️  [客户端健康度] 服务已停止');
  }

  /**
   * 1. 更新客户端在线状态
   * 每5分钟执行一次
   */
  async updateClientStatus() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      // online: 5分钟内有心跳
      const onlineResult = await ClientHeartbeat.updateMany(
        { lastHeartbeat: { $gte: fiveMinutesAgo }, status: { $ne: 'online' } },
        { status: 'online' }
      );

      // idle: 5-15分钟内有心跳
      const idleResult = await ClientHeartbeat.updateMany(
        {
          lastHeartbeat: { $gte: fifteenMinutesAgo, $lt: fiveMinutesAgo },
          status: { $ne: 'idle' }
        },
        { status: 'idle' }
      );

      // offline: 超过15分钟无心跳
      const offlineResult = await ClientHeartbeat.updateMany(
        { lastHeartbeat: { $lt: fifteenMinutesAgo }, status: { $ne: 'offline' } },
        { status: 'offline' }
      );

      const totalChanges = onlineResult.modifiedCount + idleResult.modifiedCount + offlineResult.modifiedCount;
      if (totalChanges > 0) {
        console.log(`🔄 [客户端健康度] 更新在线状态: online(+${onlineResult.modifiedCount}) idle(+${idleResult.modifiedCount}) offline(+${offlineResult.modifiedCount})`);
      }

    } catch (error) {
      console.error('❌ [客户端健康度] 更新在线状态失败:', error);
    }
  }

  /**
   * 2. 重置今日统计
   * 每日0:05执行一次
   */
  async resetDailyStats() {
    try {
      // 使用北京时间而非UTC时间，避免时区问题
      const beijingTime = TimeUtils.getBeijingTime();
      const today = beijingTime.toISOString().split('T')[0];

      // 查找需要重置的客户端
      const result = await ClientHeartbeat.updateMany(
        { todayDate: { $ne: today } },
        {
          todayDate: today,
          todayNotesDiscovered: 0,
          todayCommentsCollected: 0,
          todayValidLeads: 0,
          todayCommentsScanned: 0,
          todayBlacklisted: 0,
          todayReviewsCompleted: 0
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`🌅 [客户端健康度] 重置 ${result.modifiedCount} 个客户端的今日统计 (${today})`);
      }

    } catch (error) {
      console.error('❌ [客户端健康度] 重置今日统计失败:', error);
    }
  }

  /**
   * 3. 记录任务成功
   * 任务完成接口调用
   */
  async recordTaskSuccess(clientId, clientType, stats = {}) {
    try {
      const now = new Date();
      // 使用北京时间而非UTC时间，避免时区问题
      const beijingTime = TimeUtils.getBeijingTime();
      const today = beijingTime.toISOString().split('T')[0];

      // 基础更新字段
      const updateData = {
        $set: {
          lastSuccessUploadAt: now,
          lastUploadCount: stats.count || 1,
          consecutiveFailures: 0,  // 重置连续失败
          taskDistributionPaused: false,  // 自动恢复
          pauseReason: null,
          pausedAt: null,
          todayDate: today  // 确保日期正确
        },
        $inc: {}
      };

      // 根据客户端类型更新统计
      switch (clientType) {
        case 'discovery':
          updateData.$inc['totalNotesDiscovered'] = stats.notesDiscovered || 1;
          updateData.$set['todayNotesDiscovered'] = stats.notesDiscovered || 1;  // $set: 客户端上报的是累计值
          updateData.$inc['totalSuccessCount'] = 1;
          break;

        case 'harvest':
          updateData.$inc['totalCommentsCollected'] = stats.commentsCollected || 0;
          updateData.$inc['totalValidLeads'] = stats.validLeads || 0;
          updateData.$set['todayCommentsCollected'] = stats.commentsCollected || 0;  // $set
          updateData.$set['todayValidLeads'] = stats.validLeads || 0;  // $set
          updateData.$inc['totalSuccessCount'] = 1;
          break;

        case 'blacklist-scan':
          updateData.$inc['totalCommentsScanned'] = stats.commentsScanned || 0;
          updateData.$inc['totalBlacklisted'] = stats.blacklisted || 0;
          updateData.$set['todayCommentsScanned'] = stats.commentsScanned || 0;  // $set
          updateData.$set['todayBlacklisted'] = stats.blacklisted || 0;  // $set
          updateData.$inc['totalSuccessCount'] = 1;
          break;

        case 'audit':
          updateData.$inc['totalReviewsCompleted'] = stats.reviewsCompleted || 1;
          updateData.$set['todayReviewsCompleted'] = stats.reviewsCompleted || 1;  // $set
          updateData.$inc['totalSuccessCount'] = 1;
          break;

        default:
          updateData.$inc['totalSuccessCount'] = 1;
          break;
      }

      // 执行更新
      await ClientHeartbeat.updateOne(
        { clientId },
        updateData,
        { upsert: true }
      );

    } catch (error) {
      console.error(`❌ [客户端健康度] 记录任务成功失败 (${clientId}):`, error.message);
    }
  }

  /**
   * 4. 记录任务失败
   * 任务失败接口调用
   */
  async recordTaskFailure(clientId, reason = '任务失败') {
    try {
      const client = await ClientHeartbeat.findOne({ clientId });
      if (!client) {
        // 如果客户端不存在，创建一个记录
        await ClientHeartbeat.create({
          clientId,
          consecutiveFailures: 1,
          totalFailureCount: 1,
          status: 'offline'
        });
        console.log(`⚠️  [客户端健康度] ${clientId} 首次记录失败`);
        return;
      }

      const newFailures = (client.consecutiveFailures || 0) + 1;

      const updateData = {
        $inc: {
          consecutiveFailures: 1,
          totalFailureCount: 1
        }
      };

      // 连续失败 >=3 时自动暂停（审核客户端除外）
      if (newFailures >= this.MAX_CONSECUTIVE_FAILURES && !client.taskDistributionPaused && client.clientType !== 'audit') {
        updateData.$set = {
          taskDistributionPaused: true,
          pauseReason: `连续失败 ${newFailures} 次: ${reason}`,
          pausedAt: new Date()
        };

        console.log(`🚫 [客户端健康度] ${clientId} 已自动暂停 - 连续失败 ${newFailures} 次`);
      }

      await ClientHeartbeat.updateOne({ clientId }, updateData);

    } catch (error) {
      console.error(`❌ [客户端健康度] 记录任务失败失败 (${clientId}):`, error.message);
    }
  }

  /**
   * 5. 检测僵尸客户端
   * 每小时执行一次
   */
  async detectZombieClients() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // 查找首次发现超过24小时但累计统计全部为0的客户端
      const zombies = await ClientHeartbeat.find({
        firstSeenAt: { $lt: oneDayAgo },
        $or: [
          // 所有累计统计都是0
          {
            $or: [
              { totalNotesDiscovered: 0 },
              { totalNotesDiscovered: { $exists: false } }
            ],
            $or: [
              { totalCommentsCollected: 0 },
              { totalCommentsCollected: { $exists: false } }
            ],
            $or: [
              { totalReviewsCompleted: 0 },
              { totalReviewsCompleted: { $exists: false } }
            ]
          }
        ]
      }).select('clientId clientType firstSeenAt totalNotesDiscovered totalCommentsCollected totalReviewsCompleted taskDistributionPaused');

      if (zombies.length > 0) {
        console.log(`⚠️  [客户端健康度] 发现 ${zombies.length} 个僵尸客户端 (首次发现超过24小时且累计统计为0):`);

        // 自动移除僵尸客户端的描述，阻止其获取任务
        const zombieIds = zombies.map(z => z.clientId);
        const removeDescResult = await ClientHeartbeat.updateMany(
          { clientId: { $in: zombieIds } },
          { $set: { description: '' } }
        );

        console.log(`   已移除 ${removeDescResult.modifiedCount} 个僵尸客户端的描述`);

        // 输出详情
        zombies.forEach(z => {
          const firstSeenDate = z.firstSeenAt ? z.firstSeenAt.toISOString().slice(0, 10) : '-';
          console.log(`   ❌ ${z.clientId} | 类型: ${z.clientType} | 首次发现: ${firstSeenDate} | 暂停: ${z.taskDistributionPaused || false}`);
        });
      }

    } catch (error) {
      console.error('❌ [客户端健康度] 检测僵尸客户端失败:', error);
    }
  }

  /**
   * 获取客户端健康状态
   */
  async getClientHealthStatus(clientId) {
    try {
      const client = await ClientHeartbeat.findOne({ clientId });
      if (!client) {
        return { status: 'unknown', paused: false };
      }

      return {
        status: client.status || 'unknown',
        paused: client.taskDistributionPaused || false,
        pauseReason: client.pauseReason,
        consecutiveFailures: client.consecutiveFailures || 0,
        totalSuccess: client.totalSuccessCount || 0,
        totalFailure: client.totalFailureCount || 0,
        lastSuccess: client.lastSuccessUploadAt
      };
    } catch (error) {
      console.error(`❌ [客户端健康度] 获取健康状态失败 (${clientId}):`, error.message);
      return { status: 'error', paused: false };
    }
  }
}

// 创建单例实例
const clientHealthService = new ClientHealthService();

module.exports = clientHealthService;
