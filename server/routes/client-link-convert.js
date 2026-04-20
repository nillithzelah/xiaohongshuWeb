/**
 * 客户端短链接转换相关路由
 *
 * 从原 client.js 拆分出来的短链接转换功能：
 * - 获取待转换短链接的笔记列表
 * - 上传转换后的短链接
 * - 上报短链接转换失败
 */

const express = require('express');
const DiscoveredNote = require('../models/DiscoveredNote');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('LinkConvert');

/**
 * 获取待转换短链接的笔记列表
 * GET /xiaohongshu/api/client/link-convert/pending
 */
router.get('/link-convert/pending', async (req, res) => {
  try {
    const { limit = 10, clientId } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10分钟

    // 清理超时的锁（超过10分钟）
    await DiscoveredNote.updateMany(
      {
        'shortUrlProcessingLock.lockedUntil': { $lt: now }
      },
      {
        $unset: { shortUrlProcessingLock: 1 }
      }
    );

    // 原子性地查询并锁定任务（防止竞态条件）
    const tasks = await DiscoveredNote.find({
      shortUrl: null,
      $or: [
        { shortUrlProcessingLock: { $exists: false } },
        { 'shortUrlProcessingLock.lockedUntil': { $lt: now } }
      ]
    })
    .sort({ createdAt: 1 })  // 按创建时间排序，优先处理旧笔记
    .limit(limitNum)
    .select('_id noteUrl title')
    .lean();

    if (tasks.length === 0) {
      return res.json({
        success: true,
        tasks: []
      });
    }

    // 使用 findOneAndUpdate 原子性地锁定每个任务
    const taskIds = tasks.map(t => t._id);
    const lockedTasks = [];

    for (const taskId of taskIds) {
      const locked = await DiscoveredNote.findOneAndUpdate(
        {
          _id: taskId,
          $or: [
            { shortUrlProcessingLock: { $exists: false } },
            { 'shortUrlProcessingLock.lockedUntil': { $lt: now } }
          ]
        },
        {
          $set: {
            shortUrlProcessingLock: {
              clientId: clientId || null,
              lockedAt: now,
              lockedUntil: lockedUntil
            }
          }
        },
        { new: true }
      );

      if (locked) {
        lockedTasks.push(locked);
      }
    }

    log.info(`📋 [短链接转换] 分配 ${lockedTasks.length} 个任务给客户端 ${clientId || 'unknown'}`);

    res.json({
      success: true,
      tasks: lockedTasks
    });

  } catch (error) {
    log.error('❌ [短链接转换] 获取任务失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 上传转换后的短链接
 * POST /xiaohongshu/api/client/link-convert/update
 */
router.post('/link-convert/update', async (req, res) => {
  try {
    const { noteId, shortUrl } = req.body;

    if (!noteId || !shortUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: noteId, shortUrl'
      });
    }

    // 验证短链接格式
    if (!shortUrl.includes('xhslink.com')) {
      return res.status(400).json({
        success: false,
        message: '短链接格式错误，必须包含 xhslink.com'
      });
    }

    const note = await DiscoveredNote.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: '笔记不存在'
      });
    }

    // 更新短链接
    note.shortUrl = shortUrl;
    note.shortUrlConvertedAt = new Date();
    // 移除锁定
    note.shortUrlProcessingLock = undefined;
    await note.save();

    log.info(`✅ [短链接转换] 笔记 ${noteId} 已转换为: ${shortUrl}`);

    res.json({
      success: true
    });

  } catch (error) {
    log.error('❌ [短链接转换] 更新失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 上报短链接转换失败
 * POST /xiaohongshu/api/client/link-convert/fail
 */
router.post('/link-convert/fail', async (req, res) => {
  try {
    const { noteId, reason } = req.body;

    if (!noteId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: noteId'
      });
    }

    const note = await DiscoveredNote.findById(noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        message: '笔记不存在'
      });
    }

    // 移除锁定，允许重试
    note.shortUrlProcessingLock = undefined;
    await note.save();

    log.warn(`⚠️ [短链接转换] 笔记 ${noteId} 转换失败: ${reason || '未知原因'}`);

    res.json({
      success: true
    });

  } catch (error) {
    log.error('❌ [短链接转换] 失败上报失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
