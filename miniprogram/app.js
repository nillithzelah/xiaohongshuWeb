//app.js
App({
  onLaunch: function () {
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          this.globalData.code = res.code
          this.autoRegister()
        }
      }
    })
  },

  // 自动注册用户
  autoRegister: function() {
    wx.request({
      url: 'http://localhost:5000/api/auth/wechat-login',
      method: 'POST',
      data: {
        code: this.globalData.code
      },
      success: (res) => {
        if (res.data.success) {
          this.globalData.userInfo = res.data.user
          this.globalData.token = res.data.token
          wx.setStorageSync('token', res.data.token)
        }
      }
    })
  },

  globalData: {
    userInfo: null,
    token: null,
    code: null
  }
})