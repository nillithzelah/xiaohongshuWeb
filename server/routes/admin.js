const express = require('express');

const ImageReview = require('../models/ImageReview');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const TaskConfig = require('../models/TaskConfig');
const Complaint = require('../models/Complaint');
const DiscoveredNote = require('../models/DiscoveredNote');
const ClientHeartbeat = require('../models/ClientHeartbeat');
const { authenticateToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('Admin');

// ============ 仪表盘相关路由已迁移 ============
// 所有仪表盘相关路由已迁移到 routes/admin/dashboard.js
// 路由包括：
// - GET  /stats
// - GET  /monitoring
// - GET  /dashboard/hr
// - GET  /dashboard/manager
// - GET  /dashboard/mentor
// ============ 财务管理路由已迁移 ============
// 所有财务相关路由已迁移到 routes/admin/finance.js
// 路由包括：
// - GET  /finance/stats
// - GET  /finance/withdrawal-records
// - GET  /finance/part-time-pending
// - GET  /finance/pending
// - POST /finance/pay
// - GET  /finance/export-excel
// ============ 任务积分管理相关路由 ============

// 获取任务积分配置列表
router.get('/task-points', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const configs = await TaskConfig.find({ is_active: true })
      .select('type_key name price commission_1 commission_2 daily_reward_points continuous_check_days')
      .sort({ type_key: 1 });

    res.json({
      success: true,
      configs
    });
  } catch (error) {
    log.error('获取任务积分配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务积分配置失败'
    });
  }
});

// 更新任务积分配置
router.put('/task-points/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    log.info('📝 收到更新任务积分配置请求');
    log.info('📝 请求体:', JSON.stringify(req.body, null, 2));

    const { price, commission_1, commission_2, daily_reward_points, continuous_check_days } = req.body;

    log.info('📝 解构后的参数:', {
      id: req.params.id,
      price,
      commission_1,
      commission_2,
      daily_reward_points,
      continuous_check_days
    });

    // 验证参数：只有任务积分、一级分销积分、二级分销积分是必填项
    if (price === undefined || commission_1 === undefined || commission_2 === undefined) {
      return res.status(400).json({
        success: false,
        message: '任务积分、一级分销积分、二级分销积分是必填项'
      });
    }

    if (price < 0 || commission_1 < 0 || commission_2 < 0 || (daily_reward_points !== undefined && daily_reward_points < 0)) {
      return res.status(400).json({
        success: false,
        message: '积分值不能为负数'
      });
    }

    if (continuous_check_days !== undefined && (continuous_check_days < 1 || continuous_check_days > 365)) {
      return res.status(400).json({
        success: false,
        message: '持续检查天数必须在1-365天之间'
      });
    }

    const updateData = {
      price,
      commission_1,
      commission_2,
      updatedAt: new Date()
    };

    // 只有提供了这些字段才更新
    if (daily_reward_points !== undefined) {
      updateData.daily_reward_points = daily_reward_points;
    }
    if (continuous_check_days !== undefined) {
      updateData.continuous_check_days = continuous_check_days;
    }

    log.info('📝 执行数据库更新，ID:', req.params.id);
    log.info('📝 更新数据:', JSON.stringify(updateData, null, 2));

    try {
      // 使用 findOneAndUpdate 确保更新并返回结果
      log.info('📝 使用 findOneAndUpdate 更新配置');

      const updatedDoc = await TaskConfig.findOneAndUpdate(
        { _id: req.params.id },
        { $set: updateData },
        {
          new: true,  // 返回更新后的文档
          runValidators: false  // 跳过验证以避免问题
        }
      );

      if (!updatedDoc) {
        log.info('❌ 没有找到匹配的文档');
        return res.status(404).json({
          success: false,
          message: '任务配置不存在'
        });
      }

      log.info('✅ 文档更新成功:', {
        id: updatedDoc._id,
        price: updatedDoc.price,
        commission_1: updatedDoc.commission_1,
        commission_2: updatedDoc.commission_2,
        daily_reward_points: updatedDoc.daily_reward_points
      });

      res.json({
        success: true,
        message: '任务积分配置更新成功',
        config: updatedDoc
      });

    } catch (updateError) {
      log.error('📝 数据库更新异常:', updateError);
      return res.status(500).json({
        success: false,
        message: '数据库更新失败'
      });
    }

  } catch (error) {
    log.error('更新任务积分配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新任务积分配置失败'
    });
  }
});

// ============ 兼职用户管理相关路由 ============

// 执行用户提现（将待打款移至已提现）
router.post('/withdraw/:userId', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { userId } = req.params;

    // 查找用户 - 支持 username 或 ObjectId（防御性编程）
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
    let user;
    if (isValidObjectId) {
      user = await User.findById(userId);
    }
    if (!user) {
      user = await User.findOne({ username: userId });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 使用用户的 ObjectId 进行后续操作
    const userObjectId = user._id;

    // 查找该用户的所有待打款交易
    const pendingTransactions = await Transaction.find({
      user_id: userObjectId,
      status: 'pending'
    });

    if (pendingTransactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '该用户没有待打款记录'
      });
    }

    // 计算总提现金额（避免浮点精度问题，使用整数运算）
    const totalWithdrawAmount = Math.round(
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // 由于使用内部打款，不再需要检查用户钱包信息

    // 更新所有待打款交易为已完成状态
    await Transaction.updateMany(
      {
        user_id: userObjectId,
        status: 'pending'
      },
      {
        status: 'completed',
        paid_at: new Date(),
        paid_by: req.user._id,
        paid_by_name: req.user.username,
        payment_status: 'completed',
        updatedAt: new Date()
      }
    );

    // 更新用户已提现金额（只计算 point_exchange 类型）
    const pointExchangeAmount = pendingTransactions
      .filter(t => t.type === 'point_exchange')
      .reduce((sum, t) => sum + t.amount, 0);
    if (pointExchangeAmount > 0) {
      const currentWithdrawn = user.wallet?.total_withdrawn || 0;
      await User.findByIdAndUpdate(userObjectId, {
        $inc: {
          'wallet.total_withdrawn': pointExchangeAmount
        }
      });
    }

    // 更新响应数据
    const currentWithdrawn = user.wallet?.total_withdrawn || 0;
    res.json({
      success: true,
      message: `提现成功：处理了${pendingTransactions.length}笔交易，总金额${(totalWithdrawAmount / 100).toFixed(2)}元`,
      data: {
        userId: userObjectId,
        username: user.username,
        transactionCount: pendingTransactions.length,
        totalAmount: totalWithdrawAmount,
        pointExchangeAmount: pointExchangeAmount,
        newTotalWithdrawn: currentWithdrawn + pointExchangeAmount
      }
    });

  } catch (error) {
    log.error('执行提现失败:', error);
    res.status(500).json({
      success: false,
      message: '执行提现失败'
    });
  }
});

// 驳回兑换：将待打款积分返还给用户
router.post('/reject-exchange/:userId', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body; // 驳回原因（可选）

    // 查找用户
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userId);
    let user;
    if (isValidObjectId) {
      user = await User.findById(userId);
    }
    if (!user) {
      user = await User.findOne({ username: userId });
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const userObjectId = user._id;

    // 查找该用户的所有待打款交易
    const pendingTransactions = await Transaction.find({
      user_id: userObjectId,
      status: 'pending'
    });

    if (pendingTransactions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '该用户没有待打款记录'
      });
    }

    // 计算总返还金额（积分）
    const totalRefundAmount = Math.round(
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // 返还积分给用户
    await User.findByIdAndUpdate(userObjectId, {
      $inc: { points: totalRefundAmount }
    });

    // 更新所有待打款交易为已驳回状态
    await Transaction.updateMany(
      {
        user_id: userObjectId,
        status: 'pending'
      },
      {
        status: 'failed',
        payment_status: 'failed',
        payment_error: reason || '管理员驳回兑换',
        updatedAt: new Date()
      }
    );

    log.info(`🚫 [驳回兑换] 用户 ${user.username}，返还积分: ${totalRefundAmount}，原因: ${reason || '无'}`);

    res.json({
      success: true,
      message: `驳回成功：已返还${totalRefundAmount}积分到用户账户`,
      data: {
        userId: userObjectId,
        username: user.username,
        transactionCount: pendingTransactions.length,
        refundAmount: totalRefundAmount,
        newPoints: user.points + totalRefundAmount
      }
    });

  } catch (error) {
    log.error('驳回兑换失败:', error);
    res.status(500).json({
      success: false,
      message: '驳回兑换失败'
    });
  }
});

// ============ Cookie管理相关路由 ============

// 获取当前小红书Cookie信息（从环境变量读取，避免命令注入）
router.get('/cookie', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    // 从环境变量读取，避免命令注入风险
    const cookie = process.env.XIAOHONGSHU_COOKIE || '';

    if (!cookie) {
      return res.json({
        success: true,
        cookie: '',
        expiryInfo: null,
        maskedCookie: null,
        message: '未配置Cookie'
      });
    }

    log.info('🔍 从环境变量读取Cookie信息');

    // 解析cookie中的时间戳，计算过期时间
    let expiryInfo = null;
    if (cookie) {
      // 从cookie中提取loadts时间戳
      const loadtsMatch = cookie.match(/loadts=(\d{13})/);
      if (loadtsMatch) {
        const loadts = parseInt(loadtsMatch[1]);
        const loadDate = new Date(loadts);
        // 小红书cookie通常有效期为30天
        const expiryDate = new Date(loadDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const timeLeft = expiryDate.getTime() - now.getTime();

        expiryInfo = {
          loadedAt: loadDate.toISOString(),
          expiresAt: expiryDate.toISOString(),
          timeLeftMs: timeLeft,
          timeLeftText: timeLeft > 0 ?
            `${Math.floor(timeLeft / (24 * 60 * 60 * 1000))}天 ${Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))}小时` :
            '已过期',
          isExpired: timeLeft <= 0
        };
      }
    }

    res.json({
      success: true,
      cookie: cookie,
      expiryInfo: expiryInfo,
      maskedCookie: cookie ? cookie.substring(0, 50) + '...' : null
    });

  } catch (error) {
    log.error('获取Cookie信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie信息失败'
    });
  }
});

// 获取Cookie监控状态
router.get('/cookie/status', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const cookieMonitorService = require('../services/cookieMonitorService');
    const status = cookieMonitorService.getStatus();
    
    res.json({
      success: true,
      status: {
        isValid: status.isValid,
        lastCheckTime: status.lastCheckTime,
        cookieAge: status.cookieAge,
        cookieCreateTime: status.cookieCreateTime,
        checkInterval: status.checkInterval,
        nextCheckTime: status.nextCheckTime
      }
    });

  } catch (error) {
    log.error('获取Cookie监控状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie监控状态失败'
    });
  }
});

// 更新小红书Cookie（安全版本，避免命令注入）
router.put('/cookie', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { cookie } = req.body;

    if (!cookie || typeof cookie !== 'string' || cookie.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cookie不能为空'
      });
    }

    // 验证cookie格式（至少包含一些基本字段）
    const requiredFields = ['a1=', 'webId=', 'web_session='];
    const hasRequiredFields = requiredFields.some(field => cookie.includes(field));

    if (!hasRequiredFields) {
      return res.status(400).json({
        success: false,
        message: 'Cookie格式不正确，缺少必要的登录信息'
      });
    }

    // 安全检查：防止命令注入
    // 只允许字母、数字、常见符号，拒绝shell元字符
    const dangerousChars = ['$', '`', '|', '&', ';', '(', ')', '<', '>', '\n', '\r'];
    const hasDangerousChars = dangerousChars.some(char => cookie.includes(char));
    if (hasDangerousChars) {
      return res.status(400).json({
        success: false,
        message: 'Cookie包含非法字符'
      });
    }

    log.info('🔄 收到Cookie更新请求，长度:', cookie.length);

    // 返回更新说明（避免命令注入，改为手动更新方式）
    res.json({
      success: true,
      message: 'Cookie验证通过，请手动更新服务器上的 .env 文件中的 XIAOHONGSHU_COOKIE 变量',
      cookieLength: cookie.length,
      maskedCookie: cookie.substring(0, 50) + '...',
      updateInstructions: [
        '1. SSH登录到服务器',
        '2. 编辑 /var/www/xiaohongshu-web/server/.env 文件',
        '3. 更新 XIAOHONGSHU_COOKIE 变量值',
        '4. 运行 pm2 restart xiaohongshu-api --update-env'
      ]
    });

  } catch (error) {
    log.error('更新Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Cookie失败'
    });
  }
});

// ============ 投诉管理相关路由 ============

// 获取投诉列表
router.get('/complaints', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, keyword } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // 状态过滤
    if (status) {
      query.status = status;
    }

    // 搜索投诉内容或用户信息
    if (keyword) {
      // 这里需要联合查询用户信息
      const userIds = await User.find({
        $or: [
          { username: { $regex: keyword, $options: 'i' } },
          { nickname: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } }
        ]
      }).select('_id');

      query.$or = [
        { content: { $regex: keyword, $options: 'i' } },
        { userId: { $in: userIds.map(u => u._id) } }
      ];
    }

    const complaints = await Complaint.find(query)
      .populate('userId', 'username nickname phone')
      .populate('respondedBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(query);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    log.error('获取投诉列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取投诉列表失败'
    });
  }
});

// 更新投诉状态和回复
router.put('/complaints/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { status, adminResponse } = req.body;

    const updateData = {
      updatedAt: new Date()
    };

    if (status) {
      updateData.status = status;
    }

    if (adminResponse && adminResponse.trim()) {
      updateData.adminResponse = adminResponse.trim();
      updateData.respondedBy = req.user._id;
      updateData.respondedAt = new Date();
    }

    const updatedComplaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    .populate('userId', 'username nickname phone')
    .populate('respondedBy', 'username nickname');

    if (!updatedComplaint) {
      return res.status(404).json({
        success: false,
        message: '投诉不存在'
      });
    }

    res.json({
      success: true,
      message: '投诉更新成功',
      data: updatedComplaint
    });

  } catch (error) {
    log.error('更新投诉失败:', error);
    res.status(500).json({
      success: false,
      message: '更新投诉失败'
    });
  }
});


// ==================== Cookie监控相关路由 ====================

// 获取Cookie状态
// ==================== Cookie池相关路由 ====================

// 获取Cookie池状态
router.get('/cookie-pool-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');
    const status = simpleCookiePool.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    log.error('获取Cookie池状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie池状态失败'
    });
  }
});

// 重新加载Cookie池配置
router.post('/cookie-pool-reload', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');
    simpleCookiePool.reload();
    const status = simpleCookiePool.getStatus();

    res.json({
      success: true,
      message: 'Cookie池配置已重新加载',
      data: status
    });
  } catch (error) {
    log.error('重新加载Cookie池失败:', error);
    res.status(500).json({
      success: false,
      message: '重新加载Cookie池失败'
    });
  }
});

// 新增/更新Cookie
router.post('/cookie-pool-update', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { cookies } = req.body;

    if (!Array.isArray(cookies)) {
      return res.status(400).json({
        success: false,
        message: '参数格式错误'
      });
    }

    // 只保留原始配置字段，过滤掉状态字段（loadDate, ageHours等）
    const cleanCookies = cookies.map(c => {
      let cookieValue = c.value;
      let loadts = c.loadts;

      // 检查是否是JSON数组格式（浏览器导出格式）
      if (cookieValue && typeof cookieValue === 'string' && cookieValue.trim().startsWith('[')) {
        try {
          const cookieArray = JSON.parse(cookieValue);
          if (Array.isArray(cookieArray)) {
            // 转换为Cookie字符串格式: name1=value1; name2=value2; ...
            cookieValue = cookieArray
              .filter(item => item.name && item.value)
              .map(item => `${item.name}=${item.value}`)
              .join('; ');

            log.info(`🔄 [Cookie池] 已将JSON格式转换为Cookie字符串，${cookieArray.length}个cookie`);

            // 从数组中提取loadts
            const loadtsCookie = cookieArray.find(item => item.name === 'loadts');
            if (loadtsCookie && loadtsCookie.value) {
              loadts = parseInt(loadtsCookie.value);
            }
          }
        } catch (e) {
          log.info('⚠️ [Cookie池] value不是有效JSON，作为Cookie字符串处理');
        }
      }

      // 从cookie字符串中提取loadts（如果还没有）
      if (!loadts && cookieValue) {
        const loadtsMatch = cookieValue.match(/loadts=(\d{13})/);
        if (loadtsMatch) {
          loadts = parseInt(loadtsMatch[1]);
        }
      }

      return {
        id: c.id,
        name: c.name,
        value: cookieValue,
        loadts: loadts || Date.now(),
        estimatedExpiry: c.estimatedExpiry || 72,
        priority: c.priority || 5,
        enabled: c.enabled !== false
      };
    });

    // 写入配置文件
    const fs = require('fs');
    const path = require('path');

    const configContent = `/**
 * Cookie 池配置
 * 添加多个小红书账号的 Cookie，系统会自动轮询使用
 *
 * 获取 Cookie 步骤：
 * 1. 浏览器登录小红书
 * 2. F12 → Network → 刷新页面
 * 3. 点击任意请求 → Request Headers → Cookie
 * 4. 复制完整 Cookie 字符串到下面
 *
 * 支持两种格式：
 * - Cookie字符串格式: a1=xxx; webId=xxx; web_session=xxx; ...
 * - 浏览器导出JSON格式: [{"name":"a1","value":"xxx"},...]
 */

module.exports = {
  // Cookie 列表
  cookies: ${JSON.stringify(cleanCookies, null, 2)}
};
`;

    const configPath = path.join(__dirname, '../config/cookie-pool.js');
    fs.writeFileSync(configPath, configContent, 'utf8');

    // 重新加载配置
    const simpleCookiePool = require('../services/SimpleCookiePool');
    simpleCookiePool.reload();

    res.json({
      success: true,
      message: 'Cookie配置已更新',
      data: simpleCookiePool.getStatus()
    });
  } catch (error) {
    log.error('更新Cookie配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Cookie配置失败: ' + error.message
    });
  }
});

// 获取审核暂停状态
router.get('/audit-pause-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');
    const pauseStatus = simpleCookiePool.getAuditPauseStatus();

    res.json({
      success: true,
      data: pauseStatus
    });
  } catch (error) {
    log.error('获取审核暂停状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取审核暂停状态失败'
    });
  }
});

// 恢复审核（当有新Cookie生效时手动调用）
router.post('/audit-resume', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const simpleCookiePool = require('../services/SimpleCookiePool');

    // 检查是否还有有效的Cookie
    const allInvalid = simpleCookiePool.areAllCookiesInvalid();

    if (allInvalid) {
      return res.json({
        success: false,
        message: '无法恢复审核：所有Cookie均已失效，请先更新Cookie'
      });
    }

    simpleCookiePool.resumeAudits();

    res.json({
      success: true,
      message: '审核已恢复'
    });
  } catch (error) {
    log.error('恢复审核失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复审核失败'
    });
  }
});

// 清除Cookie失效标记（用于重置特定Cookie或全部Cookie）
router.post('/cookie-clear-invalid', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { cookieId } = req.body;
    const simpleCookiePool = require('../services/SimpleCookiePool');

    if (cookieId) {
      // 清除特定Cookie的失效标记
      simpleCookiePool.clearInvalidCookies(cookieId);
    } else {
      // 清除所有失效标记
      simpleCookiePool.clearInvalidCookies();
    }

    res.json({
      success: true,
      message: cookieId ? `已清除Cookie ${cookieId} 的失效标记` : '已清除所有失效标记',
      data: simpleCookiePool.getStatus()
    });
  } catch (error) {
    log.error('清除失效标记失败:', error);
    res.status(500).json({
      success: false,
      message: '清除失效标记失败'
    });
  }
});

// ==================== 公告管理相关路由 ====================

const Announcement = require('../models/Announcement');

// 获取公告列表
router.get('/announcements', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 20, enabled } = req.query;

    const query = {};
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    const total = await Announcement.countDocuments(query);
    const announcements = await Announcement.find(query)
      .sort({ isPinned: -1, order: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'nickname')
      .populate('updatedBy', 'nickname');

    res.json({
      success: true,
      data: {
        list: announcements,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    log.error('获取公告列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告列表失败'
    });
  }
});

// 获取单个公告详情
router.get('/announcement/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('createdBy', 'nickname')
      .populate('updatedBy', 'nickname');

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
    log.error('获取公告详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取公告详情失败'
    });
  }
});

// 创建公告
router.post('/announcement', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { title, content, type, order, enabled, isPinned, actionType, actionData, textColor, fontSize } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    const announcement = new Announcement({
      title,
      content,
      type: type || 'info',
      order: order || 0,
      enabled: enabled !== undefined ? enabled : true,
      isPinned: isPinned || false,
      actionType: actionType || 'none',
      actionData: actionData || '',
      textColor: textColor || '#ffffff',
      fontSize: fontSize || '28',
      createdBy: req.user.userId,
      updatedBy: req.user.userId
    });

    await announcement.save();

    res.json({
      success: true,
      message: '公告创建成功',
      data: announcement
    });
  } catch (error) {
    log.error('创建公告失败:', error);
    res.status(500).json({
      success: false,
      message: '创建公告失败: ' + error.message
    });
  }
});

// 更新公告
router.put('/announcement/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { title, content, type, order, enabled, isPinned, actionType, actionData, textColor, fontSize } = req.body;

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (order !== undefined) announcement.order = order;
    if (enabled !== undefined) announcement.enabled = enabled;
    if (isPinned !== undefined) announcement.isPinned = isPinned;
    if (actionType) announcement.actionType = actionType;
    if (actionData !== undefined) announcement.actionData = actionData;
    if (textColor) announcement.textColor = textColor;
    if (fontSize) announcement.fontSize = fontSize;
    announcement.updatedBy = req.user.userId;

    await announcement.save();

    res.json({
      success: true,
      message: '公告更新成功',
      data: announcement
    });
  } catch (error) {
    log.error('更新公告失败:', error);
    res.status(500).json({
      success: false,
      message: '更新公告失败: ' + error.message
    });
  }
});

// 删除公告
router.delete('/announcement/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    await Announcement.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: '公告删除成功'
    });
  } catch (error) {
    log.error('删除公告失败:', error);
    res.status(500).json({
      success: false,
      message: '删除公告失败'
    });
  }
});

// 切换公告启用状态
router.put('/announcement/:id/toggle', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: '公告不存在'
      });
    }

    announcement.enabled = !announcement.enabled;
    announcement.updatedBy = req.user.userId;
    await announcement.save();

    res.json({
      success: true,
      message: `公告已${announcement.enabled ? '启用' : '禁用'}`,
      data: announcement
    });
  } catch (error) {
    log.error('切换公告状态失败:', error);
    res.status(500).json({
      success: false,
      message: '切换公告状态失败'
    });
  }
});

// ==================== Cookie监控相关路由 ====================

// 获取Cookie状态
router.get('/cookie-status', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookieMonitorService = require('../services/cookieMonitorService');
    const status = cookieMonitorService.getStatus();

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    log.error('获取Cookie状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie状态失败'
    });
  }
});

// 手动检查Cookie
router.post('/cookie-check', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookieMonitorService = require('../services/cookieMonitorService');
    const result = await cookieMonitorService.manualCheck();

    res.json({
      success: true,
      message: 'Cookie检查完成',
      data: result
    });
  } catch (error) {
    log.error('手动检查Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '手动检查Cookie失败'
    });
  }
});

// ==================== CookiePoolService（数据库版本）相关路由 ====================

// 获取Cookie池统计
router.get('/cookies/stats', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const stats = await cookiePoolService.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    log.error('获取Cookie池统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie池统计失败'
    });
  }
});

// 获取所有Cookie列表
router.get('/cookies', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const { status } = req.query;
    
    let query = {};
    if (status) {
      query.status = status;
    }
    
    const cookies = await CookiePool.find(query)
      .sort({ priority: -1, 'metadata.lastUsed': 1 })
      .select('-cookie'); // 不返回完整的cookie值，只返回元数据
    
    res.json({
      success: true,
      data: cookies
    });
  } catch (error) {
    log.error('获取Cookie列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie列表失败'
    });
  }
});

// 获取单个Cookie详情
router.get('/cookies/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const cookie = await CookiePool.findById(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    res.json({
      success: true,
      data: cookie
    });
  } catch (error) {
    log.error('获取Cookie详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取Cookie详情失败'
    });
  }
});

// 添加新Cookie
router.post('/cookies', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { cookie, priority, notes } = req.body;
    
    if (!cookie || typeof cookie !== 'string' || cookie.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cookie不能为空'
      });
    }
    
    const cookiePoolService = require('../services/CookiePoolService');
    const newCookie = await cookiePoolService.addCookie(cookie, {
      priority,
      notes,
      source: 'admin_api'
    });
    
    res.json({
      success: true,
      message: 'Cookie添加成功',
      data: newCookie
    });
  } catch (error) {
    log.error('添加Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '添加Cookie失败'
    });
  }
});

// 更新Cookie
router.put('/cookies/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const cookie = await CookiePool.findById(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    const { cookie: newCookieValue, priority, notes, status } = req.body;
    
    // 如果提供了新的Cookie值，需要验证
    if (newCookieValue && newCookieValue.trim().length > 0) {
      const cookiePoolService = require('../services/CookiePoolService');
      const isValid = await cookiePoolService.validateCookie(newCookieValue);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Cookie无效，请检查是否已登录或Cookie是否过期'
        });
      }
      
      cookie.cookie = newCookieValue.trim();
      cookie.status = 'active';
      cookie.metadata.lastCheck = new Date();
    }
    
    if (priority !== undefined) {
      cookie.priority = priority;
    }
    
    if (notes !== undefined) {
      cookie.notes = notes;
    }
    
    if (status !== undefined) {
      cookie.status = status;
    }
    
    await cookie.save();
    
    res.json({
      success: true,
      message: 'Cookie更新成功',
      data: cookie
    });
  } catch (error) {
    log.error('更新Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '更新Cookie失败'
    });
  }
});

// 删除Cookie
router.delete('/cookies/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const cookie = await cookiePoolService.deleteCookie(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    res.json({
      success: true,
      message: 'Cookie删除成功'
    });
  } catch (error) {
    log.error('删除Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '删除Cookie失败'
    });
  }
});

// 切换Cookie状态
router.put('/cookies/:id/toggle', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const cookie = await cookiePoolService.toggleCookieStatus(req.params.id);
    
    res.json({
      success: true,
      message: `Cookie已${cookie.status === 'active' ? '启用' : '禁用'}`,
      data: cookie
    });
  } catch (error) {
    log.error('切换Cookie状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '切换Cookie状态失败'
    });
  }
});

// 手动检查单个Cookie
router.post('/cookies/:id/check', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const result = await cookiePoolService.checkSingleCookie(req.params.id);
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    log.error('检查Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '检查Cookie失败'
    });
  }
});

// 批量检查所有Cookie
router.post('/cookies/check-all', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const cookiePoolService = require('../services/CookiePoolService');
    const result = await cookiePoolService.checkAllCookies();
    
    res.json({
      success: true,
      message: `检查完成: ${result.checked}个有效, ${result.expired}个失效`,
      data: result
    });
  } catch (error) {
    log.error('批量检查Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '批量检查Cookie失败'
    });
  }
});

// 标记Cookie为失效
router.post('/cookies/:id/mark-expired', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const CookiePool = require('../models/CookiePool');
    const cookie = await CookiePool.findById(req.params.id);
    
    if (!cookie) {
      return res.status(404).json({
        success: false,
        message: 'Cookie不存在'
      });
    }
    
    const cookiePoolService = require('../services/CookiePoolService');
    await cookiePoolService.markCookieExpired(cookie.cookie, '手动标记为失效');
    
    res.json({
      success: true,
      message: 'Cookie已标记为失效'
    });
  } catch (error) {
    log.error('标记Cookie失效失败:', error);
    res.status(500).json({
      success: false,
      message: '标记Cookie失效失败'
    });
  }
});

// ==================== AI 提示词管理路由已迁移 ====================
// 所有 AI 提示词相关路由已迁移到 routes/admin/ai-prompts.js
// 路由包括：
// - GET    /ai-prompts
// - POST   /ai-prompts
// - PUT    /ai-prompts/:name
// - DELETE /ai-prompts/:name
// - POST   /ai-prompts/:name/test
// - POST   /ai-prompts/reload

// ============ 评论线索管理路由已迁移 ====================
// 所有评论线索相关路由已迁移到 routes/admin/comment-leads.js
// 路由包括：
// - GET  /comment-leads/stats
// - GET  /comment-leads
// - GET  /comment-blacklist
// - POST /comment-blacklist
// - DELETE /comment-blacklist/:keyword// ==================== 评论线索管理 API ====================

// ==================== 关键词管理 API ====================

const SearchKeyword = require('../models/SearchKeyword');

/**
 * 获取所有关键词
 * GET /xiaohongshu/api/admin/keywords
 */
router.get('/keywords', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { category, status } = req.query;
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;

    const keywords = await SearchKeyword.find(query).sort({ category: 1, keyword: 1 });
    res.json({
      success: true,
      data: keywords
    });
  } catch (error) {
    log.error('获取关键词失败:', error);
    res.status(500).json({
      success: false,
      message: '获取关键词失败'
    });
  }
});

/**
 * 创建关键词
 * POST /xiaohongshu/api/admin/keywords
 */
router.post('/keywords', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { keyword, category } = req.body;
    const kw = new SearchKeyword({ keyword, category });
    await kw.save();
    res.json({
      success: true,
      data: kw
    });
  } catch (error) {
    log.error('创建关键词失败:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '关键词已存在'
      });
    }
    res.status(500).json({
      success: false,
      message: '创建关键词失败'
    });
  }
});

/**
 * 更新关键词
 * PUT /xiaohongshu/api/admin/keywords/:id
 */
router.put('/keywords/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword, category, status } = req.body;
    const kw = await SearchKeyword.findByIdAndUpdate(
      id,
      { keyword, category, status },
      { new: true }
    );
    if (!kw) {
      return res.status(404).json({
        success: false,
        message: '关键词不存在'
      });
    }
    res.json({
      success: true,
      data: kw
    });
  } catch (error) {
    log.error('更新关键词失败:', error);
    res.status(500).json({
      success: false,
      message: '更新关键词失败'
    });
  }
});

/**
 * 删除关键词
 * DELETE /xiaohongshu/api/admin/keywords/:id
 */
router.delete('/keywords/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await SearchKeyword.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '关键词不存在'
      });
    }
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    log.error('删除关键词失败:', error);
    res.status(500).json({
      success: false,
      message: '删除关键词失败'
    });
  }
});

/**
 * 批量导入关键词
 * POST /xiaohongshu/api/admin/keywords/batch-import
 */
router.post('/keywords/batch-import', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { keywords } = req.body;
    if (!Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        message: '关键词必须是数组'
      });
    }

    let imported = 0;
    let skipped = 0;
    for (const kw of keywords) {
      const keyword = typeof kw === 'string' ? kw : kw.keyword;
      const category = typeof kw === 'object' ? kw.category : '';
      try {
        await SearchKeyword.create({ keyword, category });
        imported++;
      } catch (e) {
        if (e.code === 11000) skipped++;
        else throw e;
      }
    }

    res.json({
      success: true,
      count: imported,
      skipped
    });
  } catch (error) {
    log.error('批量导入关键词失败:', error);
    res.status(500).json({
      success: false,
      message: '批量导入关键词失败'
    });
  }
});

/**
 * 获取所有分类及其关键词数量统计
 * GET /xiaohongshu/api/admin/keyword-categories
 */
router.get('/keyword-categories', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const categories = await SearchKeyword.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $project: { category: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    log.error('获取分类失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类失败'
    });
  }
});

/**
 * 添加新分类（创建占位关键词确保分类出现在列表中）
 * POST /xiaohongshu/api/admin/keyword-categories
 */
router.post('/keyword-categories', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { category } = req.body;
    if (!category || !category.trim()) {
      return res.status(400).json({
        success: false,
        message: '分类名称不能为空'
      });
    }

    const trimmedCategory = category.trim();

    // 检查是否已存在该分类
    const existing = await SearchKeyword.findOne({ category: trimmedCategory });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '该分类已存在'
      });
    }

    // 创建占位关键词（确保分类出现在列表中）
    const placeholder = new SearchKeyword({
      keyword: `[${trimmedCategory}] 分类`,
      category: trimmedCategory,
      status: 'active',
      searchCount: 0
    });
    await placeholder.save();

    res.json({
      success: true,
      data: { category: trimmedCategory, count: 1 },
      message: '分类添加成功，请使用筛选器添加关键词'
    });
  } catch (error) {
    log.error('添加分类失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '添加分类失败'
    });
  }
});

module.exports = router;