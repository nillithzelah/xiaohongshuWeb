//app.js
// 小程序版本号（每次更新需修改此版本号）
const APP_VERSION = '1.0.6';

// 导入权限服务
const authService = require('./services/authService');

App({
  // 权限服务引用
  authService: authService,

  onLaunch: function () {
    // 检查版本更新，清理旧版本缓存
    this.checkVersionAndClearCache();

    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 启动定期缓存清理（防止内存泄漏）
    this.startCacheCleanupTimer();

    // 开发环境下加载测试工具
    if (this.config.ENV === 'development') {
      // require('./test-utils.js'); // 文件不存在，已注释
    }

    // 检查登录状态
    this.checkLoginStatus();
  },

  // 检查版本更新并清理缓存
  checkVersionAndClearCache: function() {
    const lastVersion = wx.getStorageSync('app_version');

    if (lastVersion !== APP_VERSION) {
      console.info(`版本更新: ${lastVersion || '未知'} -> ${APP_VERSION}，清理所有缓存`);

      // 清理所有本地存储缓存
      this.clearAllCache();

      // 保存新版本号
      wx.setStorageSync('app_version', APP_VERSION);
    } else {
      console.debug('版本未变化，无需清理缓存');
    }
  },

  // 清理所有缓存
  clearAllCache: function() {
    try {
      // 清理内存缓存
      this.requestCache.clear();
      this.globalDataManager.clear();

      // 【版本更新时检查用户数据完整性】
      // 如果userInfo存在但缺少关键字段(如phone)，说明数据不完整，需要清理
      const userInfo = wx.getStorageSync('userInfo');
      const loginType = wx.getStorageSync('loginType');

      if (userInfo && loginType === 'phone' && !userInfo.phone) {
        // 手机号登录用户缺少phone号，数据不完整，清理登录信息
        console.warn('检测到用户数据不完整(缺少phone号)，清理登录信息');
        this.tokenManager.clear();
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('loginType');
        // 清理全局用户数据
        this.globalData.userInfo = null;
      }

      // 清理特定业务数据缓存
      wx.removeStorageSync('announcements');
      wx.removeStorageSync('userDevices');
      wx.removeStorageSync('userTasks');
      wx.removeStorageSync('taskConfigs');

      console.info('所有缓存已清理');
    } catch (err) {
      console.error('清理缓存失败:', err);
    }
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
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/client/user/tasks',
          require('./config.js').API_BASE_URL + '/xiaohongshu/api/user/me'
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
      const appConfig = getApp().config || {};
      // 开发环境或开启日志功能时才输出
      return appConfig.FEATURES?.ENABLE_CONSOLE_LOG ||
            appConfig.ENV === 'development' ||
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

      // 检查关键字段：用户ID、手机号、用户名、积分
      return oldInfo.id !== newInfo.id ||
             oldInfo.phone !== newInfo.phone ||
             oldInfo.username !== newInfo.username ||
             oldInfo.points !== newInfo.points;
    },

    // 安全的对象属性访问（类型安全）
    safeGet(obj, path, defaultValue = null) {
      if (!obj || typeof obj !== 'object') return defaultValue;

      const keys = path.split('.');
      let result = obj;

      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = result[key];
          // 如果结果是 null 或 undefined，返回默认值
          if (result === null || result === undefined) {
            return defaultValue;
          }
        } else {
          return defaultValue;
        }
      }

      // 最终结果如果是 null 或 undefined，也返回默认值
      return (result === null || result === undefined) ? defaultValue : result;
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
          wx.setStorageSync('loginType', 'phone') // 标记登录类型（微信登录=手机号登录）

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
          // 处理401未授权错误
          if (res.statusCode === 401) {
            console.warn('检测到401错误，token可能已过期');

            // 如果正在刷新token，则将当前请求加入队列
            if (app.isRefreshing) {
              return new Promise((resolve, reject) => {
                app.addRefreshSubscriber(newToken => {
                  // 刷新成功后，使用新token重试原请求
                  options.header = {
                    ...options.header,
                    'Authorization': `Bearer ${newToken}`
                  };
                  app.request(options).then(resolve).catch(reject);
                });
              });
            } else {
              // 开始刷新token
              return app.refreshToken().then(newToken => {
                // 刷新成功，使用新token重试原请求
                options.header = {
                  ...options.header,
                  'Authorization': `Bearer ${newToken}`
                };
                return app.request(options);
              }).catch(refreshErr => {
                // 刷新失败，直接拒绝原请求
                reject(refreshErr);
              });
            }
          }

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

    // 获取token（带完整性验证和过期时间检查）
    get() {
      const token = wx.getStorageSync('secure_token');
      const timestamp = wx.getStorageSync('token_timestamp');
      const storedHash = wx.getStorageSync('token_hash');

      if (!token) return null;

      // 检查token是否过期（7天，与服务器JWT过期时间保持一致）
      if (timestamp && Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
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
    if (testUserToken && testUserToken.length > 10) { // 增加长度校验
      console.log('🎯 使用测试用户token:', testUserToken.substring(0, 50) + '...');
      return testUserToken;
    }

    // 使用安全的token管理器
    const token = this.tokenManager.get();
    console.debug('使用本地存储token:', token ? '已获取' : '无token');
    return token;
  },

  // Token刷新机制（增强版：支持重试）
  isRefreshing: false, // 标记是否正在刷新token
  refreshSubscribers: [], // 存储等待token刷新的请求回调
  refreshRetryCount: 0, // 刷新重试次数
  maxRefreshRetries: 2, // 最大重试次数

  // 添加等待刷新的请求
  addRefreshSubscriber(callback) {
    this.refreshSubscribers.push(callback);
  },

  // 通知所有等待的请求使用新token
  onRefreshed(token) {
    this.refreshSubscribers.map(callback => callback(token));
    this.refreshSubscribers = [];
  },

  // 清除所有等待的请求
  clearRefreshSubscribers(error) {
    this.refreshSubscribers.forEach(callback => {
      if (typeof callback === 'function') {
        callback(null, error);
      }
    });
    this.refreshSubscribers = [];
  },

  // 刷新token（增强版：支持重试）
  refreshToken: function() {
    // 如果正在刷新，返回等待Promise
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.addRefreshSubscriber((newToken, error) => {
          if (error) {
            reject(error);
          } else {
            resolve(newToken);
          }
        });
      });
    }

    this.isRefreshing = true;

    const CONFIG = require('./config.js');
    const API_BASE = CONFIG.API_BASE_URL;
    const oldToken = this.tokenManager.get();

    // 没有旧token，直接失败
    if (!oldToken) {
      this.isRefreshing = false;
      return Promise.reject(new Error('没有可用的token'));
    }

    const doRefresh = (retryCount = 0) => {
      return new Promise((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/xiaohongshu/api/auth/refresh-token`,
          method: 'POST',
          header: {
            'Authorization': `Bearer ${oldToken}`
          },
          timeout: 10000, // 10秒超时
          success: (res) => {
            if (res.statusCode === 200 && res.data.success && res.data.token) {
              const newToken = res.data.token;
              this.globalData.token = newToken;
              this.tokenManager.set(newToken);
              this.isRefreshing = false;
              this.refreshRetryCount = 0; // 重置重试计数
              this.onRefreshed(newToken);
              console.info('Token刷新成功');
              resolve(newToken);
            } else {
              // 刷新失败，尝试重试
              if (retryCount < this.maxRefreshRetries) {
                console.warn(`Token刷新失败，准备重试 (${retryCount + 1}/${this.maxRefreshRetries})`);
                this.isRefreshing = false;
                setTimeout(() => {
                  doRefresh(retryCount + 1).then(resolve).catch(reject);
                }, 1000 * (retryCount + 1)); // 递增延迟重试
              } else {
                // 重试次数用尽，执行登出
                console.error('Token刷新重试次数用尽，执行登出');
                this.handleRefreshFailure('登录已过期，请重新登录');
                this.isRefreshing = false;
                this.refreshRetryCount = 0;
                reject(new Error('Token刷新失败'));
              }
            }
          },
          fail: (err) => {
            // 网络错误，尝试重试
            if (retryCount < this.maxRefreshRetries) {
              console.warn(`Token刷新网络错误，准备重试 (${retryCount + 1}/${this.maxRefreshRetries}):`, err.errMsg);
              this.isRefreshing = false;
              setTimeout(() => {
                doRefresh(retryCount + 1).then(resolve).catch(reject);
              }, 1000 * (retryCount + 1));
            } else {
              // 重试次数用尽
              console.error('Token刷新网络错误重试次数用尽，执行登出');
              this.handleRefreshFailure('网络连接失败，请重新登录');
              this.isRefreshing = false;
              this.refreshRetryCount = 0;
              reject(new Error('Token刷新网络请求失败'));
            }
          }
        });
      });
    };

    return doRefresh();
  },

  // 处理刷新失败后的登出逻辑
  handleRefreshFailure: function(message) {
    // 清除所有等待的请求
    this.clearRefreshSubscribers(new Error('Token刷新失败'));

    // 清除token和用户信息
    this.tokenManager.clear();
    this.globalData.userInfo = null;
    this.globalData.token = null;
    this.stateManager.updateUserState(null);

    // 显示提示并跳转登录页
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });

    setTimeout(() => {
      wx.redirectTo({
        url: '/pages/login/login'
      });
    }, 2000);
  },

  // 检查token是否即将过期，如果是则自动刷新
  checkAndRefreshTokenIfNeeded: function() {
    const remainingDays = this.authService.tokenManager.getRemainingDays();

    // 如果剩余时间少于1天，自动刷新token
    if (remainingDays > 0 && remainingDays <= 1) {
      console.info(`Token即将过期（剩余${remainingDays}天），尝试自动刷新`);
      this.refreshToken().catch(err => {
        console.warn('自动刷新Token失败:', err.message);
      });
    }
  },

  // 全局数据管理器
  globalDataManager: {
    data: {}, // 存储全局数据
    // 设置全局数据
    set(key, value) {
      this.data[key] = value;
    },
    // 获取全局数据
    get(key) {
      return this.data[key];
    },
    // 清理过期数据
    cleanup() {
      // 示例：清理一小时前的数据
      const now = Date.now();
      for (const key in this.data) {
        if (this.data[key] && this.data[key].timestamp && (now - this.data[key].timestamp > 60 * 60 * 1000)) {
          delete this.data[key];
         console.debug(`清理过期全局数据: ${key}`);
        }
      }
    },
    // 清除指定数据或清空所有数据
    clear(key) {
      if (key) {
        delete this.data[key];
        console.debug(`全局数据已清除: ${key}`);
      } else {
        this.data = {};
        console.debug('全局数据已清空');
      }
    }
  },

  // 请求缓存管理器
  requestCache: {
    cache: {}, // 存储请求结果
    pendingRequests: {}, // 存储进行中的请求Promise
    // 设置缓存
    set(url, params, response) {
      const key = this._generateKey(url, params);
      this.cache[key] = {
        response: response,
        timestamp: Date.now()
      };
     console.debug(`请求缓存已设置: ${key}`);
    },
    // 获取缓存
    get(url, params) {
      const key = this._generateKey(url, params);
      const cached = this.cache[key];
      // 检查缓存是否过期（例如5分钟）
      if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
       console.debug(`从缓存获取: ${key}`);
        return cached.response;
      }
      return null;
    },
    // 清理过期缓存
    cleanup() {
      const now = Date.now();
      for (const key in this.cache) {
        if (this.cache[key] && (now - this.cache[key].timestamp > 5 * 60 * 1000)) {
          delete this.cache[key];
         console.debug(`清理过期请求缓存: ${key}`);
        }
      }
    },
    // 存储进行中的请求
    setPendingRequest(url, params, promise) {
      const key = this._generateKey(url, params);
      this.pendingRequests[key] = promise;
      promise.finally(() => {
        delete this.pendingRequests[key]; // 请求完成后移除
      });
    },
    // 获取进行中的请求
    getPendingRequest(url, params) {
      const key = this._generateKey(url, params);
      return this.pendingRequests[key];
    },
    // 清空缓存和进行中的请求
    clear() {
      this.cache = {};
      this.pendingRequests = {};
      console.debug('请求缓存已清空');
    },
    // 获取预加载缓存（别名，兼容旧代码）
    getPreload(url, params) {
      return this.get(url, params);
    },
    // 预加载（实际上就是发起请求并缓存）
    preload(url, params) {
      const app = getApp();
      return app.request({
        url,
        data: params,
        useCache: true
      });
    },
    // 生成缓存key
    _generateKey(url, params) {
      return url + JSON.stringify(params);
    }
  },

  // 全局数据
  globalData: {
    userInfo: null,
    token: null,
    code: null
  },

  // 统一状态管理器
  stateManager: {
    _listeners: [], // 存储所有监听器

    // 注册监听器
    subscribe(listener) {
      this._listeners.push(listener);
      // 返回一个取消订阅的函数
      return () => {
        this._listeners = this._listeners.filter(l => l !== listener);
      };
    },

    // 通知所有监听器用户状态已更新
    updateUserState(newUser) {
     console.debug('用户状态更新，通知所有监听器:', newUser);
      this._listeners.forEach(listener => {
        if (typeof listener === 'function') {
          listener(newUser);
        }
      });
    }
  }
})