/**
 * 评论线索管理路由模块
 *
 * 从 admin.js 拆分出的评论线索相关路由
 * 包含：评论线索统计、评论线索列表、评论黑名单管理
 */

const express = require('express');
const CommentLead = require('../../models/CommentLead');
const CommentBlacklist = require('../../models/CommentBlacklist');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();
const log = logger.module('CommentLeads');

// ==================== 评论线索统计 ====================

/**
 * 获取评论线索统计
 * GET /comment-leads/stats
 */
router.get('/stats', authenticateToken, requireRole(['boss', 'manager', 'promoter']), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalStats, todayStats] = await Promise.all([
      // 总计统计
      CommentLead.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // 今日统计
      CommentLead.aggregate([
        { $match: { discoverTime: { $gte: today } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const stats = {
      total: totalStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      today: todayStats.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {})
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    log.error('获取评论线索统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取评论线索统计失败'
    });
  }
});

/**
 * 获取评论线索列表
 * GET /comment-leads
 */
router.get('/', authenticateToken, requireRole(['boss', 'manager', 'promoter']), async (req, res) => {
  try {
    const { limit = 50, skip = 0, status, keyword, sort = '-discoverTime' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (keyword) query.keyword = new RegExp(keyword, 'i');

    const leads = await CommentLead.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await CommentLead.countDocuments(query);

    res.json({
      success: true,
      data: leads,
      pagination: { total, limit: parseInt(limit), skip: parseInt(skip) }
    });
  } catch (error) {
    log.error('获取评论线索列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取评论线索列表失败'
    });
  }
});

// ==================== 评论黑名单管理 ====================

/**
 * 获取评论黑名单列表
 * GET /comment-blacklist
 */
router.get('/blacklist', authenticateToken, requireRole(['boss', 'manager', 'promoter']), async (req, res) => {
  try {
    const list = await CommentBlacklist.find()
      .sort({ keyword: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: list
    });
  } catch (error) {
    log.error('获取评论黑名单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取评论黑名单列表失败'
    });
  }
});

/**
 * 添加评论到黑名单
 * POST /comment-blacklist
 */
router.post('/', authenticateToken, requireRole(['boss', 'manager', 'promoter']), async (req, res) => {
  try {
    const { keyword, text } = req.body;

    if (!keyword || !text) {
      return res.status(400).json({
        success: false,
        message: '关键词和内容不能为空'
      });
    }

    // 检查是否已存在
    const existing = await CommentBlacklist.findOne({ keyword });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '该关键词已在黑名单中'
      });
    }

    const blacklist = new CommentBlacklist({
      keyword,
      text,
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: '添加成功'
    });
  } catch (error) {
    log.error('添加评论到黑名单失败:', error);
    res.status(500).json({
      success: false,
      message: '添加评论到黑名单失败'
    });
  }
});

/**
 * 从黑名单中移除评论
 * DELETE /comment-blacklist/:keyword
 */
router.delete('/blacklist/:keyword', authenticateToken, requireRole(['boss', 'manager', 'promoter']), async (req, res) => {
  try {
    const { keyword } = req.params;

    const result = await CommentBlacklist.deleteOne({ keyword });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '该关键词不在黑名单中'
      });
    }

    res.json({
      success: true,
      message: '移除成功'
    });
  } catch (error) {
    log.error('从黑名单中移除评论失败:', error);
    res.status(500).json({
      success: false,
      message: '从黑名单中移除评论失败'
    });
  }
});

module.exports = router;
