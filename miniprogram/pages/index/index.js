// pages/index/index.js
const app = getApp();

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
    wx.request({
      url: 'http://localhost:5000/api/client/announcements', // 确保后端有这个接口
      method: 'GET',
      success: (res) => {
        if (res.data.success && res.data.data.length > 0) {
          this.setData({ announcements: res.data.data });
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

    const token = wx.getStorageSync('token');

    return new Promise((resolve) => {
      wx.request({
        url: `http://localhost:5000/api/client/user/tasks?page=${this.data.page}&limit=10`,
        method: 'GET',
        header: { 'Authorization': `Bearer ${token}` },
        success: (res) => {
          if (res.data && res.data.success) {
            const newReviews = res.data.data.map(item => ({
              ...item,
              // 简单格式化时间 MM-DD HH:mm
              formattedTime: item.createdAt ? item.createdAt.substring(5, 16).replace('T', ' ') : '刚刚'
            }));

            this.setData({
              reviews: reset ? newReviews : [...this.data.reviews, ...newReviews],
              page: this.data.page + 1,
              hasMore: newReviews.length === 10, // 如果返回少于10条，说明没更多了
              loading: false
            });
          }
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