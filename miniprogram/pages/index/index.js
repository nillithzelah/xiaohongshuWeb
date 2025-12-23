// pages/index/index.js
const app = getApp();
const CONFIG = require('../../config.js');

// 使用配置文件中的API端点（已统一管理）
const API_CONFIG = {
  ANNOUNCEMENTS: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.ANNOUNCEMENTS,
  USER_TASKS: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.USER_TASKS
};

// 从配置文件获取测试token（已移至config.js统一管理）
const DEFAULT_TEST_TOKEN = CONFIG.TEST_TOKENS?.BOSS_TOKEN;

console.info(`首页环境: ${CONFIG.ENV}`);

Page({
  data: {
    userInfo: {},
    announcements: ['暂无公告'], // 默认值，防止空白
    reviews: [],
    loading: true,
    page: 1,
    hasMore: true,
    cardCur: 0, // 当前选中的索引
    bannerList: [
      { id: 0, url: 'https://images.unsplash.com/photo-1621600411688-4be93cd68504?auto=format&fit=crop&w=800&q=80', title: '📢 今日笔记任务单价上调！' },
      { id: 1, url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80', title: '💰 提现功能升级维护通知' },
      { id: 2, url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80', title: '🎉 恭喜用户A提现500元' }
    ],
    showPhoneAuthModal: false, // 手机号授权模态框
    forceAuth: false, // 是否为强制授权模式
  },

  onLoad() {
    this.fetchAnnouncements();
    this.fetchReviews(true); // true 表示重置列表

    // 获取本地缓存的用户信息（如果没有则显示默认）
    this.updateUserInfo();
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
  },

  onPullDownRefresh() {
    this.fetchAnnouncements();
    this.fetchReviews(true).then(() => {
      wx.stopPullDownRefresh();
    });
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
    app.requestCache.cache.clear();
    app.requestCache.pendingRequests.clear();

   console.debug('用户相关缓存已清除');
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
      userInfo: { nickName: '奋斗者' }
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

      // 如果是手机号一键登录但没有手机号，才需要授权
      if (loginType === 'phone' && !this.data.userInfo.phone) {
        console.debug('手机号一键登录用户缺少手机号，显示授权弹窗');
        this.setData({ showPhoneAuthModal: true });
      }
    }, 500);
  },

  // 获取公告
  fetchAnnouncements() {
    const app = getApp();

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
        // 如果后端没数据，显示默认假数据演示效果
        const defaultAnnouncements = [
          // '🔥 今日笔记任务单价上调至 10 元！',
          // '📢 提现功能维护通知，请周五再试。',
          // '🎉 恭喜用户 138****8888 提现 500 元！'
        ];
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
      wx.request({
        url: `${API_CONFIG.USER_TASKS}?page=${this.data.page}&limit=10`,
        method: 'GET',
        header: token ? { 'Authorization': `Bearer ${token}` } : {},
        success: (res) => {
          if (res.data && res.data.success) {
            const reviews = getApp().utils.ensureArray(res.data.reviews);
            const newReviews = reviews.map(item => ({
              ...item,
              // 支持多图：显示第一张图片（类型安全）
              imageUrl: getApp().utils.safeGet(item, 'imageUrls.0', item.imageUrl),
              // 简单格式化时间 MM-DD HH:mm
              formattedTime: item.createdAt ? item.createdAt.substring(5, 16).replace('T', ' ') : '刚刚',
              // 添加设备信息显示（类型安全）
              deviceName: getApp().utils.safeGet(item, 'deviceInfo.accountName', '未知设备')
            }));

            this.setData({
              reviews: reset ? newReviews : [...this.data.reviews, ...newReviews],
              page: this.data.page + 1,
              hasMore: newReviews.length === 10, // 如果返回少于10条，说明没更多了
              loading: false
            });
          }
        },
        fail: (err) => {
         console.error('获取审核记录失败:', err.message);
          this.setData({ loading: false });
        },
        complete: () => {
          this.setData({ loading: false });
          resolve();
        }
      });
    });
  },

  // 监听轮播图切换，实现中间放大效果
  cardSwiper(e) {
    this.setData({
      cardCur: e.detail.current
    })
  },


  // 处理手机号授权
  onGetPhoneNumber(e) {
   console.debug('开始获取手机号');

    getApp().getPhoneNumber(e, (userInfo) => {
     console.info('手机号获取成功');

      // 手机号授权成功后，清除所有用户相关缓存
      this.clearUserRelatedCache();

      // 强制更新页面数据
      this.setData({
        userInfo: null, // 先清空，触发页面重新渲染
        showPhoneAuthModal: false,
        forceAuth: false
      });

      // 短暂延迟后重新设置数据，确保页面完全重新渲染
      setTimeout(() => {
        this.setData({
          userInfo,
          showPhoneAuthModal: false,
          forceAuth: false
        });

       console.debug('页面数据已更新');

        wx.showToast({
          title: '手机号获取成功',
          icon: 'success',
          duration: 2000
        });

        // 重新获取所有数据（公告、审核记录等）
        this.fetchAnnouncements();
        this.fetchReviews(true);
      }, 200);
    });
  },

  // 关闭手机号授权模态框
  closePhoneAuthModal() {
    this.setData({ showPhoneAuthModal: false });
  },

  goToUpload() {
    wx.switchTab({
      url: '/pages/upload/upload',
    });
  }
});