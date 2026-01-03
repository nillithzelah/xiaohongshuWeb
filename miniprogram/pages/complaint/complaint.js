// pages/complaint/complaint.js
const app = getApp()
const CONFIG = require('../../config.js')

const API_CONFIG = {
  SUBMIT_COMPLAINT: `${CONFIG.API_BASE_URL}/xiaohongshu/api/complaints`
}

Page({
  data: {
    complaintContent: '',
    submitting: false
  },

  onLoad: function (options) {
    // 检查用户是否已完成手机号授权
    if (!getApp().navigateGuard()) {
      return
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    // 投诉页面没有数据需要刷新，直接停止刷新
    wx.stopPullDownRefresh()
  },

  // 输入投诉内容
  onContentInput: function(e) {
    this.setData({
      complaintContent: e.detail.value
    })
  },

  // 提交投诉
  submitComplaint: function() {
    const content = this.data.complaintContent.trim()

    if (!content) {
      wx.showToast({
        title: '请输入投诉内容',
        icon: 'none'
      })
      return
    }

    if (content.length < 10) {
      wx.showToast({
        title: '投诉内容至少10个字符',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })

    const token = app.getCurrentToken()

    app.request({
      url: API_CONFIG.SUBMIT_COMPLAINT,
      method: 'POST',
      header: { 'Authorization': `Bearer ${token}` },
      data: {
        content: content
      }
    }).then(res => {
      if (res.data && res.data.success) {
        wx.showToast({
          title: '投诉提交成功',
          icon: 'success'
        })

        // 清空内容并返回
        this.setData({
          complaintContent: ''
        })

        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({
          title: res.data?.message || '提交失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error('提交投诉失败:', err)
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    }).finally(() => {
      this.setData({ submitting: false })
    })
  }
})