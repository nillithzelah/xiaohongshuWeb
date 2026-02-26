/**
 * DrissionPage 客户端服务
 * 用于调用 Python 微服务进行评论验证
 */

const axios = require('axios');

class DrissionPageClientService {
  constructor() {
    // Python 微服务地址
    this.baseURL = process.env.DRISSIONPAGE_SERVICE_URL || 'http://localhost:8000';
    this.timeout = 60000; // 60秒超时
    this.maxRetries = 3;
  }

  /**
   * 验证评论是否存在（通过 Python DrissionPage 服务）
   * @param {string} noteUrl - 小红书笔记链接
   * @param {string} commentContent - 用户提交的评论内容
   * @param {string} commentAuthor - 评论者昵称
   * @param {string} cookieString - 小红书登录Cookie字符串（可选）
   * @returns {Promise<Object>} 验证结果
   */
  async verifyCommentExists(noteUrl, commentContent, commentAuthor, cookieString = null) {
    // 如果没有提供cookie，使用环境变量
    if (!cookieString) {
      cookieString = process.env.XIAOHONGSHU_COOKIE || '';
    }

    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        console.log('🔍 [DrissionPage] 开始验证评论:', {
          url: noteUrl,
          author: commentAuthor,
          content: commentContent.substring(0, 50) + '...',
          cookieSource: '环境变量Cookie',
          retryCount
        });

        // 调用 Python 微服务 API
        const response = await axios.post(
          `${this.baseURL}/verify-comment`,
          {
            note_url: noteUrl,
            comment_content: commentContent,
            comment_author: commentAuthor,
            cookie_string: cookieString
          },
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const result = response.data;

        console.log('✅ [DrissionPage] 评论验证完成:', {
          exists: result.exists,
          confidence: result.confidence,
          reason: result.reason,
          scannedComments: result.scanned_comments
        });

        // 如果 Cookie 失效，不再重试（使用环境变量只有一个Cookie）
        if (result.needs_cookie_update || result.error?.includes('Cookie') || result.error?.includes('登录')) {
          console.warn('⚠️ [DrissionPage] Cookie 失效，请更新环境变量 XIAOHONGSHU_COOKIE');
        }

        return result;

      } catch (error) {
        console.error('❌ [DrissionPage] 评论验证失败:', error.message);

        // 如果是网络错误或服务不可用，重试
        if (retryCount < this.maxRetries - 1) {
          retryCount++;
          console.log(`🔄 [DrissionPage] 第 ${retryCount} 次重试...`);
          await this._delay(2000); // 等待2秒后重试
          continue;
        }

        // 返回错误结果
        return {
          exists: false,
          confidence: 0,
          reason: `DrissionPage 服务错误: ${error.message}`,
          error: error.message,
          method: 'drissionpage'
        };
      }
    }

    // 理论上不会到达这里
    return {
      exists: false,
      confidence: 0,
      reason: '验证失败',
      error: 'unknown_error',
      method: 'drissionpage'
    };
  }

  /**
   * 检查服务健康状态
   * @returns {Promise<boolean>} 服务是否健康
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('❌ [DrissionPage] 健康检查失败:', error.message);
      return false;
    }
  }

  /**
   * 获取服务状态
   * @returns {Promise<Object>} 服务状态
   */
  async getServiceStatus() {
    try {
      const response = await axios.get(`${this.baseURL}/`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('❌ [DrissionPage] 获取服务状态失败:', error.message);
      return {
        service: 'DrissionPage',
        status: 'unavailable',
        error: error.message
      };
    }
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例
module.exports = new DrissionPageClientService();
