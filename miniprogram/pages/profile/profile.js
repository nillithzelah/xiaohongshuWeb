// pages/profile/profile.js
const app = getApp()
const CONFIG = require('../../config.js')

const API_CONFIG = {
  USER_PROFILE: `${CONFIG.API_BASE_URL}/xiaohongshu/api/user/me`,
  USERS_LIST: `${CONFIG.API_BASE_URL}/xiaohongshu/api/users`,
  GENERATE_USER_TOKEN: `${CONFIG.API_BASE_URL}/xiaohongshu/api/auth/generate-user-token`
};

// 默认测试Token（管理员token，用于生成测试用户token）
const ADMIN_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

// 默认用户Token（管理员用户token，显示积分）
const DEFAULT_USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

console.log(`👤 个人资料页环境: ${CONFIG.ENV}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    balance: 0,
    totalEarnings: 0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserProfile()
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
        console.log('💰 积分:', res.data.user.points, '收益:', res.data.user.totalEarnings);
        this.setData({
          userInfo: res.data.user,
          balance: res.data.user.points || 0, // 显示积分
          totalEarnings: res.data.user.totalEarnings || 0
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
      points: 2550, // 使用积分字段
      totalEarnings: 125.80
    }

    this.setData({
      userInfo: mockUser,
      balance: mockUser.points, // 使用积分字段
      totalEarnings: mockUser.totalEarnings
    })
  },



})