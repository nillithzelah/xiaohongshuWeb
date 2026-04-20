/**
 * 共享配置加载工具
 */
const fs = require('fs');
const path = require('path');

class ConfigLoader {
  /**
   * 加载配置文件
   * @param {string} clientDir - 客户端目录
   * @returns {object} 配置对象
   */
  static load(clientDir) {
    const configPath = path.join(clientDir, 'config.json');

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config;
    } else {
      throw new Error(`配置文件不存在: ${configPath}`);
    }
  }

  /**
   * 获取客户端类型
   * @param {string} clientDir - 客户端目录
   * @returns {string} 客户端类型
   */
  static getClientType(clientDir) {
    const config = this.load(clientDir);
    return config.clientType || 'unknown';
  }

  /**
   * 验证配置
   * @param {object} config - 配置对象
   * @param {string} clientType - 期望的客户端类型
   * @returns {boolean} 是否有效
   */
  static validate(config, clientType) {
    if (!config.clientType) {
      throw new Error('配置文件缺少 clientType 字段');
    }

    if (config.clientType !== clientType) {
      throw new Error(`配置文件 clientType 不匹配: 期望 ${clientType}, 实际 ${config.clientType}`);
    }

    // 验证必需的配置项
    const required = ['server', 'deepseek', 'browser', 'tasks'];
    for (const key of required) {
      if (!config[key]) {
        throw new Error(`配置文件缺少必需字段: ${key}`);
      }
    }

    return true;
  }
}

module.exports = ConfigLoader;
