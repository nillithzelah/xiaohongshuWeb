// pages/profile/profile.js
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
          totalWithdrawn: res.data.user.wallet?.total_withdrawn || 0 // 已提现金额
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
      avatar: '',
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
      totalWithdrawn: mockUser.wallet?.total_withdrawn || 0 // 已提现金额
    })
  },



})