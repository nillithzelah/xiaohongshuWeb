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
  DEBUG: CURRENT_ENV === 'development'
};

// 开发环境提示
if (CURRENT_ENV === 'development') {
  console.log('🚀 小程序开发环境配置已加载');
  console.log('📡 API地址:', currentConfig.baseUrl);
}

// 导出配置（小程序方式）
module.exports = CONFIG;