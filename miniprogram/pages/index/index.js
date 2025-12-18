// pages/index/index.js
const app = getApp();
const CONFIG = require('../../config.js');

const API_CONFIG = {
  ANNOUNCEMENTS: `${CONFIG.API_BASE_URL}/xiaohongshu/api/client/announcements`,
  USER_TASKS: `${CONFIG.API_BASE_URL}/xiaohongshu/api/client/user/tasks`
};

// 默认测试Token（仅开发环境使用，boss用户token）
// 用户信息：boss001 (boss) - ID: 693d29b5cbc188007ecc5848
// 权限：所有权限，可以查看所有数据
// 生成时间：2025-12-13，使用xiaohongshu_prod_jwt密钥签名
const DEFAULT_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

console.log(`🏠 首页环境: ${CONFIG.ENV}`);

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
    // 每次显示页面时，刷新列表（确保看到最新状态）
    this.fetchReviews(true);
    // 更新用户信息
    this.updateUserInfo();

    // 检查是否需要手机号授权
    this.checkPhoneAuth();
  },

  onPullDownRefresh() {
    this.fetchAnnouncements();
    this.fetchReviews(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 更新用户信息
  updateUserInfo() {
    // 优先使用全局用户信息
    const globalUserInfo = getApp().globalData.userInfo;
    if (globalUserInfo) {
      this.setData({ userInfo: globalUserInfo });
      return;
    }

    // 从本地存储获取
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo) {
      this.setData({ userInfo: storedUserInfo });
      return;
    }

    // 默认用户信息
    this.setData({
      userInfo: { nickName: '奋斗者' }
    });
  },

  // 检查是否需要手机号授权
  checkPhoneAuth() {
    // 延迟一点时间，确保用户信息已更新
    setTimeout(() => {
      if (!this.data.userInfo.phone) {
        // 没有手机号，显示授权模态框
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
      console.log('📦 使用共享公告数据');
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
        app.globalDataManager.set('announcements', res.data.announcements);
        this.setData({ announcements: res.data.announcements });
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
            const newReviews = res.data.reviews.map(item => ({
              ...item,
              // 支持多图：显示第一张图片
              imageUrl: item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls[0] : item.imageUrl,
              // 简单格式化时间 MM-DD HH:mm
              formattedTime: item.createdAt ? item.createdAt.substring(5, 16).replace('T', ' ') : '刚刚',
              // 添加设备信息显示
              deviceName: item.deviceInfo ? item.deviceInfo.accountName : '未知设备'
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
          console.error('获取审核记录失败:', err);
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
    console.log('📱 开始获取手机号:', e);

    getApp().getPhoneNumber(e, (userInfo) => {
      console.log('✅ 手机号获取成功:', userInfo);
      this.setData({
        userInfo,
        showPhoneAuthModal: false, // 关闭模态框
        forceAuth: false // 清除强制授权标记
      });

      wx.showToast({
        title: '手机号获取成功',
        icon: 'success',
        duration: 2000
      });

      // 重新获取审核记录（现在有手机号了）
      this.fetchReviews(true);
    });
  },

  // 关闭手机号授权模态框
  closePhoneAuthModal() {
    // 在强制授权模式下，不允许关闭模态框
    if (this.data.forceAuth) {
      wx.showToast({
        title: '必须授权手机号才能使用，账号仅限特定人群登录并进行登录账号鉴权',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    this.setData({ showPhoneAuthModal: false });
  },

  goToUpload() {
    wx.switchTab({
      url: '/pages/upload/upload',
    });
  }
});