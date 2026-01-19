// pages/points-exchange/points-exchange.js
const app = getApp()
const CONFIG = require('../../config.js')

// 使用配置文件中的API端点
const API_CONFIG = {
  USER_PROFILE: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.USER.PROFILE
};

Page({
  data: {
    userPoints: 0,
    exchangeAmount: '',
    exchangeRate: 100, // 100积分 = 1元
    expectedMoney: 0,
    exchanging: false,
    minExchangePoints: 500 // 最少兑换500积分
  },

  onLoad: function (options) {
    console.log('📱 积分兑换页面加载')
    try {
      this.loadUserPoints()
    } catch (e) {
      console.error('onLoad 加载积分出错:', e)
    }
  },

  onShow: function () {
    console.log('👀 积分兑换页面显示')
    if (!getApp().navigateGuard()) {
      console.log('⚠️ 导航守卫阻止访问')
      return
    }
    console.log('✅ 导航守卫通过')

    // 重新加载用户积分以确保显示最新数据
    try {
      this.loadUserPoints()
    } catch (e) {
      console.error('onShow 加载积分出错:', e)
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('🔄 下拉刷新触发')
    this.loadUserPoints()
    // 刷新完成后停止下拉刷新
    wx.stopPullDownRefresh()
  },

  // 加载用户积分
  loadUserPoints: function() {
    console.log('🔄 开始加载用户积分')
    const token = app.getCurrentToken()
    console.log('🔐 获取到的token:', token ? '有token' : '无token')
    
    if (!token) {
      console.log('⚠️ 无token，提示用户登录')
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    console.log('📡 发起用户资料请求')
    app.request({
      url: API_CONFIG.USER_PROFILE,
      method: 'GET',
      header: { 'Authorization': `Bearer ${token}` },
      useCache: false // 禁用缓存，确保获取最新积分数据
    }).then(res => {
      console.log('📤 用户资料响应:', res)
      if (res.data && res.data.success) {
        // 安全获取积分，处理不同的响应结构
        const points = res.data.user?.points || res.data.points || res.data.user?.integral_w || 0
        console.log('✅ 加载积分成功:', points)
        this.setData({
          userPoints: points
        })

        // 更新全局用户信息，确保其他页面能检测到变化
        if (res.data.user && app.globalData.userInfo) {
          app.globalData.userInfo.points = points
          // 同时更新本地存储
          wx.setStorageSync('userInfo', app.globalData.userInfo)
          console.log('🔄 全局用户信息已更新，积分:', points)
        }
      } else {
        console.log('❌ 加载积分失败:', res.data?.message || '未知错误')
      }
    }).catch(err => {
      console.error('加载用户积分失败:', err)
    })
  },

  // 输入兑换积分数量
  onAmountInput: function(e) {
    const value = e.detail.value
    const numValue = parseInt(value) || 0
    const expectedMoney = numValue / this.data.exchangeRate
  
    console.log('📝 用户输入兑换积分:', value, '→ 数值:', numValue, '→ 预期金额:', expectedMoney)

    this.setData({
      exchangeAmount: value,
      expectedMoney: expectedMoney
    })
  },

  // 兑换全部积分
  exchangeAll: function() {
    const allPoints = this.data.userPoints
    
    // 检查是否达到最小兑换积分
    if (allPoints < this.data.minExchangePoints) {
      wx.showToast({
        title: `至少需要${this.data.minExchangePoints}积分才能兑换`,
        icon: 'none'
      })
      return
    }
    
    this.setData({
      exchangeAmount: allPoints.toString(),
      expectedMoney: (allPoints / this.data.exchangeRate)
    })
  },

  // 确认兑换
  confirmExchange: function() {
    const points = parseInt(this.data.exchangeAmount)

    console.log('🔄 确认兑换被调用，输入值:', this.data.exchangeAmount, '解析后:', points)
    console.log('📊 当前积分:', this.data.userPoints)

    if (!points || points <= 0) {
      console.log('❌ 无效的积分数量')
      wx.showToast({
        title: '请输入有效的积分数量',
        icon: 'none'
      })
      return
    }

    // 检查是否达到最小兑换积分
    if (points < this.data.minExchangePoints) {
      console.log('❌ 积分数量不足，至少需要:', this.data.minExchangePoints, '当前:', points)
      wx.showToast({
        title: `至少需要${this.data.minExchangePoints}积分才能兑换`,
        icon: 'none'
      })
      return
    }

    if (points > this.data.userPoints) {
      console.log('❌ 积分不足，当前:', this.data.userPoints, '需要:', points)
      wx.showToast({
        title: '积分不足',
        icon: 'none'
      })
      return
    }

    const expectedMoney = points / this.data.exchangeRate
    console.log('✅ 兑换条件满足，将兑换:', points, '积分 →', expectedMoney, '元')

    wx.showModal({
      title: '确认兑换',
      content: `确定要兑换${points}积分吗？\n将获得${expectedMoney}元余额`,
      success: (res) => {
        console.log('📋 用户确认结果:', res.confirm ? '确认' : '取消')
        if (res.confirm) {
          this.performExchange(points)
        }
      },
      fail: (err) => {
        console.log('❌ 显示确认对话框失败:', err)
      }
    })
  },

  // 执行兑换
  performExchange: function(points) {
    console.log('🚀 开始执行兑换，积分数量:', points)
    this.setData({ exchanging: true })

    const token = app.getCurrentToken()
    console.log('🔐 获取到的token:', token ? '有token' : '无token')

    // 直接从 userInfo 获取用户ID，避免解析 token 可能导致的错误
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    let userId = userInfo?.id || userInfo?.username || 'current'
    console.log('👤 使用用户ID:', userId)

    if (!userId || userId === 'current') {
      console.error('无法获取用户ID')
      wx.showToast({
        title: '登录信息异常，请重新登录',
        icon: 'none',
        duration: 2000
      })
      this.setData({ exchanging: false })
      return
    }

    console.log('📡 发起兑换请求到:', `${CONFIG.API_BASE_URL}/xiaohongshu/api/users/${userId}/exchange-points`)
    
    app.request({
      url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/users/${userId}/exchange-points`,
      method: 'POST',
      header: { 'Authorization': `Bearer ${token}` },
      data: {
        pointsToExchange: points // 直接发送分数值给后端
      }
    }).then(res => {
      console.log('📤 兑换请求响应:', res)
      if (res.data && res.data.success) {
        console.log('✅ 兑换成功，响应数据:', res.data)
        wx.showToast({
          title: '兑换成功',
          icon: 'success'
        })

        // 清空输入框
        this.setData({
          exchangeAmount: '',
          expectedMoney: 0
        })

        // 重新从服务器加载用户积分，确保数据同步
        this.loadUserPoints()

      } else {
        console.log('❌ 兑换失败，错误信息:', res.data?.message || '未知错误')
        wx.showToast({
          title: res.data?.message || '兑换失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('积分兑换失败:', err)
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }).finally(() => {
      console.log('🔄 兑换流程完成，重置兑换状态')
      this.setData({ exchanging: false })
    })
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: '易交单 - 积分兑换',
      path: '/pages/index/index',
      imageUrl: ''
    };
  }
})