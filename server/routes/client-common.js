/**
 * 客户端通用路由
 *
 * 从原 client.js 拆分出来的通用功能：
 * - 系统公告管理
 * - 版本检查
 * - 心跳接口
 * - 验证结果上报（单个/批量）
 * - 客户端状态上报
 * - 错误日志上报
 * - Cookie 状态上报
 * - AI 分析接口
 */

const express = require('express');
const ImageReview = require('../models/ImageReview');
const ClientHeartbeat = require('../models/ClientHeartbeat');
const CommentLimit = require('../models/CommentLimit');
const aiContentAnalysisService = require('../services/aiContentAnalysisService');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('ClientCommon');

// 验证 ObjectId 格式
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// ==================== 系统公告管理 ====================

/**
 * 获取系统公告（从数据库）
 * GET /xiaohongshu/api/client/announcements
 */
router.get('/announcements', async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');

    // 获取所有启用的公告，按置顶和排序
    const announcements = await Announcement.find({ enabled: true })
      .sort({ isPinned: -1, order: 1, createdAt: -1 })
      .select('title content type actionType actionData textColor fontSize');

    // 返回公告列表
    const summaries = announcements.map(a => ({
      id: a._id,
      title: a.title,
      content: a.content,
      type: a.type,
      actionType: a.actionType,
      actionData: a.actionData,
      textColor: a.textColor,
      fontSize: a.fontSize
    }));

    res.json({
      success: true,
      announcements: summaries
    });
  } catch (error) {
    log.error('获取公告错误:', error);
    // 降级处理：返回空数组而不是错误，避免小程序崩溃
    res.json({
      success: true,
      announcements: []
    });
  }
});

/**
 * 获取单条公告详情（富文本内容）
 * GET /xiaohongshu/api/client/announcement/:id
 */
router.get('/announcement/:id', async (req, res) => {
  try {
    const Announcement = require('../models/Announcement');
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    res.json({
      success: true,
      data: announcement
    });
  } catch (error) {
    log.error('获取公告详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取公告详情失败'
    });
  }
});

// ==================== 版本检查 ====================

/**
 * 版本检查接口
 * GET /xiaohongshu/api/client/version-check
 * Query: version, clientType
 */
router.get('/version-check', async (req, res) => {
  try {
    // 支持两种参数名：version 或 currentVersion
    const { version, currentVersion: clientCurrentVersion, clientType } = req.query;
    const currentVersion = version || clientCurrentVersion || '1.0.0';

    // 返回最新版本信息（当前硬编码，可改为从数据库读取）
    const latestVersions = {
      'audit': '1.0.1',
      'harvest': '1.0.1',
      'discovery': '1.0.1',
      'blacklist-scan': '1.0.1',
      'short-link': '1.0.1'
    };

    const latestVersion = latestVersions[clientType] || '1.0.1';

    // 比较版本 - 检查主版本号变化
    const hasUpdate = latestVersion > currentVersion;

    // 检查是否是大版本更新（主版本号变化）
    let majorUpdate = false;
    if (hasUpdate) {
      const currentMajor = parseInt(currentVersion.split('.')[0]) || 0;
      const latestMajor = parseInt(latestVersion.split('.')[0]) || 0;
      majorUpdate = latestMajor > currentMajor;
    }

    res.json({
      success: true,
      data: {
        currentVersion,
        latestVersion,
        hasUpdate,
        majorUpdate,
        downloadUrl: hasUpdate ? 'https://www.wubug.cc/downloads/xiaohongshu-audit-clients.zip' : null,
        updateNotes: hasUpdate ? '请下载最新版本' : null
      }
    });

  } catch (error) {
    log.error('❌ [版本检查] 失败:', error);
    res.json({
      success: true,
      data: {
        hasUpdate: false
      }
    });
  }
});

// ==================== 心跳接口 ====================

/**
 * 心跳接口 - 延长任务锁定时间 + 更新客户端在线状态
 * POST /xiaohongshu/api/client/heartbeat
 * Body: { clientId, status, taskIds, clientType }
 */
router.post('/heartbeat', async (req, res) => {
  try {
    const { clientId, status, taskIds, clientType } = req.body;
    // 也从请求头读取客户端类型（备用）
    const headerClientType = req.headers['x-client-type'];

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: '缺少客户端ID'
      });
    }

    const now = new Date();

    // 1. 更新客户端心跳记录（用于在线状态显示）
    const heartbeatData = {
      clientId,
      status: status || 'online',
      lastHeartbeat: now
    };

    // 添加客户端类型（优先使用 body，其次使用 header）
    if (clientType || headerClientType) {
      heartbeatData.clientType = clientType || headerClientType;
    }

    // 如果有任务ID，更新任务列表
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      heartbeatData.taskIds = taskIds;
    }

    await ClientHeartbeat.findOneAndUpdate(
      { clientId },
      heartbeatData,
      { upsert: true, new: true }
    );

    // 2. 如果有任务，更新任务锁定时间
    let updatedCount = 0;
    if (taskIds && Array.isArray(taskIds) && taskIds.length > 0) {
      const lockTimeoutMinutes = 30;
      const lockedUntil = new Date(now.getTime() + lockTimeoutMinutes * 60 * 1000);

      const result = await ImageReview.updateMany(
        {
          _id: { $in: taskIds },
          'processingLock.clientId': clientId // 只更新自己锁定的任务
        },
        {
          $set: {
            'processingLock.heartbeatAt': now,
            'processingLock.lockedUntil': lockedUntil
          }
        }
      );
      updatedCount = result.modifiedCount;
    }

    res.json({
      success: true,
      data: {
        updated: updatedCount,
        clientId: clientId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('❌ [本地客户端] 心跳失败:', error);
    res.status(500).json({
      success: false,
      message: '心跳失败',
      error: error.message
    });
  }
});

// ==================== 验证结果上报 ====================

/**
 * 上报验证结果
 * POST /xiaohongshu/api/client/verify-result
 *
 * 本地客户端完成评论验证后上报结果
 */
router.post('/verify-result', async (req, res) => {
  try {
    const { taskId, exists, confidence, foundComments, pageComments, commentCount, verifiedAt, targetComment, targetAuthor, verificationMethod, clientId, screenshotUrl, result: verifyResultType, reason } = req.body;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: '缺少任务ID'
      });
    }

    // 验证 taskId 格式
    if (!isValidObjectId(taskId)) {
      return res.status(400).json({
        success: false,
        message: '任务ID格式不正确'
      });
    }

    // 先查询任务，检查是否使用新的客户端验证流程
    const existingTask = await ImageReview.findById(taskId);
    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    // 处理客户端内容审核失败的情况
    if (verifyResultType === 'content_audit_failed') {
      log.info(`❌ [客户端验证] 内容审核失败: ${taskId}, 原因: ${reason}`);

      // 使用 handleClientVerificationResult 处理（等待第二次验证）
      const asyncAiReviewService = require('../services/asyncAiReviewService');
      const result = await asyncAiReviewService.handleClientVerificationResult(taskId, {
        success: false,
        verified: false,
        comment: reason || '客户端内容审核失败',
        reason: reason,
        contentAudit: req.body.contentAudit
      });

      // 清除处理锁定
      await ImageReview.findByIdAndUpdate(taskId, {
        $set: {
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      });

      return res.json(result);
    }

    // 处理评论验证失败的情况（包含内容审核信息）
    if (!exists && reason && reason.includes('关键词检查:')) {
      log.info(`❌ [客户端验证] 评论验证失败（含内容审核）: ${taskId}, 原因: ${reason}`);

      await ImageReview.findByIdAndUpdate(taskId, {
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: new Date(),
        // 清除处理锁定
        'processingLock.clientId': null,
        'processingLock.lockedAt': null,
        'processingLock.heartbeatAt': null,
        'processingLock.lockedUntil': null
      });

      return res.json({
        success: true,
        message: '任务已驳回',
        rejectionReason: reason
      });
    }

    // 如果任务有 clientVerification 字段，使用新的验证流程
    if (existingTask.clientVerification) {
      const asyncAiReviewService = require('../services/asyncAiReviewService');
      const result = await asyncAiReviewService.handleClientVerificationResult(taskId, {
        success: exists !== false,
        verified: exists,
        comment: reason || (exists ? '客户端验证：评论已找到' : '客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）'),
        screenshotUrl: screenshotUrl,
        contentAudit: req.body.contentAudit  // 传递内容审核结果
      });

      // 清除处理锁定
      await ImageReview.findByIdAndUpdate(taskId, {
        $set: {
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      });

      return res.json(result);
    }

    // 以下是旧的验证流程（保持向后兼容）
    // 根据验证结果设置状态
    const finalStatus = exists ? 'completed' : 'rejected';
    const now = new Date();

    // 驳回原因（用于小程序显示）
    const rejectionReason = exists ? null :
      (reason && reason.includes('关键词检查:') ? reason : '当前帖子评论区无法检测到你的评论（请用其他号观察）');

    // 构建验证结果对象
    const commentVerification = {
      verified: true,
      exists: exists,
      confidence: confidence || 0,
      verifiedAt: verifiedAt || now.toISOString(),
      verificationMethod: verificationMethod || 'local-client-visual',
      targetComment: targetComment,
      targetAuthor: targetAuthor,
      foundComments: foundComments || [],
      pageComments: pageComments || [],
      commentCount: commentCount || (pageComments ? pageComments.length : 0),
      result: exists ? 'passed' : 'comment_not_found'
    };

    // 原子更新状态 + 清除锁定
    const updateQuery = {
      _id: taskId,
      status: 'processing'
    };

    if (clientId) {
      updateQuery['processingLock.clientId'] = clientId;
    }

    const updatedTask = await ImageReview.findOneAndUpdate(
      updateQuery,
      {
        $set: {
          status: finalStatus,
          'aiReviewResult.commentVerification': commentVerification,
          'aiReviewResult.passed': exists,
          'aiReviewResult.reasons': exists
            ? ['本地客户端验证：评论已找到']
            : ['本地客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）'],
          rejectionReason: rejectionReason,
          updatedAt: now,
          'processingLock.clientId': null,
          'processingLock.lockedAt': null,
          'processingLock.heartbeatAt': null,
          'processingLock.lockedUntil': null
        }
      },
      { new: true }
    );

    if (!updatedTask) {
      const existingTask = await ImageReview.findById(taskId);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: '任务不存在'
        });
      }

      return res.status(409).json({
        success: false,
        message: `任务已被处理，当前状态: ${existingTask.status}`,
        currentStatus: existingTask.status,
        alreadyProcessed: true
      });
    }

    log.info(`✅ [本地客户端] 任务 ${taskId} 状态更新: processing → ${finalStatus}`);

    // 记录审核历史
    const auditAction = finalStatus === 'completed' ? 'local_client_passed' : 'local_client_rejected';
    const auditComment = finalStatus === 'completed'
      ? '本地客户端验证：评论已找到'
      : '本地客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）';

    await ImageReview.updateOne(
      { _id: taskId },
      {
        $push: {
          auditHistory: {
            operator: null,
            operatorName: `本地客户端 (${clientId || 'unknown'})`,
            action: auditAction,
            comment: auditComment,
            timestamp: now
          }
        }
      }
    );

    // 记录评论限制（防止重复提交）
    if (updatedTask.imageType === 'comment' && exists && updatedTask.status === 'completed') {
      const authorToRecord = updatedTask.aiParsedNoteInfo?.author || updatedTask.userNoteInfo?.author;
      const commentContent = updatedTask.userNoteInfo?.comment;

      if (authorToRecord && updatedTask.noteUrl && commentContent) {
        try {
          log.info(`📝 [本地客户端] 记录评论限制: 作者=${authorToRecord}, 链接=${updatedTask.noteUrl}`);
          await CommentLimit.recordCommentApproval(
            updatedTask.noteUrl,
            authorToRecord,
            commentContent,
            updatedTask._id
          );
          log.info(`✅ [本地客户端] 评论限制记录成功: taskId=${taskId}`);
        } catch (error) {
          log.error(`❌ [本地客户端] 记录评论限制失败:`, error);
        }
      }
    }

    res.json({
      success: true,
      message: exists ? '验证成功' : '验证失败',
      data: {
        taskId: taskId,
        status: finalStatus,
        commentVerification: commentVerification
      }
    });

  } catch (error) {
    log.error('❌ [本地客户端] 验证结果上报失败:', error);
    res.status(500).json({
      success: false,
      message: '验证结果上报失败',
      error: error.message
    });
  }
});

/**
 * 批量上报验证结果
 * POST /xiaohongshu/api/client/verify-batch
 */
router.post('/verify-batch', async (req, res) => {
  try {
    const { results } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({
        success: false,
        message: '结果列表为空'
      });
    }

    // 优化：批量查询所有任务（避免 N+1 查询）
    const taskIds = results.map(r => r.taskId);
    const tasks = await ImageReview.find({ _id: { $in: taskIds } });
    const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));

    const updateResults = [];
    const rejectionReason = '当前帖子评论区无法检测到你的评论（请用其他号观察）';

    for (const result of results) {
      try {
        const task = taskMap.get(result.taskId);

        if (task) {
          if (!task.aiReviewResult) {
            task.aiReviewResult = {};
          }

          const passed = result.exists || false;
          const finalStatus = passed ? 'completed' : 'rejected';
          const auditComment = passed
            ? '本地客户端验证：评论已找到'
            : '本地客户端验证：当前帖子评论区无法检测到你的评论（请用其他号观察）';

          task.aiReviewResult.commentVerification = {
            verified: true,
            exists: passed,
            confidence: result.confidence || 0,
            verifiedAt: result.verifiedAt || new Date().toISOString(),
            verificationMethod: 'local-client-batch',
            foundComments: result.foundComments || [],
            pageComments: result.pageComments || [],
            commentCount: result.commentCount || 0,
            result: passed ? 'passed' : 'comment_not_found'
          };

          task.aiReviewResult.passed = passed;
          task.aiReviewResult.reasons = [auditComment];

          task.status = finalStatus;
          task.rejectionReason = passed ? null : rejectionReason;

          await task.save();

          // 记录评论限制（防止重复提交）
          if (task.imageType === 'comment' && passed && finalStatus === 'completed') {
            const authorToRecord = task.aiParsedNoteInfo?.author || task.userNoteInfo?.author;
            const commentContent = task.userNoteInfo?.comment;

            if (authorToRecord && task.noteUrl && commentContent) {
              try {
                log.info(`📝 [本地客户端批量] 记录评论限制: 作者=${authorToRecord}, 链接=${task.noteUrl}`);
                await CommentLimit.recordCommentApproval(
                  task.noteUrl,
                  authorToRecord,
                  commentContent,
                  task._id
                );
                log.info(`✅ [本地客户端批量] 评论限制记录成功: taskId=${result.taskId}`);
              } catch (error) {
                log.error(`❌ [本地客户端批量] 记录评论限制失败:`, error);
              }
            }
          }

          updateResults.push({
            taskId: result.taskId,
            success: true
          });
        } else {
          updateResults.push({
            taskId: result.taskId,
            success: false,
            error: '任务不存在'
          });
        }
      } catch (err) {
        updateResults.push({
          taskId: result.taskId,
          success: false,
          error: err.message
        });
      }
    }

    const successCount = updateResults.filter(r => r.success).length;

    log.info(`📊 [本地客户端] 批量上报完成: ${successCount}/${results.length} 成功`);

    res.json({
      success: true,
      message: `批量上报完成: ${successCount}/${results.length} 成功`,
      data: {
        total: results.length,
        success: successCount,
        failed: results.length - successCount,
        results: updateResults
      }
    });

  } catch (error) {
    log.error('❌ [本地客户端] 批量上报失败:', error);
    res.status(500).json({
      success: false,
      message: '批量上报失败',
      error: error.message
    });
  }
});

// ==================== 客户端状态上报 ====================

/**
 * 上报客户端状态
 * POST /xiaohongshu/api/client/status
 */
router.post('/status', async (req, res) => {
  try {
    const { type, ...statusData } = req.body;

    log.info(`📊 [本地客户端] 状态上报:`, type || 'general', statusData);

    res.json({
      success: true,
      message: '状态上报成功'
    });

  } catch (error) {
    log.error('❌ [本地客户端] 状态上报失败:', error);
    res.status(500).json({
      success: false,
      message: '状态上报失败',
      error: error.message
    });
  }
});

/**
 * 上报错误日志
 * POST /xiaohongshu/api/client/log
 */
router.post('/log', async (req, res) => {
  try {
    const { type, error, timestamp } = req.body;

    if (type === 'error-log' && error) {
      log.error(`❌ [本地客户端] 客户端错误:`, error.message);
      log.error(`   Stack:`, error.stack);
    }

    res.json({
      success: true
    });

  } catch (error) {
    log.error('❌ [本地客户端] 日志上报失败:', error);
    res.status(500).json({
      success: false,
      message: '日志上报失败'
    });
  }
});

/**
 * Cookie 状态上报
 * POST /xiaohongshu/api/client/cookie-status
 */
router.post('/cookie-status', async (req, res) => {
  try {
    const { type, cookieId, reason } = req.body;

    if (type === 'cookie-invalid') {
      log.warn(`⚠️  [本地客户端] Cookie 失效上报: ${cookieId} - ${reason}`);

      // 可以在这里触发 Cookie 池的失效标记逻辑
      const simpleCookiePool = require('../services/SimpleCookiePool');
      if (cookieId && simpleCookiePool.markCookieInvalid) {
        simpleCookiePool.markCookieInvalid(cookieId, reason || '本地客户端上报失效');
      }
    }

    res.json({
      success: true
    });

  } catch (error) {
    log.error('❌ [本地客户端] Cookie 状态上报失败:', error);
    res.status(500).json({
      success: false,
      message: 'Cookie 状态上报失败'
    });
  }
});

// ==================== AI 分析接口 ====================

/**
 * AI文意审核（供本地审核客户端调用）
 * POST /xiaohongshu/api/client/note/ai-analyze
 */
router.post('/note/ai-analyze', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: '缺少内容参数'
      });
    }

    log.info(`🤖 [本地客户端AI] 分析内容，长度: ${content?.length || 0}`);

    const result = await aiContentAnalysisService.analyzeVictimPost(content);

    res.json({
      success: true,
      data: {
        is_genuine_victim_post: result.is_genuine_victim_post,
        confidence_score: result.confidence_score,
        reason: result.reason,
        risk_level: result.risk_level
      }
    });

  } catch (error) {
    log.error('❌ [本地客户端AI] 分析失败:', error);
    // AI失败时返回默认通过
    res.json({
      success: true,
      data: {
        is_genuine_victim_post: true,
        confidence_score: 0.5,
        reason: 'AI分析服务不可用，自动通过',
        fallback: true
      }
    });
  }
});

/**
 * AI评论分析（供采集客户端调用）
 * POST /xiaohongshu/api/client/ai/analyze-comment
 */
router.post('/ai/analyze-comment', async (req, res) => {
  try {
    const { commentContent, noteTitle } = req.body;

    if (!commentContent) {
      return res.status(400).json({
        success: false,
        message: '缺少评论内容参数'
      });
    }

    log.info(`🤖 [采集客户端AI] 分析评论，长度: ${commentContent?.length || 0}`);

    const result = await aiContentAnalysisService.analyzeComment(commentContent, noteTitle || '');

    res.json({
      success: true,
      data: {
        isPotentialLead: result.isPotentialLead,
        category: result.category,
        confidence_score: result.confidence_score,
        reason: result.reason,
        shouldContact: result.shouldContact,
        riskLevel: result.riskLevel
      }
    });

  } catch (error) {
    log.error('❌ [采集客户端AI] 评论分析失败:', error);
    // AI失败时返回保守结果
    res.json({
      success: true,
      data: {
        isPotentialLead: true,
        category: 'uncertain',
        confidence_score: 0.3,
        reason: 'AI分析失败，默认保留',
        shouldContact: true,
        riskLevel: 'low',
        fallback: true
      }
    });
  }
});

/**
 * 系统配置 API
 * 用于管理系统级配置，如采集优先级间隔等
 */

// 获取系统配置
// GET /xiaohongshu/api/client/system/config?key=xxx
router.get('/system/config', async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: '请指定配置键 key'
      });
    }

    const SystemConfig = require('../models/SystemConfig');
    const config = await SystemConfig.findOne({ key });

    if (!config) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: {
        key: config.key,
        value: config.value,
        description: config.description,
        category: config.category
      }
    });

  } catch (error) {
    log.error('❌ [系统配置] 获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 更新系统配置
// PUT /xiaohongshu/api/client/system/config
router.put('/system/config', authenticateToken, async (req, res) => {
  try {
    const { key, value, description, category } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: '配置键 key 不能为空'
      });
    }

    const SystemConfig = require('../models/SystemConfig');
    const config = await SystemConfig.setValue(
      key,
      value,
      description || '',
      category || 'general'
    );

    log.info(`✅ [系统配置] 已更新配置: ${key}`);

    res.json({
      success: true,
      data: {
        key: config.key,
        value: config.value,
        description: config.description,
        category: config.category
      }
    });

  } catch (error) {
    log.error('❌ [系统配置] 更新配置失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
