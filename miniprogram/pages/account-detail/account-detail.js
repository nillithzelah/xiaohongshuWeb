// pages/account-detail/account-detail.js
const app = getApp()
const CONFIG = require('../../config.js')

const API_CONFIG = {
  USER_PROFILE: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.USER.PROFILE,
  INVITATION_CODE: `${CONFIG.API_BASE_URL}/xiaohongshu/api/user/invitation-code`
}

Page({
  data: {
    userInfo: null,
    maskedIntegralZ: '暂无',
    maskedIntegralW: '暂无',
    mentorName: '暂无',
    parentName: '暂无',
    invitationCode: '暂无',
    loading: true,
    showEditModal: false, // 编辑弹窗显示
    updating: false, // 更新中状态
    editForm: {
      username: '',
      nickname: '',
      newPassword: '',
      confirmPassword: '',
      parentInvitationCode: ''
    }
  },

  onLoad: function (options) {
    if (!getApp().navigateGuard()) {
      return
    }
    this.loadAccountDetail()
  },

  onShow: function () {
    // 页面显示时刷新数据
    if (this.data.userInfo) {
      this.loadAccountDetail()
    }
  },

  // 加载账号详细信息
  loadAccountDetail: function() {
    this.setData({ loading: true })

    const token = app.getCurrentToken()

    // 并行加载用户信息和邀请码
    return Promise.all([
      this.loadUserProfile(token),
      this.loadInvitationCode(token)
    ]).then(() => {
      this.setData({ loading: false })
    }).catch(err => {
      console.error('加载账号详情失败:', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      throw err // 重新抛出错误，让调用方处理
    })
  },

  // 加载用户信息
  loadUserProfile: function(token) {
    return new Promise((resolve, reject) => {
      // 添加时间戳参数强制刷新，避免缓存
      const timestamp = Date.now();
      const url = `${API_CONFIG.USER_PROFILE}?t=${timestamp}`;

      app.request({
        url: url,
        method: 'GET',
        header: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.data && res.data.success) {
          const user = res.data.user
          console.log('📥 加载用户信息成功:', {
            username: user.username,
            nickname: user.nickname,
            phone: user.phone
          })
          this.setData({
            userInfo: user,
            maskedIntegralZ: this.maskString(user.integral_z),
            maskedIntegralW: this.maskString(user.integral_w),
            mentorName: user.mentor ? (user.mentor.nickname || user.mentor.username) : '暂无',
            parentName: user.parent ? (user.parent.nickname || user.parent.username) : '暂无'
          })
          console.log('✅ 页面数据已更新')
          resolve()
        } else {
          reject(new Error(res.data?.message || '获取用户信息失败'))
        }
      }).catch(reject)
    })
  },

  // 加载邀请码
  loadInvitationCode: function(token) {
    return new Promise((resolve, reject) => {
      // 添加时间戳参数强制刷新，避免缓存
      const timestamp = Date.now();
      const url = `${API_CONFIG.INVITATION_CODE}?t=${timestamp}`;

      app.request({
        url: url,
        method: 'GET',
        header: { 'Authorization': `Bearer ${token}` }
      }).then(res => {
        if (res.data && res.data.success) {
          this.setData({
            invitationCode: res.data.invitationCode || '暂无'
          })
          resolve()
        } else {
          reject(new Error(res.data?.message || '获取邀请码失败'))
        }
      }).catch(reject)
    })
  },

  // 字符串脱敏处理
  maskString: function(str) {
    if (!str || str === '暂无') return '暂无'
    if (str.length <= 6) return str.substring(0, 2) + '***'
    return str.substring(0, 3) + '***' + str.substring(str.length - 3)
  },

  // 复制邀请码
  copyInvitationCode: function() {
    if (this.data.invitationCode && this.data.invitationCode !== '暂无') {
      wx.setClipboardData({
        data: this.data.invitationCode,
        success: () => {
          wx.showToast({
            title: '邀请码已复制',
            icon: 'success'
          })
        }
      })
    }
  },

  // 刷新数据
  onPullDownRefresh: function() {
    this.loadAccountDetail().then(() => {
      wx.stopPullDownRefresh()
      wx.showToast({ title: '数据已更新', icon: 'none' })
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 显示编辑弹窗
  showEditModal: function() {
    console.log('🎪 显示编辑弹窗');
    this.setData({
      showEditModal: true,
      editForm: {
        username: this.data.userInfo?.username || '',
        nickname: this.data.userInfo?.nickname || '',
        newPassword: '',
        confirmPassword: '',
        parentInvitationCode: ''
      }
    });
    console.log('✅ 弹窗状态已设置:', this.data.showEditModal);
  },

  // 隐藏编辑弹窗
  hideEditModal: function() {
    this.setData({
      showEditModal: false
    });
  },

  // 输入处理
  onUsernameInput: function(e) {
    this.setData({
      'editForm.username': e.detail.value
    });
  },

  onNicknameInput: function(e) {
    this.setData({
      'editForm.nickname': e.detail.value
    });
  },

  onNewPasswordInput: function(e) {
    this.setData({
      'editForm.newPassword': e.detail.value
    });
  },

  onConfirmPasswordInput: function(e) {
    this.setData({
      'editForm.confirmPassword': e.detail.value
    });
  },

  onParentInvitationInput: function(e) {
    this.setData({
      'editForm.parentInvitationCode': e.detail.value
    });
  },

  // 更新用户信息
  updateProfile: function() {
    const { username, nickname, newPassword, confirmPassword, parentInvitationCode } = this.data.editForm;

    if (!username.trim()) {
      wx.showToast({
        title: '用户名不能为空',
        icon: 'none'
      });
      return;
    }

    // 密码验证
    if (newPassword && newPassword.trim()) {
      if (newPassword.length < 6) {
        wx.showToast({
          title: '密码至少需要6位字符',
          icon: 'none'
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        wx.showToast({
          title: '两次输入的密码不一致',
          icon: 'none'
        });
        return;
      }
    }

    this.setData({ updating: true });

    const token = app.getCurrentToken();
    const updateData = {
      username: username.trim(),
      nickname: nickname.trim()
    };

    // 如果有新密码，添加到更新数据中
    if (newPassword && newPassword.trim()) {
      updateData.newPassword = newPassword.trim();
    }

    if (parentInvitationCode.trim()) {
      updateData.parentInvitationCode = parentInvitationCode.trim();
    }

    app.request({
      url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/user/profile`,
      method: 'PUT',
      header: { 'Authorization': `Bearer ${token}` },
      data: updateData
    }).then(res => {
      if (res.data && res.data.success) {
        console.log('✅ 更新成功，准备重新加载数据');
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        });
        this.hideEditModal();
        // 强制重新加载账号详情
        setTimeout(() => {
          this.loadAccountDetail();
        }, 500); // 延迟500ms确保弹窗关闭
      } else {
        wx.showToast({
          title: res.data?.message || '更新失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('更新用户信息失败:', err);
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
    }).finally(() => {
      this.setData({ updating: false });
    });
  }
})