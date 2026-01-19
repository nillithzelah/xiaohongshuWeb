const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const OSS = require('ali-oss');
const router = express.Router();

// 配置头像上传中间件
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 限制 5MB
});

// 获取用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id)
      .populate('parent_id', 'username nickname')
      .populate('mentor_id', 'username nickname')
      .select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 获取待打款金额
    const Transaction = require('../models/Transaction');
    const pendingTransactions = await Transaction.find({
      user_id: req.user._id,
      status: 'pending'
    });
    // 计算待兑换金额，确保正确处理单位转换（避免浮点精度问题）
    const pendingAmount = Math.round(
      pendingTransactions.reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // 生成邀请码（如果没有）
    let invitationCode = user.invitationCode;
    if (!invitationCode) {
      invitationCode = `INV${user._id.toString().slice(-6).toUpperCase()}`;
      // 更新用户的邀请码// pages/profile/profile.js
const app = getApp()
const CONFIG = require('../../config.js')

// 使用配置文件中的API端点（已统一管理）
const API_CONFIG = {
  USER_PROFILE: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.USER.PROFILE,
  USERS_LIST: `${CONFIG.API_BASE_URL}/xiaohongshu/api/users`,
  GENERATE_USER_TOKEN: `${CONFIG.API_BASE_URL}/xiaohongshu/api/auth/generate-user-token`
};

// 从配置文件获取测试token（已移至config.js统一管理）
const ADMIN_TEST_TOKEN = CONFIG.TEST_TOKENS?.BOSS_TOKEN;
const DEFAULT_USER_TOKEN = CONFIG.TEST_TOKENS?.BOSS_TOKEN;

console.log(`👤 个人资料页环境: ${CONFIG.ENV}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    points: 0,
    totalEarned: 0, // 总获得金额
    totalWithdrawn: 0, // 已提现金额
    pendingAmount: 0 // 待兑换金额
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserProfile()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('👤 个人资料页 onShow 被调用');

    // 检查用户是否已完成手机号授权
    if (!getApp().navigateGuard()) {
      return; // 如果未授权，会自动跳转到首页
    }

    // 检查用户信息是否发生变化
    const app = getApp();
    const currentUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const previousUserInfo = this.data.userInfo;

    console.log('👤 当前全局用户信息:', currentUserInfo);
    console.log('👤 页面当前用户信息:', previousUserInfo);

    // 如果用户信息发生变化，重新加载用户资料
    if (this.hasUserInfoChanged(previousUserInfo, currentUserInfo)) {
      console.log('🔄 用户信息发生变化，重新加载用户资料');
      this.loadUserProfile();
    }
  },

  /**
   * 检查用户信息是否发生变化（使用公共方法）
   */
  hasUserInfoChanged(oldInfo, newInfo) {
    return getApp().utils.hasUserInfoChanged(oldInfo, newInfo);
  },

  /**
   * 加载用户资料
   */
  loadUserProfile: function() {
    // 使用当前用户的token
    const token = app.getCurrentToken();
    if (token) {
      this.loadUserProfileWithToken(token);
    } else {
      // 没有token，提示用户先登录
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      // 3秒后返回首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 3000);
    }
  },

  /**
   * 使用指定token加载用户资料
   */
  loadUserProfileWithToken: function(token) {
    console.log('🔍 开始加载用户资料，token:', token ? token.substring(0, 50) + '...' : '无token');

    const app = getApp();
    app.request({
      url: API_CONFIG.USER_PROFILE,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      useCache: false // 用户资料需要实时数据
    }).then(res => {
      console.log('📡 用户资料API响应:', res);
      console.log('📊 响应数据结构:', res.data);
      if (res.data && res.data.success) {
        console.log('✅ API返回成功，用户数据:', res.data.user);
        console.log('💰 积分:', res.data.user.points, '总获得:', res.data.user.wallet?.total_earned, '已提现:', res.data.user.wallet?.total_withdrawn);

        this.setData({
          userInfo: res.data.user,
          points: res.data.user.points || 0, // 显示积分
          totalEarned: res.data.user.wallet?.total_earned || 0, // 总获得金额
          totalWithdrawn: res.data.user.wallet?.total_withdrawn || 0, // 已提现金额
          pendingAmount: res.data.user.pendingAmount || 0 // 待兑换金额
        });
        console.log('📱 页面数据已更新');
      } else {
        console.log('❌ API返回失败，使用模拟数据');
        // 使用模拟用户数据 
        this.loadMockUserProfile()
      }
    }).catch(err => {
      console.log('❌ 网络请求失败:', err);
      // 网络失败时使用模拟数据
      this.loadMockUserProfile()
    });
  },

  /**
   * 加载模拟用户资料（与实际token用户保持一致）
   */
  loadMockUserProfile: function() {
    const mockUser = {
      username: 'user001', // 与实际token用户一致
      nickname: '用户001', // 对应的昵称
      avatar: 'https://via.placeholder.com/120x120/E5E7EB/9CA3AF?text=用户',
      points: 2550, // 积分
      wallet: {
        total_earned: 125.80, // 总获得金额
        total_withdrawn: 115.80 // 已提现金额
      }
    }

    this.setData({
      userInfo: mockUser,
      points: mockUser.points, // 积分
      totalEarned: mockUser.wallet?.total_earned || 0, // 总获得金额
      totalWithdrawn: mockUser.wallet?.total_withdrawn || 0, // 已提现金额
      pendingAmount: 10 // 模拟待兑换金额
    })
  },



  // 登出
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 获取当前token用于调用logout API
          const currentApp = getApp();
          const token = currentApp.getCurrentToken();

          // 清除本地存储
          currentApp.tokenManager.clear(); // 使用tokenManager的clear方法清除所有token相关数据
          wx.removeStorageSync('userInfo'); // 额外清除用户信息
          wx.removeStorageSync('loginType'); // 清除登录类型
          wx.removeStorageSync('testUserToken'); // 清除测试用户token

          // 清除全局数据
          currentApp.globalData.userInfo = null;
          currentApp.globalData.token = null;
          currentApp.globalDataManager.clear();

          // 清除状态管理器中的用户状态
          currentApp.stateManager.updateUserState(null);

          // 调用服务器端logout API（可选，用于记录登出日志）
          if (token) {
            currentApp.request({
              url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/auth/logout`,
              method: 'POST',
              header: { 'Authorization': `Bearer ${token}` },
              success: (res) => {
                console.log('服务器端登出成功');
              },
              fail: (err) => {
                console.log('服务器端登出失败（不影响客户端登出）', err);
              }
            });
          }

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });

          // 跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  },



})
      await require('../models/User').findByIdAndUpdate(req.user._id, { invitationCode });
    }

    // 脱敏显示积分号
    const maskString = (str) => {
      if (!str || str.length <= 4) return str;
      return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
    };

    res.json({
      success: true,
      user: {
        id: user._id,
        openid: user.openid,
        username: user.username,
        nickname: user.nickname,
        phone: user.phone, // 添加手机号字段
        avatar: user.avatar,
        wallet: user.wallet,
        points: user.points,
        totalWithdrawn: user.wallet?.total_withdrawn || 0,
        pendingAmount: pendingAmount,
        integral_z: maskString(user.integral_z),
        integral_w: maskString(user.integral_w),
        mentor: user.mentor_id,
        invitationCode: invitationCode,
        parent: user.parent_id,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { username, nickname, newPassword, parentInvitationCode } = req.body;

    // 验证必填字段
    if (!username || username.trim() === '') {
      return res.status(400).json({ success: false, message: '用户名不能为空' });
    }

    const updateData = {
      username: username.trim(),
      nickname: nickname ? nickname.trim() : username.trim()
    };

    // 如果提供了新密码，验证并更新
    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: '密码至少需要6位字符' });
      }
      updateData.password = newPassword.trim(); // 会通过pre save中间件自动加密
    }

    // 如果提供了上级邀请码，尝试绑定（只在 parent_id 为空时允许设置）
    if (parentInvitationCode && parentInvitationCode.trim()) {
      const invitationCode = parentInvitationCode.trim();

      // 检查用户是否已有上级用户
      if (req.user.parent_id) {
        return res.status(400).json({
          success: false,
          message: '您已有上级用户，无法修改邀请关系'
        });
      }

      // 查找拥有此邀请码的用户
      const parentUser = await require('../models/User').findOne({
        invitationCode: invitationCode,
        is_deleted: { $ne: true }
      });

      if (parentUser) {
        // 检查是否已经是上下级关系
        if (parentUser._id.toString() !== req.user._id.toString()) {
          updateData.parent_id = parentUser._id;
        }
      } else {
        return res.status(400).json({ success: false, message: '邀请码无效' });
      }
    }

    // 检查用户名是否已被其他用户使用
    const existingUser = await require('../models/User').findOne({
      username: updateData.username,
      _id: { $ne: req.user._id },
      is_deleted: { $ne: true }
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已被使用' });
    }

    // 更新用户信息
    const updatedUser = await require('../models/User').findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      message: '用户信息更新成功',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        nickname: updatedUser.nickname
      }
    });

  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ success: false, message: '更新用户信息失败' });
  }
});

// 绑定上级邀请码
router.post('/bind-invitation', authenticateToken, async (req, res) => {
  try {
    const { invitationCode } = req.body;

    if (!invitationCode || invitationCode.trim() === '') {
      return res.status(400).json({ success: false, message: '邀请码不能为空' });
    }

    // 查找拥有此邀请码的用户
    const parentUser = await require('../models/User').findOne({
      invitationCode: invitationCode.trim(),
      is_deleted: { $ne: true }
    });

    if (!parentUser) {
      return res.status(400).json({ success: false, message: '邀请码无效' });
    }

    // 检查是否已经是上下级关系
    if (parentUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: '不能绑定自己的邀请码' });
    }

    // 检查当前用户是否已经有上级
    const currentUser = await require('../models/User').findById(req.user._id);
    if (currentUser.parent_id) {
      return res.status(400).json({ success: false, message: '您已经绑定了上级用户' });
    }

    // 更新用户的上级关系
    await require('../models/User').findByIdAndUpdate(req.user._id, {
      parent_id: parentUser._id
    });

    res.json({
      success: true,
      message: '邀请码绑定成功',
      parent: {
        username: parentUser.username,
        nickname: parentUser.nickname
      }
    });

  } catch (error) {
    console.error('绑定邀请码错误:', error);
    res.status(500).json({ success: false, message: '绑定邀请码失败' });
  }
});

// 获取用户的邀请码
router.get('/invitation-code', authenticateToken, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id);

    // 如果用户没有邀请码，生成一个
    let invitationCode = user.invitationCode;
    if (!invitationCode) {
      invitationCode = `INV${user._id.toString().slice(-6).toUpperCase()}`;
      await require('../models/User').findByIdAndUpdate(req.user._id, { invitationCode });
    }

    res.json({
      success: true,
      invitationCode: invitationCode
    });

  } catch (error) {
    console.error('获取邀请码错误:', error);
    res.status(500).json({ success: false, message: '获取邀请码失败' });
  }
});

// 获取上下级关系树
router.get('/referral-tree', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const Transaction = require('../models/Transaction');

    // 获取上级用户
    const currentUser = await User.findById(req.user._id).populate('parent_id', 'username nickname');
    const parent = currentUser.parent_id;

    // 获取下级用户（直接下级）
    const children = await User.find({
      parent_id: req.user._id,
      is_deleted: { $ne: true }
    }).select('username nickname createdAt');

    // 计算每个下级为您贡献的佣金（从一级佣金交易中计算）
    const childrenWithCommission = await Promise.all(children.map(async (child) => {
      const commissionTransactions = await Transaction.find({
        user_id: req.user._id,
        type: 'referral_bonus_1',
        description: { $regex: child.username, $options: 'i' },
        status: 'completed'
      });
      const totalCommission = commissionTransactions.reduce((sum, t) => sum + t.amount, 0);
      return {
        username: child.username,
        nickname: child.nickname,
        joinedAt: child.createdAt,
        contributedCommission: Math.round(totalCommission * 100) / 100  // 该下级为您贡献的佣金
      };
    }));

    // 获取下级的下级用户
    const grandchildren = [];
    for (const child of children) {
      const childDescendants = await User.find({
        parent_id: child._id,
        is_deleted: { $ne: true }
      }).select('username nickname createdAt');
      grandchildren.push(...childDescendants);
    }

    // 计算每个下级的下级为您贡献的佣金（从二级佣金交易中计算）
    const grandchildrenWithCommission = await Promise.all(grandchildren.map(async (gc) => {
      const commissionTransactions = await Transaction.find({
        user_id: req.user._id,
        type: 'referral_bonus_2',
        description: { $regex: gc.username, $options: 'i' },
        status: 'completed'
      });
      const totalCommission = commissionTransactions.reduce((sum, t) => sum + t.amount, 0);
      return {
        username: gc.username,
        nickname: gc.nickname,
        joinedAt: gc.createdAt,
        contributedCommission: Math.round(totalCommission * 100) / 100  // 该下级为您贡献的佣金
      };
    }));

    res.json({
      success: true,
      referralTree: {
        parent: parent ? {
          username: parent.username,
          nickname: parent.nickname
        } : null,
        children: childrenWithCommission,
        grandchildren: grandchildrenWithCommission
      }
    });

  } catch (error) {
    console.error('获取上下级关系树错误:', error);
    res.status(500).json({ success: false, message: '获取上下级关系树失败' });
  }
});

// 获取分销积分
router.get('/distribution-points', authenticateToken, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');

    // 获取用户的分销积分（通过Transaction表中的referral_bonus类型）
    const referralTransactions = await Transaction.find({
      user_id: req.user._id,
      type: { $in: ['referral_bonus_1', 'referral_bonus_2'] },
      status: 'completed'
    }).sort({ createdAt: -1 });

    // 计算总分销积分（避免浮点精度问题）
    const totalDistributionPoints = Math.round(
      referralTransactions.reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    // 获取最近的分销记录
    const recentRecords = referralTransactions.slice(0, 10).map(t => ({
      amount: t.amount,
      type: t.type === 'referral_bonus_1' ? '一级佣金' : '二级佣金',
      createdAt: t.createdAt,
      description: t.description
    }));

    res.json({
      success: true,
      distributionPoints: {
        total: totalDistributionPoints,
        recentRecords: recentRecords
      }
    });

  } catch (error) {
    console.error('获取分销积分错误:', error);
    res.status(500).json({ success: false, message: '获取分销积分失败' });
  }
});

// 获取推荐统计和积分
router.get('/referral-stats', authenticateToken, async (req, res) => {
  try {
    const User = require('../models/User');
    const Transaction = require('../models/Transaction');

    // 获取直接下级用户数
    const directReferrals = await User.countDocuments({
      parent_id: req.user._id,
      is_deleted: { $ne: true }
    });

    // 获取间接下级用户数（下级的下级）
    const indirectReferrals = await User.countDocuments({
      parent_id: {
        $in: await User.find({ parent_id: req.user._id }).select('_id')
      },
      is_deleted: { $ne: true }
    });

    // 获取分销积分统计
    const referralTransactions = await Transaction.find({
      user_id: req.user._id,
      type: { $in: ['referral_bonus_1', 'referral_bonus_2'] },
      status: 'completed'
    });

    const level1Earnings = Math.round(
      referralTransactions
        .filter(t => t.type === 'referral_bonus_1')
        .reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    const level2Earnings = Math.round(
      referralTransactions
        .filter(t => t.type === 'referral_bonus_2')
        .reduce((sum, t) => sum + t.amount, 0) * 100
    ) / 100;

    res.json({
      success: true,
      referralStats: {
        directReferrals,
        indirectReferrals,
        totalReferrals: directReferrals + indirectReferrals,
        level1Earnings,
        level2Earnings,
        totalEarnings: Math.round((level1Earnings + level2Earnings) * 100) / 100
      }
    });

  } catch (error) {
    console.error('获取推荐统计错误:', error);
    res.status(500).json({ success: false, message: '获取推荐统计失败' });
  }
});

// 上传用户头像
router.post('/upload-avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: '请选择头像文件' });
    }

    // 文件类型验证
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ success: false, message: '只允许上传图片文件' });
    }

    // 额外验证文件头
    const fileHeader = file.buffer.slice(0, 8);
    let isValidImage = false;

    // JPEG: FF D8 FF
    if (fileHeader[0] === 0xFF && fileHeader[1] === 0xD8 && fileHeader[2] === 0xFF) {
      isValidImage = true;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    else if (fileHeader[0] === 0x89 && fileHeader[1] === 0x50 && fileHeader[2] === 0x4E &&
             fileHeader[3] === 0x47 && fileHeader[4] === 0x0D && fileHeader[5] === 0x0A &&
             fileHeader[6] === 0x1A && fileHeader[7] === 0x0A) {
      isValidImage = true;
    }
    // GIF: 47 49 46 38
    else if (fileHeader[0] === 0x47 && fileHeader[1] === 0x49 && fileHeader[2] === 0x46 &&
             fileHeader[3] === 0x38) {
      isValidImage = true;
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    else if (fileHeader[0] === 0x52 && fileHeader[1] === 0x49 && fileHeader[2] === 0x46 &&
             fileHeader[3] === 0x46 && fileHeader[8] === 0x57 && fileHeader[9] === 0x45 &&
             fileHeader[10] === 0x42 && fileHeader[11] === 0x50) {
      isValidImage = true;
    }

    if (!isValidImage) {
      return res.status(400).json({ success: false, message: '文件格式不正确，请上传有效的图片文件' });
    }

    // 检查OSS配置
    const hasKeys = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET;
    if (!hasKeys) {
      console.log('❌ [Error] 未检测到 OSS Key，无法上传');
      return res.status(500).json({
        success: false,
        message: 'OSS配置缺失，无法上传头像'
      });
    }

    // 初始化OSS客户端
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true
    });

    // 上传到OSS，使用avatar目录
    const filename = `avatar/${Date.now()}-${req.user._id}-${file.originalname}`;
    const result = await client.put(filename, file.buffer);

    // 确保返回 HTTPS URL
    const avatarUrl = result.url.replace('http://', 'https://');

    // 更新用户头像
    const User = require('../models/User');
    await User.findByIdAndUpdate(req.user._id, { avatar: avatarUrl });

    res.json({
      success: true,
      message: '头像上传成功',
      avatarUrl: avatarUrl
    });

  } catch (error) {
    console.error('头像上传失败:', error);
    res.status(500).json({ success: false, message: '头像上传失败' });
  }
});

// 修改密码（需要验证旧密码）
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // 验证必填字段
    if (!oldPassword || !oldPassword.trim()) {
      return res.status(400).json({ success: false, message: '请输入原密码' });
    }
    if (!newPassword || !newPassword.trim()) {
      return res.status(400).json({ success: false, message: '请输入新密码' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: '新密码至少需要6位字符' });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: '新密码不能与原密码相同' });
    }

    const User = require('../models/User');
    const bcrypt = require('bcrypt');

    // 获取用户（包含密码字段）
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ success: false, message: '原密码错误' });
    }

    // 更新密码
    user.password = newPassword.trim();
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功'
    });

  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ success: false, message: '修改密码失败' });
  }
});

module.exports = router;