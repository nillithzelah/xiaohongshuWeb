const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const Device = require('../models/Device');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
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

    // 检查账号链接格式
    if (!device.accountUrl || !device.accountUrl.includes('xiaohongshu.com')) {
      console.log(`❌ [AI预审核] 失败: 账号链接格式不正确 - ${device.accountUrl}`);
      return {
        passed: false,
        reason: '账号链接格式不正确'
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

// 设备管理权限：mentor, manager, boss 均可访问
const deviceRoles = ['mentor', 'manager', 'boss'];

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
    if (req.user.role === 'part_time') {
      query.createdBy = req.user._id;
      console.log('👤 part_time 用户，仅显示自己创建的设备');
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
      message: '获取待审核设备列表失败',
      error: error.message
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

    // 搜索设备账号名
    if (keyword) {
      query.accountName = { $regex: keyword, $options: 'i' };
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

    const { phone, accountId, accountName, assignedUser, status, influence, onlineDuration, points, remark, reviewImage } = req.body;

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
router.put('/:id', authenticateToken, requireRole(deviceRoles), async (req, res) => {
  try {
    const { phone, accountId, accountName, assignedUser, status, influence, onlineDuration, points, remark, reviewImage } = req.body;

    console.log('🔄 更新设备请求:', {
      id: req.params.id,
      body: req.body,
      user: req.user?.username
    });

    // 查找设备
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    // 准备更新数据
    let updateData = {
      phone,
      accountId,
      accountName,
      assignedUser: assignedUser || req.user._id, // 如果没有指定assignedUser，自动分配给当前用户
      status,
      influence,
      onlineDuration,
      remark
    };

    // 字段级权限控制：积分字段
     if (req.user.role === 'mentor') {
       // 带教老师更新时，剔除points字段，防止他们修改积分
       // 积分保持原值不变
     } else {
       // manager 和 boss 可以修改积分
       updateData.points = points;
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
        message: '更新设备失败',
        error: error.message
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
      is_deleted: { $ne: true }
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

// AI审核设备昵称和账号匹配 (免浏览器轻量版)
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const { accountUrl, accountId, nickname } = req.body;

    // 1. 基础验证
    if (!accountUrl || !accountId || !nickname) {
      return res.status(400).json({ success: false, message: '账号链接、账号ID和昵称均为必填' });
    }

    console.log(`🤖 开始轻量级AI审核: 预期ID"${accountId}"，预期昵称"${nickname}"`);

    const cleanUrl = accountUrl.trim();
    let cleanAccountId = accountId.trim();
    const cleanNickname = nickname.trim();

    // 如果accountId是链接，尝试从中提取ID
    if (cleanAccountId.includes('xiaohongshu.com')) {
      const urlMatch = cleanAccountId.match(/\/user\/profile\/([^/?]+)/);
      if (urlMatch && urlMatch[1]) {
        cleanAccountId = urlMatch[1];
        console.log(`🔄 从链接中提取账号ID: ${cleanAccountId}`);
      }
    }

    // 2. 发起 HTTP 请求 (模拟真实浏览器)
    let html;
    try {
      const response = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': process.env.XIAOHONGSHU_COOKIE || '', // 从环境变量读取真实Cookie
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Referer': 'https://www.xiaohongshu.com/',
          'Accept-Language': 'zh-CN,zh;q=0.9'
        },
        timeout: 15000 // 15秒超时
      });
      html = response.data;
    } catch (error) {
      console.error('🌐 访问小红书失败:', error.message);
      return res.status(400).json({ 
        success: false, 
        message: '无法连接小红书服务器，请检查链接或稍后再试',
        error: error.message 
      });
    }

    // 3. 安全检查：是否被验证码拦截
    if (html.includes('captcha') || html.includes('无法浏览')) {
      return res.status(403).json({
        success: false,
        verified: false,
        message: '触发小红书安全验证，请联系管理员更新系统Cookie',
        reason: 'ip_blocked_or_cookie_expired'
      });
    }

    // 4. 核心提取逻辑：解析 window.__INITIAL_STATE__
    let extractedNickname = null;
    let extractedRedId = null;

    try {
      // 使用正则从源码抓取结构化 JSON
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?})<\/script>/);
      if (stateMatch && stateMatch[1]) {
        const jsonStr = stateMatch[1].replace(/undefined/g, 'null');
        const state = JSON.parse(jsonStr);
        
        // 个人主页深度路径解析
        const info = state.user?.userPageData?.basicInfo || state.userPageData?.basicInfo;
        if (info) {
          extractedNickname = info.nickname;
          extractedRedId = info.redId || info.redNo || info.userId;
        }
      }
    } catch (parseErr) {
      console.warn('⚠️ 结构化数据解析失败，尝试 DOM 回退逻辑');
    }

    // 5. 回退逻辑：如果结构化解析失败，使用 Cheerio (DOM) 解析
    if (!extractedNickname) {
      const $ = cheerio.load(html);
      extractedNickname = $('.nickname, .user-nickname, [data-testid="user-nickname"]').text().trim() || $('h1').text().trim();
      
      // 提取 ID 并过滤掉“小红书号：”前缀
      const idText = $('[class*="user-redId"], .user-redId').text().trim();
      if (idText) {
        extractedRedId = idText.replace(/小红书号[:：]\s*/, '').trim();
      }
    }

    console.log(`🔍 抓取结果 -> 昵称: "${extractedNickname}", ID: "${extractedRedId}"`);

    // 6. 最终比对逻辑
    let isMatch = false;
    let confidence = 0;
    let reasonText = '';

    if (extractedNickname) {
      // ID 必须完全匹配（忽略大小写，防止用户填错大小写字母）
      const idMatched = extractedRedId && extractedRedId.toLowerCase() === cleanAccountId.toLowerCase();

      // 昵称必须完全匹配（忽略大小写）
      const nameMatched = extractedNickname && extractedNickname.toLowerCase() === cleanNickname.toLowerCase();

      if (!idMatched && !nameMatched) {
        isMatch = false;
        confidence = 10;
        reasonText = `账号ID和昵称都不匹配 (发现ID: ${extractedRedId || '无'}, 预期ID: ${cleanAccountId}; 发现昵称: ${extractedNickname}, 预期昵称: ${cleanNickname})`;
      } else if (!idMatched) {
        isMatch = false;
        confidence = 20;
        reasonText = `账号ID不匹配 (发现ID: ${extractedRedId || '无'}, 预期ID: ${cleanAccountId})`;
      } else if (!nameMatched) {
        isMatch = false;
        confidence = 30;
        reasonText = `昵称不匹配 (发现昵称: ${extractedNickname}, 预期昵称: ${cleanNickname})`;
      } else {
        // ID和昵称都完全匹配
        isMatch = true;
        confidence = 100;
        reasonText = '账号ID与昵称完全匹配';
      }
    } else {
      isMatch = false;
      confidence = 0;
      reasonText = '无法获取页面数据，请确保是正确的小红书个人主页链接';
    }

    // 7. 返回统一结果格式
    res.json({
      success: true,
      verified: isMatch,
      confidence,
      message: isMatch ? '验证通过' : '验证失败',
      data: {
        extractedNickname,
        extractedId: extractedRedId
      },
      reasonText
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
router.put('/:id/review', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

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
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '无效的审核操作' });
    }

    if (action === 'reject' && (!reason || reason.trim() === '')) {
      console.log('❌ [人工审核] 参数验证失败: 拒绝操作必须提供原因');
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: '拒绝审核必须提供原因' });
    }

    // 查找设备（在事务中）
    const device = await Device.findById(deviceId).session(session);
    if (!device) {
      console.log('❌ [人工审核] 设备不存在:', deviceId);
      await session.abortTransaction();
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
      await session.abortTransaction();
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

    // 执行数据库更新（在事务中）
    const updatedDevice = await Device.findByIdAndUpdate(deviceId, updateData, {
      new: true,
      runValidators: true,
      session
    });

    if (!updatedDevice) {
      console.log('❌ [人工审核] 数据库更新失败: 未找到更新的设备');
      await session.abortTransaction();
      return res.status(500).json({ success: false, message: '数据库更新失败' });
    }

    // 提交事务
    await session.commitTransaction();

    console.log('✅ [人工审核] 设备审核完成，事务已提交:', {
      id: updatedDevice._id,
      reviewStatus: updatedDevice.reviewStatus,
      status: updatedDevice.status,
      reviewedBy: req.user.username,
      reviewedAt: updatedDevice.reviewedAt
    });

    // 事务外执行populate和通知
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
    await session.abortTransaction();
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
      message: '审核设备失败',
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

module.exports = router;
