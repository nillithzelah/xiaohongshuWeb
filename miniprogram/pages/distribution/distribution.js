// pages/distribution/distribution.js
const app = getApp()
const CONFIG = require('../../config.js')

const API_CONFIG = {
  REFERRAL_TREE: `${CONFIG.API_BASE_URL}/xiaohongshu/api/user/referral-tree`,
  DISTRIBUTION_POINTS: `${CONFIG.API_BASE_URL}/xiaohongshu/api/user/distribution-points`
}

Page({
  data: {
    referralTree: null,
    distributionPoints: 0,
    loading: true
  },

  onLoad: function (options) {
    this.loadReferralData()
  },

  onShow: function () {
    if (!getApp().navigateGuard()) {
      return
    }
  },

  // 加载推荐数据
  loadReferralData: function() {
    this.setData({ loading: true })

    const token = app.getCurrentToken()

    // 并行加载上下级关系和分销积分
    return Promise.all([
      this.loadReferralTree(token),
      this.loadDistributionPoints(token)
    ]).then(() => {
      this.setData({ loading: false })
    }).catch(err => {
      console.error('加载推荐数据失败:', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      throw err // 重新抛出错误，让调用方处理
    })
  },

  // 加载上下级关系树
  loadReferralTree: function(token) {
    return new Promise((resolve, reject) => {
      app.request({
        url: API_CONFIG.REFERRAL_TREE,
        method: 'GET',
        header: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.data && res.data.success) {
          this.setData({
            referralTree: res.data.referralTree
          })
          resolve()
        } else {
          reject(new Error(res.data?.message || '获取上下级关系失败'))
        }
      }).catch(reject)
    })
  },

  // 加载分销积分
  loadDistributionPoints: function(token) {
    return new Promise((resolve, reject) => {
      app.request({
        url: API_CONFIG.DISTRIBUTION_POINTS,
        method: 'GET',
        header: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.data && res.data.success) {
          this.setData({
            distributionPoints: res.data.distributionPoints?.total || 0
          })
          resolve()
        } else {
          reject(new Error(res.data?.message || '获取分销积分失败'))
        }
      }).catch(reject)
    })
  },

  // 刷新数据
  onPullDownRefresh: function() {
    this.loadReferralData().then(() => {
      wx.stopPullDownRefresh()
      wx.showToast({ title: '数据已更新', icon: 'none' })
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  }
})