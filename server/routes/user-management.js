const express = require('express');
const User = require('../models/User');
const { authenticateToken, Role, canManageUser } = require('../middleware/auth');
const router = express.Router();

// 获取用户资料
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // 从数据库获取真实用户信息
    const user = await User.findById(req.user._id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 计算待审核金额（status=pending 的交易总额，单位：分）
    const Transaction = require('../models/Transaction');
    const pendingTransactions = await Transaction.find({
      user_id: user._id,
      status: 'pending'
    });

    // Transaction.amount 存储的是分，直接求和
    const pendingAmount = pendingTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        points: user.points || 0,
        totalWithdrawn: user.wallet?.total_withdrawn || 0,  // 已提现，单位：元
        avatar: user.avatar,
        nickname: user.nickname || user.username,
        phone: user.phone,
        parentUser: user.parent_id,
        pendingAmount: pendingAmount,  // 待审核，单位：分
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('获取用户资料错误:', error);
    res.status(500).json({ success: false, message: '获取用户资料失败' });
  }
});

// 更新用户资料
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { nickname, phone, avatar } = req.body;

    // 输入长度验证
    if (nickname && nickname.length > 50) {
      return res.status(400).json({ success: false, message: '昵称长度不能超过50个字符' });
    }
    if (phone && phone.length > 20) {
      return res.status(400).json({ success: false, message: '手机号长度不能超过20个字符' });
    }
    if (avatar && avatar.length > 500) {
      return res.status(400).json({ success: false, message: '头像URL长度不能超过500个字符' });
    }

    // 手机号重复检查：如果要修改手机号，检查是否已被其他用户使用
    if (phone !== undefined) {
      const currentUser = await User.findById(req.user._id);
      if (phone !== currentUser.phone) {
        const existingPhoneUser = await User.findOne({
          phone: phone,
          is_deleted: { $ne: true },
          _id: { $ne: req.user._id }  // 排除当前用户
        });

        if (existingPhoneUser) {
          return res.status(400).json({
            success: false,
            message: '该手机号已被其他用户使用'
          });
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { nickname, phone, avatar },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        points: user.points,
        totalWithdrawn: user.wallet?.total_withdrawn || 0,
        avatar: user.avatar,
        nickname: user.nickname,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('更新用户资料错误:', error);
    res.status(500).json({ success: false, message: '更新用户资料失败' });
  }
});

// 更新用户资料（支持客服修改名下用户）
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, phone, wechat, notes, integral_w, integral_z, role, hr_id, mentor_id, parent_id, alipay_qr_code } = req.body;

    // 输入长度验证
    if (nickname && nickname.length > 50) {
      return res.status(400).json({ success: false, message: '昵称长度不能超过50个字符' });
    }
    if (phone && phone.length > 20) {
      return res.status(400).json({ success: false, message: '手机号长度不能超过20个字符' });
    }
    if (wechat && wechat.length > 50) {
      return res.status(400).json({ success: false, message: '微信号长度不能超过50个字符' });
    }
    if (notes && notes.length > 500) {
      return res.status(400).json({ success: false, message: '备注长度不能超过500个字符' });
    }
    if (alipay_qr_code) {
      if (alipay_qr_code.length > 2000) {
        return res.status(400).json({ success: false, message: '支付宝二维码URL长度不能超过2000个字符' });
      }
    }
    if (integral_w && integral_w.length > 100) {
      return res.status(400).json({ success: false, message: '积分号W长度不能超过100个字符' });
    }
    if (integral_z && integral_z.length > 100) {
      return res.status(400).json({ success: false, message: '积分号Z长度不能超过100个字符' });
    }

    console.log('🔍 [DEBUG] 更新用户请求体:', req.body);
    console.log('🔍 [DEBUG] alipay_qr_code:', alipay_qr_code);

    // 查找要更新的用户
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 权限检查
    let allowedFields = [];

    // 调试日志：打印权限检查信息
    console.log('🔍 [权限检查] 当前用户:', {
      id: req.user.id,
      _id: req.user._id?.toString(),
      role: req.user.role,
      username: req.user.username
    });
    console.log('🔍 [权限检查] 目标用户:', {
      id: id,
      hr_id: targetUser.hr_id?.toString(),
      mentor_id: targetUser.mentor_id?.toString(),
      role: targetUser.role
    });

    if (Role.isAdmin(req)) {
      // 老板和主管可以修改所有字段
      allowedFields = ['nickname', 'phone', 'wechat', 'notes', 'integral_w', 'integral_z', 'role', 'alipay_qr_code'];

      // 如果是编辑兼职用户，老板和主管可以分配HR和带教老师，以及上级用户
      if (targetUser.role === 'part_time') {
        allowedFields.push('hr_id', 'mentor_id', 'parent_id');
      }
    } else if (Role.isHr(req) && targetUser.hr_id?.toString() === req.user.id) {
      // HR 可以修改自己名下的兼职用户的基本信息和积分
      allowedFields = ['nickname', 'phone', 'wechat', 'notes', 'integral_w', 'integral_z', 'alipay_qr_code'];
    } else if (Role.isMentor(req) && targetUser.mentor_id?.toString() === req.user.id) {
      // 带教老师可以修改自己名下的用户，包括积分和上级用户
      allowedFields = ['integral_w', 'integral_z', 'parent_id', 'alipay_qr_code'];
    } else if (req.user._id.toString() === id) {
      // 用户可以修改自己的基本信息（比较ObjectId字符串）
      allowedFields = ['nickname', 'phone', 'wechat', 'notes', 'alipay_qr_code'];
    } else {
      return res.status(403).json({ success: false, message: '没有权限修改此用户' });
    }

    // 构建更新对象，只包含允许的字段
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        // 特殊处理：alipay_qr_code 需要映射到 wallet.alipay_qr_code
        if (field === 'alipay_qr_code') {
          console.log('🔍 [DEBUG] 处理 alipay_qr_code 字段');
          console.log('🔍 [DEBUG] targetUser.wallet 存在:', !!targetUser.wallet);
          console.log('🔍 [DEBUG] req.body.alipay_qr_code 值:', req.body[field]);
          console.log('🔍 [DEBUG] req.body.alipay_qr_code 类型:', typeof req.body[field]);
          console.log('🔍 [DEBUG] req.body.alipay_qr_code 长度:', req.body[field]?.length);
          
          // 确保 wallet 对象存在
          if (!targetUser.wallet) {
            console.log('🔍 [DEBUG] wallet 不存在，创建新对象');
            updateData.wallet = {
              alipay_account: null,
              real_name: null,
              alipay_qr_code: req.body[field],
              total_withdrawn: 0
            };
          } else {
            console.log('🔍 [DEBUG] wallet 已存在，使用嵌套更新');
            updateData['wallet.alipay_qr_code'] = req.body[field];
          }
          console.log('🔍 [DEBUG] updateData.wallet:', updateData.wallet);
        } else {
          updateData[field] = req.body[field];
        }
      }
    });
    
    console.log('🔍 [DEBUG] 更新数据:', updateData);

    // 特殊处理培训状态：老板、主管、HR（对其名下用户）和带教老师（对其名下用户）可以编辑兼职用户的培训状态
    if (req.body.training_status !== undefined && targetUser.role === 'part_time') {
      const currentUserRole = req.user.role;
      if (currentUserRole === 'boss' || currentUserRole === 'manager' ||
          (currentUserRole === 'hr' && targetUser.hr_id?.toString() === req.user.id) ||
          (currentUserRole === 'mentor' && targetUser.mentor_id?.toString() === req.user.id)) {
        updateData.training_status = req.body.training_status;
      } else {
        return res.status(403).json({ success: false, message: '没有权限编辑培训状态' });
      }
    }

    // 如果是分配带教老师，自动设置分配时间（必须在注册时间之前）
    if (updateData.mentor_id !== undefined && updateData.mentor_id !== targetUser.mentor_id) {
      if (updateData.mentor_id) {
        // 分配给新的带教老师，设置分配时间为注册时间之前的一段时间
        const registrationTime = new Date(targetUser.createdAt);
        // 设置分配时间为注册时间前1-7天内的随机时间
        const daysBefore = Math.floor(Math.random() * 7) + 1; // 1-7天
        const assignmentTime = new Date(registrationTime.getTime() - daysBefore * 24 * 60 * 60 * 1000);
        updateData.assigned_to_mentor_at = assignmentTime;
      } else {
        // 取消分配，清空分配时间
        updateData.assigned_to_mentor_at = null;
      }
    }

    // 如果没有要更新的字段，返回错误
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: '没有有效的更新字段' });
    }

    // 手机号重复检查：如果要修改手机号，检查是否已被其他用户使用
    if (updateData.phone !== undefined && updateData.phone !== targetUser.phone) {
      const existingPhoneUser = await User.findOne({
        phone: updateData.phone,
        is_deleted: { $ne: true },
        _id: { $ne: id }  // 排除当前用户
      });

      if (existingPhoneUser) {
        return res.status(400).json({
          success: false,
          message: '该手机号已被其他用户使用'
        });
      }
    }

    // 如果要修改 parent_id，记录警告日志
    if (updateData.parent_id !== undefined) {
      const oldParentId = targetUser.parent_id ? targetUser.parent_id.toString() : null;
      const newParentId = updateData.parent_id ? updateData.parent_id.toString() : null;

      if (oldParentId !== newParentId) {
        const ImageReview = require('../models/ImageReview');

        // 统计该用户已完成的任务数
        const completedTasksCount = await ImageReview.countDocuments({
          userId: targetUser._id,
          status: 'manager_approved'
        });

        console.warn(`⚠️ [parent_id变更] 操作人: ${req.user.username}, 目标用户: ${targetUser.username}`);
        console.warn(`⚠️ [parent_id变更] 原parent_id: ${oldParentId || '无'}, 新parent_id: ${newParentId || '清除'}, 已完成任务: ${completedTasksCount}条`);

        // 如果用户有已完成的任务，返回警告但仍允许管理员修改
        if (completedTasksCount > 0) {
          console.warn(`🚨 [parent_id变更] 用户 ${targetUser.username} 已有 ${completedTasksCount} 条完成任务，修改上级可能影响佣金结算！`);
        }
      }
    }

    // 执行更新
    console.log('🔍 [DEBUG] 准备执行更新，updateData:', JSON.stringify(updateData));
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).select('-password');
    console.log('🔍 [DEBUG] 更新后 updatedUser.wallet:', JSON.stringify(updatedUser.wallet));
    console.log('🔍 [DEBUG] 更新后 updatedUser.wallet?.alipay_qr_code:', updatedUser.wallet?.alipay_qr_code);

    res.json({
      success: true,
      message: '用户更新成功',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        nickname: updatedUser.nickname,
        phone: updatedUser.phone,
        wechat: updatedUser.wechat,
        notes: updatedUser.notes,
        integral_w: updatedUser.integral_w,
        integral_z: updatedUser.integral_z,
        role: updatedUser.role,
        mentor_id: updatedUser.mentor_id,
        hr_id: updatedUser.hr_id,
        parent_id: updatedUser.parent_id,
        assigned_to_mentor_at: updatedUser.assigned_to_mentor_at,
        training_status: updatedUser.training_status,
        alipay_qr_code: updatedUser.wallet?.alipay_qr_code
      }
    });
    
    console.log('🔍 [DEBUG] 返回数据 alipay_qr_code:', updatedUser.wallet?.alipay_qr_code);
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({ success: false, message: '更新用户失败' });
  }
});

// 获取用户列表（管理员功能）
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, role, keyword, managed_by, viewType, training_status } = req.query;

    let query = {
      // 排除已锁定的用户（锁定等同于伪删除）
      isLocked: { $ne: true }
    };

    // 根据viewType限制查询范围
    if (viewType === 'staff') {
      // 只返回员工（非兼职用户）
      query.role = { $ne: 'part_time' };
    } else if (viewType === 'client') {
      // 只返回兼职用户，且排除培训状态未设置的用户
      query.role = 'part_time';
      query.training_status = { $ne: null, $ne: '' };
      // 排除小程序自动创建的没有姓名的用户
      query.nickname = { $ne: null, $ne: '', $exists: true };
    }

    // 如果指定了role，进一步过滤
    if (role) {
      query.role = role;
      // 如果查询兼职用户（角色管理），也排除没有姓名的用户
      if (role === 'part_time') {
        query.nickname = { $ne: null, $ne: '', $exists: true };
      }
    }

    // 数据权限过滤条件：HR 和 Mentor 只能看到自己的用户或未分配的用户
    let permissionFilter = null;
    if (Role.isHr(req)) {
      permissionFilter = [
        { hr_id: req.user._id },           // 自己创建的用户
        { hr_id: null },                   // 未分配 HR 的用户
        { hr_id: { $exists: false } }     // 没有 hr_id 字段的用户
      ];
    } else if (Role.isMentor(req)) {
      permissionFilter = [
        { mentor_id: req.user._id },           // 自己名下的用户
        { mentor_id: null },                   // 未分配 Mentor 的用户
        { mentor_id: { $exists: false } }     // 没有 mentor_id 字段的用户
      ];
    }
    // boss 和 manager 可以看到所有用户，不需要额外过滤

    // 安全处理关键词搜索 - 转义正则特殊字符
    if (keyword) {
      // 限制关键词长度，防止DoS
      if (keyword.length > 50) {
        return res.status(400).json({ success: false, message: '搜索关键词过长' });
      }
      // 转义正则表达式特殊字符
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keywordFilter = [
        { username: { $regex: escapedKeyword, $options: 'i' } },
        { nickname: { $regex: escapedKeyword, $options: 'i' } },
        { phone: { $regex: `^${escapedKeyword}$`, $options: 'i' } }  // 手机号精确匹配
      ];

      // 如果有权限过滤，需要用 $and 组合关键词和权限条件
      if (permissionFilter) {
        query.$and = [
          { $or: keywordFilter },
          { $or: permissionFilter }
        ];
      } else {
        query.$or = keywordFilter;
      }
    } else if (permissionFilter) {
      // 没有关键词但有权限过滤
      query.$or = permissionFilter;
    }
    // 只有 boss 和 manager 才能使用 managed_by 参数筛选
    if (managed_by && !permissionFilter) {
      query.mentor_id = managed_by;
    }
    if (training_status) query.training_status = training_status;

    const users = await User.find({
      ...query,
      is_deleted: { $ne: true } // 只返回未删除的用户
    })
      .select('-password')
      .populate({
        path: 'parent_id',
        select: 'username nickname',
        populate: {
          path: 'parent_id',
          select: 'username nickname'
        }
      })
      .populate('hr_id', 'username nickname')
      .populate('mentor_id', 'username nickname')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // 为每个用户添加分配时间和培训状态信息
    const usersWithAssignmentTime = users.map(user => ({
      ...user.toObject(),
      assigned_to_mentor_at: user.assigned_to_mentor_at,
      training_status: user.training_status,
      points: user.points,
      wallet: user.wallet,
      alipay_qr_code: user.wallet?.alipay_qr_code // 添加支付宝二维码字段
    }));

    const total = await User.countDocuments({
      ...query,
      is_deleted: { $ne: true } // 只统计未删除的用户
    });

    // 标准化用户数据，确保字段完整性
    const standardizedUsers = usersWithAssignmentTime.map(user => ({
      ...user,
      points: user.points || 0,
      wallet: {
        total_withdrawn: user.wallet?.total_withdrawn || 0,
        alipay_account: user.wallet?.alipay_account || null,
        real_name: user.wallet?.real_name || null,
        alipay_qr_code: user.wallet?.alipay_qr_code || null
      }
    }));

    res.json({
      success: true,
      users: standardizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ success: false, message: '获取用户列表失败' });
  }
});

// 删除用户（软删除 + 安全检查）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 1. Boss保护机制：禁止删除老板账号
    if (user.role === 'boss') {
      return res.status(400).json({ success: false, message: '老板账号无法删除' });
    }

    // 2. 资金安全锁：检查用户是否有积分
    if (user.points > 0) {
      return res.status(400).json({ success: false, message: '该用户账户仍有积分，无法删除' });
    }

    // 3. 先释放关联的设备（防止孤儿设备）
    const Device = require('../models/Device');
    const deviceUpdateResult = await Device.updateMany(
      { assignedUser: id },
      { $set: { assignedUser: null } }
    );
    console.log(`🔓 已释放用户 ${id} 的 ${deviceUpdateResult.modifiedCount} 个关联设备`);

    // 4. 软删除：标记为已删除
    await User.findByIdAndUpdate(id, {
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: req.user._id  // 记录操作人
    });
    console.log(`🗑️ 已软删除用户 ${id}`);

    res.json({
      success: true,
      message: '用户已成功删除'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ success: false, message: '删除用户失败' });
  }
});

// 更新用户培训状态（升级/降级专用）
router.put('/:id/training-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { training_status } = req.body;

    if (!training_status) {
      return res.status(400).json({ success: false, message: '培训状态不能为空' });
    }

    // 查找要更新的用户
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 检查用户是否为兼职用户
    if (targetUser.role !== 'part_time') {
      return res.status(400).json({ success: false, message: '只能修改兼职用户的培训状态' });
    }

    // 权限检查：老板、主管可以修改所有兼职用户，带教老师只能修改自己名下的用户
    const currentUserRole = req.user.role;
    const hasPermission = currentUserRole === 'boss' ||
                         currentUserRole === 'manager' ||
                         (currentUserRole === 'mentor' && targetUser.mentor_id?.toString() === req.user.id);

    if (!hasPermission) {
      return res.status(403).json({ success: false, message: '没有权限修改此用户的培训状态' });
    }

    // 验证培训状态是否有效
    const validStatuses = [
      '已筛选', '培训中', '业务实操', '评论能力培养',
      '发帖能力培养', '素人已申请发帖内容', '持续跟进', '已结业',
      '未通过', '中止'
    ];

    if (!validStatuses.includes(training_status)) {
      return res.status(400).json({ success: false, message: '无效的培训状态' });
    }

    // 更新培训状态
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { training_status },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: '培训状态更新成功',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        training_status: updatedUser.training_status
      }
    });

  } catch (error) {
    console.error('更新培训状态错误:', error);
    res.status(500).json({ success: false, message: '更新培训状态失败' });
  }
});

// 积分兑换余额
router.post('/:id/exchange-points', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { pointsToExchange } = req.body;

    // 严格验证输入参数
    const pointsNum = parseFloat(pointsToExchange);
    if (isNaN(pointsNum) || !isFinite(pointsNum) || pointsNum <= 0) {
      return res.status(400).json({ success: false, message: '兑换积分数量必须是有效的正数' });
    }

    // 检查是否为整数（积分应该是整数）
    if (pointsNum !== Math.floor(pointsNum)) {
      return res.status(400).json({ success: false, message: '兑换积分数量必须是整数' });
    }

    // 检查最小兑换积分（至少500积分）
    const MIN_EXCHANGE_POINTS = 500;
    if (pointsNum < MIN_EXCHANGE_POINTS) {
      return res.status(400).json({ success: false, message: `至少需要${MIN_EXCHANGE_POINTS}积分才能兑换` });
    }

    // 查找用户 - 支持 username 或 ObjectId
    // 判断是否是有效的 ObjectId 格式（24位十六进制字符串）
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let user;
    if (isValidObjectId) {
      user = await User.findById(id);
    }
    if (!user) {
      // 如果通过 ObjectId 没找到，尝试通过 username 查找
      user = await User.findOne({ username: id });
    }
    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 兑换比例：100积分 = 1元人民币
    // 金额存储规则：所有金额统一存储为分（整数），避免浮点数精度问题
    const amountInCents = pointsNum; // 积分兑换：1积分 = 1分，所以分值 = 积分数
    const amountInYuan = pointsNum / 100; // 显示用：转换为元

    // 检查已提现金额上限（防止兑换后打款时超出限制）
    const currentWithdrawn = user.wallet?.total_withdrawn || 0;
    if (currentWithdrawn + amountInYuan > 999999.99) {
      return res.status(400).json({ success: false, message: '兑换后已提现金额将超过上限' });
    }

    // 原子操作：只有积分足够时才扣减，防止竞态条件
    // 使用 findOneAndUpdate 确保检查和更新是原子操作
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, points: { $gte: pointsNum } },  // 只有积分 >= pointsNum 时才更新
      { $inc: { points: -pointsNum } },
      { new: true }  // 返回更新后的文档
    );

    // 如果更新失败（返回null），说明积分不足
    if (!updatedUser) {
      return res.status(400).json({ success: false, message: '用户积分不足或兑换失败' });
    }

    // 创建待打款交易记录（amount 存储为分，整数）
    const Transaction = require('../models/Transaction');
    await Transaction.create({
      user_id: user._id,
      type: 'point_exchange',
      amount: amountInCents,  // 存储为分（整数），例如 1630 分
      status: 'pending',  // 待打款状态
      description: `积分兑换：${pointsNum}积分 → ${amountInYuan}元`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: `积分兑换成功：${pointsNum}积分兑换为${amountInYuan}元，已进入待打款队列`,
      data: {
        exchangedPoints: pointsNum,
        addedAmount: amountInYuan,  // 返回给前端的是元
        remainingPoints: updatedUser.points,  // 使用更新后的积分
        pendingAmount: amountInYuan  // 待打款金额（元）
      }
    });

  } catch (error) {
    console.error('积分兑换失败:', error);
    res.status(500).json({ success: false, message: '积分兑换失败' });
  }
});

// 管理员修改用户密码
router.put('/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // 权限检查：只有老板和经理可以修改其他用户密码
    if (req.user.role !== 'boss' && req.user.role !== 'manager') {
      return res.status(403).json({ success: false, message: '没有权限修改密码' });
    }

    // 验证新密码
    if (!newPassword || !newPassword.trim()) {
      return res.status(400).json({ success: false, message: '请输入新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码至少需要6位字符' });
    }

    // 查找目标用户
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 更新密码
    targetUser.password = newPassword.trim();
    await targetUser.save();

    // 记录操作日志
    console.log(`🔐 [密码修改] 管理员 ${req.user.username} 修改了用户 ${targetUser.username} 的密码`);

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('管理员修改密码错误:', error);
    res.status(500).json({ success: false, message: '修改密码失败' });
  }
});

// 锁定/解锁用户（HR专用功能）
router.put('/:id/lock', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isLocked, lockedReason } = req.body;

    // 权限检查：只有 HR、经理和老板可以锁定/解锁用户
    if (!['hr', 'manager', 'boss'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: '没有权限执行此操作' });
    }

    // 查找目标用户
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // HR 只能锁定兼职用户
    if (Role.isHr(req) && targetUser.role !== 'part_time') {
      return res.status(403).json({ success: false, message: 'HR 只能锁定兼职用户' });
    }

    // 更新锁定状态
    targetUser.isLocked = isLocked === true;
    if (isLocked) {
      targetUser.lockedAt = new Date();
      targetUser.lockedBy = req.user._id;
      targetUser.lockedReason = lockedReason || null;
      console.log(`🔒 [用户锁定] HR ${req.user.username} 锁定了用户 ${targetUser.username}，原因: ${lockedReason || '无'}`);
    } else {
      targetUser.lockedAt = null;
      targetUser.lockedBy = null;
      targetUser.lockedReason = null;
      console.log(`🔓 [用户解锁] HR ${req.user.username} 解锁了用户 ${targetUser.username}`);
    }

    await targetUser.save();

    res.json({
      success: true,
      message: isLocked ? '用户已锁定' : '用户已解锁',
      data: {
        isLocked: targetUser.isLocked,
        lockedAt: targetUser.lockedAt
      }
    });

  } catch (error) {
    console.error('锁定/解锁用户错误:', error);
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

module.exports = router;