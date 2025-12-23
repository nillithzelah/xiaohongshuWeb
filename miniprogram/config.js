// 小程序API配置管理

// 当前环境设置（开发时改为 'development'，生产时改为 'production'）
const CURRENT_ENV = 'production';

// 开发环境配置
const development = {
  baseUrl: 'http://localhost:5000',
  env: 'development'
};

// 生产环境配置
const production = {
  baseUrl: 'https://www.wubug.cc',
  env: 'production'
};

// 获取当前环境配置
const currentConfig = CURRENT_ENV === 'development' ? development : production;

// 小程序配置对象
const CONFIG = {
  // API基础地址
  API_BASE_URL: currentConfig.baseUrl,

  // 完整API路径
  API: {
    // 用户相关
    DEVICE_MY_LIST: `${currentConfig.baseUrl}/xiaohongshu/api/client/device/my-list`,

    // 上传相关
    UPLOAD_IMAGE: `${currentConfig.baseUrl}/xiaohongshu/api/upload/image`,
    UPLOAD_IMAGES: `${currentConfig.baseUrl}/xiaohongshu/api/upload/images`,

    // 任务相关
    TASK_SUBMIT: `${currentConfig.baseUrl}/xiaohongshu/api/client/task/submit`,
    TASKS_BATCH_SUBMIT: `${currentConfig.baseUrl}/xiaohongshu/api/client/tasks/batch-submit`
  },

  // 当前环境信息
  ENV: currentConfig.env,

  // 调试信息
  DEBUG: CURRENT_ENV === 'development',

  // 测试配置（仅开发环境使用）
  TEST_TOKENS: {
    // boss用户token - 所有权限
    BOSS_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI',

    // 普通用户token（如果需要）
    // USER_TOKEN: 'your_user_token_here'
  },

  // 功能开关
  FEATURES: {
    ENABLE_CONSOLE_LOG: CURRENT_ENV === 'development', // 只在开发环境显示日志
    ENABLE_CACHE_DEBUG: false, // 缓存调试日志
    ENABLE_API_MOCK: false // API模拟数据
  },

  // 缓存配置
  CACHE: {
    DEFAULT_DURATION: 5 * 60 * 1000, // 5分钟
    USER_DEVICES_DURATION: 5 * 60 * 1000, // 用户设备缓存5分钟
    USER_TASKS_DURATION: 2 * 60 * 1000, // 用户任务缓存2分钟
    ANNOUNCEMENTS_DURATION: 30 * 60 * 1000, // 公告缓存30分钟
  },

  // API端点配置（统一管理）
  API_ENDPOINTS: {
    AUTH: {
      WECHAT_LOGIN: '/xiaohongshu/api/auth/wechat-login',
      PHONE_LOGIN: '/xiaohongshu/api/auth/phone-login'
    },
    CLIENT: {
      ANNOUNCEMENTS: '/xiaohongshu/api/client/announcements',
      USER_TASKS: '/xiaohongshu/api/client/user/tasks',
      DEVICE_MY_LIST: '/xiaohongshu/api/client/device/my-list'
    },
    USER: {
      PROFILE: '/xiaohongshu/api/user/me'
    }
  }
};

// 开发环境提示
if (CURRENT_ENV === 'development') {
  // 开发环境下才显示配置信息
  setTimeout(() => {
    console.log('🚀 小程序开发环境配置已加载');
    console.log('📡 API地址:', currentConfig.baseUrl);
  }, 100);
}

// 导出配置（小程序方式）
module.exports = CONFIG;