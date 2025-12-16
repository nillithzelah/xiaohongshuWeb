// pages/profile/profile.js
const app = getApp()

// 环境配置（与上传页面保持一致）
const IS_DEVELOPMENT = true; // 开发时true，生产时false
const API_BASE = IS_DEVELOPMENT ? 'http://localhost:5000' : 'https://www.wubug.cc';

const API_CONFIG = {
  USER_PROFILE: `${API_BASE}/xiaohongshu/api/user/me`,
  USERS_LIST: `${API_BASE}/xiaohongshu/api/users`,
  GENERATE_USER_TOKEN: `${API_BASE}/xiaohongshu/api/auth/generate-user-token`
};

// 默认测试Token（管理员token，用于生成测试用户token）
const ADMIN_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

// 默认用户Token（管理员用户token，显示积分）
const DEFAULT_USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

console.log(`👤 个人资料页环境: ${IS_DEVELOPMENT ? '开发环境' : '生产环境'}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    userInfo: null,
    balance: 0,
    totalEarnings: 0,
    // 测试模式相关
    users: [], // 用户列表
    showUserSelector: false, // 是否显示用户选择器
    testUser: null // 当前测试用户
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 初始化测试用户状态
    const testUser = wx.getStorageSync('testUser');
    if (testUser) {
      this.setData({ testUser });
    }

    this.loadUserProfile()
    // 加载用户列表（用于测试模式）
    this.loadUsers()
  },

  /**
   * 加载用户资料
   */
  loadUserProfile: function() {
    // 检查是否有测试用户选择
    const testUser = wx.getStorageSync('testUser');

    if (testUser && testUser._id) {
      // 如果有测试用户，使用测试用户的token
      console.log('🧪 使用测试用户身份加载资料:', testUser.username);
      this.getUserToken(testUser._id).then(result => {
        this.loadUserProfileWithToken(result.token);
      }).catch(error => {
        console.error('🧪 获取测试用户token失败:', error);
        wx.showToast({
          title: '获取测试用户资料失败',
          icon: 'none'
        });
        // 回退到默认用户
        this.loadUserProfileWithToken(IS_DEVELOPMENT ? DEFAULT_TEST_TOKEN : wx.getStorageSync('token'));
      });
    } else {
      // 使用默认token
      const token = IS_DEVELOPMENT ? DEFAULT_USER_TOKEN : wx.getStorageSync('token');
      this.loadUserProfileWithToken(token);
    }
  },

  /**
   * 使用指定token加载用户资料
   */
  loadUserProfileWithToken: function(token) {
    wx.request({
      url: API_CONFIG.USER_PROFILE,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success) {
          this.setData({
            userInfo: res.data.user,
            balance: res.data.user.points || 0, // 显示积分
            totalEarnings: res.data.user.totalEarnings || 0
          })
        } else {
          // 使用模拟用户数据
          this.loadMockUserProfile()
        }
      },
      fail: () => {
        // 网络失败时使用模拟数据
        this.loadMockUserProfile()
      }
    })
  },

  /**
   * 加载模拟用户资料（与实际token用户保持一致）
   */
  loadMockUserProfile: function() {
    const mockUser = {
      username: 'user001', // 与实际token用户一致
      nickname: '用户001', // 对应的昵称
      avatar: '',
      points: 2550, // 使用积分字段
      totalEarnings: 125.80
    }

    this.setData({
      userInfo: mockUser,
      balance: mockUser.points, // 使用积分字段
      totalEarnings: mockUser.totalEarnings
    })
  },

  /**
   * 加载用户列表（用于测试模式）
   */
  loadUsers: function() {
    // 使用管理员token来获取用户列表
    const token = IS_DEVELOPMENT ? ADMIN_TEST_TOKEN : wx.getStorageSync('token')

    wx.request({
      url: API_CONFIG.USERS_LIST,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success && res.data.users && res.data.users.length > 0) {
          this.setData({
            users: res.data.users
          })
        } else {
          // 使用模拟用户数据
          this.loadMockUsers()
        }
      },
      fail: () => {
        // 网络失败时使用模拟数据
        this.loadMockUsers()
      }
    })
  },

  /**
   * 加载模拟用户数据
   */
  loadMockUsers: function() {
    const mockUsers = [
      {
        _id: '693d29b5cbc188007ecc5848',
        username: 'boss001',
        nickname: '管理员',
        role: 'boss',
        points: 1000
      },
      {
        _id: '693d29b5cbc188007ecc5849',
        username: 'mentor001',
        nickname: '带教老师',
        role: 'mentor',
        points: 500
      },
      {
        _id: '693d29b5cbc188007ecc5850',
        username: 'parttime001',
        nickname: '兼职用户',
        role: 'part_time',
        points: 100
      }
    ]

    this.setData({
      users: mockUsers
    })
  },

  /**
   * 显示用户选择器
   */
  showUserSelector: function() {
    this.setData({
      showUserSelector: true
    })
  },

  /**
   * 隐藏用户选择器
   */
  hideUserSelector: function() {
    this.setData({
      showUserSelector: false
    })
  },

  /**
   * 获取指定用户的token（测试模式使用）
   */
  getUserToken(userId) {
    return new Promise((resolve, reject) => {
      // 使用管理员token来生成测试用户token
      const adminToken = IS_DEVELOPMENT ? ADMIN_TEST_TOKEN : wx.getStorageSync('adminToken');

      wx.request({
        url: API_CONFIG.GENERATE_USER_TOKEN,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        data: { userId },
        success: (res) => {
          if (res.data && res.data.success) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.message || '获取用户token失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  /**
   * 选择测试用户
   */
  selectUser: function(e) {
    const user = e.currentTarget.dataset.user

    wx.showModal({
      title: '切换用户',
      content: `确定要切换到用户 "${user.username}" (${user.role}) 吗？\n\n注意：这是一个测试功能，不会实际修改您的登录状态。`,
      success: (res) => {
        if (res.confirm) {
          // 获取切换用户的token
          this.getUserToken(user._id).then(result => {
            // 保存选择的测试用户和对应的token到本地存储
            wx.setStorageSync('testUser', user)
            wx.setStorageSync('testUserToken', result.token)

            // 更新页面状态
            this.setData({
              testUser: user,
              showUserSelector: false
            })

            wx.showToast({
              title: `已切换到 ${user.username}`,
              icon: 'success'
            })

            // 重新加载用户资料（显示测试用户的信息）
            this.loadUserProfile()
          }).catch(error => {
            console.error('获取测试用户token失败:', error)
            wx.showToast({
              title: '切换用户失败',
              icon: 'none'
            })
          })
        }
      }
    })
  },

  /**
   * 退出登录
   */
  logout: function() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('testUser')
          wx.removeStorageSync('testUserToken')
          app.globalData.userInfo = null
          app.globalData.token = null
          wx.reLaunch({
            url: '/pages/index/index'
          })
        }
      }
    })
  }
})