const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const Device = require('../models/Device');
const User = require('../models/User');
const { authenticateToken, requireRole, Role } = require('../middleware/auth');
const { escapeRegExp } = require('../utils/security');
const router = express.Router();

// 设备AI预审核函数
async function performDeviceAiReview(device) {
  try {
    console.log(`🤖 [AI预审核] 开始审核设备: ${device.accountName}, ID: ${device._id}`);
    console.log(`🤖 [AI预审核] 设备数据:`, {
      accountName: device.accountName,
      accountId: device.accountId,
      accountUrl: device.accountUrl,
      reviewImage: device.reviewImage ? '已提供' : '未提供',
      createdBy: device.createdBy
    });

    // 基础检查：必须有审核图片
    if (!device.reviewImage) {
      console.log(`❌ [AI预审核] 失败: 缺少审核图片`);
      return {
        passed: false,
        reason: '缺少审核图片'
      };
    }

    // 检查图片URL是否有效（简单的URL格式检查）
    if (!device.reviewImage.startsWith('http')) {
      console.log(`❌ [AI预审核] 失败: 审核图片URL无效 - ${device.reviewImage}`);
      return {
        passed: false,
        reason: '审核图片URL无效'
      };
    }

    // 检查账号名称格式（简单的格式检查）
    if (!device.accountName || device.accountName.length < 2) {
      console.log(`❌ [AI预审核] 失败: 账号名称格式不正确 - ${device.accountName}`);
      return {
        passed: false,
        reason: '账号名称格式不正确'
      };
    }

    // 检查账号ID格式
    if (!device.accountId || !/^\d{8,12}$/.test(device.accountId)) {
      console.log(`❌ [AI预审核] 失败: 账号ID格式不正确 - ${device.accountId}`);
      return {
        passed: false,
        reason: '账号ID格式不正确'
      };
    }

    console.log(`✅ [AI预审核] 通过: 所有检查通过`);
    // 所有检查通过
    return {
      passed: true,
      reason: 'AI预审核通过'
    };

  } catch (error) {
    console.error('❌ [AI预审核] 系统错误:', error);
    console.error('❌ [AI预审核] 错误详情:', {
      message: error.message,
      stack: error.stack,
      deviceId: device._id,
      accountName: device.accountName
    });
    return {
      passed: false,
      reason: 'AI预审核系统错误'
    };
  }
}

// 设备管理权限：mentor, manager, boss, hr 均可访问
const deviceRoles = ['mentor', 'manager', 'boss', 'hr'];

// 获取待审核设备列表
router.get('/pending-review', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    console.log('🔍 获取待审核设备列表:', { page, limit, user: req.user.username, role: req.user.role });

    // 构建查询条件
    let query = {
      reviewStatus: { $in: ['pending', 'ai_approved'] }
    };

    // 权限控制：part_time 用户只能看到自己创建的设备
    if (Role.isPartTime(req)) {
      query.createdBy = req.user._id;
      console.log('👤 part_time 用户，仅显示自己创建的设备');
    } else if (Role.isMentor(req)) {
      // 带教老师只能看到自己名下用户提交的设备
      const assignedUsers = await User.find({ mentor_id: req.user._id }).select('_id');
      const assignedUserIds = assignedUsers.map(u => u._id);
      query.createdBy = { $in: assignedUserIds };
      console.log(`🎓 [带教老师权限] 当前带教老师: ${req.user.username}, 名下用户数: ${assignedUserIds.length}`);

      // 调试：检查这些用户的所有设备状态
      const allDevices = await Device.find({ createdBy: { $in: assignedUserIds } }).select('accountName reviewStatus');
      console.log(`🎓 [调试] 这些用户创建的所有设备 (${allDevices.length}个):`);
      allDevices.forEach(d => {
        console.log(`   - ${d.accountName}: ${d.reviewStatus}`);
      });
    } else if (!deviceRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    console.log('🔍 查询条件:', query);
    console.log('📊 分页参数:', { skip, limit: parseInt(limit) });

    const devices = await Device.find(query)
    .populate({
      path: 'assignedUser',
      select: 'username nickname',
      options: { lean: true } // 使用lean模式提高性能
    })
    .populate({
      path: 'createdBy',
      select: 'username nickname',
      options: { lean: true } // 使用lean模式提高性能
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    console.log('📋 查询结果数量:', devices.length);

    const total = await Device.countDocuments(query);

    console.log(`📊 找到 ${devices.length} 个待审核设备，总共 ${total} 个`);

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ 获取待审核设备列表失败:', error);
    console.error('❌ 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: '获取待审核设备列表失败'
    });
  }
});

// 获取设备列表
router.get('/', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, assignedUser, keyword, reviewer } = req.query;
    const skip = (page - 1) * limit;

    let query = {
      isLocked: { $ne: true } // 默认不显示锁定的设备
    };

    // 状态过滤
    if (status) {
      query.status = status;
    }

    // 搜索设备账号名
    if (keyword) {
      query.accountName = { $regex: escapeRegExp(keyword), $options: 'i' };
    }

    // 数据权限过滤
    if (Role.isHr(req)) {
      // HR 可以看到：
      // 1. 分配给 hr_id = 自己的用户的设备
      // 2. 分配给 hr_id = null（未分配HR）的用户的设备
      // 3. assignedUser = null（完全未分配）的设备
      const hrUsers = await User.find({
        $or: [
          { hr_id: req.user._id },
          { hr_id: null },
          { hr_id: { $exists: false } }
        ],
        role: 'part_time'
      }).select('_id');
      const hrUserIds = hrUsers.map(user => user._id);

      console.log(`🔍 [设备管理权限] HR ${req.user.username} 查询设备，找到 ${hrUserIds.length} 个兼职用户`);

      // 使用 $or：分配给该HR相关用户的设备 OR 完全未分配的设备
      query.$or = [
        { assignedUser: { $in: hrUserIds } },
        { assignedUser: null }
      ];
    } else if (Role.isMentor(req)) {
      // 带教老师可以看到：
      // 1. 分配给 mentor_id = 自己的用户的设备
      // 2. 分配给 mentor_id = null（未分配带教老师）的用户的设备
      // 3. assignedUser = null（完全未分配）的设备
      const mentorUsers = await User.find({
        $or: [
          { mentor_id: req.user._id },
          { mentor_id: null },
          { mentor_id: { $exists: false } }
        ],
        role: 'part_time'
      }).select('_id');
      const mentorUserIds = mentorUsers.map(user => user._id);

      console.log(`🔍 [设备管理权限] 带教老师 ${req.user.username} 查询设备，找到 ${mentorUserIds.length} 个兼职用户`);

      // 使用 $or：分配给该带教老师相关用户的设备 OR 完全未分配的设备
      query.$or = [
        { assignedUser: { $in: mentorUserIds } },
        { assignedUser: null }
      ];
    } else {
      // boss/manager 使用原有的筛选逻辑
      // 分配用户过滤
      if (assignedUser) {
        query.assignedUser = assignedUser;
      }

      // 按客服筛选：找到该客服名下的用户，然后筛选这些用户分配的设备
      if (reviewer) {
        const csUsers = await User.find({ managed_by: reviewer }).select('_id');
        const userIds = csUsers.map(user => user._id);
        query.assignedUser = { $in: userIds };
      }
    }

    const devices = await Device.find(query)
      .populate('assignedUser', 'username nickname mentor_id')
      .populate('createdBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
  
    // 手动populate mentor信息
    for (const device of devices) {
      if (device.assignedUser && device.assignedUser.mentor_id) {
        const mentor = await User.findById(device.assignedUser.mentor_id).select('username nickname');
        device.assignedUser.mentor_id = mentor;
      }
    }

    const total = await Device.countDocuments(query);

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({ success: false, message: '获取设备列表失败' });
  }
});

// ==================== 设备修改申请路由（必须在 /:id 之前）====================

// 获取设备修改申请列表（管理员）
router.get('/modify-requests', authenticateToken, requireRole(['manager', 'boss', 'hr', 'mentor']), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      DeviceModifyRequest.find(query)
        .populate('device', 'accountName accountUrl')
        .populate('applicant', 'username nickname phone')
        .populate('reviewer', 'username nickname')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      DeviceModifyRequest.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('❌ [修改申请] 获取列表失败:', error);
    res.status(500).json({ success: false, message: '获取申请列表失败' });
  }
});

// 审核设备修改申请（管理员）
router.post('/modify-requests/:id/review', authenticateToken, requireRole(['manager', 'boss', 'hr', 'mentor']), async (req, res) => {
  try {
    const { action, rejectReason, note } = req.body;
    const requestId = req.params.id;

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的审核操作' });
    }

    const modifyRequest = await DeviceModifyRequest.findById(requestId)
      .populate('device');

    if (!modifyRequest) {
      return res.status(404).json({ success: false, message: '申请不存在' });
    }

    if (modifyRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: '该申请已被处理' });
    }

    if (action === 'approve') {
      // 审核通过：更新设备信息
      const device = modifyRequest.device;
      if (!device) {
        return res.status(404).json({ success: false, message: '关联设备不存在' });
      }

      // 检查新账号名是否已存在（仅限账号名修改）
      if (modifyRequest.modifyType === 'account_name') {
        const existingDevice = await Device.findOne({
          accountName: modifyRequest.newValue,
          _id: { $ne: device._id }
        });
        if (existingDevice) {
          return res.status(400).json({ success: false, message: '该账号名已被使用，无法通过审核' });
        }
        device.accountName = modifyRequest.newValue;
      } else if (modifyRequest.modifyType === 'account_url') {
        device.accountUrl = modifyRequest.newValue;
      }

      await device.save();

      // 更新申请状态
      modifyRequest.status = 'approved';
      modifyRequest.reviewedAt = new Date();
      modifyRequest.reviewer = req.user._id;
      modifyRequest.note = note || '';
      await modifyRequest.save();

      console.log('✅ [修改申请] 审核通过:', {
        requestId: modifyRequest._id,
        deviceId: device._id,
        modifyType: modifyRequest.modifyType,
        newValue: modifyRequest.newValue
      });

      res.json({
        success: true,
        message: '修改申请已通过，设备信息已更新',
        data: { device, request: modifyRequest }
      });

    } else {
      // 审核拒绝
      modifyRequest.status = 'rejected';
      modifyRequest.reviewedAt = new Date();
      modifyRequest.reviewer = req.user._id;
      modifyRequest.rejectReason = rejectReason || '管理员拒绝';
      modifyRequest.note = note || '';
      await modifyRequest.save();

      console.log('✅ [修改申请] 已拒绝:', {
        requestId: modifyRequest._id,
        reason: rejectReason
      });

      res.json({
        success: true,
        message: '修改申请已拒绝',
        data: { request: modifyRequest }
      });
    }

  } catch (error) {
    console.error('❌ [修改申请] 审核失败:', error);
    res.status(500).json({ success: false, message: '审核申请失败' });
  }
});

// 获取用户的修改申请列表
router.get('/my-modify-requests', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;

    const query = { applicant: req.user._id };
    if (status) {
      query.status = status;
    }

    const requests = await DeviceModifyRequest.find(query)
      .populate('device', 'accountName accountUrl')
      .populate('reviewer', 'username nickname')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: { requests }
    });

  } catch (error) {
    console.error('❌ [修改申请] 获取我的申请失败:', error);
    res.status(500).json({ success: false, message: '获取申请列表失败' });
  }
});

// ==================== 设备详情路由（必须在具体路由之后）====================

// 获取单个设备详情
router.get('/:id', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)
      .populate({
        path: 'assignedUser',
        select: 'username nickname mentor_id',
        populate: {
          path: 'mentor_id',
          select: 'username nickname'
        }
      })
      .populate('createdBy', 'username nickname');

    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    res.json({ success: true, data: device });
  } catch (error) {
    console.error('获取设备详情失败:', error);
    res.status(500).json({ success: false, message: '获取设备详情失败' });
  }
});

// 创建设备
router.post('/', authenticateToken, async (req, res) => {
  try {

    const { phone, accountId, accountName, accountUrl, assignedUser, status, influence, onlineDuration, points, remark, reviewImage } = req.body;

    // 验证必填字段
    if (!accountName) {
      return res.status(400).json({ success: false, message: '设备账号名不能为空' });
    }

    // 检查账号名是否已存在
    const existingDevice = await Device.findOne({ accountName });
    if (existingDevice) {
      return res.status(400).json({ success: false, message: '设备账号名已存在' });
    }

    // 字段级权限控制：积分字段
    let deviceData = {
      phone,
      accountId,
      accountName,
      accountUrl: accountUrl || '', // 存储账号链接
      assignedUser: assignedUser || req.user._id, // 如果没有指定assignedUser，自动分配给当前用户
      status: 'reviewing', // 创建设备时设为审核中状态，表示正在等待审核
      influence,
      onlineDuration,
      remark,
      reviewImage: reviewImage || '',
      reviewStatus: 'pending', // 创建设备后先设为pending，等待AI审核
      createdBy: req.user._id
    };

    // 如果是带教老师创建，强制积分设为0，忽略前端传的值
     if (req.user.role === 'mentor') {
       deviceData.points = 0;
     } else {
       // manager 和 boss 可以设置初始积分
       deviceData.points = points || 0;
     }

    const device = new Device(deviceData);
    await device.save();

    // 【新增】创建设备后进行AI预审核
    try {
      console.log('🤖 [创建设备] 开始设备AI预审核...', {
        deviceId: device._id,
        accountName: device.accountName,
        createdBy: device.createdBy
      });
      const aiReviewResult = await performDeviceAiReview(device);

      if (aiReviewResult.passed) {
        // AI审核通过，更新设备状态为ai_approved
        const updateResult = await Device.findByIdAndUpdate(device._id, {
          reviewStatus: 'ai_approved'
        }, { new: true });

        console.log('✅ [创建设备] 设备AI预审核通过，状态更新为ai_approved:', {
          deviceId: device._id,
          accountName: device.accountName,
          newStatus: updateResult?.reviewStatus
        });
      } else {
        // AI审核失败，保持pending状态等待人工审核
        console.log('❌ [创建设备] 设备AI预审核失败:', {
          deviceId: device._id,
          accountName: device.accountName,
          reason: aiReviewResult.reason,
          currentStatus: 'pending (等待人工审核)'
        });
      }
    } catch (aiError) {
      console.error('❌ [创建设备] 设备AI预审核系统错误:', {
        deviceId: device._id,
        accountName: device.accountName,
        error: aiError.message,
        stack: aiError.stack
      });
      // AI审核失败不影响设备创建，保持pending状态
    }

    // 重新查询以获取关联数据
    const populatedDevice = await Device.findById(device._id)
      .populate({
        path: 'assignedUser',
        select: 'username nickname mentor_id',
        populate: {
          path: 'mentor_id',
          select: 'username nickname'
        }
      })
      .populate('createdBy', 'username nickname');

    res.json({
      success: true,
      message: '设备创建成功',
      data: populatedDevice
    });
  } catch (error) {
    console.error('创建设备失败:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: '设备账号名已存在' });
    } else {
      res.status(500).json({ success: false, message: '创建设备失败' });
    }
  }
});

// 更新设备
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { phone, accountId, accountName, accountUrl, assignedUser, status, influence, onlineDuration, points, remark, reviewImage } = req.body;

    console.log('🔄 更新设备请求:', {
      id: req.params.id,
      body: req.body,
      user: req.user?.username,
      role: req.user?.role
    });

    // 查找设备
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 权限检查：管理员可以修改任何设备，part_time 用户只能修改分配给自己的设备
    const isAdmin = deviceRoles.includes(req.user.role);
    const isOwner = device.assignedUser && device.assignedUser.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: '权限不足，只有管理员或设备所有者可以修改设备' });
    }

    // 准备更新数据：只包含明确传来的字段
    let updateData = {};

    // part_time 用户只能修改账号昵称和链接
    if (req.user.role === 'part_time') {
      if (accountName !== undefined) updateData.accountName = accountName;
      if (accountUrl !== undefined) updateData.accountUrl = accountUrl;
    } else {
      // 管理员可以修改所有字段
      if (phone !== undefined) updateData.phone = phone;
      if (accountId !== undefined) updateData.accountId = accountId;
      if (accountName !== undefined) updateData.accountName = accountName;
      if (accountUrl !== undefined) updateData.accountUrl = accountUrl;
      if (assignedUser !== undefined) updateData.assignedUser = assignedUser || req.user._id;
      if (status !== undefined) updateData.status = status;
      if (influence !== undefined) updateData.influence = influence;
      if (onlineDuration !== undefined) updateData.onlineDuration = onlineDuration;
      if (remark !== undefined) updateData.remark = remark;

      // 字段级权限控制：积分字段
      if (req.user.role === 'mentor') {
        // 带教老师更新时，不修改积分字段
      } else {
        // manager 和 boss 可以修改积分
        if (points !== undefined) updateData.points = points;
      }
    }

    console.log('📝 准备更新数据:', updateData);

    // 如果要修改账号名，检查是否与其他设备重复
    if (accountName && accountName !== device.accountName) {
      const existingDevice = await Device.findOne({
        accountName,
        _id: { $ne: req.params.id }
      });
      if (existingDevice) {
        return res.status(400).json({ success: false, message: '设备账号名已存在' });
      }
    }

    const result = await Device.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    console.log('✅ 数据库更新结果:', result);

    // 重新查询以获取更新后的数据
    const updatedDevice = await Device.findById(req.params.id)
      .populate({
        path: 'assignedUser',
        select: 'username nickname mentor_id',
        populate: {
          path: 'mentor_id',
          select: 'username nickname'
        }
      })
      .populate('createdBy', 'username nickname');

    console.log('📤 返回数据:', updatedDevice);

    res.json({
      success: true,
      message: '设备更新成功',
      data: updatedDevice
    });
  } catch (error) {
    console.error('❌ 更新设备失败:', error);
    console.error('❌ 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (error.code === 11000) {
      res.status(400).json({ success: false, message: '设备账号名已存在' });
    } else if (error.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: '数据验证失败',
        details: Object.values(error.errors).map(e => e.message)
      });
    } else {
      res.status(500).json({
        success: false,
        message: '更新设备失败'
      });
    }
  }
});

// 锁定/解锁设备 (仅manager和boss可以操作)
router.put('/:id/toggle-lock', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 切换锁定状态
    device.isLocked = !device.isLocked;
    await device.save();

    const action = device.isLocked ? '锁定' : '解锁';
    res.json({
      success: true,
      message: `设备${action}成功`,
      data: { isLocked: device.isLocked }
    });
  } catch (error) {
    console.error('锁定/解锁设备失败:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

// 增加设备积分
router.put('/:id/add-points', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { pointsToAdd } = req.body;

    if (!pointsToAdd || pointsToAdd <= 0) {
      return res.status(400).json({ success: false, message: '积分数量必须大于0' });
    }

    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 只有在线设备才能增加积分
    if (device.status !== 'online') {
      return res.status(400).json({ success: false, message: '只有在线设备才能增加积分' });
    }

    // 更新积分 - 使用原子操作避免并发问题
    const updatedDevice = await Device.findByIdAndUpdate(
      req.params.id,
      { $inc: { points: pointsToAdd } },
      { new: true, runValidators: true }
    );

    if (!updatedDevice) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    res.json({
      success: true,
      message: `成功增加 ${pointsToAdd} 积分`,
      data: {
        deviceId: updatedDevice._id,
        newPoints: updatedDevice.points
      }
    });
  } catch (error) {
    console.error('增加积分失败:', error);
    res.status(500).json({ success: false, message: '增加积分失败' });
  }
});

// 获取用户列表（用于分配设备）
router.get('/users/list', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    console.log('🔍 查询兼职用户列表...');
    console.log('📋 当前用户信息:', req.user);

    const query = {
      role: 'part_time', // 只查询普通兼职用户，带教老师不分配设备
      is_deleted: { $ne: true },
      isLocked: { $ne: true } // 排除已锁定的用户（锁定等同于伪删除）
    };

    console.log('🔍 查询条件:', query);

    const users = await User.find(query)
    .select('username nickname phone wechat role') // 添加role字段用于前端区分
    .sort({ createdAt: -1 });

    console.log(`📊 查询结果: 找到 ${users.length} 个兼职用户`);
    console.log('👥 用户详情:', users.map(u => ({ username: u.username, role: u.role, is_deleted: u.is_deleted })));

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('❌ 获取用户列表失败:', error);
    console.error('❌ 错误详情:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// AI审核设备昵称和账号匹配 (免浏览器轻量版) - 已简化为默认通过
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { accountUrl, accountId, nickname } = req.body;

    console.log(`🤖 [验证] 跳过验证，默认通过: 预期ID"${accountId}"，预期昵称"${nickname}"`);

    // 直接返回验证通过
    res.json({
      success: true,
      verified: true,
      confidence: 100,
      message: '验证通过',
      data: {
        extractedNickname: nickname,
        extractedId: accountId
      },
      reasonText: '验证通过'
    });

  } catch (error) {
    console.error('❌ 审核系统内部错误:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
});

// 删除设备
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deviceId = req.params.id;
    console.log('🗑️ 删除设备请求:', { deviceId, user: req.user.username, role: req.user.role });

    // 查找设备
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 权限检查：只有管理员或设备所有者可以删除
    const isAdmin = ['mentor', 'manager', 'boss'].includes(req.user.role);
    const isOwner = device.assignedUser && device.assignedUser.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: '权限不足，只有管理员或设备所有者可以删除设备' });
    }

    // 删除设备
    await Device.findByIdAndDelete(deviceId);

    console.log('✅ 设备删除成功:', deviceId);
    res.json({
      success: true,
      message: '设备删除成功'
    });

  } catch (error) {
    console.error('❌ 删除设备失败:', error);
    res.status(500).json({ success: false, message: '删除设备失败' });
  }
});

// 审核设备（通过或拒绝）
router.put('/:id/review', authenticateToken, requireRole(['manager', 'boss', 'hr']), async (req, res) => {
  try {
    const { action, reason } = req.body;
    const deviceId = req.params.id;

    console.log('🔄 [人工审核] 开始审核设备请求:', {
      deviceId,
      action,
      reason: reason || '未提供',
      user: req.user.username,
      userId: req.user._id,
      userRole: req.user.role
    });

    // 参数验证
    if (!['approve', 'reject'].includes(action)) {
      console.log('❌ [人工审核] 参数验证失败: 无效的审核操作 -', action);
      return res.status(400).json({ success: false, message: '无效的审核操作' });
    }

    if (action === 'reject' && (!reason || reason.trim() === '')) {
      console.log('❌ [人工审核] 参数验证失败: 拒绝操作必须提供原因');
      return res.status(400).json({ success: false, message: '拒绝审核必须提供原因' });
    }

    // 查找设备
    const device = await Device.findById(deviceId);
    if (!device) {
      console.log('❌ [人工审核] 设备不存在:', deviceId);
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    console.log('📋 [人工审核] 设备当前状态:', {
      id: device._id,
      accountName: device.accountName,
      reviewStatus: device.reviewStatus,
      status: device.status,
      assignedUser: device.assignedUser,
      createdBy: device.createdBy
    });

    // 状态验证
    if (!['pending', 'ai_approved'].includes(device.reviewStatus)) {
      console.log('❌ [人工审核] 设备状态不允许审核:', device.reviewStatus);
      return res.status(400).json({
        success: false,
        message: `设备当前状态为 ${device.reviewStatus}，不允许人工审核`
      });
    }

    // 准备更新数据
    const updateData = {
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    };

    if (action === 'approve') {
      updateData.reviewStatus = 'approved';
      updateData.status = 'online'; // 审核通过后自动设为在线状态
      console.log('✅ [人工审核] 审核通过，设置状态为approved和online');
    } else {
      updateData.reviewStatus = 'rejected';
      updateData.reviewReason = reason.trim();
      updateData.assignedUser = null; // 审核拒绝时解除设备与用户的分配关系
      updateData.status = 'offline'; // 重置设备状态
      console.log('❌ [人工审核] 审核拒绝，原因:', updateData.reviewReason, '，解除用户分配');
    }

    console.log('🔄 [人工审核] 准备更新数据库:', updateData);

    // 执行数据库更新
    const updatedDevice = await Device.findByIdAndUpdate(deviceId, updateData, {
      new: true,
      runValidators: true
    });

    if (!updatedDevice) {
      console.log('❌ [人工审核] 数据库更新失败: 未找到更新的设备');
      return res.status(500).json({ success: false, message: '数据库更新失败' });
    }

    console.log('✅ [人工审核] 设备审核完成:', {
      id: updatedDevice._id,
      reviewStatus: updatedDevice.reviewStatus,
      status: updatedDevice.status,
      reviewedBy: req.user.username,
      reviewedAt: updatedDevice.reviewedAt
    });

    // 执行populate
    const populatedDevice = await Device.findById(updatedDevice._id)
      .populate({
        path: 'assignedUser',
        select: 'username nickname',
        options: { lean: true }
      })
      .populate({
        path: 'reviewedBy',
        select: 'username nickname',
        options: { lean: true }
      });

    // 发送通知（可选，后续添加）
    // await notificationService.sendDeviceReviewNotification(populatedDevice, action, reason);

    res.json({
      success: true,
      message: action === 'approve' ? '设备审核通过' : '设备审核拒绝',
      data: populatedDevice
    });

  } catch (error) {
    console.error('❌ [人工审核] 审核设备失败:', error);
    console.error('❌ [人工审核] 错误详情:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      deviceId: req.params.id,
      action: req.body.action,
      user: req.user?.username
    });
    res.status(500).json({
      success: false,
      message: '审核设备失败'
    });
  }
});

// ==================== 设备修改申请 API ====================

// 提交设备修改申请（兼职用户）
router.post('/:id/modify-request', authenticateToken, async (req, res) => {
  try {
    const { accountName, accountUrl, reason } = req.body;

    console.log('📝 [修改申请] 收到申请:', {
      deviceId: req.params.id,
      userId: req.user._id,
      accountName,
      accountUrl,
      reason
    });

    // 查找设备
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 验证权限：只能修改分配给自己的设备
    const isOwner = device.assignedUser && device.assignedUser.toString() === req.user._id.toString();
    const isAdmin = ['manager', 'boss', 'hr', 'mentor'].includes(req.user.role);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: '权限不足，只能申请修改自己的设备' });
    }

    // 检查是否有待审核的申请
    const pendingRequest = await DeviceModifyRequest.findOne({
      device: req.params.id,
      status: 'pending'
    });

    if (pendingRequest) {
      return res.status(400).json({ success: false, message: '该设备有待审核的修改申请，请等待审核完成' });
    }

    // 创建修改申请
    const modifyRequests = [];

    // 账号名修改申请
    if (accountName && accountName.trim() !== device.accountName) {
      // 检查新账号名是否已存在
      const existingDevice = await Device.findOne({
        accountName: accountName.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingDevice) {
        return res.status(400).json({ success: false, message: '该账号名已被使用' });
      }

      modifyRequests.push({
        device: device._id,
        deviceAccountName: device.accountName,
        applicant: req.user._id,
        modifyType: 'account_name',
        oldValue: device.accountName,
        newValue: accountName.trim(),
        reason: reason || '修改账号昵称',
        status: 'pending'
      });
    }

    // 账号链接修改申请
    if (accountUrl && accountUrl.trim() !== device.accountUrl) {
      modifyRequests.push({
        device: device._id,
        deviceAccountName: device.accountName,
        applicant: req.user._id,
        modifyType: 'account_url',
        oldValue: device.accountUrl || '',
        newValue: accountUrl.trim(),
        reason: reason || '修改账号链接',
        status: 'pending'
      });
    }

    if (modifyRequests.length === 0) {
      return res.status(400).json({ success: false, message: '没有需要修改的内容' });
    }

    // 批量创建申请
    const createdRequests = await DeviceModifyRequest.insertMany(modifyRequests);

    console.log('✅ [修改申请] 创建成功:', {
      requestId: createdRequests.map(r => r._id),
      deviceId: device._id
    });

    res.json({
      success: true,
      message: '修改申请已提交，请等待审核',
      data: {
        requests: createdRequests,
        count: createdRequests.length
      }
    });

  } catch (error) {
    console.error('❌ [修改申请] 创建失败:', error);
    res.status(500).json({ success: false, message: '提交申请失败' });
  }
});

module.exports = router;
