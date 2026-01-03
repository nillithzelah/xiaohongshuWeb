// pages/points-exchange/points-exchange.js
const app = getApp()
const CONFIG = require('../../config.js')

const API_CONFIG = {
  EXCHANGE_POINTS: `${CONFIG.API_BASE_URL}/xiaohongshu/api/users/${app.getCurrentToken ? 'current' : 'user'}/exchange-points`,
  USER_PROFILE: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.USER.PROFILE
}

Page({
  data: {
    userPoints: 0,
    exchangeAmount: '',
    exchangeRate: 100, // 100积分 = 1元
    expectedMoney: 0,
    exchanging: false
  },

  onLoad: function (options) {
    console.log('📱 积分兑换页面加载')
    this.loadUserPoints()
  },

  onShow: function () {
    console.log('👀 积分兑换页面显示')
    if (!getApp().navigateGuard()) {
      console.log('⚠️ 导航守卫阻止访问')
      return
    }
    console.log('✅ 导航守卫通过')

    // 重新加载用户积分以确保显示最新数据
    this.loadUserPoints()
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
        console.log('✅ 加载积分成功:', res.data.user.points || 0)
        this.setData({
          userPoints: res.data.user.points || 0 // 直接显示分
        })
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
    const allPoints = this.data.userPoints // 可以兑换所有积分
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
    
    // 从token中解析出正确的用户ID
    let userId = 'current'
    if (token) {
      try {
        // 小程序兼容的base64解码
const base64Decode = (str) => {
  // 1. 修正 JWT 的特殊字符 (- 换成 +, _ 换成 /)
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // 2. 补齐末尾缺失的 '=' (Base64 长度必须是 4 的倍数)
  const pad = str.length % 4;
  if (pad) {
    str += new Array(5 - pad).join('=');
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');

  for (let i = 0; i < str.length; ) {
    const enc1 = chars.indexOf(str.charAt(i++));
    const enc2 = chars.indexOf(str.charAt(i++));
    const enc3 = chars.indexOf(str.charAt(i++));
    const enc4 = chars.indexOf(str.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  // 3. 🔥 核心修正：解决中文乱码问题
  // 将解码后的字符串转回正确的 UTF-8 编码
    try {
      return decodeURIComponent(atobToUtf8(output));
    } catch (e) {
      return output; // 如果转换失败返回原字符串
    }
  };

        // 辅助函数：将 Latin-1 字符串转为百分比编码，方便 decodeURIComponent 处理中文
        function atobToUtf8(str) {
          return str.split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('');
        }

        // 使用：
        const payload = JSON.parse(base64Decode(token.split('.')[1]));
        userId = payload.userId
        console.log('👤 解析到的用户ID:', userId)
      } catch (e) {
        console.error('解析token失败:', e)
      }
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

        // 更新本地积分
        this.setData({
          userPoints: this.data.userPoints - points,
          exchangeAmount: '',
          expectedMoney: 0
        })

        // 通知其他页面更新
        if (app.globalData.userInfo) {
          app.globalData.userInfo.points = this.data.userPoints
        }
        console.log('📊 积分更新完成，剩余积分:', this.data.userPoints - points)

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
  }
})