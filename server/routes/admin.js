const express = require('express');

const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 获取仪表盘统计数据 (老板专用)
router.get('/stats', authenticateToken, requireRole(['boss', 'manager', 'finance', 'mentor', 'hr']), async (req, res) => {
  try {
    console.log('📊 收到统计数据请求');

    // 并行执行所有查询，速度更快
    const [
      totalReviews,
      pendingReviews,
      mentorReviewing,
      completedReviews,
      rejectedReviews,
      totalUsers
    ] = await Promise.all([
      ImageReview.countDocuments(), // 总审核数
      ImageReview.countDocuments({ status: 'pending' }), // 待审核
      ImageReview.countDocuments({ status: 'mentor_approved' }), // 带教老师审核中（待经理确认）
      ImageReview.countDocuments({ status: 'completed' }), // 已完成
      ImageReview.countDocuments({ status: 'rejected' }), // 已拒绝
      User.countDocuments({ role: 'part_time' }) // 总用户数 (只算兼职用户)
    ]);

    const stats = {
      totalReviews,
      pendingReviews,
      inProgressReviews: mentorReviewing, // 把带教老师审核过的也算作处理中
      completedReviews,
      rejectedReviews,
      totalUsers
    };

    console.log('📊 返回统计数据:', stats);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
});

// HR专用仪表盘统计
router.get('/dashboard/hr', authenticateToken, requireRole(['hr']), async (req, res) => {
  try {
    const hrId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 今日新增线索数（该HR名下的今日新增用户）
    const todayNewLeads = await User.countDocuments({
      role: 'part_time',
      hr_id: hrId,
      createdAt: { $gte: today, $lt: tomorrow },
      is_deleted: { $ne: true }
    });

    // 本月累计客户数（该HR名下的本月累计用户）
    const monthlyClients = await User.countDocuments({
      role: 'part_time',
      hr_id: hrId,
      createdAt: { $gte: monthStart },
      is_deleted: { $ne: true }
    });

    // 待跟进客户数（该HR名下还没有分配给带教老师的用户）
    const pendingFollowups = await User.countDocuments({
      role: 'part_time',
      hr_id: hrId,
      mentor_id: null,
      is_deleted: { $ne: true }
    });

    // 最近录入的 5 条线索（该HR录入的最新用户）
    const recentLeads = await User.find({
      role: 'part_time',
      hr_id: hrId,
      is_deleted: { $ne: true }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('username nickname phone wechat createdAt');

    res.json({
      success: true,
      stats: {
        todayNewLeads,
        monthlyClients,
        pendingFollowups
      },
      recentLeads
    });
  } catch (error) {
    console.error('获取销售仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

// 主管专用仪表盘统计
router.get('/dashboard/manager', authenticateToken, requireRole(['manager']), async (req, res) => {
  try {
    // 团队总客户数（所有用户数量）
    const teamTotalClients = await User.countDocuments({
      role: 'part_time',
      is_deleted: { $ne: true }
    });

    // 待分配线索数 (hr_id不为空但mentor_id为空，即分配给HR但还没有分配给带教老师)
    const unassignedLeads = await User.countDocuments({
      role: 'part_time',
      hr_id: { $ne: null },
      mentor_id: null,
      is_deleted: { $ne: true }
    });

    // HR业绩排行榜（按客户数量排序）
    const hrRanking = await User.aggregate([
      {
        $match: {
          role: 'hr',
          is_deleted: { $ne: true }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'hr_id',
          as: 'clients'
        }
      },
      {
        $project: {
          username: 1,
          nickname: 1,
          clientCount: { $size: '$clients' }
        }
      },
      {
        $sort: { clientCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      stats: {
        teamPerformance: teamTotalClients,
        unassignedLeads,
        conversionRate: 0 // 暂时设为0，后续可以计算转化率
      },
      hrRanking
    });
  } catch (error) {
    console.error('获取主管仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

// 带教老师专用仪表盘统计
router.get('/dashboard/mentor', authenticateToken, requireRole(['mentor']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 待审核任务数 (status: pending)
    const pendingReviews = await ImageReview.countDocuments({
      status: 'pending'
    });

    // 我的活跃客户数（分配给我的用户数量）
    const activeClients = await User.countDocuments({
      role: 'part_time',
      mentor_id: req.user._id,
      is_deleted: { $ne: true }
    });

    // 今日已审核数（今日更新的审核记录）
    const completedToday = await ImageReview.countDocuments({
      status: { $in: ['mentor_approved', 'completed', 'rejected'] },
      updatedAt: { $gte: today, $lt: tomorrow }
    });

    // 最近的 5 条待审核任务
    const recentPendingReviews = await ImageReview.find({
      status: 'pending'
    })
    .populate('userId', 'username nickname')
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      success: true,
      stats: {
        pendingReviews,
        activeClients,
        completedToday
      },
      pendingReviewsList: recentPendingReviews
    });
  } catch (error) {
    console.error('获取客服仪表盘数据失败:', error);
    res.status(500).json({ success: false, message: '获取数据失败' });
  }
});

module.exports = router;