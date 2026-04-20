/**
 * API 服务封装
 *
 * 统一管理前端 API 请求，提供：
 * - 自动添加 JWT token
 * - 统一错误处理
 * - 请求/响应拦截
 * - 401 自动跳转登录
 */

import axios from 'axios';
import { message } from 'antd';

/**
 * API 基础配置
 */
const API_BASE_URL = '/xiaohongshu/api';
const API_TIMEOUT = 30000; // 30 秒

/**
 * 创建 axios 实例
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 *
 * 自动添加 JWT token 到请求头
 */
api.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加时间戳防止缓存（仅 GET 请求）
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }

    return config;
  },
  (error) => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 *
 * 统一处理错误响应
 */
api.interceptors.response.use(
  (response) => {
    // 直接返回 data 字段
    return response.data;
  },
  (error) => {
    const { response } = error;

    // 网络错误
    if (!response) {
      if (error.code === 'ECONNABORTED') {
        message.error('请求超时，请检查网络连接');
      } else {
        message.error('网络错误，请检查网络连接');
      }
      return Promise.reject(error);
    }

    const { status, data } = response;

    // 根据状态码处理错误
    switch (status) {
      case 400:
        message.error(data?.message || '请求参数错误');
        break;

      case 401:
        // 未授权，清除 token 并跳转登录
        message.error('登录已过期，请重新登录');
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');

        // 延迟跳转，让用户看到提示
        setTimeout(() => {
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            window.location.href = '/login';
          }
        }, 1000);
        break;

      case 403:
        message.error(data?.message || '无权限访问');
        break;

      case 404:
        message.error(data?.message || '请求的资源不存在');
        break;

      case 429:
        message.error('请求过于频繁，请稍后再试');
        break;

      case 500:
        message.error(data?.message || '服务器错误，请稍后再试');
        break;

      case 502:
      case 503:
      case 504:
        message.error('服务暂时不可用，请稍后再试');
        break;

      default:
        message.error(data?.message || `请求失败 (${status})`);
    }

    return Promise.reject(error);
  }
);

/**
 * API 方法封装
 */

/**
 * GET 请求
 * @param {string} url - 请求路径
 * @param {object} params - 查询参数
 * @param {object} config - 额外配置
 */
export function get(url, params = {}, config = {}) {
  return api.get(url, {
    params,
    ...config,
  });
}

/**
 * POST 请求
 * @param {string} url - 请求路径
 * @param {object} data - 请求体
 * @param {object} config - 额外配置
 */
export function post(url, data = {}, config = {}) {
  return api.post(url, data, config);
}

/**
 * PUT 请求
 * @param {string} url - 请求路径
 * @param {object} data - 请求体
 * @param {object} config - 额外配置
 */
export function put(url, data = {}, config = {}) {
  return api.put(url, data, config);
}

/**
 * PATCH 请求
 * @param {string} url - 请求路径
 * @param {object} data - 请求体
 * @param {object} config - 额外配置
 */
export function patch(url, data = {}, config = {}) {
  return api.patch(url, data, config);
}

/**
 * DELETE 请求
 * @param {string} url - 请求路径
 * @param {object} config - 额外配置
 */
export function del(url, config = {}) {
  return api.delete(url, config);
}

/**
 * 文件上传
 * @param {string} url - 请求路径
 * @param {FormData} formData - 文件数据
 * @param {function} onProgress - 上传进度回调
 */
export function upload(url, formData, onProgress) {
  return api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
}

/**
 * 文件下载
 * @param {string} url - 请求路径
 * @param {object} params - 查询参数
 * @param {string} filename - 下载文件名
 */
export async function download(url, params = {}, filename = 'download') {
  try {
    const response = await api.get(url, {
      params,
      responseType: 'blob',
    });

    // 创建下载链接
    const blob = new Blob([response]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);

    return { success: true };
  } catch (error) {
    console.error('文件下载失败:', error);
    return { success: false, message: '文件下载失败' };
  }
}

/**
 * 导出默认实例和所有方法
 */
export default api;
export { api };

/**
 * 便捷的 API 模块（按功能分组）
 */
export const apiAuth = {
  login: (data) => post('/auth/admin-login', data),
  logout: () => post('/auth/logout'),
  getUserInfo: () => get('/auth/user-info'),
};

export const apiUser = {
  getList: (params) => get('/users', params),
  getById: (id) => get(`/users/${id}`),
  create: (data) => post('/users', data),
  update: (id, data) => put(`/users/${id}`, data),
  delete: (id) => del(`/users/${id}`),
};

export const apiDevice = {
  getList: (params) => get('/devices', params),
  getById: (id) => get(`/devices/${id}`),
  update: (id, data) => put(`/devices/${id}`, data),
  delete: (id) => del(`/devices/${id}`),
};

export const apiReview = {
  getList: (params) => get('/reviews', params),
  getById: (id) => get(`/reviews/${id}`),
  approve: (id, data) => post(`/reviews/${id}/approve`, data),
  reject: (id, data) => post(`/reviews/${id}/reject`, data),
};

export const apiFinance = {
  getTransactions: (params) => get('/transactions', params),
  processWithdraw: (id, data) => post(`/withdrawals/${id}/process`, data),
};

export const apiConfig = {
  getSystemConfig: () => get('/system-config'),
  updateSystemConfig: (data) => post('/system-config', data),
};

export const apiStats = {
  getDashboard: () => get('/stats/dashboard'),
  getUserStats: (params) => get('/stats/user', params),
  getReviewStats: (params) => get('/stats/review', params),
};
