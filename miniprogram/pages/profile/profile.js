// pages/profile/profile.js
const app = getApp()

// 环境配置（与上传页面保持一致）
const IS_DEVELOPMENT = true; // 开发时true，生产时false
const API_BASE = IS_DEVELOPMENT ? 'http://192.168.3.9:5000' : 'https://www.wubug.cc';

const API_CONFIG = {
  USER_PROFILE: `${API_BASE}/xiaohongshu/api/user/me`
};

// 默认测试Token（与上传页面保持一致）
const DEFAULT_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMTk5M2I5OTE5MDU4OTEwNjQzNmIiLCJ1c2VybmFtZSI6InVzZXIwMDEiLCJpYXQiOjE3NjU2MTIwNDAsImV4cCI6MTc2NjIxNjg0MH0.NoSLeXZQNK1UWJDEcn1CmCUVm2YzHBItWMJ2fdWRuYY';

console.log(`👤 个人资料页环境: ${IS_DEVELOPMENT ? '开发环境' : '生产环境'}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    balance: 0,
    totalEarnings: 0
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
    const token = IS_DEVELOPMENT ? DEFAULT_TEST_TOKEN : wx.getStorageSync('token')

    wx.request({
      url: API_CONFIG.USER_PROFILE,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success) {
          this.setData({
            userInfo: res.data.user,
            balance: res.data.user.wallet || 0, // 服务器返回的是wallet字段
            totalEarnings: res.data.user.totalEarnings || 0
          })
        } else {
          // 使用模拟用户数据
          this.loadMockUserProfile()
        }
      },
      fail: () => {
        // 网络失败时使用模拟数据
        this.loadMockUserProfile()
      }
    })
  },

  /**
   * 加载模拟用户资料（与实际token用户保持一致）
   */
  loadMockUserProfile: function() {
    const mockUser = {
      username: 'user001', // 与实际token用户一致
      nickname: '用户001', // 对应的昵称
      avatar: '',
      wallet: 25.50, // 使用wallet字段，与服务器一致
      totalEarnings: 125.80
    }

    this.setData({
      userInfo: mockUser,
      balance: mockUser.wallet, // 使用wallet字段
      totalEarnings: mockUser.totalEarnings
    })
  },

  /**
   * 退出登录
   */
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          app.globalData.userInfo = null
          app.globalData.token = null
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    })
  }
})