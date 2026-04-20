/**
 * 客户端采集和评论线索相关路由
 *
 * 从原 client.js 拆分出来的采集和评论管理功能：
 * - 标记笔记评论已采集
 * - 获取待采集笔记队列
 * - 提交评论线索
 * - 获取评论线索列表
 * - 获取评论线索统计
 * - 黑名单管理（获取/添加/删除）
 */

const express = require('express');
const DiscoveredNote = require('../models/DiscoveredNote');
const CommentLead = require('../models/CommentLead');
const CommentBlacklist = require('../models/CommentBlacklist');
const SystemConfig = require('../models/SystemConfig');
const aiAnalysis = require('../services/aiContentAnalysisService');
const clientHealthService = require('../services/clientHealthService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('Harvest');

// ==================== 采集队列管理 ====================

/**
 * 标记笔记评论已采集
 * POST /xiaohongshu/api/client/harvest/complete
 *
 * 客户端采集评论成功后调用
 *
 * 新增参数 lastCommentTime：笔记内最新评论的时间（用于计算下次采集间隔）
 */
router.post('/harvest/complete', async (req, res) => {
  try {
    const { noteUrl, commentCount = 0, lastCommentTime, clientId, validLeads = 0, harvestPriority } = req.body;

    if (!noteUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少 noteUrl 参数'
      });
    }

    // 构建更新数据
    const updateData = {
      commentsHarvested: true,
      commentsHarvestedAt: new Date(),
      lastCommentCount: commentCount
    };

    // 如果提供了最新评论时间，更新它
    if (lastCommentTime) {
      updateData.lastCommentTime = new Date(lastCommentTime);
    }

    // 如果客户端提供了优先级，更新它
    if (harvestPriority !== undefined) {
      updateData.harvestPriority = harvestPriority;
    }

    const result = await DiscoveredNote.updateOne(
      { noteUrl: noteUrl },
      updateData
    );

    if (result.matchedCount > 0) {
      const timeInfo = lastCommentTime ? ` (最新评论: ${new Date(lastCommentTime).toLocaleString('zh-CN')})` : '';
      const priorityInfo = harvestPriority !== undefined ? ` [优先级:${harvestPriority}]` : '';
      log.info(`✅ [采集队列] 已标记评论采集完成: ${noteUrl.substring(0, 60)}... (${commentCount}条)${timeInfo}${priorityInfo}`);
    }

    // 记录任务成功（更新客户端健康度和今日统计）
    if (clientId) {
      await clientHealthService.recordTaskSuccess(clientId, 'harvest', {
        commentsCollected: commentCount,
        validLeads: validLeads
      });
    }

    res.json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    log.error('❌ [采集队列] 标记完成失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取待采集笔记队列
 * GET /xiaohongshu/api/client/harvest/pending
 *
 * 采集优先级说明：
 * - 10（最高级）→ 每10分钟采集
 * - 5（第二级） → 每1小时采集
 * - 2（第三级） → 每6小时采集
 * - 1（默认级） → 每24小时采集
 */
router.get('/harvest/pending', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const now = new Date();

    // 1. 从 SystemConfig 获取优先级间隔配置
    const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
    const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

    // 2. 构建查询条件（与页面 /discovery/harvest-queue 一致）
    const query = { noteStatus: 'active' };
    const canHarvestConditions = [];

    // 根据每个优先级构建条件
    for (const [priority, minutes] of Object.entries(intervals)) {
      const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
      canHarvestConditions.push({
        harvestPriority: parseInt(priority),
        $or: [
          { commentsHarvestedAt: { $exists: false } },
          { commentsHarvestedAt: null },
          { commentsHarvestedAt: { $lte: cutoffTime } }
        ]
      });
    }

    // 添加默认优先级条件（用于没有设置 harvestPriority 的笔记）
    const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
    canHarvestConditions.push({
      harvestPriority: { $exists: false },
      $or: [
        { commentsHarvestedAt: { $exists: false } },
        { commentsHarvestedAt: null },
        { commentsHarvestedAt: { $lte: defaultCutoff } }
      ]
    });

    query.$or = canHarvestConditions;

    // 调试：输出查询条件
    log.info(`🔍 [采集队列] 查询条件: ${canHarvestConditions.length} 个优先级条件`);

    // 3. 查询并按优先级排序
    const notes = await DiscoveredNote.find(query)
      .select('noteUrl noteId title author keyword commentsHarvestedAt harvestPriority discoverTime createdAt')
      .sort({ harvestPriority: -1, discoverTime: -1 })
      .limit(parseInt(limit))
      .lean();

    log.info(`📥 [采集客户端] 返回 ${notes.length} 个待采集评论的笔记`);

    res.json({
      success: true,
      data: {
        notes: notes,
        count: notes.length
      }
    });

  } catch (error) {
    log.error('❌ [采集客户端] 获取失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 评论线索管理 ====================

/**
 * AI分析评论是否为引流/同行
 */
function analyzeCommentForSpam(content) {
  if (!content || typeof content !== 'string') {
    return { isSpam: false, reason: '', type: '', confidence: 0 };
  }

  const text = content.toLowerCase().trim();

  // 引流特征
  const spamPhrases = [
    '可以问我', '不会可以问', '来问我', '问我',
    '私信我', '加我', '联系我', '找我',
    '我有方法', '我有渠道', '我帮你', '帮你',
    '我成功了，可以问', '成功，可以问'
  ];

  // 同行/帮助者特征（已经成功的）
  const helperPhrases = [
    '我已经要回来了', '已经要回来了', '要回来了',
    '我成功退了', '成功退了', '我退了',
    '我已经退了', '已经退了',
    '我试过', '真的可以', '可以退',
    '不难的', '有记录就好了', '保留记录可以',
    '得亏最后', '幸好最后'
  ];

  // 检查引流
  for (const phrase of spamPhrases) {
    if (text.includes(phrase)) {
      return {
        isSpam: true,
        reason: `引流: "${phrase}"`,
        type: '引流',
        confidence: 0.95
      };
    }
  }

  // 检查同行/帮助者（已经成功的）
  for (const phrase of helperPhrases) {
    if (text.includes(phrase)) {
      return {
        isSpam: true,
        reason: `同行/帮助者: "${phrase}"`,
        type: '帮助者',
        confidence: 0.85
      };
    }
  }

  // 不是引流
  return {
    isSpam: false,
    reason: '',
    type: '',
    confidence: 0
  };
}

/**
 * 提交评论线索（客户端采集）
 * POST /xiaohongshu/api/client/comments/submit
 */
router.post('/comments/submit', async (req, res) => {
  try {
    const {
      noteUrl,
      noteId,
      noteTitle,
      noteAuthor,
      keyword,
      comments, // 评论数组 [{commentAuthor, commentAuthorId, commentContent, commentUrl, commentTime}]
      clientId
    } = req.body;

    if (!noteUrl || !comments || !Array.isArray(comments)) {
      return res.status(400).json({
        success: false,
        message: '参数错误'
      });
    }

    const results = {
      added: 0,
      blacklisted: 0,
      skipped: 0,
      details: []
    };

    // 获取当前有效的黑名单（未过期的）
    const blacklistedNicknames = await CommentBlacklist.find({
      expireAt: { $gt: new Date() }
    }).distinct('nickname');

    for (const comment of comments) {
      const { commentAuthor, commentAuthorId, commentContent, commentUrl, commentTime, commentId } = comment;

      // 检查是否在黑名单中
      if (blacklistedNicknames.includes(commentAuthor)) {
        results.blacklisted++;
        results.details.push({ nickname: commentAuthor, action: 'blacklisted' });
        continue;
      }

      // 检查是否已存在
      const existing = await CommentLead.findOne({
        noteUrl: noteUrl,
        commentAuthor: commentAuthor
      });

      if (existing) {
        results.skipped++;
        continue;
      }

      // AI分析判断是否为潜在客户/引流/同行
      let aiResult;
      try {
        aiResult = await aiAnalysis.analyzeComment(commentContent, noteTitle);
      } catch (error) {
        log.error('AI分析评论失败，使用默认处理:', error.message);
        // AI失败时默认作为潜在客户保留
        aiResult = {
          isPotentialLead: true,
          category: 'uncertain',
          confidence_score: 0.3,
          reason: 'AI分析失败，默认保留',
          shouldContact: true,
          riskLevel: 'low'
        };
      }

      // 根据 AI 结果分类处理
      if (aiResult.category === 'spam') {
        // 引流 - 加入黑名单
        await CommentBlacklist.findOneAndUpdate(
          { nickname: commentAuthor },
          {
            nickname: commentAuthor,
            userId: commentAuthorId || '',
            reason: 'AI检测:引流',
            commentContent: commentContent,
            $inc: { reportCount: 1 },
            lastSeenAt: new Date(),
            clientId: clientId || null
          },
          { upsert: true, new: true }
        );
        results.blacklisted++;
        results.details.push({ nickname: commentAuthor, action: 'blacklisted', reason: aiResult.reason });
        continue;
      }

      if (aiResult.category === 'author') {
        // 作者回复 - 跳过
        results.skipped++;
        results.details.push({ nickname: commentAuthor, action: 'skipped', reason: `${aiResult.category}: ${aiResult.reason}` });
        continue;
      }

      // noise 也通过，保存为线索（只要不是引流或作者）

      // 保存潜在客户线索
      await CommentLead.create({
        noteUrl: noteUrl,
        noteId: noteId || '',
        noteTitle: noteTitle || '',
        noteAuthor: noteAuthor || '',
        keyword: keyword || '',
        commentAuthor: commentAuthor || '',
        commentAuthorId: commentAuthorId || '',
        commentContent: commentContent || '',
        commentId: commentId || '',
        commentUrl: commentUrl || '',
        commentTime: commentTime ? new Date(commentTime) : null,
        aiAnalysis: {
          isSpam: false,
          type: aiResult.category,
          reason: aiResult.reason,
          confidence: aiResult.confidence_score,
          shouldContact: aiResult.shouldContact,
          riskLevel: aiResult.riskLevel
        },
        clientId: clientId || null,
        discoverTime: new Date()
      });
      results.added++;
      results.details.push({ nickname: commentAuthor, action: 'added', aiCategory: aiResult.category });
    }

    log.info(`📝 [评论线索] 提交完成: 新增${results.added}, 黑名单${results.blacklisted}, 跳过${results.skipped}`);

    // 记录任务成功（更新客户端健康度和今日统计）
    if (clientId) {
      await clientHealthService.recordTaskSuccess(clientId, 'blacklist-scan', {
        commentsScanned: comments.length,
        blacklisted: results.blacklisted
      });
    }

    // 更新 DiscoveredNote 的评论采集状态
    if (results.added > 0 && noteUrl) {
      try {
        await DiscoveredNote.updateOne(
          { noteUrl: noteUrl },
          {
            commentsHarvested: true,
            commentsHarvestedAt: new Date(),
            lastCommentCount: results.added
          }
        );
        log.info(`✅ [采集队列] 已更新笔记评论采集状态: ${noteUrl.substring(0, 60)}... (${results.added}条)`);
      } catch (updateError) {
        log.error('⚠️ [采集队列] 更新笔记状态失败:', updateError.message);
        // 更新失败不影响主流程返回
      }
    }

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    log.error('❌ [评论线索] 提交失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取评论线索列表（支持筛选和搜索）
 * GET /xiaohongshu/api/client/comments/list
 */
router.get('/comments/list', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      keyword,
      startDate,
      endDate,
      skip = 0,
      limit = 50
    } = req.query;

    const query = {};

    // 状态筛选
    if (status) query.status = status;

    // 关键词搜索（搜索评论者和评论内容）
    if (keyword && keyword.trim()) {
      query.$or = [
        { commentAuthor: { $regex: keyword.trim(), $options: 'i' } },
        { commentContent: { $regex: keyword.trim(), $options: 'i' } },
        { noteTitle: { $regex: keyword.trim(), $options: 'i' } }
      ];
    }

    // 日期范围筛选
    if (startDate || endDate) {
      query.discoverTime = {};
      if (startDate) {
        // 开始日期：设置为当天 00:00:00
        query.discoverTime.$gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        // 结束日期：设置为当天 23:59:59
        query.discoverTime.$lte = new Date(endDate + 'T23:59:59');
      }
    }

    const total = await CommentLead.countDocuments(query);
    const leads = await CommentLead.find(query)
      .populate('lastOperatedBy', 'username nickname')
      .sort({ discoverTime: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        leads: leads,
        pagination: { total, skip: parseInt(skip), limit: parseInt(limit) }
      }
    });

  } catch (error) {
    log.error('❌ [评论线索] 获取列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取评论线索统计
 * GET /xiaohongshu/api/client/comments/stats
 */
router.get('/comments/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      total: await CommentLead.countDocuments(),
      pending: await CommentLead.countDocuments({ status: 'pending' }),
      contacted: await CommentLead.countDocuments({ status: 'contacted' }),
      converted: await CommentLead.countDocuments({ status: 'converted' }),
      today: await CommentLead.countDocuments({
        discoverTime: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    log.error('❌ [评论线索] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新评论线索状态
 * PATCH /xiaohongshu/api/client/comments/:id/status
 */
router.patch('/comments/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }

    const updateData = {
      status,
      lastOperatedBy: req.user._id,
      lastOperatedAt: new Date()
    };

    if (notes !== undefined) {
      updateData['followUp.notes'] = notes;
    }

    // 根据状态自动更新跟进信息
    if (status === 'contacted') {
      updateData['followUp.contacted'] = true;
      updateData['followUp.contactedAt'] = new Date();
    } else if (status === 'converted') {
      updateData['followUp.contacted'] = true; // 既然转化了，肯定联系过
    }

    const lead = await CommentLead.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate('lastOperatedBy', 'username nickname');

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: '未找到该线索'
      });
    }

    log.info(`📝 [评论线索] 状态更新: ${lead.commentAuthor} -> ${status} (操作人: ${req.user.username})`);

    res.json({
      success: true,
      data: lead
    });

  } catch (error) {
    log.error('❌ [评论线索] 更新状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 将评论作者加入黑名单并标记线索无效
 * POST /xiaohongshu/api/client/comments/:id/blacklist
 */
router.post('/comments/:id/blacklist', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '引流' } = req.body;

    const lead = await CommentLead.findById(id);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: '未找到该线索'
      });
    }

    // 1. 添加到黑名单 (默认7天过期)
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 7);

    await CommentBlacklist.findOneAndUpdate(
      { nickname: lead.commentAuthor },
      {
        nickname: lead.commentAuthor,
        userId: lead.commentAuthorId || '',
        reason: reason,
        commentContent: lead.commentContent,
        $inc: { reportCount: 1 },
        lastSeenAt: new Date(),
        expireAt: expireAt
      },
      { upsert: true, new: true }
    );

    // 2. 标记线索状态为无效
    lead.status = 'invalid';
    lead.lastOperatedBy = req.user._id;
    lead.lastOperatedAt = new Date();
    await lead.save();

    log.info(`🚫 [评论线索] 加入黑名单并标记无效: ${lead.commentAuthor} (操作人: ${req.user.username})`);

    res.json({
      success: true,
      message: '已成功加入黑名单并标记线索无效'
    });

  } catch (error) {
    log.error('❌ [评论线索] 黑名单操作失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 评论黑名单管理 ====================

/**
 * 获取黑名单列表（客户端专用，无需认证）
 * GET /xiaohongshu/api/client/comments/blacklist
 */
router.get('/comments/blacklist', async (req, res) => {
  try {
    const blacklist = await CommentBlacklist.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: blacklist
    });

  } catch (error) {
    log.error('❌ [评论黑名单] 获取失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取黑名单列表（客户端专用，支持clientId，只返回未过期的）
 * GET /xiaohongshu/api/client/comments/blacklist/client
 */
router.get('/comments/blacklist/client', async (req, res) => {
  try {
    const { clientId } = req.query;

    // 只返回未过期的黑名单记录
    const blacklist = await CommentBlacklist.find({
      $or: [
        { expireAt: { $gt: new Date() } },  // 未过期
        { expireAt: null }                   // 永久黑名单
      ]
    })
      .sort({ createdAt: -1 })
      .limit(500);

    log.info(`🚫 [黑名单] 客户端 ${clientId || 'unknown'} 获取黑名单: ${blacklist.length} 条`);

    res.json({
      success: true,
      data: blacklist
    });

  } catch (error) {
    log.error('❌ [评论黑名单] 获取失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 添加昵称到黑名单（客户端专用，支持clientId）
 * POST /xiaohongshu/api/client/comments/blacklist/client
 */
router.post('/comments/blacklist/client', async (req, res) => {
  try {
    const { nickname, commentContent, reason, clientId } = req.body;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        message: '昵称不能为空'
      });
    }

    // 检查是否已存在
    const existing = await CommentBlacklist.findOne({ nickname });
    if (existing) {
      // 更新现有记录
      await CommentBlacklist.updateOne(
        { nickname },
        {
          $inc: { reportCount: 1 },
          commentContent: commentContent || existing.commentContent,
          reason: reason || existing.reason,
          lastSeenAt: new Date()
        }
      );
      log.info(`🚫 [黑名单] 更新: ${nickname} (举报次数: ${(existing.reportCount || 0) + 1}, 客户端: ${clientId || 'unknown'})`);
    } else {
      // 创建新记录（默认7天过期）
      const expireAt = new Date();
      expireAt.setDate(expireAt.getDate() + 7);

      await CommentBlacklist.create({
        nickname,
        commentContent,
        reason: reason || '引流',
        expireAt,
        clientId
      });
      log.info(`🚫 [黑名单] 新增: ${nickname} (原因: ${reason || '引流'}, 客户端: ${clientId || 'unknown'})`);
    }

    res.json({
      success: true,
      message: '已添加到黑名单'
    });

  } catch (error) {
    log.error('❌ [评论黑名单] 添加失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 添加昵称到黑名单（客户端专用，无需认证）
 * POST /xiaohongshu/api/client/comments/blacklist
 */
router.post('/comments/blacklist', async (req, res) => {
  try {
    const { nickname, commentContent, reason } = req.body;

    if (!nickname) {
      return res.status(400).json({
        success: false,
        message: '昵称不能为空'
      });
    }

    // 检查是否已存在
    const existing = await CommentBlacklist.findOne({ nickname });
    if (existing) {
      // 更新现有记录
      await CommentBlacklist.updateOne(
        { nickname },
        {
          $inc: { reportCount: 1 },
          commentContent: commentContent || existing.commentContent,
          reason: reason || existing.reason,
          lastSeenAt: new Date()
        }
      );
      return res.json({
        success: true,
        message: '黑名单记录已更新',
        data: { updated: true }
      });
    }

    // 创建新记录
    await CommentBlacklist.create({
      nickname,
      userId: '',
      commentContent: commentContent || '',
      reason: reason || '引流',
      reportCount: 1,
      lastSeenAt: new Date()
    });

    log.info(`🚫 [黑名单] 客户端添加: ${nickname} (${reason || '引流'})`);

    res.json({
      success: true,
      message: '已添加到黑名单',
      data: { added: true }
    });

  } catch (error) {
    log.error('❌ [黑名单] 添加失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 从黑名单删除（解封）
 * DELETE /xiaohongshu/api/client/comments/blacklist/:nickname
 */
router.delete('/comments/blacklist/:nickname', authenticateToken, async (req, res) => {
  try {
    const { nickname } = req.params;

    const result = await CommentBlacklist.deleteOne({ nickname });

    res.json({
      success: true,
      message: result.deletedCount > 0 ? '已从黑名单移除' : '未找到该用户',
      data: { deletedCount: result.deletedCount }
    });

  } catch (error) {
    log.error('❌ [评论黑名单] 删除失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
