// pages/profile/profile.js
const app = getApp()
const CONFIG = require('../../config.js')

// 使用配置文件中的API端点（已统一管理）
const API_CONFIG = {
  USER_PROFILE: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.USER.PROFILE
};


console.log(`👤 个人资料页环境: ${CONFIG.ENV}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    points: 0,
    totalEarned: 0, // 总获得金额
    totalWithdrawn: 0, // 已提现金额
    pendingAmount: 0 // 待兑换金额
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserProfile()
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('👤 个人资料页 onShow 被调用');

    // 检查用户是否已完成手机号授权
    if (!getApp().navigateGuard()) {
      return; // 如果未授权，会自动跳转到首页
    }

    // 检查用户信息是否发生变化
    const app = getApp();
    const currentUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const previousUserInfo = this.data.userInfo;

    console.log('👤 当前全局用户信息:', currentUserInfo);
    console.log('👤 页面当前用户信息:', previousUserInfo);

    // 如果用户信息发生变化，重新加载用户资料
    if (this.hasUserInfoChanged(previousUserInfo, currentUserInfo)) {
      console.log('🔄 用户信息发生变化，重新加载用户资料');
      this.loadUserProfile();
    }
  },

  /**
   * 检查用户信息是否发生变化（使用公共方法）
   */
  hasUserInfoChanged(oldInfo, newInfo) {
    return getApp().utils.hasUserInfoChanged(oldInfo, newInfo);
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('🔄 个人资料页下拉刷新，强制重新加载数据');
    this.loadUserProfile(true); // 强制刷新
    // 注意：wx.stopPullDownRefresh() 会在数据加载完成后调用
  },

  /**
   * 加载用户资料
   */
  loadUserProfile: function(forceRefresh = false) {
    // 使用当前用户的token
    const token = app.getCurrentToken();
    if (token) {
      this.loadUserProfileWithToken(token, forceRefresh);
    } else {
      // 没有token，提示用户先登录
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 2000
      });
      // 3秒后返回首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' });
      }, 3000);
    }
  },

  /**
   * 使用指定token加载用户资料
   */
  loadUserProfileWithToken: function(token, forceRefresh = false) {
    console.log('🔍 开始加载用户资料，token:', token ? token.substring(0, 50) + '...' : '无token', forceRefresh ? '强制刷新' : '');

    const app = getApp();

    // 下拉刷新时跳过预加载缓存，直接重新请求
    if (!forceRefresh) {
      // 优先使用预加载缓存
      const preloadData = app.requestCache.getPreload(API_CONFIG.USER_PROFILE, {});
      if (preloadData) {
        console.log('🚀 使用预加载用户资料数据');
        if (preloadData.data && preloadData.data.success) {
          console.log('✅ 预加载数据有效，用户数据:', preloadData.data.user);
          console.log('💰 积分:', preloadData.data.user.points, '总获得:', preloadData.data.user.wallet?.total_withdrawn, '已提现:', preloadData.data.user.wallet?.total_withdrawn);

          // 确保钱包数据存在并正确处理
          const wallet = preloadData.data.user.wallet || {};
          const totalWithdrawnRaw = wallet.total_withdrawn !== undefined ? wallet.total_withdrawn : 0;

          this.setData({
            userInfo: preloadData.data.user,
            points: preloadData.data.user.points || 0,
            totalEarned: (totalWithdrawnRaw / 100).toFixed(2),  // 后端返回的是分，显示时除以100转为元
            totalWithdrawn: (totalWithdrawnRaw / 100).toFixed(2),  // 已提现金额
            pendingAmount: ((preloadData.data.user.pendingAmount || 0) / 100).toFixed(2)  // 服务器返回分，显示时除以100转为元
          });
          console.log('📱 页面数据已更新（预加载）');
          return; // 使用预加载数据后直接返回
        }
      }
    }

    // 没有预加载数据，使用正常请求
    app.request({
      url: API_CONFIG.USER_PROFILE,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      useCache: false // 用户资料需要实时数据
    }).then(res => {
      console.log('📡 用户资料API响应:', res);
      console.log('📊 响应数据结构:', res.data);
      if (res.data && res.data.success) {
        console.log('✅ API返回成功，用户数据:', res.data.user);
        console.log('💰 积分:', res.data.user.points, '总获得:', res.data.user.wallet?.total_withdrawn, '已提现:', res.data.user.wallet?.total_withdrawn);

        // 确保钱包数据存在并正确处理
        const wallet = res.data.user.wallet || {};
        const totalWithdrawnRaw = wallet.total_withdrawn !== undefined ? wallet.total_withdrawn : 0;

        this.setData({
          userInfo: res.data.user,
          points: res.data.user.points || 0,
          totalEarned: (totalWithdrawnRaw / 100).toFixed(2),  // 后端返回的是分，显示时除以100转为元
          totalWithdrawn: (totalWithdrawnRaw / 100).toFixed(2),  // 已提现金额
          pendingAmount: ((res.data.user.pendingAmount || 0) / 100).toFixed(2)  // 服务器返回分，显示时除以100转为元
        });
        console.log('📱 页面数据已更新');

        // 如果是下拉刷新触发的，请求成功后停止动画
        if (forceRefresh) {
          wx.stopPullDownRefresh();
          wx.showToast({ title: '数据已更新', icon: 'none' });
        }
      } else {
        console.log('❌ API返回失败');
      }
    }).catch(err => {
      console.log('❌ 网络请求失败:', err);

      // 如果是下拉刷新触发的，请求失败也要停止动画
      if (forceRefresh) {
        wx.stopPullDownRefresh();
      }
    });
  },




  // 选择头像
  chooseAvatar: function() {
    wx.chooseImage({
      count: 1, // 只允许选择一张图片
      sizeType: ['compressed'], // 压缩图
      sourceType: ['album', 'camera'], // 从相册或相机选择
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.uploadAvatar(tempFilePath);
      },
      fail: (err) => {
        console.log('选择头像失败:', err);
      }
    });
  },

  // 上传头像
  uploadAvatar: function(filePath) {
    wx.showLoading({
      title: '上传中...'
    });

    const token = app.getCurrentToken();
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.uploadFile({
      url: CONFIG.API_BASE_URL + '/xiaohongshu/api/user/upload-avatar',
      filePath: filePath,
      name: 'avatar',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.success) {
            wx.showToast({
              title: '头像上传成功',
              icon: 'success'
            });
            // 更新本地用户信息
            const updatedUserInfo = { ...this.data.userInfo, avatar: data.avatarUrl };
            this.setData({
              userInfo: updatedUserInfo
            });
            // 更新全局数据
            app.globalData.userInfo = updatedUserInfo;
            wx.setStorageSync('userInfo', updatedUserInfo);
          } else {
            wx.showToast({
              title: data.message || '上传失败',
              icon: 'none'
            });
          }
        } catch (e) {
          wx.showToast({
            title: '上传失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.log('上传头像失败:', err);
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 修改密码
  changePassword: function() {
    wx.showModal({
      title: '修改密码',
      editable: true,
      placeholderText: '请输入新密码（至少6位）',
      success: (res) => {
        if (res.confirm) {
          const newPassword = res.content;
          if (!newPassword || newPassword.trim().length < 6) {
            wx.showToast({
              title: '密码至少需要6位',
              icon: 'none'
            });
            return;
          }
          this.doChangePassword(newPassword.trim());
        }
      }
    });
  },

  // 执行修改密码
  doChangePassword: function(newPassword) {
    const token = app.getCurrentToken();
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '修改中...'
    });

    app.request({
      url: CONFIG.API_BASE_URL + '/xiaohongshu/api/user/change-password',
      method: 'PUT',
      header: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        newPassword: newPassword
      }
    }).then(res => {
      wx.hideLoading();
      if (res.data && res.data.success) {
        wx.showModal({
          title: '修改成功',
          content: '密码已修改，请重新登录',
          showCancel: false,
          success: () => {
            // 清除本地存储
            app.tokenManager.clear();
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('loginType');

            // 清除全局数据
            app.globalData.userInfo = null;
            app.globalData.token = null;

            // 跳转到登录页
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }
        });
      } else {
        wx.showToast({
          title: res.data?.message || '修改失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.log('修改密码失败:', err);
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
    });
  },

  // 登出
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 获取当前token用于调用logout API
          const currentApp = getApp();
          const token = currentApp.getCurrentToken();

          // 清除本地存储
          currentApp.tokenManager.clear(); // 使用tokenManager的clear方法清除所有token相关数据
          wx.removeStorageSync('userInfo'); // 额外清除用户信息
          wx.removeStorageSync('loginType'); // 清除登录类型
          wx.removeStorageSync('testUserToken'); // 清除测试用户token

          // 清除全局数据
          currentApp.globalData.userInfo = null;
          currentApp.globalData.token = null;
          currentApp.globalDataManager.clear();

          // 清除状态管理器中的用户状态
          currentApp.stateManager.updateUserState(null);

          // 调用服务器端logout API（可选，用于记录登出日志）
          if (token) {
            currentApp.request({
              url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/auth/logout`,
              method: 'POST',
              header: { 'Authorization': `Bearer ${token}` },
              success: (res) => {
                console.log('服务器端登出成功');
              },
              fail: (err) => {
                console.log('服务器端登出失败（不影响客户端登出）', err);
              }
            });
          }

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });

          // 跳转到登录页
          setTimeout(() => {
            wx.redirectTo({
              url: '/pages/login/login'
            });
          }, 1500);
        }
      }
    });
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: '易交单',
      path: '/pages/index/index',
      imageUrl: ''
    };
  }
});