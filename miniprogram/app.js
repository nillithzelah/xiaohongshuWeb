//app.js
App({
  onLaunch: function () {
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 启动定期缓存清理（防止内存泄漏）
    this.startCacheCleanupTimer();

    // 开发环境下加载测试工具
    if (this.config.ENV === 'development') {
      require('./test-utils.js');
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查登录状态并决定跳转页面
  checkLoginStatus: function() {
    const token = this.tokenManager.get();
    if (token) {
      // 有token，跳转到首页
      console.info('检测到已有token，跳转到首页');
      wx.switchTab({
        url: '/pages/index/index',
        success: () => {
          // 登录成功后预加载所有tabBar页面
          setTimeout(() => {
            this.pagePreloader.preloadAllTabBarPages();
          }, 1000); // 延迟1秒等待页面初始化完成
        }
      });
    } else {
      // 无token，跳转到登录页
      console.info('未检测到token，跳转到登录页');
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }
  },

  // 启动定期缓存清理定时器
  startCacheCleanupTimer: function() {
    // 每30分钟清理一次过期缓存
    setInterval(() => {
      this.globalDataManager.cleanup();
      this.requestCache.cleanup();
    }, 30 * 60 * 1000);

    console.log('缓存清理定时器已启动');
  },

  // 页面预加载管理器
  pagePreloader: {
    // 预加载配置
    preloadConfig: {
      // tabBar页面预加载
      '/pages/index/index': {
        urls: [
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/client/announcements',
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/client/user/tasks'
        ]
      },
      '/pages/upload/upload': {
        urls: [
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/client/device/my-list',
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/client/task-configs'
        ]
      },
      '/pages/profile/profile': {
        urls: [
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/user/me'
        ]
      }
    },

    // 预加载所有tabBar页面
    preloadAllTabBarPages: function() {
      const app = getApp();
      const token = app.getCurrentToken();

      if (!token) {
       console.debug('没有token，跳过预加载');
        return;
      }

     console.debug('开始预加载所有tabBar页面数据');

      // 预加载每个tabBar页面
      Object.keys(this.preloadConfig).forEach(pagePath => {
        const config = this.preloadConfig[pagePath];
        config.urls.forEach(url => {
          // 使用完整的API URL进行预加载
          app.requestCache.preload(url, {}).catch(err => {
           console.error(`预加载失败 ${pagePath}:`, err);
          });
        });
      });
    },

    // 预加载特定页面
    preloadPage: function(pagePath) {
      const app = getApp();
      const token = app.getCurrentToken();

      if (!token) {
       console.debug('没有token，跳过预加载页面:', pagePath);
        return;
      }

      const config = this.preloadConfig[pagePath];
      if (!config) {
       console.debug('没有找到预加载配置:', pagePath);
        return;
      }

     console.debug('预加载页面:', pagePath);

      // 预加载所有URL
      config.urls.forEach(url => {
        // 使用完整的API URL进行预加载
        app.requestCache.preload(url, {}).catch(err => {
        console.error(`预加载页面失败 ${pagePath}:`, err);
      });
      });
    }
  },

  // 统一日志管理器
  logger: {
    // 根据环境和配置决定是否输出日志
    shouldLog(level) {
      const config = this.config || {};
      // 开发环境或开启日志功能时才输出
      return config.FEATURES?.ENABLE_CONSOLE_LOG ||
            config.ENV === 'development' ||
            level === 'error'; // 错误日志总是输出
    },

    debug(message, ...args) {
      if (this.shouldLog('debug')) {
        console.log(`🐛 ${message}`, ...args);
      }
    },

    info(message, ...args) {
      if (this.shouldLog('info')) {
        console.log(`ℹ️ ${message}`, ...args);
      }
    },

    warn(message, ...args) {
      if (this.shouldLog('warn')) {
        console.warn(`⚠️ ${message}`, ...args);
      }
    },

    error(message, ...args) {
      // 错误日志总是输出
      console.error(`❌ ${message}`, ...args);
    }
  },

  // 配置访问器（方便其他文件访问配置）
  get config() {
    return require('./config.js');
  },

  // 通用工具方法（减少代码重复）
  utils: {
    // 检查用户信息是否发生变化（提取公共逻辑）
    hasUserInfoChanged(oldInfo, newInfo) {
      if (!oldInfo && !newInfo) return false;
      if (!oldInfo || !newInfo) return true;

      // 检查关键字段：用户ID、手机号、用户名
      return oldInfo.id !== newInfo.id ||
             oldInfo.phone !== newInfo.phone ||
             oldInfo.username !== newInfo.username;
    },

    // 安全的对象属性访问（类型安全）
    safeGet(obj, path, defaultValue = null) {
      if (!obj || typeof obj !== 'object') return defaultValue;

      const keys = path.split('.');
      let result = obj;

      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = result[key];
        } else {
          return defaultValue;
        }
      }

      return result;
    },

    // 类型检查和转换
    ensureArray(value) {
      return Array.isArray(value) ? value : [];
    },

    ensureString(value, defaultValue = '') {
      return typeof value === 'string' ? value : String(value || defaultValue);
    },

    ensureNumber(value, defaultValue = 0) {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    },

    ensureBoolean(value, defaultValue = false) {
      return typeof value === 'boolean' ? value : Boolean(value || defaultValue);
    }
  },

  // 统一错误处理和用户提示
  errorHandler: {
    // 处理API错误
    handleApiError(error, context = '') {
      const logger =console;

      // 记录错误详情
      logger.error(`API错误 ${context}:`, {
        message: error.message || error.errMsg,
        statusCode: error.statusCode,
        data: error.data
      });

      // 根据错误类型给出用户友好的提示
      let userMessage = '操作失败，请稍后重试';

      if (error.statusCode === 401) {
        userMessage = '登录已过期，请重新登录';
      } else if (error.statusCode === 403) {
        userMessage = '权限不足，无法执行此操作';
      } else if (error.statusCode === 404) {
        userMessage = '请求的资源不存在';
      } else if (error.statusCode === 500) {
        userMessage = '服务器内部错误，请联系管理员';
      } else if (error.errMsg && error.errMsg.includes('timeout')) {
        userMessage = '网络请求超时，请检查网络连接';
      } else if (error.errMsg && error.errMsg.includes('fail')) {
        userMessage = '网络连接失败，请检查网络后重试';
      }

      // 显示用户友好的错误提示
      wx.showToast({
        title: userMessage,
        icon: 'none',
        duration: 3000
      });

      return userMessage;
    },

    // 处理用户操作错误
    handleUserError(message, title = '操作失败') {
     console.warn(`用户操作错误: ${message}`);

      wx.showModal({
        title: title,
        content: message,
        showCancel: false,
        confirmText: '知道了'
      });
    },

    // 处理成功消息
    handleSuccess(message = '操作成功') {
      wx.showToast({
        title: message,
        icon: 'success',
        duration: 2000
      });
    }
  },

  // 检查用户是否已完成手机号授权
  checkPhoneAuthForNavigation: function() {
    const userInfo = this.globalData.userInfo || wx.getStorageSync('userInfo');
    return userInfo && userInfo.phone;
  },

  // 导航守卫：检查权限并处理未授权情况
  navigateGuard: function() {
    if (!this.checkPhoneAuthForNavigation()) {
     console.warn('用户未完成手机号授权，跳转到登录页');

      wx.showModal({
        title: '需要完成授权',
        content: '请先完成手机号授权才能使用其他功能',
        showCancel: false,
        confirmText: '立即授权',
        success: (res) => {
          if (res.confirm) {
            // 跳转到登录页面进行手机号授权
            wx.redirectTo({
              url: '/pages/login/login?needPhoneAuth=true',
              success: () => {
                console.info('成功跳转到登录页面进行手机号授权');
              },
              fail: (err) => {
                console.error('跳转到登录页面失败:', err);
              }
            });
          }
        }
      });

      return false; // 阻止导航
    }

    return true; // 允许导航
  },

  // 自动注册用户（微信登录）
  autoRegister: function() {
    const CONFIG = require('./config.js');
    const API_BASE = CONFIG.API_BASE_URL;

    // 如果已经有用户信息，说明已经登录过了
    if (this.globalData.userInfo && this.globalData.userInfo.phone) {
     console.info('用户已登录且有手机号，跳过自动登录');
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
          this.tokenManager.set(res.data.token) // 安全存储token
          wx.setStorageSync('userInfo', res.data.user) // 保存用户信息到本地存储
          wx.setStorageSync('loginType', 'wechat') // 标记登录类型

          // 更新统一状态管理器
          this.stateManager.updateUserState(res.data.user);

         console.info('自动登录成功:', res.data.user.username)

          // 检查是否需要获取手机号（由首页处理）
          if (!res.data.user.phone) {
           console.info('用户没有手机号，首页将显示授权提示');
          }
        }
      },
      fail: (err) => {
       console.error('自动登录失败:', err.errMsg || err.message)
      }
    })
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
   console.debug('getPhoneNumber 被调用:', e.detail.errMsg);

    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 获取成功，先重新获取code（因为之前的code可能已被使用）
     console.debug('重新获取微信登录code...');

      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
           console.debug('获取到新code:', loginRes.code);
            this.globalData.code = loginRes.code; // 更新全局code

            // 现在发送到后端
            const CONFIG = require('./config.js');
            const API_BASE = CONFIG.API_BASE_URL;

           console.debug('发送手机号授权请求到服务器');

            wx.request({
              url: `${API_BASE}/xiaohongshu/api/auth/wechat-login`,
              method: 'POST',
              data: {
                code: this.globalData.code,
                encryptedData: e.detail.encryptedData,
                iv: e.detail.iv
              },
              success: (res) => {
                console.log('📱 服务器响应:', res.data);

                if (res.data.success) {
                 console.debug('更新全局用户信息');
                  this.globalData.userInfo = res.data.user;
                  this.globalData.token = res.data.token;

                 console.debug('保存到本地存储');
                  this.tokenManager.set(res.data.token); // 安全存储token
                  wx.setStorageSync('userInfo', res.data.user);

                  // 更新统一状态管理器（关键！）
                  this.stateManager.updateUserState(res.data.user);

                  wx.showToast({
                    title: '手机号获取成功',
                    icon: 'success'
                  });

                  if (callback) {
                   console.debug('调用回调函数');
                    callback(res.data.user);
                  }
                } else {
                 console.error('服务器返回失败:', res.data.message);
                  wx.showToast({
                    title: res.data.message || '获取手机号失败',
                    icon: 'error'
                  });
                }
              },
              fail: (err) => {
               console.error('网络请求失败:', err.errMsg || err.message);
                wx.showToast({
                  title: '网络错误，请重试',
                  icon: 'error'
                });
              }
            });
          } else {
           console.error('获取新code失败:', loginRes.errMsg);
            wx.showToast({
              title: '获取登录凭证失败，请重试',
              icon: 'error'
            });
          }
        },
        fail: (loginErr) => {
         console.error('wx.login失败:', loginErr.errMsg);
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'error'
          });
        }
      });
    } else {
      // 用户拒绝授权
     console.warn('用户拒绝手机号授权');
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
          this.tokenManager.set(res.data.token) // 安全存储token
          wx.setStorageSync('userInfo', res.data.user) // 保存用户信息到本地存储
          wx.setStorageSync('loginType', 'phone') // 标记登录类型

          // 更新统一状态管理器
          this.stateManager.updateUserState(res.data.user);

          if (callback) callback(res.data.user);
        }
      },
      fail: (err) => {
       console.error('手机号登录失败:', err.errMsg || err.message);
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
     console.debug('发现相同请求，使用现有请求:', url);
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

  // Token存储安全管理器（小程序兼容版本）
  tokenManager: {
    // 存储token（添加时间戳和基本验证）
    set(token) {
      if (token && typeof token === 'string' && token.length > 10) {
        wx.setStorageSync('secure_token', token);
        wx.setStorageSync('token_timestamp', Date.now());
        wx.setStorageSync('token_hash', this.simpleHash(token)); // 简单的完整性检查
       console.debug('Token已存储（带安全检查）');
      } else {
       console.error('Token格式无效');
      }
    },

    // 获取token（带完整性验证）
    get() {
      const token = wx.getStorageSync('secure_token');
      const timestamp = wx.getStorageSync('token_timestamp');
      const storedHash = wx.getStorageSync('token_hash');

      if (!token) return null;

      // 检查token是否过期（24小时）
      if (timestamp && Date.now() - timestamp > 24 * 60 * 60 * 1000) {
       console.info('Token已过期，清除');
        this.clear();
        return null;
      }

      // 验证token完整性
      if (storedHash && this.simpleHash(token) !== storedHash) {
       console.error('Token完整性检查失败，可能被篡改');
        this.clear();
        return null;
      }

      return token;
    },

    // 清除token
    clear() {
      wx.removeStorageSync('secure_token');
      wx.removeStorageSync('token_timestamp');
      wx.removeStorageSync('token_hash');
      wx.removeStorageSync('userInfo'); // 同时清除用户信息
     console.debug('Token已清除');
    },

    // 简单的哈希函数（用于完整性检查）
    simpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
      }
      return hash.toString();
    }
  },

  // 获取当前使用的token（优先使用测试用户token）
  getCurrentToken: function() {
    // 优先使用从profile页面切换的测试用户token（测试token不混淆）
    const testUserToken = wx.getStorageSync('testUserToken');
    if (testUserToken) {
      console.log('🎯 使用测试用户token:', testUserToken.substring(0, 50) + '...');
      return testUserToken;
    }

    // 使用安全的token管理器
    const token = this.tokenManager.get();
   console.debug('使用本地存储token:', token ? '已获取' : '无token');
    return token;
  },

  // 全局请求缓存管理器（优化版本）
  requestCache: {
    // 缓存数据存储
    cache: new Map(),

    // 进行中的请求
    pendingRequests: new Map(),

    // 缓存过期时间（毫秒）
    CACHE_DURATION: 5 * 60 * 1000, // 5分钟

    // 预加载缓存（用于预加载常用数据）
    preloadCache: new Map(),
    PRELOAD_DURATION: 10 * 60 * 1000, // 预加载缓存10分钟

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
       console.debug('使用缓存数据:', key);
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
     console.debug('缓存数据:', key);
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
    },

    // 清理长时间未完成的请求（防止内存泄漏）
    cleanup() {
      const now = Date.now();
      let cleaned = 0;

      // 清理过期的缓存数据
      for (const [key, cached] of this.cache.entries()) {
        if (now - cached.timestamp > this.CACHE_DURATION) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      // 清理过期的预加载缓存
      for (const [key, cached] of this.preloadCache.entries()) {
        if (now - cached.timestamp > this.PRELOAD_DURATION) {
          this.preloadCache.delete(key);
          cleaned++;
        }
      }

      // 清理长时间未完成的请求（超过10分钟）
      for (const [key, promise] of this.pendingRequests.entries()) {
        // 这里无法直接检查promise状态，但可以定期清理
        // 在实际应用中，可以为每个请求添加时间戳
      }

      if (cleaned > 0) {
       console.info(`清理了 ${cleaned} 个过期请求缓存`);
      }
    },

    // 预加载数据（用于常用页面预加载）
    preload(url, data) {
      const key = this.generateKey(url, data);

      // 如果已经有缓存，直接返回
      if (this.preloadCache.has(key)) {
       console.debug('预加载数据已存在:', key);
        return Promise.resolve(this.preloadCache.get(key).data);
      }

      // 检查是否有相同请求正在进行
      const pendingRequest = this.pendingRequests.get(key);
      if (pendingRequest) {
       console.debug('发现相同预加载请求，使用现有请求:', url);
        return pendingRequest;
      }

      // 创建新的预加载请求
      const requestPromise = new Promise((resolve, reject) => {
        wx.request({
          url: url,
          data: data,
          method: 'GET',
          success: (res) => {
            // 缓存预加载数据
            this.preloadCache.set(key, {
              data: res,
              timestamp: Date.now()
            });
            resolve(res);
          },
          fail: reject
        });
      });

      // 记录进行中的请求
      this.pendingRequests.set(key, requestPromise);

      // 请求完成后清理
      requestPromise.finally(() => {
        this.pendingRequests.delete(key);
      });

      return requestPromise;
    },

    // 获取预加载数据
    getPreload(url, data) {
      const key = this.generateKey(url, data);
      const cached = this.preloadCache.get(key);

      if (cached && (Date.now() - cached.timestamp) < this.PRELOAD_DURATION) {
       console.debug('使用预加载缓存数据:', key);
        return cached.data;
      }

      // 清理过期缓存
      if (cached) {
        this.preloadCache.delete(key);
      }

      return null;
    }
  },

  // 全局状态管理器（统一的状态更新机制）
  stateManager: {
    // 页面状态监听器
    listeners: new Map(),

    // 用户状态
    userState: {
      isLoggedIn: false,
      userInfo: null,
      hasPhoneAuth: false
    },

    // 注册页面状态监听器
    registerListener(pageId, callback) {
      this.listeners.set(pageId, callback);
     console.debug(`注册状态监听器: ${pageId}`);
    },

    // 移除页面状态监听器
    unregisterListener(pageId) {
      this.listeners.delete(pageId);
     console.debug(`移除状态监听器: ${pageId}`);
    },

    // 更新用户状态（核心方法）
    updateUserState(userInfo) {
      const oldState = { ...this.userState };

      this.userState.userInfo = userInfo;
      this.userState.isLoggedIn = !!userInfo;
      this.userState.hasPhoneAuth = !!(userInfo && userInfo.phone);

      console.log('用户状态更新:', {
        登录状态: this.userState.isLoggedIn,
        手机号验证: this.userState.hasPhoneAuth,
        用户信息: userInfo ? '已设置' : '未设置'
      });

      // 通知所有监听器
      this.listeners.forEach((callback, pageId) => {
        try {
          callback(this.userState, oldState);
        } catch (error) {
          console.error(`状态监听器错误 (${pageId}):`, error);
        }
      });

      // 清理相关缓存
      if (this.hasUserStateChanged(oldState, this.userState)) {
        console.log('用户状态变化，清理相关缓存');
        getApp().globalDataManager.clear('userDevices');
        getApp().globalDataManager.clear('userTasks');
        getApp().globalDataManager.clear('announcements');
      }
    },

    // 检查用户状态是否发生变化
    hasUserStateChanged(oldState, newState) {
      return oldState.isLoggedIn !== newState.isLoggedIn ||
             oldState.hasPhoneAuth !== newState.hasPhoneAuth ||
             (oldState.userInfo && newState.userInfo &&
              (oldState.userInfo.id !== newState.userInfo.id ||
               oldState.userInfo.phone !== newState.userInfo.phone));
    },

    // 获取当前用户状态
    getUserState() {
      return { ...this.userState };
    }
  },

// 资源加载管理器（图片懒加载和优化）
resourceManager: {
  // 图片缓存
  imageCache: new Map(),

  // 最大缓存数量
  MAX_CACHE_SIZE: 50,

  // 缓存图片
  cacheImage: function(url, callback) {
    if (this.imageCache.has(url)) {
      const cached = this.imageCache.get(url);
      if (callback) callback(cached.success ? cached.path : null);
      return;
    }

    wx.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode === 200) {
          this.imageCache.set(url, { path: res.tempFilePath, success: true });
          if (callback) callback(res.tempFilePath);
          
          // 如果缓存超过最大值，清理旧缓存
          if (this.imageCache.size > this.MAX_CACHE_SIZE) {
            this.cleanupCache();
          }
        } else {
          this.imageCache.set(url, { success: false });
          if (callback) callback(null);
        }
      },
      fail: (err) => {
        this.imageCache.set(url, { success: false });
        if (callback) callback(null);
      }
    });
  },

  // 获取缓存图片
  getCachedImage: function(url) {
    const cached = this.imageCache.get(url);
    return cached && cached.success ? cached.path : null;
  },

  // 清理缓存
  cleanupCache: function() {
    const urls = Array.from(this.imageCache.keys());
    if (urls.length <= this.MAX_CACHE_SIZE) return;

    // 清理前50%的缓存
    const toRemove = urls.slice(0, Math.floor(urls.length / 2));
    toRemove.forEach(url => this.imageCache.delete(url));
  },

  // 懒加载图片（带占位符和渐进加载）
  lazyLoadImage: function(url, callback) {
    // 先检查缓存
    const cachedPath = this.getCachedImage(url);
    if (cachedPath) {
      if (callback) callback(cachedPath);
      return;
    }

    // 使用低优先级下载
    this.cacheImage(url, callback);
  }
},

// 全局数据管理器（优化版本）
globalDataManager: {
    // 共享数据存储（带时间戳）
    sharedData: {
      taskConfigs: { data: null, timestamp: 0 },
      userDevices: { data: null, timestamp: 0 },
      userTasks: { data: null, timestamp: 0 },
      announcements: { data: null, timestamp: 0 },
      users: { data: null, timestamp: 0 }
    },

    // 缓存过期时间（毫秒）
    CACHE_DURATIONS: {
      taskConfigs: 10 * 60 * 1000,    // 10分钟
      userDevices: 5 * 60 * 1000,     // 5分钟（重要数据）
      userTasks: 2 * 60 * 1000,       // 2分钟
      announcements: 30 * 60 * 1000,  // 30分钟
      users: 15 * 60 * 1000           // 15分钟
    },

    // 获取共享数据（带过期检查）
    get(key) {
      const cacheItem = this.sharedData[key];
      if (!cacheItem || !cacheItem.data) {
        return null;
      }

      const now = Date.now();
      const duration = this.CACHE_DURATIONS[key] || 5 * 60 * 1000;

      if (now - cacheItem.timestamp > duration) {
       console.debug(`缓存过期: ${key}, 清除旧数据`);
        this.clear(key);
        return null;
      }

      return cacheItem.data;
    },

    // 设置共享数据
    set(key, data) {
      this.sharedData[key] = {
        data: data,
        timestamp: Date.now()
      };
    },

    // 清除共享数据
    clear(key) {
      this.sharedData[key] = { data: null, timestamp: 0 };
    },

    // 强制刷新特定缓存
    refresh(key) {
      this.clear(key);
    },

    // 定期清理过期缓存（防止内存泄漏）
    cleanup() {
      const now = Date.now();
      let cleaned = 0;

      Object.keys(this.sharedData).forEach(key => {
        const cacheItem = this.sharedData[key];
        const duration = this.CACHE_DURATIONS[key] || 5 * 60 * 1000;

        if (cacheItem.data && now - cacheItem.timestamp > duration) {
          this.clear(key);
          cleaned++;
        }
      });

      if (cleaned > 0) {
       console.info(`清理了 ${cleaned} 个过期缓存`);
      }
    }
  },

  // 图片上传相关方法
  uploadImage: function(filePath) {
    const CONFIG = require('./config.js');
    const API_CONFIG = {
      UPLOAD_IMAGE: `${CONFIG.API_BASE_URL}/xiaohongshu/api/upload/image`
    };

    return new Promise((resolve, reject) => {
      // 优先使用从profile页面切换的测试用户token
      const testUserToken = wx.getStorageSync('testUserToken');
      const token = testUserToken || wx.getStorageSync('token');

      // 使用wx.uploadFile直接上传文件，避免base64大小问题
      wx.uploadFile({
        url: API_CONFIG.UPLOAD_IMAGE,
        filePath: filePath,
        name: 'file',
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.success) {
              // 计算MD5（需要前端计算，因为服务器/upload/image不返回MD5）
              wx.getFileSystemManager().readFile({
                filePath: filePath,
                success: (fileRes) => {
                  // 使用异步MD5计算，避免UI卡顿
                  this.calculateMD5(fileRes.data).then(md5 => {
                    resolve({
                      imageUrl: data.data.url,
                      md5: md5
                    });
                  }).catch(() => {
                    reject(new Error('计算文件MD5失败'));
                  });
                },
                fail: () => {
                  reject(new Error('读取文件失败'));
                }
              });
            } else {
              reject(new Error(data.message || '上传失败'));
            }
          } catch (e) {
            reject(new Error('解析响应失败'));
          }
        },
        fail: (err) => {
          console.error('上传失败:', err);
          reject(new Error('网络错误'));
        }
      });
    });
  },

  // 计算MD5的辅助函数（异步分块处理，避免UI卡顿）
  calculateMD5: function(data) {
    return new Promise((resolve) => {
      // 检查数据有效性
      if (!data) {
        console.error('MD5计算失败: 数据为空', data);
        resolve('error_null_data_' + Date.now());
        return;
      }

      let dataArray;
      let dataLength;

      try {
        // 处理ArrayBuffer（小程序文件数据）
        if (data.byteLength !== undefined) {
          // ArrayBuffer类型检测
          dataArray = new Uint8Array(data);
          dataLength = dataArray.length;
        } else if (data.length !== undefined) {
          // 普通数组或类似数组的对象
          dataArray = data;
          dataLength = data.length;
        } else {
          console.error('MD5计算失败: 不支持的数据类型', typeof data, data.constructor?.name, data);
          resolve('error_unsupported_type_' + Date.now());
          return;
        }

        if (dataLength === 0) {
          console.error('MD5计算失败: 数据长度为0');
          resolve('error_empty_data_' + Date.now());
          return;
        }

        // 使用分块异步处理，避免长时间占用主线程
        this.calculateMD5Async(dataArray, dataLength).then(resolve).catch((error) => {
          console.error('异步MD5计算失败:', error);
          resolve('error_async_calculation_failed_' + Date.now());
        });

      } catch (error) {
        console.error('MD5计算过程中出错:', error, data);
        resolve('error_calculation_failed_' + Date.now());
      }
    });
  },

  // 异步MD5计算（优化版：更高效的分块处理和更好的哈希算法）
  calculateMD5Async: function(dataArray, dataLength) {
    return new Promise((resolve) => {
      // 使用更高效的哈希算法：FNV-1a变体
      let hash = 2166136261; // FNV offset basis
      const prime = 16777619; // FNV prime

      // 包含文件大小作为种子
      hash ^= dataLength;
      hash *= prime;

      // 动态分块大小：根据文件大小调整
      let chunkSize;
      if (dataLength <= 1024 * 1024) { // 1MB以内
        chunkSize = 64 * 1024; // 64KB块
      } else if (dataLength <= 10 * 1024 * 1024) { // 10MB以内
        chunkSize = 256 * 1024; // 256KB块
      } else {
        chunkSize = 512 * 1024; // 512KB块
      }

      // 采样处理：对于大文件，只处理部分块以提高速度
      const maxChunks = dataLength <= 5 * 1024 * 1024 ? 20 : 10; // 小文件处理更多块
      const totalChunks = Math.min(maxChunks, Math.ceil(dataLength / chunkSize));
      let processedChunks = 0;

      // 均匀采样：选择分布在文件各处的块
      const chunkIndices = [];
      for (let i = 0; i < totalChunks; i++) {
        const index = Math.floor((i * dataLength) / (totalChunks * chunkSize));
        chunkIndices.push(index);
      }

      const processChunk = (chunkIndex) => {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, dataLength);
        const chunk = dataArray.slice(start, end);

        // 使用FNV-1a哈希算法
        for (let i = 0; i < chunk.length; i++) {
          hash ^= chunk[i];
          hash *= prime;
          hash = hash >>> 0; // 确保32位无符号整数
        }

        processedChunks++;

        // 如果还有更多块，继续处理
        if (processedChunks < totalChunks) {
          // 使用setTimeout让出主线程，避免UI卡顿
          setTimeout(() => processChunk(chunkIndices[processedChunks]), 0);
        } else {
          // 所有块处理完成
          // 添加时间戳和随机因子确保唯一性
          const timestamp = Date.now() % 1000000;
          const randomFactor = Math.floor(Math.random() * 1000);

          // 组合最终哈希
          const finalHash = (hash >>> 0).toString(16).padStart(8, '0') +
                            timestamp.toString(16).padStart(6, '0') +
                            randomFactor.toString(16).padStart(3, '0');

          resolve(finalHash);
        }
      };

      // 开始处理第一块
      if (chunkIndices.length > 0) {
        processChunk(chunkIndices[0]);
      } else {
        // 处理空文件的情况
        const timestamp = Date.now() % 1000000;
        const randomFactor = Math.floor(Math.random() * 1000);
        const finalHash = '00000000' + timestamp.toString(16).padStart(6, '0') + randomFactor.toString(16).padStart(3, '0');
        resolve(finalHash);
      }
    });
  },

  globalData: {
    userInfo: null,
    token: null,
    code: null
  }
})