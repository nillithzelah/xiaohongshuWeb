const express = require('express');
const router = express.Router();
const ShortLinkPool = require('../models/ShortLinkPool');
const DiscoveredNote = require('../models/DiscoveredNote');

// 锁定时间（毫秒）
const LOCK_TIMEOUT = 10 * 60 * 1000; // 10分钟

/**
 * 添加短链接到池中
 * POST /xiaohongshu/api/short-link-pool/add
 *
 * 外部系统调用此接口添加待审核短链接
 */
router.post('/add', async (req, res) => {
  try {
    const { shortUrl, source = 'external', remark } = req.body;

    if (!shortUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少 shortUrl 参数'
      });
    }

    // 验证短链接格式（必须包含 xhslink.com）
    if (!shortUrl.includes('xhslink.com')) {
      return res.status(400).json({
        success: false,
        message: '短链接格式错误，必须包含 xhslink.com'
      });
    }

    // 检查是否已存在
    const existing = await ShortLinkPool.findOne({ shortUrl });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: '该短链接已存在于池中',
        data: {
          id: existing._id,
          status: existing.status
        }
      });
    }

    // 创建新记录
    const record = await ShortLinkPool.create({
      shortUrl,
      source,
      remark,
      status: 'pending'
    });

    console.log(`✅ [短链接池] 添加成功: ${shortUrl.substring(0, 60)}... (来源: ${source})`);

    res.json({
      success: true,
      message: '短链接添加成功',
      data: {
        id: record._id,
        shortUrl: record.shortUrl,
        status: record.status
      }
    });

  } catch (error) {
    console.error('❌ [短链接池] 添加失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '添加失败'
    });
  }
});

/**
 * 获取最新5条短链接记录（外部接口，无需认证）
 * GET /xiaohongshu/api/short-link-pool/latest
 *
 * 供外部系统查看最新提交的短链接处理状态
 */
router.get('/latest', async (req, res) => {
  try {
    const records = await ShortLinkPool.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('shortUrl status source remark createdAt auditResult')
      .lean();

    console.log(`📋 [短链接池] 获取最新记录: ${records.length} 条`);

    res.json({
      success: true,
      data: {
        count: records.length,
        records: records.map(r => ({
          id: r._id,
          shortUrl: r.shortUrl,
          status: r.status,
          source: r.source,
          remark: r.remark,
          createdAt: r.createdAt,
          // 如果审核完成，返回审核结果
          ...(r.auditResult?.title && {
            auditResult: {
              title: r.auditResult.title,
              author: r.auditResult.author,
              is_genuine_victim_post: r.auditResult.is_genuine_victim_post
            }
          })
        }))
      }
    });

  } catch (error) {
    console.error('❌ [短链接池] 获取最新记录失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取失败'
    });
  }
});

/**
 * 批量添加短链接
 * POST /xiaohongshu/api/short-link-pool/batch-add
 */
router.post('/batch-add', async (req, res) => {
  try {
    const { shortUrls, source = 'external' } = req.body;

    if (!Array.isArray(shortUrls) || shortUrls.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少 shortUrls 数组参数'
      });
    }

    const results = {
      success: [],
      duplicate: [],
      error: []
    };

    for (const shortUrl of shortUrls) {
      try {
        // 验证格式
        if (!shortUrl.includes('xhslink.com')) {
          results.error.push({ shortUrl, reason: '格式错误' });
          continue;
        }

        // 检查是否已存在
        const existing = await ShortLinkPool.findOne({ shortUrl });
        if (existing) {
          results.duplicate.push({ shortUrl, status: existing.status });
          continue;
        }

        // 创建记录
        await ShortLinkPool.create({
          shortUrl,
          source,
          status: 'pending'
        });

        results.success.push(shortUrl);

      } catch (err) {
        results.error.push({ shortUrl, reason: err.message });
      }
    }

    console.log(`✅ [短链接池] 批量添加: 成功 ${results.success.length}, 重复 ${results.duplicate.length}, 失败 ${results.error.length}`);

    res.json({
      success: true,
      message: `批量添加完成: 成功${results.success.length}, 重复${results.duplicate.length}, 失败${results.error.length}`,
      data: results
    });

  } catch (error) {
    console.error('❌ [短链接池] 批量添加失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '批量添加失败'
    });
  }
});

/**
 * 获取待处理的短链接
 * GET /xiaohongshu/api/short-link-pool/pending
 *
 * 审核客户端调用此接口获取待处理任务
 */
router.get('/pending', async (req, res) => {
  try {
    const { limit = 10, clientId } = req.query;

    // 清理超时的锁
    await ShortLinkPool.updateMany(
      {
        status: 'processing',
        'processingLock.lockedUntil': { $lt: new Date() }
      },
      {
        $set: { status: 'pending' },
        $unset: { processingLock: 1 }
      }
    );

    // 使用原子操作查找并锁定待处理记录
    const records = await ShortLinkPool.find({
      status: 'pending',
      $or: [
        { processingLock: { $exists: false } },
        { 'processingLock.lockedUntil': { $lt: new Date() } },
        { processingLock: { $eq: {} } }  // 处理空锁定对象
      ]
    })
      .sort({ createdAt: 1 })
      .limit(parseInt(limit));

    // 锁定记录
    const lockedUntil = new Date(Date.now() + LOCK_TIMEOUT);
    const updateResults = await Promise.all(records.map(async (record) => {
      const updated = await ShortLinkPool.findOneAndUpdate(
        { _id: record._id, status: 'pending' },
        {
          $set: {
            status: 'processing',
            processingLock: {
              clientId: clientId || null,
              lockedAt: new Date(),
              lockedUntil: lockedUntil
            }
          }
        },
        { new: true }
      );
      return updated;
    }));

    // 过滤出成功锁定的记录
    const lockedRecords = updateResults.filter(r => r !== null && r.status === 'processing');

    if (lockedRecords.length > 0) {
      console.log(`📥 [短链接池] 分配 ${lockedRecords.length} 个待处理任务给客户端 ${clientId || 'unknown'}`);
    }

    res.json({
      success: true,
      data: {
        tasks: lockedRecords.map(r => ({
          id: r._id,
          shortUrl: r.shortUrl,
          source: r.source,
          remark: r.remark
        })),
        count: lockedRecords.length,
        lockedUntil: lockedUntil
      }
    });

  } catch (error) {
    console.error('❌ [短链接池] 获取待处理任务失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取失败'
    });
  }
});

/**
 * 审核通过
 * POST /xiaohongshu/api/short-link-pool/:id/approve
 *
 * 审核客户端调用此接口，将审核通过的笔记写入DiscoveredNote
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { noteData, clientId } = req.body;

    const shortLinkRecord = await ShortLinkPool.findById(id);
    if (!shortLinkRecord) {
      return res.status(404).json({
        success: false,
        message: '短链接记录不存在'
      });
    }

    // 检查是否已处理
    if (shortLinkRecord.status === 'approved') {
      return res.json({
        success: true,
        message: '该短链接已审核通过',
        data: { discoveredNoteId: shortLinkRecord.discoveredNoteId }
      });
    }

    // 构建DiscoveredNote数据
    const discoveredNoteData = {
      noteUrl: noteData.noteUrl || shortLinkRecord.shortUrl,
      noteId: noteData.noteId || null,
      title: noteData.title || '',
      author: noteData.author || '',
      publishTime: noteData.publishTime || null,
      keyword: noteData.keyword || 'short-link-pool',
      aiAnalysis: {
        is_genuine_victim_post: noteData.aiAnalysis?.is_genuine_victim_post || true,
        confidence_score: noteData.aiAnalysis?.confidence_score || 0,
        reason: noteData.aiAnalysis?.reason || '来自短链接池审核'
      },
      status: 'discovered',
      clientId: clientId,
      shortUrl: shortLinkRecord.shortUrl,
      shortUrlConvertedAt: new Date()
    };

    // 创建DiscoveredNote记录
    const discoveredNote = await DiscoveredNote.create(discoveredNoteData);

    // 更新短链接池记录
    shortLinkRecord.status = 'approved';
    shortLinkRecord.noteId = discoveredNoteData.noteId;
    shortLinkRecord.auditResult = {
      is_genuine_victim_post: discoveredNoteData.aiAnalysis.is_genuine_victim_post,
      confidence_score: discoveredNoteData.aiAnalysis.confidence_score,
      reason: discoveredNoteData.aiAnalysis.reason,
      title: discoveredNoteData.title,
      author: discoveredNoteData.author
    };
    shortLinkRecord.processedBy = clientId;
    shortLinkRecord.discoveredNoteId = discoveredNote._id;
    shortLinkRecord.processingLock = undefined;
    await shortLinkRecord.save();

    console.log(`✅ [短链接池] 审核通过: ${shortLinkRecord.shortUrl.substring(0, 60)}... → DiscoveredNote: ${discoveredNote._id}`);

    res.json({
      success: true,
      message: '审核通过，已写入笔记发现管理',
      data: {
        shortLinkPoolId: id,
        discoveredNoteId: discoveredNote._id
      }
    });

  } catch (error) {
    console.error('❌ [短链接池] 审核通过处理失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '处理失败'
    });
  }
});

/**
 * 审核拒绝
 * POST /xiaohongshu/api/short-link-pool/:id/reject
 *
 * 审核客户端调用此接口，标记审核不通过
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, clientId } = req.body;

    const record = await ShortLinkPool.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '短链接记录不存在'
      });
    }

    record.status = 'rejected';
    record.errorMessage = reason || '审核不通过';
    record.processedBy = clientId;
    record.processingLock = undefined;
    await record.save();

    console.log(`❌ [短链接池] 审核拒绝: ${record.shortUrl.substring(0, 60)}... (原因: ${reason || '未提供'})`);

    res.json({
      success: true,
      message: '已标记为审核拒绝'
    });

  } catch (error) {
    console.error('❌ [短链接池] 审核拒绝处理失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '处理失败'
    });
  }
});

/**
 * 释放锁（失败重试）
 * POST /xiaohongshu/api/short-link-pool/:id/release
 *
 * 审核失败时调用，释放锁以便下次重试
 */
router.post('/:id/release', async (req, res) => {
  try {
    const { id } = req.params;
    const { errorMessage, incrementRetry = true } = req.body;

    const record = await ShortLinkPool.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '短链接记录不存在'
      });
    }

    // 增加重试次数
    if (incrementRetry) {
      record.retryCount = (record.retryCount || 0) + 1;
    }

    // 超过最大重试次数，标记为失败
    const MAX_RETRY = 3;
    if (record.retryCount >= MAX_RETRY) {
      record.status = 'failed';
      record.errorMessage = errorMessage || `超过最大重试次数(${MAX_RETRY})`;
      record.processingLock = undefined;
      await record.save();

      console.log(`⚠️ [短链接池] 标记为失败: ${record.shortUrl.substring(0, 60)}... (重试${record.retryCount}次)`);

      return res.json({
        success: true,
        message: `超过最大重试次数，已标记为失败`,
        data: { status: 'failed' }
      });
    }

    // 释放锁，重新变为待处理
    record.status = 'pending';
    record.errorMessage = errorMessage;
    record.processingLock = undefined;
    await record.save();

    console.log(`🔄 [短链接池] 释放锁: ${record.shortUrl.substring(0, 60)}... (重试: ${record.retryCount})`);

    res.json({
      success: true,
      message: '已释放锁，可重新处理',
      data: { retryCount: record.retryCount }
    });

  } catch (error) {
    console.error('❌ [短链接池] 释放锁失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '释放失败'
    });
  }
});

/**
 * 获取统计信息
 * GET /xiaohongshu/api/short-link-pool/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const total = await ShortLinkPool.countDocuments();
    const pending = await ShortLinkPool.countDocuments({ status: 'pending' });
    const processing = await ShortLinkPool.countDocuments({ status: 'processing' });
    const approved = await ShortLinkPool.countDocuments({ status: 'approved' });
    const rejected = await ShortLinkPool.countDocuments({ status: 'rejected' });
    const failed = await ShortLinkPool.countDocuments({ status: 'failed' });

    const result = {
      total,
      pending,
      processing,
      approved,
      rejected,
      failed
    };

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ [短链接池] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取统计失败'
    });
  }
});

/**
 * 获取短链接列表
 * GET /xiaohongshu/api/short-link-pool/list
 */
router.get('/list', async (req, res) => {
  try {
    const { status, limit = 50, skip = 0, source } = req.query;

    const query = {};
    if (status) query.status = status;
    if (source) query.source = source;

    const shortLinks = await ShortLinkPool.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await ShortLinkPool.countDocuments(query);

    res.json({
      success: true,
      data: {
        shortLinks,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      }
    });

  } catch (error) {
    console.error('❌ [短链接池] 获取列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取列表失败'
    });
  }
});

/**
 * 删除短链接记录
 * DELETE /xiaohongshu/api/short-link-pool/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await ShortLinkPool.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '短链接记录不存在'
      });
    }

    await ShortLinkPool.deleteOne({ _id: id });

    console.log(`🗑️ [短链接池] 删除记录: ${record.shortUrl.substring(0, 60)}...`);

    res.json({
      success: true,
      message: '删除成功'
    });

  } catch (error) {
    console.error('❌ [短链接池] 删除失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '删除失败'
    });
  }
});

/**
 * 重新处理失败的短链接
 * POST /xiaohongshu/api/short-link-pool/:id/retry
 */
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;

    const record = await ShortLinkPool.findById(id);
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '短链接记录不存在'
      });
    }

    // 只有失败或拒绝状态才能重试
    if (record.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: '已审核通过的记录无需重试'
      });
    }

    // 重置状态为待处理，清空错误信息，重置锁
    record.status = 'pending';
    record.errorMessage = null;
    record.processingLock = undefined;
    await record.save();

    console.log(`🔄 [短链接池] 重新加入处理队列: ${record.shortUrl.substring(0, 60)}...`);

    res.json({
      success: true,
      message: '已重新加入处理队列'
    });

  } catch (error) {
    console.error('❌ [短链接池] 重试失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '重试失败'
    });
  }
});

module.exports = router;
