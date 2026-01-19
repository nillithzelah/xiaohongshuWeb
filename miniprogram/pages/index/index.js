// pages/index/index.js
const app = getApp();
const CONFIG = require('../../config.js');

// 使用配置文件中的API端点（已统一管理）
const API_CONFIG = {
  ANNOUNCEMENTS: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.ANNOUNCEMENTS,
  USER_TASKS: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.USER_TASKS
};


console.info(`首页环境: ${CONFIG.ENV}`);

Page({
  data: {
    userInfo: {},
    announcements: [], // 公告列表，默认为空数组
    reviews: [],
    loading: true,
    page: 1,
    hasMore: true,
    showPhoneAuthModal: false, // 手机号授权模态框
    forceAuth: false, // 是否为强制授权模式
    deviceReviewStatus: null, // 设备审核状态
    showDeviceReviewCard: false, // 是否显示设备审核卡片
    auditorStatus: { totalAuditors: 0, onlineAuditors: 0 } // 审核员在线状态
  },

  onLoad() {
    this.fetchAnnouncements();
    this.fetchReviews(true); // true 表示重置列表
    this.fetchAuditorStatus(); // 获取审核员在线状态

    // 主动获取用户信息（不依赖预加载）
    this.fetchUserInfo();

    // 获取设备审核状态
    this.fetchDeviceReviewStatus();
  },

  onShow() {
   console.debug('首页 onShow 被调用');

    // 检查用户登录状态是否发生变化
    const app = getApp();
    const currentUserInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const previousUserInfo = this.data.userInfo;

   console.debug('当前用户信息:', currentUserInfo ? '已设置' : '未设置');

    // 如果用户信息发生变化（登录/登出/手机号授权），清除相关缓存
    const userChanged = this.hasUserInfoChanged(previousUserInfo, currentUserInfo);
    if (userChanged) {
     console.info('用户信息发生变化，清除相关缓存');
      this.clearUserRelatedCache();
    }

    // 更新用户信息
    this.updateUserInfo();

    // 每次显示页面时，刷新列表（确保看到最新状态）
    this.fetchReviews(true);

    // 检查是否需要手机号授权（根据登录类型）
    this.checkPhoneAuth();

    // 获取设备审核状态
    this.fetchDeviceReviewStatus();

    // 刷新审核员状态
    this.fetchAuditorStatus();
  },

  onPullDownRefresh() {
    console.log('🔄 用户触发下拉刷新');

    // 重置页码并重新获取数据
    this.setData({ page: 1, hasMore: true });

    // 重新获取公告和审核列表
    this.fetchAnnouncements();
    this.fetchReviews(true).then(() => {
      console.log('✅ 下拉刷新完成');
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    }).catch(() => {
      console.log('❌ 下拉刷新失败');
      wx.stopPullDownRefresh();
    });
  },

  // 下拉刷新恢复（scroll-view 专用）
  onPullDownRefreshRestore() {
    console.log('🔄 下拉刷新恢复');
    // 可以在这里添加一些恢复逻辑，如果需要的话
  },

  // 上拉加载更多 (scroll-view 的滚动到底部事件)
  onScrollToLower() {
    console.debug('触发上拉加载更多');
    this.fetchReviews(false); // false 表示不重置，加载下一页
  },

  // 检查用户信息是否发生变化（使用公共方法）
  hasUserInfoChanged(oldInfo, newInfo) {
    return getApp().utils.hasUserInfoChanged(oldInfo, newInfo);
  },

  // 清除用户相关的缓存数据
  clearUserRelatedCache() {
    const app = getApp();
   console.debug('清除用户相关缓存');

    // 清除全局数据管理器中的用户相关缓存
    app.globalDataManager.clear('announcements');
    app.globalDataManager.clear('userTasks');
    app.globalDataManager.clear('userDevices');

    // 清除网络请求缓存
    app.requestCache.clear();

   console.debug('用户相关缓存已清除');
  },

  // 主动获取用户信息
  fetchUserInfo() {
    const app = getApp();
    const token = app.getCurrentToken();

    if (!token) {
      console.debug('没有token，使用默认用户信息');
      this.setData({
        userInfo: {
          nickName: '奋斗者',
          avatar: 'https://via.placeholder.com/120x120/E5E7EB/9CA3AF?text=用户'
        }
      });
      return;
    }

    console.debug('主动获取用户信息');
    app.request({
      url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/user/me`,
      method: 'GET',
      header: { 'Authorization': `Bearer ${token}` },
      useCache: true
    }).then(res => {
      if (res.data && res.data.success && res.data.user) {
        const userInfo = res.data.user;
        console.debug('获取到用户信息:', userInfo);
        
        // 更新全局用户信息
        app.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
        
        // 更新页面用户信息
        this.setData({ userInfo });
      }
    }).catch(err => {
      console.error('获取用户信息失败:', err);
      // 失败时使用默认值
      this.setData({
        userInfo: {
          nickName: '奋斗者',
          avatar: 'https://via.placeholder.com/120x120/E5E7EB/9CA3AF?text=用户'
        }
      });
    });
  },

  // 更新用户信息
  updateUserInfo() {
   console.debug('updateUserInfo 被调用');

    // 优先使用全局用户信息
    const globalUserInfo = getApp().globalData.userInfo;

    if (globalUserInfo) {
     console.debug('使用全局用户信息更新页面');
      this.setData({ userInfo: globalUserInfo });
      return;
    }

    // 从本地存储获取
    const storedUserInfo = wx.getStorageSync('userInfo');

    if (storedUserInfo) {
     console.debug('使用本地存储用户信息更新页面');
      this.setData({ userInfo: storedUserInfo });
      return;
    }

    // 默认用户信息
   console.debug('使用默认用户信息');
     this.setData({
       userInfo: {
         nickName: '奋斗者',
         avatar: 'https://via.placeholder.com/120x120/E5E7EB/9CA3AF?text=用户'
       }
     });
  },

  // 检查是否需要手机号授权
  checkPhoneAuth() {
    // 延迟一点时间，确保用户信息已更新
    setTimeout(() => {
      const loginType = wx.getStorageSync('loginType');

      // 如果是账号密码登录，用户已经有手机号了，不需要授权
      if (loginType === 'account') {
        console.debug('账号密码登录用户，跳过手机号授权检查');
        return;
      }

      // 【修复】兼容旧数据：loginType 可能是 'wechat'，应该被当作 'phone' 处理
      const isPhoneLogin = loginType === 'phone' || loginType === 'wechat';

      // 【增强】从多个来源检查用户信息，提高可靠性
      const app = getApp();
      const phone = this.data.userInfo.phone ||
                    app.globalData.userInfo?.phone ||
                    wx.getStorageSync('userInfo')?.phone;

      // 如果是手机号一键登录但没有手机号，需要授权
      if (isPhoneLogin && !phone) {
        console.warn('手机号登录用户缺少手机号，显示授权弹窗 (loginType:', loginType, ')');
        this.setData({ showPhoneAuthModal: true });

        // 【修复】统一 loginType 为 'phone'，避免后续混淆
        if (loginType === 'wechat') {
          wx.setStorageSync('loginType', 'phone');
        }
      } else {
        console.debug('手机号授权检查通过，phone:', phone ? '已授权' : '无需授权');
      }
    }, 500);
  },

  // 获取公告
  fetchAnnouncements() {
    const app = getApp();

    // 优先使用预加载缓存
    const preloadData = app.requestCache.getPreload(API_CONFIG.ANNOUNCEMENTS, {});
    if (preloadData) {
     console.debug('使用预加载公告数据');
      if (preloadData.data.success && preloadData.data.announcements && preloadData.data.announcements.length > 0) {
        const announcements = getApp().utils.ensureArray(preloadData.data.announcements);
        app.globalDataManager.set('announcements', announcements);
        this.setData({ announcements: announcements });
      }
      return;
    }

    // 检查全局共享数据
    const sharedData = app.globalDataManager.get('announcements');
    if (sharedData) {
     console.debug('使用共享公告数据');
      this.setData({ announcements: sharedData });
      return;
    }

    const token = app.getCurrentToken();

    app.request({
      url: API_CONFIG.ANNOUNCEMENTS,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      useCache: true
    }).then(res => {
      if (res.data.success && res.data.announcements && res.data.announcements.length > 0) {
        const announcements = getApp().utils.ensureArray(res.data.announcements);
        app.globalDataManager.set('announcements', announcements);
        this.setData({ announcements: announcements });
      } else {
        // 如果后端没数据，显示默认数据
        const defaultAnnouncements = [];
        app.globalDataManager.set('announcements', defaultAnnouncements);
        this.setData({ announcements: defaultAnnouncements });
      }
    }).catch(() => {
      // 接口失败也显示默认数据，保证 UI 不空
      this.setData({
        announcements: ['🔥 系统维护中，请稍后...']
      });
    });
  },

  // 获取审核列表
  fetchReviews(reset = false) {
    if (reset) {
      this.setData({ page: 1, hasMore: true, reviews: [] });
    }

    if (!this.data.hasMore) return Promise.resolve();

    const token = app.getCurrentToken();

    return new Promise((resolve) => {
      app.request({
        url: `${API_CONFIG.USER_TASKS}?page=${this.data.page}&limit=10`,
        method: 'GET',
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        useCache: false // 审核记录需要实时数据
      }).then(res => {
        if (res.data && res.data.success) {
          const reviews = getApp().utils.ensureArray(res.data.reviews);
          const newReviews = reviews.map(item => {
            // 持续检查奖励记录
            if (item.isContinuousCheckReward) {
              return {
                ...item,
                imageUrl: '', // 持续检查奖励不需要图片
                formattedTime: item.continuousCheckInfo?.checkTime || '刚刚'
              };
            }
            // 普通审核记录 - 添加空值安全检查
            return {
              ...item,
              // 支持多图：显示第一张图片（类型安全）
              imageUrl: getApp().utils.safeGet(item, 'imageUrls.0', item.imageUrl) || '',
              // 简单格式化时间 MM-DD HH:mm - 添加空值检查
              formattedTime: item.createdAt ?
                (typeof item.createdAt === 'string' ?
                  item.createdAt.substring(5, 16).replace('T', ' ') :
                  new Date(item.createdAt).toISOString().substring(5, 16).replace('T', ' ')) :
                '刚刚',
              // 添加设备信息显示（类型安全）
              deviceName: getApp().utils.safeGet(item, 'deviceInfo.accountName', '未知设备') || '未知设备',
              // 添加评论昵称显示（优先使用AI解析的昵称）- 添加空值保护
              commentAuthor: item.imageType === 'comment' ?
                (getApp().utils.safeGet(item, 'aiParsedNoteInfo.author') ||
                 (getApp().utils.safeGet(item, 'userNoteInfo.author') || '未知昵称').toString().split(',')[0]) :
                null,
              // 添加笔记作者显示
              noteAuthor: item.imageType === 'note' ?
                (getApp().utils.safeGet(item, 'aiParsedNoteInfo.author') ||
                 getApp().utils.safeGet(item, 'userNoteInfo.author') || '未知作者') :
                null,
              // 计算失败原因（简化WXML中的复杂表达式）
              failureReason: item.rejectionReason ||
                (getApp().utils.safeGet(item, 'aiReviewResult.reasons')?.length > 0
                  ? item.aiReviewResult.reasons[item.aiReviewResult.reasons.length - 1]
                  : null)
            };
          });

          this.setData({
            reviews: reset ? newReviews : [...this.data.reviews, ...newReviews],
            page: this.data.page + 1,
            hasMore: newReviews.length === 10, // 如果返回少于10条，说明没更多了
            loading: false
          });
        }
      }).catch(err => {
        console.error('获取审核记录失败:', err.message);
        // 如果是401错误，app.request已经处理过了，这里不需要额外处理
        if (err.message !== '登录已过期') {
          this.setData({ loading: false });
        }
      }).finally(() => {
        this.setData({ loading: false });
        resolve();
      });
    });
  },

  // 处理公告点击事件
  handleAnnouncementTap(e) {
    const item = e.currentTarget.dataset.item;

    // 如果有跳转动作
    if (item.actionType && item.actionType !== 'none' && item.actionData) {
      if (item.actionType === 'link') {
        // 跳转到H5页面
        wx.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(item.actionData)}`,
          fail: () => {
            wx.showToast({
              title: '无法打开链接',
              icon: 'none'
            });
          }
        });
      } else if (item.actionType === 'page') {
        // 跳转到小程序页面
        wx.navigateTo({
          url: item.actionData,
          fail: () => {
            wx.switchTab({
              url: item.actionData,
              fail: () => {
                wx.showToast({
                  title: '页面不存在',
                  icon: 'none'
                });
              }
            });
          }
        });
      }
    }
  },

  // 处理手机号授权 - 跳转到登录页面完成完整授权流程
  onGetPhoneNumber(e) {
    console.info('用户点击立即授权，跳转到登录页面完成手机号授权');

    // 关闭当前模态框
    this.setData({
      showPhoneAuthModal: false,
      forceAuth: false
    });

    // 跳转到登录页面，传递参数表示需要手机号授权
    wx.navigateTo({
      url: '/pages/login/login?needPhoneAuth=true',
      success: () => {
        console.info('成功跳转到登录页面进行手机号授权');
      },
      fail: (err) => {
        console.error('跳转到登录页面失败:', err);
        wx.showToast({
          title: '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 关闭手机号授权模态框
  closePhoneAuthModal() {
    this.setData({ showPhoneAuthModal: false });
  },

  // 获取设备审核状态
  fetchDeviceReviewStatus: function() {
    const token = app.getCurrentToken();
    if (!token) return;

    app.request({
      url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/client/devices/my-review-status`,
      method: 'GET',
      header: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.data && res.data.success) {
        const reviewStatus = res.data.reviewStatus;
        this.setData({
          deviceReviewStatus: reviewStatus,
          showDeviceReviewCard: reviewStatus && reviewStatus.status !== 'approved'
        });
      }
    }).catch(err => {
      console.error('获取设备审核状态失败:', err);
    });
  },

  // 获取审核员在线状态
  fetchAuditorStatus: function() {
    app.request({
      url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/client/auditor-status`,
      method: 'GET',
      useCache: false // 实时刷新，不缓存
    }).then(res => {
      if (res.data && res.data.success) {
        this.setData({
          auditorStatus: res.data.data
        });
      }
    }).catch(err => {
      console.error('获取审核员状态失败:', err);
      // 失败时保持默认值，不影响页面显示
    });
  },

  // 跳转到设备列表页面
  goToDeviceList: function() {
    wx.navigateTo({
      url: '/pages/device-list/device-list?showAddModal=true'
    });
  },

  goToUpload() {
    wx.switchTab({
      url: '/pages/upload/upload',
    });
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: '易交单 - 内容审核',
      path: '/pages/index/index',
      imageUrl: ''
    };
  }
});