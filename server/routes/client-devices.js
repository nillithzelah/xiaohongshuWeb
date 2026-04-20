/**
 * 客户端设备相关路由
 *
 * 从原 client.js 拆分出来的设备管理相关功能：
 * - 获取用户设备列表
 * - 获取设备审核状态
 */

const express = require('express');
const Device = require('../models/Device');
const ImageReview = require('../models/ImageReview');
const { authenticateToken } = require('../middleware/auth');
const TimeUtils = require('../utils/timeUtils');
const logger = require('../utils/logger');
const router = express.Router();

const log = logger.module('ClientDevices');

/**
 * 获取用户被分配的设备列表
 * GET /xiaohongshu/api/client/device/my-list
 */
router.get('/device/my-list', authenticateToken, async (req, res) => {
  try {
    const devices = await Device.find({
      assignedUser: req.user._id,
      is_deleted: { $ne: true },
      reviewStatus: { $in: ['ai_approved', 'approved'] } // 只返回审核通过的设备
    })
    .select('accountName status influence onlineDuration points reviewStatus reviewReason reviewedAt')
    .sort({ createdAt: -1 });

    // 为每个设备添加昵称限制状态检查
    const devicesWithNicknameStatus = await Promise.all(devices.map(async (device) => {
      const deviceObj = device.toObject();

      // 检查该设备的昵称是否在1天内被使用过（从人工复审通过时间开始计算）
      const nowBeijing = TimeUtils.getBeijingTime();
      const oneDayAgo = new Date(nowBeijing);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      // 将北京时间转换为UTC用于数据库查询
      const oneDayAgoUTC = TimeUtils.beijingToUTC(oneDayAgo);

      // 查找最近1天内人工复审通过使用该昵称的记录
      const recentReview = await ImageReview.findOne({
        'aiParsedNoteInfo.author': device.accountName,
        userId: req.user._id,
        status: { $in: ['manager_approved', 'completed'] },
        $or: [
          { 'managerApproval.approvedAt': { $gte: oneDayAgoUTC } }, // 人工复审通过时间
          { 'financeProcess.processedAt': { $gte: oneDayAgoUTC } } // 财务处理时间（兼容老数据）
        ]
      });

      if (recentReview) {
        // 计算还有多少小时不能使用（从人工复审通过时间开始计算）
        const lastUsedTime = recentReview.managerApproval?.approvedAt || recentReview.financeProcess?.processedAt || recentReview.createdAt;
        const lastUsedBeijing = new Date(lastUsedTime.getTime() + (8 * 60 * 60 * 1000));
        const hoursSinceLastUse = Math.floor((nowBeijing.getTime() - lastUsedBeijing.getTime()) / (1000 * 60 * 60));
        const remainingHours = 24 - hoursSinceLastUse;

        deviceObj.nicknameLimitStatus = {
          canUse: false,
          reason: '昵称限制中',
          remainingHours: Math.max(0, remainingHours),
          lastUsed: lastUsedTime
        };
      } else {
        deviceObj.nicknameLimitStatus = {
          canUse: true,
          reason: '可正常使用'
        };
      }

      return deviceObj;
    }));

    res.json({
      success: true,
      devices: devicesWithNicknameStatus
    });
  } catch (error) {
    log.error('获取用户设备列表错误:', error);
    res.status(500).json({ success: false, message: '获取设备列表失败' });
  }
});

/**
 * 获取用户设备审核状态
 * GET /xiaohongshu/api/client/devices/my-review-status
 */
router.get('/devices/my-review-status', authenticateToken, async (req, res) => {
  try {
    // 获取用户最新提交的设备审核记录
    const latestDevice = await Device.findOne({
      assignedUser: req.user._id,
      reviewStatus: { $in: ['pending', 'ai_approved', 'rejected'] }
    })
    .select('accountName reviewStatus reviewReason createdAt reviewedAt')
    .sort({ createdAt: -1 }); // 获取最新的审核记录

    if (!latestDevice) {
      return res.json({
        success: true,
        reviewStatus: null,
        message: '暂无设备审核记录'
      });
    }

    // 格式化时间为北京时间
    const formattedDevice = {
      ...latestDevice.toObject(),
      accountName: latestDevice.accountName || '未知设备', // 确保accountName不为空
      createdAt: TimeUtils.formatBeijingTime(latestDevice.createdAt),
      reviewedAt: latestDevice.reviewedAt ? TimeUtils.formatBeijingTime(latestDevice.reviewedAt) : null
    };

    res.json({
      success: true,
      reviewStatus: formattedDevice
    });

  } catch (error) {
    log.error('获取用户设备审核状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备审核状态失败'
    });
  }
});

module.exports = router;
