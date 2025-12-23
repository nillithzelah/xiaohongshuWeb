// pages/login/login.js
const app = getApp();
const CONFIG = require('../../config.js');

Page({
  data: {
    loading: false,
    userInfo: null,
    // 选项卡
    currentTab: 'wechat', // wechat | account
    showRegister: false,
    // 登录表单
    loginForm: {
      phoneNumber: '',
      password: ''
    },
    loginLoading: false,
    showPassword: false,
    // 注册表单
    registerForm: {
      phoneNumber: '',
      username: '',
      nickname: '',
      password: '',
      confirmPassword: ''
    },
    registerLoading: false,
    showRegPassword: false,
    showRegConfirmPassword: false
  },

  onLoad: function (options) {
    console.info('登录页面加载');

    // 检查是否已经有token
    const token = app.tokenManager.get();
    if (token) {
      console.info('检测到已有token，跳转到首页');
      wx.switchTab({
        url: '/pages/index/index'
      });
      return;
    }

  },

  // 切换选项卡
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      showRegister: false
    });
  },

  // 切换到注册页面
  switchToRegister: function() {
    console.log('切换到注册页面');
    this.setData({
      showRegister: true
    });
    console.log('注册页面状态:', this.data.showRegister);
  },

  // 返回登录页面
  backToLogin: function() {
    this.setData({
      showRegister: false
    });
  },

  // 登录表单输入
  onLoginInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`loginForm.${field}`]: value
    });
  },

  // 注册表单输入
  onRegisterInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`registerForm.${field}`]: value
    });
  },

  // 切换密码可见性
  togglePassword: function() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  toggleRegPassword: function() {
    this.setData({
      showRegPassword: !this.data.showRegPassword
    });
  },

  toggleRegConfirmPassword: function() {
    this.setData({
      showRegConfirmPassword: !this.data.showRegConfirmPassword
    });
  },



  // 账号密码登录
  onAccountLogin: function() {
    const { phoneNumber, password } = this.data.loginForm;

    // 表单验证
    if (!phoneNumber || !password) {
      this.showError('请输入手机号和密码');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      this.showError('请输入正确的手机号');
      return;
    }

    this.setData({ loginLoading: true });

    const API_BASE = CONFIG.API_BASE_URL;
    wx.request({
      url: `${API_BASE}/xiaohongshu/api/auth/login`,
      method: 'POST',
      data: {
        phoneNumber,
        password
      },
      success: (res) => {
        if (res.data.success) {
          console.info('账号密码登录成功:', res.data.user.username);
          this.loginSuccess(res.data);
        } else {
          console.error('账号密码登录失败:', res.data.message);
          this.showError(res.data.message || '登录失败');
        }
      },
      fail: (err) => {
        console.error('账号密码登录网络错误:', err.errMsg);
        this.showError('网络错误，请重试');
      },
      complete: () => {
        this.setData({ loginLoading: false });
      }
    });
  },

  // 用户注册
  onRegister: function() {
    const { phoneNumber, username, nickname, password, confirmPassword } = this.data.registerForm;

    // 表单验证
    if (!phoneNumber || !username || !password) {
      this.showError('请填写完整的注册信息');
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
      this.showError('请输入正确的手机号');
      return;
    }

    if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
      this.showError('用户名格式不正确（4-20位字母数字下划线）');
      return;
    }

    if (password.length < 6) {
      this.showError('密码至少需要6位字符');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('两次输入的密码不一致');
      return;
    }

    this.setData({ registerLoading: true });

    const API_BASE = CONFIG.API_BASE_URL;
    wx.request({
      url: `${API_BASE}/xiaohongshu/api/auth/user-register`,
      method: 'POST',
      data: {
        phoneNumber,
        username,
        password,
        nickname: nickname || username
      },
      success: (res) => {
        if (res.data.success) {
          console.info('用户注册成功:', res.data.user.username);
          wx.showToast({
            title: '注册成功',
            icon: 'success',
            duration: 1500
          });
          // 注册成功后自动登录
          setTimeout(() => {
            this.loginSuccess(res.data);
          }, 1500);
        } else {
          console.error('用户注册失败:', res.data.message);
          this.showError(res.data.message || '注册失败');
        }
      },
      fail: (err) => {
        console.error('用户注册网络错误:', err.errMsg);
        this.showError('网络错误，请重试');
      },
      complete: () => {
        this.setData({ registerLoading: false });
      }
    });
  },

  // 处理手机号授权（一键登录）
  onGetPhoneNumber: function(e) {
    console.info('开始手机号一键登录');

    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 手机号授权成功，显示加载状态
      this.setData({ loading: true });

      wx.login({
        success: (loginRes) => {
          if (loginRes.code) {
            console.info('获取到微信code，准备完成手机号登录');
            this.phoneAuth(loginRes.code, e.detail.encryptedData, e.detail.iv);
          } else {
            console.error('获取登录凭证失败');
            this.showError('获取登录凭证失败，请重试');
          }
        },
        fail: (loginErr) => {
          console.error('wx.login调用失败:', loginErr.errMsg);
          this.showError('登录失败，请检查网络后重试');
        }
      });
    } else {
      // 用户拒绝授权
      console.warn('用户拒绝手机号授权');
      wx.showModal({
        title: '需要授权',
        content: '手机号一键登录需要您授权手机号信息才能使用',
        showCancel: false,
        confirmText: '重新授权',
        success: () => {
          // 用户可以重新点击授权按钮
        }
      });
    }
  },


  // 手机号授权处理（用于一键登录）
  phoneAuth: function(code, encryptedData, iv) {
    const API_BASE = CONFIG.API_BASE_URL;

    wx.request({
      url: `${API_BASE}/xiaohongshu/api/auth/wechat-login`,
      method: 'POST',
      data: {
        code,
        encryptedData,
        iv
      },
      success: (res) => {
        if (res.data.success) {
          const { user, token } = res.data;

          // 更新用户信息
          app.globalData.userInfo = user;
          app.globalData.token = token;
          app.tokenManager.set(token);
          wx.setStorageSync('userInfo', user);

          // 更新状态管理器
          app.stateManager.updateUserState(user);

          console.info('手机号授权成功:', user.phone);

          // 手机号一键登录成功，直接完成登录
          console.info('手机号一键登录完成');
          this.loginSuccess();
        } else {
          console.error('手机号授权失败:', res.data.message);
          this.showError(res.data.message || '手机号授权失败');
        }
      },
      fail: (err) => {
        console.error('手机号授权网络请求失败:', err.errMsg);
        this.showError('网络错误，请重试');
      }
    });
  },


  // 登录成功处理
  loginSuccess: function(data) {
    if (data) {
      // 保存登录信息
      app.globalData.userInfo = data.user;
      app.globalData.token = data.token;
      app.tokenManager.set(data.token);
      wx.setStorageSync('userInfo', data.user);
      wx.setStorageSync('loginType', this.data.currentTab === 'wechat' ? 'phone' : 'account');

      // 更新状态管理器
      app.stateManager.updateUserState(data.user);
    }

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    // 延迟跳转，让用户看到成功提示
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/index/index'
      });
    }, 1500);
  },

  // 显示错误信息
  showError: function(message) {
    this.setData({ loading: false });
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 3000
    });
  },

});