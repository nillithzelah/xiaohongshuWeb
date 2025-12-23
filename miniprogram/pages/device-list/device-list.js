// pages/device-list/device-list.js
const app = getApp();
const CONFIG = require('../../config.js');

// 使用配置文件中的API端点（已统一管理）
const API_CONFIG = {
  DEVICE_MY_LIST: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.DEVICE_MY_LIST
};

// 从配置文件获取测试token（已移至config.js统一管理）
const DEFAULT_TEST_TOKEN = CONFIG.TEST_TOKENS?.BOSS_TOKEN;

console.log(`📱 设备列表页环境: ${CONFIG.ENV}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    devices: [],
    loading: true, // 骨架屏状态
    noDevicesMessage: null // 无设备时的提示信息
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserDevices();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('📱 设备管理页面 onShow 被调用');

    // 检查用户是否已完成手机号授权
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    console.log('👤 当前用户信息:', userInfo);
    console.log('📞 用户手机号:', userInfo?.phone);

    if (!app.checkPhoneAuthForNavigation()) {
      console.log('🚫 用户未完成手机号授权，跳转首页');
      wx.showModal({
        title: '需要完成授权',
        content: '请先完成手机号授权才能使用设备管理功能',
        showCancel: false,
        confirmText: '立即授权',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/index/index',
              success: () => {
                setTimeout(() => {
                  const pages = getCurrentPages();
                  const currentPage = pages[pages.length - 1];
                  if (currentPage && currentPage.checkPhoneAuth) {
                    currentPage.checkPhoneAuth();
                  }
                }, 500);
              }
            });
          }
        }
      });
      return;
    }

    console.log('✅ 用户已授权，开始加载设备数据');
    // 重新加载设备数据，确保使用最新缓存
    this.loadUserDevices();
  },

  /**
   * 加载用户设备列表
   */
  loadUserDevices: function() {
    console.log('🔍 开始加载用户设备列表');
    // 设置加载状态
    this.setData({ loading: true });

    const app = getApp();

    // 检查全局共享数据
    const sharedData = app.globalDataManager.get('userDevices');
    console.log('📊 缓存中的设备数据:', sharedData);

    if (sharedData && Array.isArray(sharedData) && sharedData.length > 0) {
      console.log('📦 使用共享设备数据，数量:', sharedData.length);
      this.processUserDevices(sharedData);
      return;
    }

    console.log('🌐 缓存无效或为空，调用API获取数据');

    const token = app.getCurrentToken();
    console.log('🎯 使用token:', token ? token.substring(0, 50) + '...' : '无token');

    console.log('🔗 请求URL:', API_CONFIG.DEVICE_MY_LIST);
    console.log('🎫 请求token:', token ? token.substring(0, 50) + '...' : '无token');

    app.request({
      url: API_CONFIG.DEVICE_MY_LIST,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      useCache: true
    }).then(res => {
      console.log('📡 设备列表API响应:', res);

      // 严谨的数据验证
      if (!res || !res.data) {
        console.error('❌ API响应异常: 响应数据为空');
        this.setData({
          devices: [],
          noDevicesMessage: '服务器响应异常，请稍后重试'
        });
        return;
      }

      console.log('📊 响应数据结构:', res.data);

      if (res.data.success === true) {
        const devices = getApp().utils.ensureArray(res.data.devices);
        console.log('✅ API返回成功，设备数量:', devices.length);

        // 保存到全局共享数据
        app.globalDataManager.set('userDevices', devices);

        if (devices.length > 0) {
          // 有设备数据，正常处理
          this.processUserDevices(devices);
        } else {
          // 没有设备，显示友好提示
          this.setData({
            devices: [],
            noDevicesMessage: '暂无设备分配，请联系管理员分配设备'
          });
        }
      } else {
        // API返回失败
        const errorMessage = res.data?.message || '获取设备列表失败';
        console.log('❌ API返回失败:', errorMessage);

        this.setData({
          devices: [],
          noDevicesMessage: errorMessage
        });
      }
    }).catch(err => {
      console.error('❌ 网络请求失败:', err);

      // 更详细的错误信息
      let errorMessage = '网络连接失败';
      if (err && err.errMsg) {
        if (err.errMsg.includes('timeout')) {
          errorMessage = '网络请求超时，请检查网络连接';
        } else if (err.errMsg.includes('fail')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        }
      }

      this.setData({
        devices: [],
        noDevicesMessage: errorMessage
      });
    }).finally(() => {
      // 无论成功失败，都关闭骨架屏
      this.setData({ loading: false });
      // 停止下拉刷新
      wx.stopPullDownRefresh();
    });
  },

  // 处理用户设备数据
  processUserDevices: function(devices) {
    console.log('🔄 处理设备数据，数量:', devices.length);
    this.setData({
      devices: devices,
      loading: false // 确保关闭骨架屏
    });
    console.log('✅ 设备数据已设置到页面');
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