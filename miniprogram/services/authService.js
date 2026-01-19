/**
 * 统一权限和认证服务
 * 提供角色权限检查、Token管理、权限验证等功能
 */

// 角色权限配置
const ROLE_PERMISSIONS = {
  // 兼职用户：只能做基础任务
  part_time: {
    name: '兼职',
    permissions: ['task.submit', 'device.view_own', 'points.view_own'],
    canAccessPages: ['index', 'upload', 'profile', 'device-list', 'points-exchange', 'account-detail']
  },
  // 带教老师：可以查看和管理自己带的学员
  mentor: {
    name: '带教老师',
    permissions: ['task.submit', 'task.view_students', 'device.view_own', 'device.view_students', 'points.view_own'],
    canAccessPages: ['index', 'upload', 'profile', 'device-list', 'points-exchange', 'account-detail']
  },
  // HR：可以管理用户
  hr: {
    name: 'HR',
    permissions: ['user.create', 'user.view', 'task.submit', 'device.view_own', 'points.view_own'],
    canAccessPages: ['index', 'upload', 'profile', 'device-list', 'points-exchange', 'account-detail', 'distribution']
  },
  // 经理：可以管理所有内容
  manager: {
    name: '经理',
    permissions: ['*'], // 所有权限
    canAccessPages: ['*'] // 所有页面
  },
  // 财务：可以处理提现
  finance: {
    name: '财务',
    permissions: ['withdraw.view', 'withdraw.approve', 'points.view_all', 'user.view'],
    canAccessPages: ['index', 'upload', 'profile', 'device-list', 'points-exchange', 'account-detail', 'complaint']
  },
  // 老板：所有权限
  boss: {
    name: '老板',
    permissions: ['*'],
    canAccessPages: ['*']
  }
};

// 角色优先级（用于权限比较）
const ROLE_LEVELS = {
  part_time: 1,
  mentor: 2,
  hr: 3,
  finance: 4,
  manager: 5,
  boss: 6
};

const authService = {
  /**
   * 检查用户是否有指定权限
   * @param {string|Object} user - 用户角色或用户对象
   * @param {string} permission - 权限标识
   * @returns {boolean}
   */
  hasPermission(user, permission) {
    if (!user) return false;

    const role = typeof user === 'string' ? user : user.role;
    if (!role) return false;

    const roleConfig = ROLE_PERMISSIONS[role];
    if (!roleConfig) return false;

    // 拥有所有权限
    if (roleConfig.permissions.includes('*')) return true;

    return roleConfig.permissions.includes(permission);
  },

  /**
   * 检查用户是否有任一权限
   * @param {string|Object} user - 用户角色或用户对象
   * @param {string[]} permissions - 权限标识数组
   * @returns {boolean}
   */
  hasAnyPermission(user, permissions) {
    if (!permissions || permissions.length === 0) return true;
    return permissions.some(permission => this.hasPermission(user, permission));
  },

  /**
   * 检查用户是否有所有权限
   * @param {string|Object} user - 用户角色或用户对象
   * @param {string[]} permissions - 权限标识数组
   * @returns {boolean}
   */
  hasAllPermissions(user, permissions) {
    if (!permissions || permissions.length === 0) return true;
    return permissions.every(permission => this.hasPermission(user, permission));
  },

  /**
   * 检查用户是否可以访问指定页面
   * @param {string|Object} user - 用户角色或用户对象
   * @param {string} page - 页面名称
   * @returns {boolean}
   */
  canAccessPage(user, page) {
    if (!user) return false;

    const role = typeof user === 'string' ? user : user.role;
    if (!role) return false;

    const roleConfig = ROLE_PERMISSIONS[role];
    if (!roleConfig) return false;

    // 拥有所有页面访问权限
    if (roleConfig.canAccessPages.includes('*')) return true;

    return roleConfig.canAccessPages.includes(page);
  },

  /**
   * 获取角色的显示名称
   * @param {string} role - 角色代码
   * @returns {string}
   */
  getRoleName(role) {
    const config = ROLE_PERMISSIONS[role];
    return config ? config.name : role;
  },

  /**
   * 比较两个角色的级别
   * @param {string} role1 - 角色1
   * @param {string} role2 - 角色2
   * @returns {number} - 1: role1 > role2, -1: role1 < role2, 0: 相等
   */
  compareRoles(role1, role2) {
    const level1 = ROLE_LEVELS[role1] || 0;
    const level2 = ROLE_LEVELS[role2] || 0;

    if (level1 > level2) return 1;
    if (level1 < level2) return -1;
    return 0;
  },

  /**
   * 检查当前用户是否是管理员角色
   * @param {string|Object} user - 用户角色或用户对象
   * @returns {boolean}
   */
  isAdmin(user) {
    const role = typeof user === 'string' ? user : user.role;
    return ['manager', 'boss', 'hr', 'finance', 'mentor'].includes(role);
  },

  /**
   * 检查当前用户是否是超级管理员
   * @param {string|Object} user - 用户角色或用户对象
   * @returns {boolean}
   */
  isSuperAdmin(user) {
    const role = typeof user === 'string' ? user : user.role;
    return ['boss', 'manager'].includes(role);
  },

  /**
   * 获取用户信息（带缓存）
   * @returns {Object|null}
   */
  getUserInfo() {
    try {
      // 优先从全局变量获取
      const app = getApp();
      if (app && app.globalData && app.globalData.userInfo) {
        return app.globalData.userInfo;
      }

      // 从本地存储获取
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        return userInfo;
      }

      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  },

  /**
   * 获取当前用户角色
   * @returns {string|null}
   */
  getUserRole() {
    const userInfo = this.getUserInfo();
    return userInfo ? userInfo.role : null;
  },

  /**
   * 检查当前用户是否有指定权限
   * @param {string} permission - 权限标识
   * @returns {boolean}
   */
  currentUserHasPermission(permission) {
    const userInfo = this.getUserInfo();
    return this.hasPermission(userInfo, permission);
  },

  /**
   * 检查当前用户是否可以访问指定页面
   * @param {string} page - 页面名称
   * @returns {boolean}
   */
  currentUserCanAccessPage(page) {
    const userInfo = this.getUserInfo();
    return this.canAccessPage(userInfo, page);
  },

  /**
   * 验证用户登录状态
   * @returns {boolean}
   */
  isLoggedIn() {
    const app = getApp();
    if (!app) return false;

    const token = app.tokenManager ? app.tokenManager.get() : null;
    const userInfo = this.getUserInfo();

    return !!(token && userInfo);
  },

  /**
   * 验证用户是否完成手机号授权
   * @returns {boolean}
   */
  hasPhoneAuthorized() {
    const userInfo = this.getUserInfo();
    return !!(userInfo && userInfo.phone);
  },

  /**
   * 检查登录状态，如果未登录跳转到登录页
   * @param {Object} options - 配置选项
   * @returns {boolean} - 是否已登录
   */
  requireLogin(options = {}) {
    const { redirect = true, message = '请先登录' } = options;

    if (!this.isLoggedIn()) {
      if (redirect) {
        wx.showModal({
          title: '需要登录',
          content: message,
          showCancel: false,
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/login/login'
              });
            }
          }
        });
      }
      return false;
    }

    return true;
  },

  /**
   * 检查手机号授权，如果未授权跳转到登录页
   * @param {Object} options - 配置选项
   * @returns {boolean} - 是否已授权
   */
  requirePhoneAuth(options = {}) {
    const { redirect = true, message = '请先完成手机号授权' } = options;

    if (!this.hasPhoneAuthorized()) {
      if (redirect) {
        wx.showModal({
          title: '需要授权',
          content: message,
          showCancel: false,
          confirmText: '去授权',
          success: (res) => {
            if (res.confirm) {
              wx.redirectTo({
                url: '/pages/login/login?needPhoneAuth=true'
              });
            }
          }
        });
      }
      return false;
    }

    return true;
  },

  /**
   * 检查页面访问权限
   * @param {string} pageName - 页面名称
   * @returns {boolean} - 是否有权限访问
   */
  checkPageAccess(pageName) {
    // 首先检查是否登录
    if (!this.isLoggedIn()) {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return false;
    }

    // 然后检查是否有页面访问权限
    if (!this.currentUserCanAccessPage(pageName)) {
      wx.showModal({
        title: '权限不足',
        content: '您没有权限访问此页面，将返回上一页',
        showCancel: false,
        confirmText: '确定',
        success: () => {
          // 尝试返回上一页，如果不能返回则回到首页
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack({
              delta: 1,
              fail: () => {
                // 如果返回失败（比如是第一个页面），则跳转到首页
                wx.switchTab({
                  url: '/pages/index/index',
                  fail: () => {
                    // 如果首页不是tabBar页面，使用redirectTo
                    wx.redirectTo({
                      url: '/pages/index/index'
                    });
                  }
                });
              }
            });
          } else {
            // 如果是第一个页面，直接跳转到首页
            wx.switchTab({
              url: '/pages/index/index',
              fail: () => {
                wx.redirectTo({
                  url: '/pages/index/index'
                });
              }
            });
          }
        }
      });
      return false;
    }

    return true;
  },

  /**
   * 退出登录
   */
  logout() {
    const app = getApp();
    if (!app) return;

    try {
      // 清除token
      if (app.tokenManager) {
        app.tokenManager.clear();
      }

      // 清除全局用户信息
      if (app.globalData) {
        app.globalData.userInfo = null;
        app.globalData.token = null;
      }

      // 清除本地存储
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('loginType');
      wx.removeStorageSync('testUserToken');

      // 更新状态管理器
      if (app.stateManager) {
        app.stateManager.updateUserState(null);
      }

      console.info('用户已退出登录');

      // 跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  },

  /**
   * Token管理增强版
   */
  tokenManager: {
    // 检查Token是否即将过期（剩余时间少于1天）
    isExpiringSoon() {
      try {
        const timestamp = wx.getStorageSync('token_timestamp');
        if (!timestamp) return false;

        const TOKEN_EXPIRY_DAYS = 7;
        const WARN_BEFORE_DAYS = 1; // 提前1天警告
        const expiryTime = timestamp + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const warnTime = expiryTime - WARN_BEFORE_DAYS * 24 * 60 * 60 * 1000;

        return Date.now() > warnTime;
      } catch (error) {
        console.error('检查Token过期时间失败:', error);
        return false;
      }
    },

    // 获取Token剩余有效天数
    getRemainingDays() {
      try {
        const timestamp = wx.getStorageSync('token_timestamp');
        if (!timestamp) return 0;

        const TOKEN_EXPIRY_DAYS = 7;
        const expiryTime = timestamp + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const remaining = Math.max(0, expiryTime - Date.now());

        return Math.ceil(remaining / (24 * 60 * 60 * 1000));
      } catch (error) {
        console.error('获取Token剩余天数失败:', error);
        return 0;
      }
    }
  },

  /**
   * 错误处理增强版
   */
  errorHandler: {
    // 处理API错误并返回用户友好的提示
    handleApiError(error, context = '') {
      const logger = console;

      let statusCode = error.statusCode;
      let message = error.message || error.errMsg || '操作失败，请稍后重试';
      let userMessage = '操作失败，请稍后重试';
      let shouldLogout = false;

      // 根据错误类型给出用户友好的提示
      if (statusCode === 401) {
        userMessage = '登录已过期，请重新登录';
        shouldLogout = true;
      } else if (statusCode === 403) {
        userMessage = '权限不足，无法执行此操作';
      } else if (statusCode === 404) {
        userMessage = '请求的资源不存在';
      } else if (statusCode === 429) {
        userMessage = '操作太频繁，请稍后再试';
      } else if (statusCode === 500) {
        userMessage = '服务器内部错误，请稍后重试';
      } else if (message.includes('timeout')) {
        userMessage = '网络请求超时，请检查网络连接';
      } else if (message.includes('fail')) {
        userMessage = '网络连接失败，请检查网络后重试';
      }

      // 记录错误详情
      logger.error(`API错误 ${context}:`, {
        statusCode,
        message,
        userMessage
      });

      return {
        userMessage,
        shouldLogout,
        statusCode
      };
    },

    // 显示错误提示并根据需要执行登出
    showErrorAndHandle(error, context = '') {
      const { userMessage, shouldLogout } = this.handleApiError(error, context);

      wx.showToast({
        title: userMessage,
        icon: 'none',
        duration: 3000
      });

      if (shouldLogout) {
        setTimeout(() => {
          authService.logout();
        }, 2000);
      }

      return userMessage;
    }
  },

  // 导出角色权限配置，供外部使用
  ROLE_PERMISSIONS,
  ROLE_LEVELS
};

module.exports = authService;
