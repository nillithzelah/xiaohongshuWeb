/**
 * 服务器端日志工具
 *
 * 功能：
 * - 多级别日志（debug, info, success, warn, error）
 * - 带时间戳的日志格式
 * - 请求追踪ID支持（用于追踪单个请求的完整日志链）
 * - 结构化日志支持
 * - 日志级别过滤
 *
 * 使用示例：
 * const logger = require('../utils/logger');
 * logger.info('用户登录', 'Auth', { userId: '123' });
 * logger.error('数据库连接失败', 'Database', new Error('...'));
 */

const fs = require('fs');
const path = require('path');

// 日志级别定义
const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
};

// 当前日志级别（可通过环境变量 LOG_LEVEL 设置）
let currentLevel = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

// 日志文件路径
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

// 确保 logs 目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * 获取格式化的时间戳
 * @returns {string} YYYY-MM-DD HH:mm:ss 格式
 */
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取调用堆栈中的文件信息
 * @returns {string} 文件名和行号
 */
function getCallerInfo() {
  const stack = new Error().stack.split('\n');
  // 跳过 Error、getCallerInfo 和 log 函数本身
  for (let i = 3; i < stack.length; i++) {
    const match = stack[i].match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)|at\s+(.+?):(\d+):(\d+)/);
    if (match) {
      const filePath = match[2] || match[5];
      const line = match[3] || match[6];
      // 只显示文件名，不显示完整路径
      const fileName = filePath.split(/[\\/]/).pop();
      return `${fileName}:${line}`;
    }
  }
  return '';
}

/**
 * 格式化日志消息
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {string} module - 模块名
 * @param {*} data - 附加数据
 * @returns {string} 格式化后的日志
 */
function formatLog(level, message, module = '', data = null) {
  const emoji = {
    DEBUG: '🔍',
    INFO: 'ℹ️',
    SUCCESS: '✅',
    WARN: '⚠️',
    ERROR: '❌'
  };

  const caller = getCallerInfo();
  const timestamp = getTimestamp();
  const moduleStr = module ? `[${module}]` : '';
  const callerStr = caller ? ` (${caller})` : '';

  let log = `${emoji[level]} [${timestamp}]${moduleStr} ${message}${callerStr}`;

  if (data) {
    if (data instanceof Error) {
      log += `\n  错误: ${data.message}`;
      if (data.stack) {
        log += `\n  堆栈: ${data.stack.split('\n').slice(1).join('\n')}`;
      }
    } else if (typeof data === 'object') {
      log += `\n  ${JSON.stringify(data, null, 2).split('\n').join('\n  ')}`;
    } else {
      log += ` ${data}`;
    }
  }

  return log;
}

/**
 * 写入日志到文件（异步）
 * @param {string} logMessage - 日志消息
 */
function writeToFile(logMessage) {
  fs.appendFile(LOG_FILE, logMessage + '\n', (err) => {
    if (err) {
      console.error('写入日志文件失败:', err.message);
    }
  });
}

/**
 * 核心日志函数
 * @param {string} level - 日志级别
 * @param {string} message - 日志消息
 * @param {string} module - 模块名
 * @param {*} data - 附加数据
 */
function log(level, message, module = '', data = null) {
  if (LEVELS[level] < currentLevel) {
    return;
  }

  const logMessage = formatLog(level, message, module, data);

  // 根据级别选择输出方式
  switch (level) {
    case 'ERROR':
      console.error(logMessage);
      break;
    case 'WARN':
      console.warn(logMessage);
      break;
    default:
      console.log(logMessage);
  }

  // 写入文件
  writeToFile(logMessage);
}

/**
 * Logger 主对象
 */
const logger = {
  // 设置日志级别
  setLevel(level) {
    const upperLevel = level.toUpperCase();
    if (LEVELS[upperLevel] !== undefined) {
      currentLevel = LEVELS[upperLevel];
    }
  },

  // 获取当前日志级别
  getLevel() {
    return Object.keys(LEVELS).find(key => LEVELS[key] === currentLevel);
  },

  // 调试级别
  debug(message, module = '', data = null) {
    log('DEBUG', message, module, data);
  },

  // 信息级别
  info(message, module = '', data = null) {
    log('INFO', message, module, data);
  },

  // 成功级别
  success(message, module = '', data = null) {
    log('SUCCESS', message, module, data);
  },

  // 警告级别
  warn(message, module = '', data = null) {
    log('WARN', message, module, data);
  },

  // 错误级别
  error(message, module = '', data = null) {
    log('ERROR', message, module, data);
  },

  /**
   * 创建带模块前缀的子日志器
   * @param {string} moduleName - 模块名称
   * @returns {Object} 带模块前缀的日志方法
   */
  module(moduleName) {
    return {
      debug: (msg, data) => logger.debug(msg, moduleName, data),
      info: (msg, data) => logger.info(msg, moduleName, data),
      success: (msg, data) => logger.success(msg, moduleName, data),
      warn: (msg, data) => logger.warn(msg, moduleName, data),
      error: (msg, data) => logger.error(msg, moduleName, data)
    };
  },

  /**
   * 创建请求追踪的日志器（用于 Express 中间件）
   * @param {string} requestId - 请求ID
   * @returns {Object} 带请求ID的日志方法
   */
  withRequest(requestId) {
    const prefix = `[Req:${requestId.substring(0, 8)}]`;
    return {
      debug: (msg, module, data) => logger.debug(msg, module, data),
      info: (msg, module, data) => logger.info(`${prefix} ${msg}`, module, data),
      success: (msg, module, data) => logger.success(`${prefix} ${msg}`, module, data),
      warn: (msg, module, data) => logger.warn(`${prefix} ${msg}`, module, data),
      error: (msg, module, data) => logger.error(`${prefix} ${msg}`, module, data)
    };
  },

  /**
   * 打印分隔线
   * @param {string} title - 标题
   */
  section(title) {
    const line = '═'.repeat(50);
    console.log('');
    console.log(line);
    console.log(`  ${title}`);
    console.log(line);
    writeToFile(`\n${line}\n  ${title}\n${line}`);
  }
};

// 预创建常用模块的日志器
logger.auth = logger.module('Auth');
logger.db = logger.module('Database');
logger.api = logger.module('API');
logger.ai = logger.module('AI');
logger.cron = logger.module('Cron');

module.exports = logger;
