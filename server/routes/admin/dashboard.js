/**
 * 管理后台 - 仪表板路由
 * 包含统计、监控、各角色仪表板等
 */

const express = require('express');
const router = express.Router();

const ImageReview = require('../../models/ImageReview');
const User = require('../../models/User');
const DiscoveredNote = require('../../models/DiscoveredNote');
const ClientHeartbeat = require('../../models/ClientHeartbeat');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const log = logger.module('Admin:Dashboard');

/**
 * 获取仪表盘统计数据
 * GET /stats
 */
router.get('/stats', authenticateToken, requireRole(['boss', 'manager', 'finance', 'mentor', 'hr']), async (req, res) => {
  try {
    log.info('📊 收到统计数据请求');

    const [
      totalReviews,
      pendingReviews,
      mentorReviewing,
      completedReviews,
      rejectedReviews,
      totalUsers
    ] = await Promise.all([
      ImageReview.countDocuments(),
      ImageReview.countDocuments({ status: 'pending' }),
      ImageReview.countDocuments({ status: 'mentor_approved' }),
      ImageReview.countDocuments({ status: 'completed' }),
      ImageReview.countDocuments({ status: 'rejected' }),
      User.countDocuments({ role: 'part_time' })
    ]);

    const stats = {
      totalReviews,
      pendingReviews,
      inProgressReviews: mentorReviewing,
      completedReviews,
      rejectedReviews,
      totalUsers
    };

    log.info('📊 返回统计数据:', stats);

    res.json({ success: true, stats });

  } catch (error) {
    log.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败' });
  }
});

/**
 * 系统监控数据
 * GET /monitoring
 */
router.get('/monitoring', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    log.info('📊 [监控] 收到监控数据请求');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [
      pendingNotes,
      pendingComments,
      inProgress,
      todayCompleted,
      pendingHarvest,
      todayDiscoveredNotes,
      todayHarvestedNotes,
      todayHarvestCommentsTotal,
      onlineClients
    ] = await Promise.all([
      ImageReview.countDocuments({ imageType: 'note', status: 'pending' }),
      ImageReview.countDocuments({ imageType: 'comment', status: 'pending' }),
      ImageReview.countDocuments({ status: 'processing' }),
      ImageReview.countDocuments({
        updatedAt: { $gte: todayStart },
        status: { $in: ['completed', 'rejected'] }
      }),
      DiscoveredNote.countDocuments({
        needsCommentHarvest: true,
        commentsHarvested: { $ne: true }
      }),
      DiscoveredNote.countDocuments({ createdAt: { $gte: todayStart } }),
      DiscoveredNote.countDocuments({ commentsHarvestedAt: { $gte: todayStart } }),
      DiscoveredNote.aggregate([
        { $match: { commentsHarvestedAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$lastCommentCount' } } }
      ]),
      ClientHeartbeat.find({ lastHeartbeat: { $gte: fiveMinutesAgo } })
        .select('clientId status lastHeartbeat taskIds clientType description remark ' +
                'todayNotesDiscovered todayNotesProcessed todayValidLeads ' +
                'todayCommentsScanned todayBlacklisted todayReviewsCompleted ' +
                'consecutiveFailures taskDistributionPaused lastSuccessUploadAt')
        .sort({ lastHeartbeat: -1 })
    ]);

    const todayComments = todayHarvestCommentsTotal.length > 0 ? todayHarvestCommentsTotal[0].total : 0;

    const clientsList = onlineClients.map(client => ({
      clientId: client.clientId,
      lastHeartbeat: client.lastHeartbeat,
      status: client.status || 'online',
      taskCount: client.taskIds ? client.taskIds.length : 0,
      clientType: client.clientType,
      description: client.description,
      remark: client.remark,
      todayNotesDiscovered: client.todayNotesDiscovered || 0,
      todayNotesProcessed: client.todayNotesProcessed || 0,
      todayValidLeads: client.todayValidLeads || 0,
      todayCommentsScanned: client.todayCommentsScanned || 0,
      todayBlacklisted: client.todayBlacklisted || 0,
      todayReviewsCompleted: client.todayReviewsCompleted || 0,
      consecutiveFailures: client.consecutiveFailures || 0,
      taskDistributionPaused: client.taskDistributionPaused || false,
      lastSuccessUploadAt: client.lastSuccessUploadAt
    }));

    const monitoringData = {
      audit: { pendingNotes, pendingComments, inProgress, todayCompleted },
      harvest: { pendingHarvest, todayNotes: todayDiscoveredNotes, todayComments },
      clients: { online: clientsList.length, list: clientsList }
    };

    log.info('📊 [监控] 返回监控数据');
    res.json({ success: true, data: monitoringData });

  } catch (error) {
    log.error('❌ [监控] 获取监控数据失败:', error);
    res.status(500).json({ success: false, message: '获取监控数据失败' });
  }
});

/**
 * HR专用仪表盘统计
 * GET /dashboard/hr
 */
router.get('/dashboard/hr', authenticateToken, requireRole(['hr']), async (req, res) => {
  try {
    const hrId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayNewLeads, monthlyClients, pendingFollowups, recentLeads] = await Promise.all([
      User.countDocuments({
        role: 'part_time',
        hr_id: hrId,
        createdAt: { $gte: today, $lt: tomorrow },
        is_deleted: { $ne: true }
      }),
      User.countDocuments({
        role: 'part_time',
        hr_id: hrId,
        createdAt: { $gte: monthStart },
        is_deleted: { $ne: true }
      }),
      User.countDocuments({
        role: 'part_time',
        hr_id: hrId,
        mentor_id: null,
        is_deleted: { $ne: true }
      }),
      User.find({
        role: 'part_time',
        hr_id: hrId,
        is_deleted: { $ne: true }
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username nickname phone wechat createdAt')
    ]);

    res.json({
      success: true,
      stats: { todayNewLeads, monthlyClients, pendingFollowups },
      recentLeads
    });
  } catch (error) {
    log.error('获取销售仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

/**
 * 主管专用仪表盘统计
 * GET /dashboard/manager
 */
router.get('/dashboard/manager', authenticateToken, requireRole(['manager']), async (req, res) => {
  try {
    const [teamTotalClients, unassignedLeads, hrRanking] = await Promise.all([
      User.countDocuments({ role: 'part_time', is_deleted: { $ne: true } }),
      User.countDocuments({
        role: 'part_time',
        hr_id: { $ne: null },
        mentor_id: null,
        is_deleted: { $ne: true }
      }),
      User.aggregate([
        { $match: { role: 'hr', is_deleted: { $ne: true } } },
        { $lookup: { from: 'users', localField: '_id', foreignField: 'hr_id', as: 'clients' } },
        { $project: { username: 1, nickname: 1, clientCount: { $size: '$clients' } } },
        { $sort: { clientCount: -1 } },
        { $limit: 10 }
      ])
    ]);

    res.json({
      success: true,
      stats: { teamPerformance: teamTotalClients, unassignedLeads, conversionRate: 0 },
      hrRanking
    });
  } catch (error) {
    log.error('获取主管仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

/**
 * 带教老师专用仪表盘统计
 * GET /dashboard/mentor
 */
router.get('/dashboard/mentor', authenticateToken, requireRole(['mentor']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pendingReviews, activeClients, completedToday, recentPendingReviews] = await Promise.all([
      ImageReview.countDocuments({ status: 'pending' }),
      User.countDocuments({
        role: 'part_time',
        mentor_id: req.user._id,
        is_deleted: { $ne: true }
      }),
      ImageReview.countDocuments({
        status: { $in: ['mentor_approved', 'completed', 'rejected'] },
        updatedAt: { $gte: today, $lt: tomorrow }
      }),
      ImageReview.find({ status: 'pending' })
        .populate('userId', 'username nickname')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.json({
      success: true,
      stats: { pendingReviews, activeClients, completedToday },
      pendingReviewsList: recentPendingReviews
    });
  } catch (error) {
    log.error('获取客服仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

module.exports = router;
