/**
 * 客户端笔记发现相关路由
 *
 * 从原 client.js 拆分出来的笔记发现功能：
 * - 检查笔记是否存在
 * - 上报发现的笔记
 * - 获取已发现的笔记列表
 * - 获取笔记发现统计
 * - 获取采集队列管理数据
 * - 获取搜索关键词列表
 */

const express = require('express');
const DiscoveredNote = require('../models/DiscoveredNote');
const ClientHeartbeat = require('../models/ClientHeartbeat');
const SystemConfig = require('../models/SystemConfig');
const clientHealthService = require('../services/clientHealthService');
const { escapeRegExp } = require('../utils/security');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('Discovery');

/**
 * 检查笔记是否存在（用于客户端在上报前查重）
 * GET /xiaohongshu/api/client/discovery/check/:noteUrl
 */
router.get('/discovery/check/:noteUrl', async (req, res) => {
  try {
    const noteUrl = decodeURIComponent(req.params.noteUrl);

    log.info(`🔍 [笔记发现] 检查笔记是否存在: ${noteUrl.substring(0, 50)}...`);

    const existing = await DiscoveredNote.findOne({ noteUrl });

    if (existing) {
      log.info(`📋 [笔记发现] 笔记已存在，状态: ${existing.status}`);
    } else {
      log.info(`✅ [笔记发现] 笔记不存在，可以上报`);
    }

    res.json({
      success: true,
      exists: !!existing,
      data: existing
    });

  } catch (error) {
    log.error('❌ [笔记发现] 检查失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 上报发现的笔记
 * POST /xiaohongshu/api/client/discovery/report
 *
 * 客户端在空闲时采集到符合条件的笔记后上报
 */
router.post('/discovery/report', async (req, res) => {
  try {
    const {
      noteUrl,
      noteId,
      title,
      author,
      publishTime,
      keyword,
      lastCommentTime,  // 新增：笔记内最新评论时间
      aiAnalysis,
      clientId
    } = req.body;

    // 参数验证
    if (!noteUrl) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: noteUrl'
      });
    }

    log.info(`📝 [笔记发现] 收到笔记上报: ${title?.substring(0, 30) || noteUrl.substring(0, 30)}...`);
    log.info(`   URL: ${noteUrl}`);
    log.info(`   关键词: ${keyword || 'N/A'}`);
    log.info(`   AI结果: ${aiAnalysis?.is_genuine_victim_post ? '通过' : '未通过'}`);
    if (lastCommentTime) {
      log.info(`   最新评论: ${new Date(lastCommentTime).toLocaleString('zh-CN')}`);
    }

    // 构建更新数据
    const updateData = {
      noteUrl,
      noteId,
      title: title || '',
      author: (author || '').replace(/关注$/, '').trim(),
      publishTime: publishTime ? new Date(publishTime) : null,
      keyword: keyword || '',
      aiAnalysis: aiAnalysis || {
        is_genuine_victim_post: false,
        confidence_score: 0,
        reason: ''
      },
      clientId: clientId || null,
      // 根据AI分析结果设置状态
      status: aiAnalysis?.is_genuine_victim_post ? 'verified' : 'discovered',
      discoverTime: new Date()
    };

    // 如果提供了最新评论时间，更新它
    if (lastCommentTime) {
      updateData.lastCommentTime = new Date(lastCommentTime);
    }

    // 使用 findOneAndUpdate 防止重复
    const note = await DiscoveredNote.findOneAndUpdate(
      { noteUrl },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 判断是否为新创建的记录（比较时间戳）
    const isNew = !note.createdAt ||
      (note.createdAt instanceof Date && note.updatedAt instanceof Date &&
       note.createdAt.getTime() === note.updatedAt.getTime());

    if (isNew) {
      log.info(`✅ [笔记发现] 新笔记已保存，ID: ${note._id}`);
    } else {
      log.info(`🔄 [笔记发现] 笔记已更新，ID: ${note._id}`);
    }

    // 记录任务成功（更新客户端健康度和今日统计）
    if (clientId && isNew) {
      await clientHealthService.recordTaskSuccess(clientId, 'discovery', {
        notesDiscovered: 1
      });
    }

    res.json({
      success: true,
      isNew,
      data: {
        id: note._id,
        noteUrl: note.noteUrl,
        status: note.status,
        createdAt: note.createdAt
      }
    });

  } catch (error) {
    log.error('❌ [笔记发现] 上报失败:', error);

    // 检查是否是唯一键冲突（重复上报）
    if (error.code === 11000 || error.code === 11001) {
      return res.status(200).json({
        success: true,
        isNew: false,
        duplicate: true,
        message: '笔记已存在'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取已发现的笔记列表（可选，用于管理后台）
 * GET /xiaohongshu/api/client/discovery/list
 * 支持筛选：status, harvestPriority, hasShortUrl, noteStatus, canHarvest, keyword
 */
router.get('/discovery/list', async (req, res) => {
  try {
    const {
      status,
      limit = 50,
      skip = 0,
      converted,
      harvestPriority,
      hasShortUrl,
      noteStatus,
      canHarvest,
      keyword
    } = req.query;

    const query = {};

    // 基础状态筛选
    if (status) {
      query.status = status;
    }

    // 采集优先级筛选
    if (harvestPriority) {
      query.harvestPriority = parseInt(harvestPriority);
    }

    // 短链接筛选
    if (hasShortUrl === 'yes') {
      // 使用 $and 确保同时满足存在且非空
      query.$and = query.$and || [];
      query.$and.push({
        shortUrl: { $exists: true, $nin: ['', null] }
      });
    } else if (hasShortUrl === 'no') {
      query.$or = [
        { shortUrl: { $exists: false } },
        { shortUrl: null },
        { shortUrl: '' }
      ];
    }

    // 删除状态筛选
    if (noteStatus) {
      query.noteStatus = noteStatus;
    }

    // 使用数组收集所有需要 $and 组合的条件，避免 $or 被覆盖
    const andConditions = [];

    // 处理 hasShortUrl === 'no' 的情况（需要在 keyword 之前处理）
    if (hasShortUrl === 'no' && !keyword) {
      query.$or = [
        { shortUrl: { $exists: false } },
        { shortUrl: null },
        { shortUrl: '' }
      ];
    }

    // 关键词搜索（标题、作者、长链接、短链接）
    if (keyword) {
      const escapedKeyword = escapeRegExp(keyword);
      const keywordRegex = { $regex: escapedKeyword, $options: 'i' };

      // 收集关键词搜索条件
      const keywordCondition = {
        $or: [
          { title: keywordRegex },
          { author: keywordRegex },
          { noteUrl: keywordRegex },
          { shortUrl: keywordRegex }
        ]
      };

      // 如果同时有 hasShortUrl='no'，需要组合条件
      if (hasShortUrl === 'no') {
        andConditions.push(
          { $or: [{ shortUrl: { $exists: false } }, { shortUrl: null }, { shortUrl: '' }] },
          keywordCondition
        );
      } else {
        andConditions.push(keywordCondition);
      }
    }

    // 可采集筛选（根据采集间隔和上次采集时间计算）
    if (canHarvest === 'yes' || canHarvest === 'no') {
      // 获取优先级间隔配置
      const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
      const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

      // 构建可采集条件
      const now = new Date();
      const canHarvestConditions = [];

      // 遍历每个优先级，构建对应的时间条件
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

      // 添加默认优先级（1）的条件，用于没有设置优先级的笔记
      const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
      canHarvestConditions.push({
        harvestPriority: { $exists: false },
        $or: [
          { commentsHarvestedAt: { $exists: false } },
          { commentsHarvestedAt: null },
          { commentsHarvestedAt: { $lte: defaultCutoff } }
        ]
      });

      if (canHarvest === 'yes') {
        // 可采集：满足任一优先级的时间条件，添加到 andConditions
        andConditions.push({ $or: canHarvestConditions });
      } else if (canHarvest === 'no') {
        // 排队中：不满足任何优先级的时间条件
        andConditions.push({ $nor: canHarvestConditions });
      }
    }

    // 统一应用 $and 条件（如果有多个条件需要组合）
    if (andConditions.length > 0) {
      query.$and = query.$and || [];
      query.$and.push(...andConditions);
    }

    const notes = await DiscoveredNote.find(query)
      .sort({ discoverTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await DiscoveredNote.countDocuments(query);

    res.json({
      success: true,
      data: {
        notes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        }
      }
    });

  } catch (error) {
    log.error('❌ [笔记发现] 获取列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取笔记发现统计
 * GET /xiaohongshu/api/client/discovery/stats
 */
router.get('/discovery/stats', async (req, res) => {
  try {
    const total = await DiscoveredNote.countDocuments();
    const verified = await DiscoveredNote.countDocuments({ status: 'verified' });

    // 获取优先级间隔配置
    const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
    const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

    // 待采集队列：删除状态正常 + 可加入队列（满足采集间隔条件）
    const now = new Date();
    const canHarvestConditions = [];
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
    const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
    canHarvestConditions.push({
      harvestPriority: { $exists: false },
      $or: [
        { commentsHarvestedAt: { $exists: false } },
        { commentsHarvestedAt: null },
        { commentsHarvestedAt: { $lte: defaultCutoff } }
      ]
    });

    const pending = await DiscoveredNote.countDocuments({
      noteStatus: 'active',
      $or: canHarvestConditions
    });

    // 最近7天发现的笔记数量
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = await DiscoveredNote.countDocuments({
      discoverTime: { $gte: sevenDaysAgo }
    });

    // 在线采集设备数量（基于 ClientHeartbeat 心跳判断）
    // 只统计最近5分钟内有心跳的采集客户端（harvest 类型）
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineHarvestDevices = await ClientHeartbeat.countDocuments({
      clientType: 'harvest',
      lastHeartbeat: { $gte: fiveMinutesAgo }
    });

    // 正在分发：已被锁定的笔记数量
    const processing = await DiscoveredNote.countDocuments({
      noteStatus: 'active',
      'harvestLock.lockedUntil': { $gt: now }
    });

    res.json({
      success: true,
      data: {
        total,
        verified,
        pending,
        recent,
        onlineHarvestDevices,
        pendingStats: {
          processing,  // 正在分发
          ready: pending // 可加入队列
        }
      }
    });

  } catch (error) {
    log.error('❌ [笔记发现] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取采集队列管理数据
 * GET /xiaohongshu/api/client/discovery/harvest-queue
 *
 * 用于管理后台的采集队列管理页面
 * 支持待采集队列和已完成队列的查询
 */
router.get('/discovery/harvest-queue', async (req, res) => {
  try {
    const {
      tab = 'pending',           // pending: 待采集, processing: 正在分发, completed: 已完成
      skip = 0,
      limit = 50,
      keyword
    } = req.query;

    const now = new Date();

    // 获取优先级间隔配置
    const configDoc = await SystemConfig.findOne({ key: 'harvest_priority_intervals' });
    const intervals = configDoc?.value || { 10: 10, 5: 60, 2: 360, 1: 1440 };

    // 计算下次可采集时间的函数
    const getNextHarvestTime = (priority, lastHarvestAt) => {
      const minutes = intervals[priority] || intervals[1];
      return new Date(new Date(lastHarvestAt).getTime() + minutes * 60 * 1000);
    };

    // 构建 query 条件
    const query = {};

    if (tab === 'pending') {
      // 待采集队列：删除状态正常 + (可采集 OR 正在分发)
      query.noteStatus = 'active';

      // 构建可采集条件：满足任一优先级的时间间隔
      const canHarvestConditions = [];
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

      // 添加默认优先级（1）的条件，用于没有设置优先级的笔记
      const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
      canHarvestConditions.push({
        harvestPriority: { $exists: false },
        $or: [
          { commentsHarvestedAt: { $exists: false } },
          { commentsHarvestedAt: null },
          { commentsHarvestedAt: { $lte: defaultCutoff } }
        ]
      });

      // 正在分发的条件（被锁定的笔记）
      const processingCondition = {
        'harvestLock.lockedUntil': { $gt: now }
      };

      // 满足时间条件 OR 正在分发
      query.$or = [
        { $or: canHarvestConditions },
        processingCondition
      ];
    } else if (tab === 'processing') {
      // 正在分发：已被锁定的笔记
      query.noteStatus = 'active';
      query['harvestLock.lockedUntil'] = { $gt: now };
    } else if (tab === 'completed') {
      // 已完成队列：已采集过
      query.commentsHarvested = true;
    }

    // 关键词搜索
    if (keyword) {
      const escapedKeyword = escapeRegExp(keyword);
      const keywordRegex = { $regex: escapedKeyword, $options: 'i' };
      const keywordCondition = {
        $or: [
          { title: keywordRegex },
          { author: keywordRegex },
          { noteUrl: keywordRegex },
          { shortUrl: keywordRegex }
        ]
      };

      // 如果待采集队列已有 $or 条件，需要用 $and 组合
      if (tab === 'pending') {
        query.$and = [
          { $or: query.$or },
          keywordCondition
        ];
        delete query.$or;
      } else {
        // processing 和 completed tab 使用 $and 组合
        query.$and = [
          { ...query },
          keywordCondition
        ];
      }
    }

    // 查询笔记
    const notes = await DiscoveredNote.find(query)
      .sort({ harvestPriority: -1, discoverTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const total = await DiscoveredNote.countDocuments(query);

    // 计算 queueStatus 和 waitTime
    const enrichedNotes = notes.map(note => {
      let queueStatus = 'ready';
      let waitTime = '可立即采集';

      // 检查是否正在被采集
      if (note.harvestLock && note.harvestLock.lockedUntil && new Date(note.harvestLock.lockedUntil) > now) {
        queueStatus = 'processing';
        waitTime = '采集中...';
      } else if (tab === 'completed' && note.commentsHarvestedAt) {
        // 已完成队列显示最后采集时间
        const harvestedAt = new Date(note.commentsHarvestedAt);
        const nextTime = getNextHarvestTime(note.harvestPriority || 1, harvestedAt);
        if (nextTime > now) {
          const diffMs = nextTime - now;
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 60) {
            waitTime = `下次采集: ${diffMins}分钟后`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            waitTime = `下次采集: ${diffHours}小时后`;
          }
        } else {
          waitTime = '可再次采集';
        }
      } else if (tab === 'pending' && note.commentsHarvestedAt) {
        // 待采集队列但之前采集过（重新采集）
        const harvestedAt = new Date(note.commentsHarvestedAt);
        const nextTime = getNextHarvestTime(note.harvestPriority || 1, harvestedAt);
        if (nextTime > now) {
          queueStatus = 'waiting';
          const diffMs = nextTime - now;
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins < 60) {
            waitTime = `等待: ${diffMins}分钟`;
          } else {
            const diffHours = Math.floor(diffMins / 60);
            waitTime = `等待: ${diffHours}小时`;
          }
        }
      }

      return {
        ...note,
        queueStatus,
        waitTime
      };
    });

    // 统计数据
    let stats;
    if (tab === 'pending') {
      // 待采集队列统计
      const [readyTotal, processingTotal] = await Promise.all([
        // 可加入队列：满足采集间隔条件 + 删除状态正常（不检查锁定状态）
        (async () => {
          const canHarvestConditions = [];
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
          const defaultCutoff = new Date(now.getTime() - 1440 * 60 * 1000);
          canHarvestConditions.push({
            harvestPriority: { $exists: false },
            $or: [
              { commentsHarvestedAt: { $exists: false } },
              { commentsHarvestedAt: null },
              { commentsHarvestedAt: { $lte: defaultCutoff } }
            ]
          });
          return await DiscoveredNote.countDocuments({
            noteStatus: 'active',
            $or: canHarvestConditions
          });
        })(),
        // 正在分发：有锁定且未过期
        DiscoveredNote.countDocuments({
          noteStatus: 'active',
          'harvestLock.lockedUntil': { $gt: now }
        })
      ]);

      stats = {
        processing: processingTotal,  // 正在分发
        ready: readyTotal             // 可加入队列
      };
    } else {
      // 已完成队列统计
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [completedTotal, todayTotal] = await Promise.all([
        // 已完成总数
        DiscoveredNote.countDocuments({
          commentsHarvested: true
        }),
        // 今日完成（今天采集的）
        DiscoveredNote.countDocuments({
          commentsHarvested: true,
          commentsHarvestedAt: { $gte: today }
        })
      ]);

      stats = {
        total: completedTotal,  // 已完成总数
        today: todayTotal       // 今日完成
      };
    }

    res.json({
      success: true,
      data: {
        notes: enrichedNotes,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip)
        },
        stats
      }
    });

  } catch (error) {
    log.error('❌ [采集队列] 获取队列数据失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新笔记状态（删除检测客户端使用）
 * PUT /xiaohongshu/api/client/discovery/:id/status
 */
router.put('/discovery/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, aiReason, noteStatus, deletionCheckAnalysis, isDeletionCheck } = req.body;

    log.info(`📝 [笔记状态更新] ID: ${id}, status: ${status}, noteStatus: ${noteStatus}, isDeletionCheck: ${isDeletionCheck}`);

    // 验证笔记是否存在
    const note = await DiscoveredNote.findById(id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: '笔记不存在'
      });
    }

    // 更新状态
    if (status) note.status = status;

    // 更新审核原因
    if (aiReason) note.aiReason = aiReason;

    // 如果是删除检测客户端的更新，保存到 deletionCheckAnalysis
    if (isDeletionCheck && deletionCheckAnalysis) {
      note.deletionCheckAnalysis = {
        ...deletionCheckAnalysis,
        checkedAt: new Date().toISOString()
      };
    }

    // 更新笔记状态（如 deleted）
    if (noteStatus) note.noteStatus = noteStatus;

    await note.save();

    log.info(`✅ [笔记状态更新] 更新成功: ${id}`);

    res.json({
      success: true,
      data: note
    });

  } catch (error) {
    log.error('❌ [笔记状态更新] 更新失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 更新笔记短链接
 * PUT /xiaohongshu/api/client/discovery/:id/short-url
 */
router.put('/discovery/:id/short-url', async (req, res) => {
  try {
    const { id } = req.params;
    const { shortUrl } = req.body;

    const note = await DiscoveredNote.findByIdAndUpdate(
      id,
      { $set: { shortUrl } },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ success: false, message: '笔记不存在' });
    }

    log.info(`📝 [笔记短链接] 更新成功: ${id} -> ${shortUrl}`);
    res.json({ success: true, data: note });
  } catch (error) {
    log.error('❌ [笔记短链接] 更新失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量更新笔记短链接
 * POST /xiaohongshu/api/client/discovery/batch-update-short-urls
 */
router.post('/discovery/batch-update-short-urls', async (req, res) => {
  try {
    const { updates } = req.body; // [{ noteId, shortUrl }]

    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: '参数格式不正确' });
    }

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const update of updates) {
      try {
        const { noteId, shortUrl } = update;
        // 如果 noteId 存在，按 noteId 更新；否则按 shortUrl 的解析结果（这里前端传了 noteId）
        const note = await DiscoveredNote.findOneAndUpdate(
          { noteId },
          { $set: { shortUrl } },
          { new: true }
        );

        if (note) {
          successCount++;
          results.push({ noteId, success: true });
        } else {
          failedCount++;
          results.push({ noteId, success: false, message: '未找到笔记' });
        }
      } catch (e) {
        failedCount++;
        results.push({ noteId: update.noteId, success: false, message: e.message });
      }
    }

    log.info(`📝 [批量短链接] 完成: 成功 ${successCount}, 失败 ${failedCount}`);
    res.json({
      success: true,
      data: { successCount, failedCount, results }
    });
  } catch (error) {
    log.error('❌ [批量短链接] 失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 更新笔记删除状态
 * PUT /xiaohongshu/api/client/discovery/:id/note-status
 */
router.put('/discovery/:id/note-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { noteStatus } = req.body;

    const updateData = { noteStatus };
    if (noteStatus === 'deleted' || noteStatus === 'ai_rejected') {
      updateData.deletedAt = new Date();
    }

    const note = await DiscoveredNote.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ success: false, message: '笔记不存在' });
    }

    log.info(`📝 [笔记删除状态] 更新成功: ${id} -> ${noteStatus}`);
    res.json({ success: true, data: note });
  } catch (error) {
    log.error('❌ [笔记删除状态] 更新失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量更新笔记删除状态
 * PUT /xiaohongshu/api/client/discovery/batch-status
 */
router.put('/discovery/batch-status', async (req, res) => {
  try {
    const { noteIds, noteStatus } = req.body;

    if (!Array.isArray(noteIds)) {
      return res.status(400).json({ success: false, message: '参数格式不正确' });
    }

    const updateData = { noteStatus };
    if (noteStatus === 'deleted' || noteStatus === 'ai_rejected') {
      updateData.deletedAt = new Date();
    }

    const result = await DiscoveredNote.updateMany(
      { _id: { $in: noteIds } },
      { $set: updateData }
    );

    log.info(`📝 [批量删除状态] 更新成功: ${result.modifiedCount} 条 -> ${noteStatus}`);
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    log.error('❌ [批量删除状态] 更新失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 删除单个笔记
 * DELETE /xiaohongshu/api/client/discovery/:id
 */
router.delete('/discovery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DiscoveredNote.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ success: false, message: '笔记不存在' });
    }

    log.info(`🗑️ [笔记删除] 成功: ${id}`);
    res.json({ success: true, message: '已删除' });
  } catch (error) {
    log.error('❌ [笔记删除] 失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量删除笔记
 * DELETE /xiaohongshu/api/client/discovery/batch
 */
router.delete('/discovery/batch', async (req, res) => {
  try {
    const { noteIds } = req.body;

    if (!Array.isArray(noteIds)) {
      return res.status(400).json({ success: false, message: '参数格式不正确' });
    }

    const result = await DiscoveredNote.deleteMany({ _id: { $in: noteIds } });

    log.info(`🗑️ [批量删除] 成功: ${result.deletedCount} 条`);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    log.error('❌ [批量删除] 失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取笔记发现任务（关键词列表）
 * GET /xiaohongshu/api/client/discovery/keywords
 *
 * 专用于 discovery-client（笔记发现客户端）
 */
router.get('/discovery/keywords', async (req, res) => {
  try {
    const { clientId, clientType } = req.query;
    const headerClientType = req.headers['x-client-type'];
    const finalClientType = clientType || headerClientType;

    // 验证客户端类型
    if (finalClientType && finalClientType !== 'discovery') {
      return res.status(400).json({
        success: false,
        message: `此接口仅限 discovery-client 使用`
      });
    }

    // 返回搜索关键词列表
    const keywords = [
      { keyword: '减肥被骗', priority: 1 },
      { keyword: '护肤被骗', priority: 1 },
      { keyword: '祛斑被骗', priority: 1 },
      { keyword: '美容院被骗', priority: 2 },
      { keyword: '整容被骗', priority: 2 },
      { keyword: '网购被骗', priority: 3 },
      { keyword: '微商被骗', priority: 3 }
    ];

    log.info(`📥 [发现客户端] 返回 ${keywords.length} 个搜索关键词`);

    res.json({
      success: true,
      data: {
        keywords: keywords,
        count: keywords.length
      }
    });

  } catch (error) {
    log.error('❌ [发现客户端] 获取关键词失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
