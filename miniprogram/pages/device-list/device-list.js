// pages/device-list/device-list.js
const app = getApp();

// 环境配置（与上传页面保持一致）
const IS_DEVELOPMENT = true; // 开发时true，生产时false
const API_BASE = IS_DEVELOPMENT ? 'http://localhost:5000' : 'https://www.wubug.cc';

const API_CONFIG = {
  DEVICE_MY_LIST: `${API_BASE}/xiaohongshu/api/client/device/my-list`
};

// 默认测试Token（与上传页面保持一致，boss用户token）
// 用户信息：boss001 - ID: 693d29b5cbc188007ecc5848
// 权限：所有权限，可以查看所有数据
// 生成时间：2025-12-13，使用xiaohongshu_prod_jwt密钥签名
const DEFAULT_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

console.log(`📱 设备列表页环境: ${IS_DEVELOPMENT ? '开发环境' : '生产环境'}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    devices: [],
    loading: true // 骨架屏状态
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserDevices();
  },

  /**
   * 加载用户设备列表
   */
  loadUserDevices: function() {
    // 设置加载状态
    this.setData({ loading: true });

    const token = app.getCurrentToken();

    wx.request({
      url: API_CONFIG.DEVICE_MY_LIST,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success) {
          this.setData({ devices: res.data.devices || [] });
        } else {
          // 使用模拟设备数据
          this.loadMockDevices()
        }
      },
      fail: () => {
        // 网络失败时使用模拟数据
        this.loadMockDevices()
      },
      complete: () => {
        // 无论成功失败，都关闭骨架屏
        this.setData({ loading: false });
        // 停止下拉刷新
        wx.stopPullDownRefresh();
      }
    });
  },

  /**
   * 加载模拟设备数据
   */
  loadMockDevices: function() {
    const mockDevices = [
      {
        _id: 'device_001',
        accountName: 'xiaohongshu_user_001',
        status: 'online',
        influence: 'new',
        onlineDuration: 24,
        points: 150
      },
      {
        _id: 'device_002',
        accountName: 'xiaohongshu_user_002',
        status: 'offline',
        influence: 'old',
        onlineDuration: 48,
        points: 200
      },
      {
        _id: 'device_003',
        accountName: 'xiaohongshu_user_003',
        status: 'protected',
        influence: 'real_name',
        onlineDuration: 72,
        points: 300
      },
      {
        _id: 'device_004',
        accountName: 'xiaohongshu_user_004',
        status: 'frozen',
        influence: 'opened_shop',
        onlineDuration: 12,
        points: 50
      }
    ]

    this.setData({
      devices: mockDevices
    })
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.loadUserDevices();
    // 注意：wx.stopPullDownRefresh() 会在 loadUserDevices 的 complete 回调中调用
  }
});