// pages/index/index.js
const app = getApp();

// 环境配置（与上传页面保持一致）
const IS_DEVELOPMENT = true; // 开发时true，生产时false
const API_BASE = IS_DEVELOPMENT ? 'http://localhost:5000' : 'https://www.wubug.cc';

const API_CONFIG = {
  ANNOUNCEMENTS: `${API_BASE}/xiaohongshu/api/client/announcements`,
  USER_TASKS: `${API_BASE}/xiaohongshu/api/client/user/tasks`
};

// 默认测试Token（仅开发环境使用，boss用户token）
// 用户信息：boss001 (boss) - ID: 693d29b5cbc188007ecc5848
// 权限：所有权限，可以查看所有数据
// 生成时间：2025-12-13，使用xiaohongshu_prod_jwt密钥签名
const DEFAULT_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

console.log(`🏠 首页环境: ${IS_DEVELOPMENT ? '开发环境' : '生产环境'}`);

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
      { id: 1, url: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?auto=format&fit=crop&w=800&q=80', title: '💰 提现功能升级维护通知' },
      { id: 2, url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80', title: '🎉 恭喜用户A提现500元' }
    ],
  },

  onLoad() {
    this.fetchAnnouncements();
    this.fetchReviews(true); // true 表示重置列表

    // 获取本地缓存的用户信息（如果没有则显示默认）
    const userInfo = wx.getStorageSync('userInfo') || { nickName: '奋斗者' };
    this.setData({ userInfo });
  },

  onShow() {
    // 每次显示页面时，刷新列表（确保看到最新状态）
    this.fetchReviews(true);
  },

  onPullDownRefresh() {
    this.fetchAnnouncements();
    this.fetchReviews(true).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 获取公告
  fetchAnnouncements() {
    const token = app.getCurrentToken();

    wx.request({
      url: API_CONFIG.ANNOUNCEMENTS,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data.success && res.data.announcements && res.data.announcements.length > 0) {
          this.setData({ announcements: res.data.announcements });
        } else {
          // 如果后端没数据，显示默认假数据演示效果
          this.setData({
            announcements: [
              '🔥 今日笔记任务单价上调至 10 元！',
              '📢 提现功能维护通知，请周五再试。',
              '🎉 恭喜用户 138****8888 提现 500 元！'
            ]
          });
        }
      },
      fail: () => {
        // 接口失败也显示默认数据，保证 UI 不空
        this.setData({
          announcements: ['🔥 系统维护中，请稍后...']
        });
      }
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

  goToUpload() {
    wx.switchTab({
      url: '/pages/upload/upload',
    });
  }
});