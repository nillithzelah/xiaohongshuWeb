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
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.request({
      url: 'http://localhost:5000/api/users/profile',
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            userInfo: res.data.user,
            balance: res.data.user.balance,
            totalEarnings: res.data.user.totalEarnings
          })
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
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