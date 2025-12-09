// pages/profile/profile.js
const app = getApp()

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
    const token = wx.getStorageSync('token')

    wx.request({
      url: 'http://localhost:5000/api/users/profile',
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success) {
          this.setData({
            userInfo: res.data.user,
            balance: res.data.user.balance || 0,
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
   * 加载模拟用户资料
   */
  loadMockUserProfile: function() {
    const mockUser = {
      username: 'test_user',
      nickname: '测试用户',
      avatar: '',
      balance: 25.50,
      totalEarnings: 125.80
    }

    this.setData({
      userInfo: mockUser,
      balance: mockUser.balance,
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