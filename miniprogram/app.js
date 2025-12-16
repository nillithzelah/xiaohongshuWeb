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

  // 获取当前使用的token（优先使用测试用户token）
  getCurrentToken: function() {
    // 优先使用从profile页面切换的测试用户token
    const testUserToken = wx.getStorageSync('testUserToken');
    if (testUserToken) {
      console.log('🎯 使用测试用户token:', testUserToken.substring(0, 50) + '...');
      return testUserToken;
    }

    // 开发环境使用默认token
    const IS_DEVELOPMENT = true; // 与其他页面保持一致
    if (IS_DEVELOPMENT) {
      console.log('🎯 使用默认开发token');
      return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';
    }

    // 生产环境使用存储的token
    const token = wx.getStorageSync('token');
    console.log('🎯 使用生产环境token:', token ? token.substring(0, 50) + '...' : '无token');
    return token;
  },

  globalData: {
    userInfo: null,
    token: null,
    code: null
  }
})