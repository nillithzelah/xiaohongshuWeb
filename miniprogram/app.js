//app.js
App({
  onLaunch: function () {
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          this.globalData.code = res.code
          this.autoRegister()
        }
      }
    })
  },

  // 自动注册用户（微信登录）
  autoRegister: function() {
    const CONFIG = require('./config.js');
    const API_BASE = CONFIG.API_BASE_URL;

    // 如果已经有用户信息，说明已经登录过了
    if (this.globalData.userInfo && this.globalData.userInfo.phone) {
      console.log('✅ 用户已登录且有手机号，跳过自动登录');
      return;
    }

    wx.request({
      url: `${API_BASE}/xiaohongshu/api/auth/wechat-login`,
      method: 'POST',
      data: {
        code: this.globalData.code
      },
      success: (res) => {
        if (res.data.success) {
          this.globalData.userInfo = res.data.user
          this.globalData.token = res.data.token
          wx.setStorageSync('token', res.data.token)
          wx.setStorageSync('userInfo', res.data.user) // 保存用户信息到本地存储
          wx.setStorageSync('loginType', 'wechat') // 标记登录类型
          console.log('✅ 自动登录成功:', res.data.user.username)

          // 检查是否需要获取手机号
          if (!res.data.user.phone) {
            console.log('📱 用户没有手机号，开始获取手机号授权');
            this.requestPhoneAuthOnLaunch();
          }
        }
      },
      fail: (err) => {
        console.error('❌ 自动登录失败:', err)
      }
    })
  },

  // 在启动时请求手机号授权
  requestPhoneAuthOnLaunch: function() {
    wx.showModal({
      title: '手机号授权',
      content: '为了更好地为您服务，需要获取您的手机号信息，账号仅限特定人群登录并进行登录账号鉴权',
      showCancel: false, // 不显示取消按钮，强制授权
      confirmText: '立即授权',
      success: (res) => {
        if (res.confirm) {
          // 显示手机号授权按钮的页面
          this.showPhoneAuthPage();
        }
      }
    });
  },

  // 显示手机号授权页面
  showPhoneAuthPage: function() {
    // 创建一个临时的手机号授权页面
    const phoneAuthPage = `
      <view class="phone-auth-container">
        <view class="auth-header">
          <text class="auth-title">📱 手机号授权</text>
          <text class="auth-desc">为了您的账户安全和更好的服务体验，请授权获取手机号，账号仅限特定人群登录并进行登录账号鉴权</text>
        </view>
        <view class="auth-content">
          <button
            class="auth-button"
            open-type="getPhoneNumber"
            bindgetphonenumber="onLaunchPhoneAuth"
          >
            📞 授权获取手机号
          </button>
          <text class="auth-tip">点击按钮完成手机号授权</text>
        </view>
      </view>
    `;

    // 跳转到首页，让首页处理手机号授权
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        // 在首页显示强制授权模态框
        setTimeout(() => {
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          if (currentPage && currentPage.setData) {
            currentPage.setData({
              showPhoneAuthModal: true,
              forceAuth: true // 标记为强制授权
            });
          }
        }, 500);
      }
    });
  },

  // 处理启动时的手机号授权
  onLaunchPhoneAuth: function(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      this.getPhoneNumber(e, (userInfo) => {
        console.log('✅ 启动时手机号获取成功:', userInfo);
        wx.showToast({
          title: '手机号获取成功',
          icon: 'success',
          duration: 2000
        });

        // 关闭强制授权模态框
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        if (currentPage && currentPage.setData) {
          currentPage.setData({
            showPhoneAuthModal: false,
            forceAuth: false
          });
        }
      });
    } else {
      // 用户拒绝授权，重新显示模态框
      wx.showToast({
        title: '需要授权手机号才能使用',
        icon: 'none',
        duration: 2000
      });

      // 重新显示授权模态框
      setTimeout(() => {
        const pages = getCurrentPages();
        const currentPage = pages[pages.length - 1];
        if (currentPage && currentPage.setData) {
          currentPage.setData({
            showPhoneAuthModal: true,
            forceAuth: true
          });
        }
      }, 2000);
    }
  },

  // 请求用户授权手机号
  requestPhoneNumber: function() {
    wx.showModal({
      title: '获取手机号',
      content: '为了更好地为您服务，请授权获取您的手机号，账号仅限特定人群登录并进行登录账号鉴权',
      success: (res) => {
        if (res.confirm) {
          // 用户同意，显示授权按钮（需要在页面中实现）
          wx.showToast({
            title: '请在页面中点击授权按钮',
            icon: 'none',
            duration: 2000
          });
        }
      }
    });
  },

  // 获取手机号（需要在页面中调用）
  getPhoneNumber: function(e, callback) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 获取成功，发送到后端
      const CONFIG = require('./config.js');
      const API_BASE = CONFIG.API_BASE_URL;

      wx.request({
        url: `${API_BASE}/xiaohongshu/api/auth/wechat-login`,
        method: 'POST',
        data: {
          code: this.globalData.code,
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv
        },
        success: (res) => {
          if (res.data.success) {
            this.globalData.userInfo = res.data.user
            this.globalData.token = res.data.token
            wx.setStorageSync('token', res.data.token)
            wx.setStorageSync('userInfo', res.data.user) // 保存用户信息到本地存储

            wx.showToast({
              title: '手机号获取成功',
              icon: 'success'
            });

            if (callback) callback(res.data.user);
          }
        },
        fail: () => {
          wx.showToast({
            title: '获取手机号失败',
            icon: 'error'
          });
        }
      });
    } else {
      // 用户拒绝授权
      wx.showToast({
        title: '需要授权手机号才能使用完整功能',
        icon: 'none'
      });
    }
  },

  // 手机号快速验证登录
  phoneLogin: function(phoneNumber, callback) {
    const CONFIG = require('./config.js');
    const API_BASE = CONFIG.API_BASE_URL;

    wx.request({
      url: `${API_BASE}/xiaohongshu/api/auth/phone-login`,
      method: 'POST',
      data: {
        phoneNumber: phoneNumber
      },
      success: (res) => {
        if (res.data.success) {
          this.globalData.userInfo = res.data.user
          this.globalData.token = res.data.token
          wx.setStorageSync('token', res.data.token)
          wx.setStorageSync('userInfo', res.data.user) // 保存用户信息到本地存储
          wx.setStorageSync('loginType', 'phone') // 标记登录类型

          if (callback) callback(res.data.user);
        }
      },
      fail: () => {
        wx.showToast({
          title: '手机号登录失败',
          icon: 'error'
        });
      }
    })
  },

  // 优化的网络请求方法（带缓存和去重）
  request: function(options) {
    const { url, data, useCache = true, cacheKey } = options;
    const app = getApp();

    // 检查缓存
    if (useCache) {
      const cachedData = app.requestCache.get(url, data);
      if (cachedData) {
        return Promise.resolve(cachedData);
      }
    }

    // 检查是否有相同请求正在进行
    const pendingRequest = app.requestCache.getPendingRequest(url, data);
    if (pendingRequest) {
      console.log('🔄 发现相同请求，使用现有请求:', url);
      return pendingRequest;
    }

    // 创建新的请求
    const requestPromise = new Promise((resolve, reject) => {
      wx.request({
        ...options,
        success: (res) => {
          // 缓存成功响应
          if (useCache && res.data && res.data.success) {
            app.requestCache.set(url, data, res);
          }
          resolve(res);
        },
        fail: reject
      });
    });

    // 记录进行中的请求
    app.requestCache.setPendingRequest(url, data, requestPromise);

    return requestPromise;
  },

  // 获取当前使用的token（优先使用测试用户token）
  getCurrentToken: function() {
    // 优先使用从profile页面切换的测试用户token
    const testUserToken = wx.getStorageSync('testUserToken');
    if (testUserToken) {
      console.log('🎯 使用测试用户token:', testUserToken.substring(0, 50) + '...');
      return testUserToken;
    }

    // 清除可能存在的旧token（王总的token）
    const oldBossToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';
    const currentToken = wx.getStorageSync('token');
    if (currentToken === oldBossToken) {
      console.log('🗑️ 清除旧的王总token');
      wx.removeStorageSync('token');
      wx.removeStorageSync('userInfo');
      return null;
    }

    // 使用存储的token
    console.log('🎯 使用本地存储token:', currentToken ? currentToken.substring(0, 50) + '...' : '无token');
    return currentToken;
  },

  // 全局请求缓存管理器
  requestCache: {
    // 缓存数据存储
    cache: new Map(),

    // 进行中的请求
    pendingRequests: new Map(),

    // 缓存过期时间（毫秒）
    CACHE_DURATION: 5 * 60 * 1000, // 5分钟

    // 生成缓存key
    generateKey(url, data) {
      const sortedData = data ? JSON.stringify(data, Object.keys(data).sort()) : '';
      return `${url}_${sortedData}`;
    },

    // 获取缓存数据
    get(url, data) {
      const key = this.generateKey(url, data);
      const cached = this.cache.get(key);

      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        console.log('🎯 使用缓存数据:', key);
        return cached.data;
      }

      // 清理过期缓存
      if (cached) {
        this.cache.delete(key);
      }

      return null;
    },

    // 设置缓存数据
    set(url, data, responseData) {
      const key = this.generateKey(url, data);
      this.cache.set(key, {
        data: responseData,
        timestamp: Date.now()
      });
      console.log('💾 缓存数据:', key);
    },

    // 检查是否有相同请求正在进行
    getPendingRequest(url, data) {
      const key = this.generateKey(url, data);
      return this.pendingRequests.get(key);
    },

    // 设置进行中的请求
    setPendingRequest(url, data, promise) {
      const key = this.generateKey(url, data);
      this.pendingRequests.set(key, promise);

      // 请求完成后清理
      promise.finally(() => {
        this.pendingRequests.delete(key);
      });
    }
  },

  // 全局数据管理器
  globalDataManager: {
    // 共享数据存储
    sharedData: {
      taskConfigs: null,
      userDevices: null,
      userTasks: null,
      announcements: null,
      users: null
    },

    // 获取共享数据
    get(key) {
      return this.sharedData[key];
    },

    // 设置共享数据
    set(key, data) {
      this.sharedData[key] = data;
      console.log('📦 设置共享数据:', key);
    },

    // 清除共享数据
    clear(key) {
      this.sharedData[key] = null;
      console.log('🗑️ 清除共享数据:', key);
    }
  },

  globalData: {
    userInfo: null,
    token: null,
    code: null
  }
})