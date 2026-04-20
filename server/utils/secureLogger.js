/**
 * 安全日志工具
 *
 * 对敏感信息进行脱敏处理，防止敏感数据泄露到日志中
 *
 * 使用示例：
 *   const logger = require('../utils/secureLogger');
 *   logger.info('用户登录', { userId, token }); // token 会自动脱敏
 */

const { PATTERNS } = require('./constants');

/**
 * 敏感字段名称列表（匹配时自动脱敏）
 */
const SENSITIVE_FIELDS = [
  // 认证相关
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'jwt',
  'session',
  'sessionId',
  'cookie',
  'cookies',

  // 小红书相关
  'a1',           // 小红书主 Cookie
  'web_session',  // 小红书会话 Cookie
  'webId',
  'x-sign',

  // 个人信息
  'phone',
  'mobile',
  'email',
  'idCard',
  'realName',

  // 密钥相关
  'secret',
  'apiKey',
  'apiSecret',
  'privateKey',
  'accessKey',
  'secretKey',
  'otp',
  'verificationCode',
  'captcha',
];

/**
 * 脱敏占位符
 */
const MASK_PLACEHOLDERS = {
  SHORT: '***',           // 短脱敏
  MEDIUM: '***REDACTED***', // 中等脱敏
  LONG: '***REDACTED***',  // 长脱敏
  TOKEN: '***TOKEN***',    // Token 脱敏
  COOKIE: '***COOKIE***',  // Cookie 脱敏
};

/**
 * 脱敏处理函数
 */

/**
 * 脱敏字符串
 * @param {string} str - 原字符串
 * @param {string} placeholder - 脱敏占位符
 * @param {number} visibleStart - 开头保留字符数
 * @param {number} visibleEnd - 结尾保留字符数
 * @returns {string} 脱敏后的字符串
 */
function maskString(str, placeholder = MASK_PLACEHOLDERS.MEDIUM, visibleStart = 0, visibleEnd = 0) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  const len = str.length;

  // 太短的字符串直接脱敏
  if (len <= visibleStart + visibleEnd) {
    return placeholder;
  }

  if (visibleStart === 0 && visibleEnd === 0) {
    return placeholder;
  }

  const start = str.substring(0, visibleStart);
  const end = str.substring(len - visibleEnd);

  return `${start}${placeholder}${end}`;
}

/**
 * 脱敏 Token（JWT、API Token 等）
 * @param {string} token - Token 字符串
 * @returns {string} 脱敏后的 Token
 */
function maskToken(token) {
  if (!token || typeof token !== 'string') {
    return token;
  }

  // JWT 格式：header.payload.signature，显示前 10 和后 10 字符
  if (token.includes('.')) {
    return maskString(token, MASK_PLACEHOLDERS.TOKEN, 10, 10);
  }

  // 其他 Token 格式
  return maskString(token, MASK_PLACEHOLDERS.TOKEN, 8, 8);
}

/**
 * 脱敏 Cookie
 * @param {string} cookie - Cookie 字符串
 * @returns {string} 脱敏后的 Cookie
 */
function maskCookie(cookie) {
  if (!cookie || typeof cookie !== 'string') {
    return cookie;
  }

  // 单个 Cookie 格式：name=value
  if (cookie.includes('=')) {
    const [name, value] = cookie.split('=');
    const maskedValue = value.length > 20
      ? value.substring(0, 8) + MASK_PLACEHOLDERS.COOKIE + value.substring(value.length - 8)
      : MASK_PLACEHOLDERS.COOKIE;
    return `${name}=${maskedValue}`;
  }

  // Cookie 字符串（包含多个 Cookie）
  return maskCookieString(cookie);
}

/**
 * 脱敏 Cookie 字符串（包含多个 Cookie）
 * @param {string} cookieString - Cookie 字符串
 * @returns {string} 脱敏后的 Cookie 字符串
 */
function maskCookieString(cookieString) {
  if (!cookieString || typeof cookieString !== 'string') {
    return cookieString;
  }

  let result = cookieString;

  // 脱敏 a1 Cookie（小红书主 Cookie）
  result = result.replace(/a1=([^;]+)/g, (match, value) => {
    if (value.length > 20) {
      return `a1=${value.substring(0, 8)}${MASK_PLACEHOLDERS.MEDIUM}${value.substring(value.length - 4)}`;
    }
    return `a1=${MASK_PLACEHOLDERS.MEDIUM}`;
  });

  // 脱敏 web_session Cookie
  result = result.replace(/web_session=([^;]+)/g, `web_session=${MASK_PLACEHOLDERS.MEDIUM}`);

  // 脱敏 id_token Cookie
  result = result.replace(/id_token=([^;]+)/g, `id_token=${MASK_PLACEHOLDERS.MEDIUM}`);

  // 脱敏其他常见 Cookie
  const commonCookies = ['session', 'sessionid', 'token', 'access_token', 'csrf_token'];
  for (const name of commonCookies) {
    const regex = new RegExp(`${name}=([^;]+)`, 'gi');
    result = result.replace(regex, `${name}=${MASK_PLACEHOLDERS.MEDIUM}`);
  }

  return result;
}

/**
 * 脱敏手机号
 * @param {string} phone - 手机号
 * @returns {string} 脱敏后的手机号
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return phone;
  }

  // 保留前 3 和后 4 位
  return maskString(phone, MASK_PLACEHOLDERS.SHORT, 3, 4);
}

/**
 * 脱敏邮箱
 * @param {string} email - 邮箱地址
 * @returns {string} 脱敏后的邮箱
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return email;
  }

  const [local, domain] = email.split('@');
  if (!domain) {
    return maskString(email, MASK_PLACEHOLDERS.SHORT, 2, 0);
  }

  // 保留用户名前 2 个字符，@ 后完整
  const maskedLocal = local.length > 2
    ? local.substring(0, 2) + MASK_PLACEHOLDERS.SHORT
    : MASK_PLACEHOLDERS.SHORT;

  return `${maskedLocal}@${domain}`;
}

/**
 * 脱敏身份证号
 * @param {string} idCard - 身份证号
 * @returns {string} 脱敏后的身份证号
 */
function maskIdCard(idCard) {
  if (!idCard || typeof idCard !== 'string') {
    return idCard;
  }

  // 保留前 6 和后 4 位
  return maskString(idCard, MASK_PLACEHOLDERS.SHORT, 6, 4);
}

/**
 * 脱敏对象中的敏感字段
 * @param {any} obj - 待脱敏对象
 * @returns {any} 脱敏后的对象
 */
function maskObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 字符串类型，检测是否为敏感格式
  if (typeof obj === 'string') {
    // 检测 Token 格式
    if (obj.length > 30 && (obj.includes('.') || obj.startsWith('eyJ'))) {
      return maskToken(obj);
    }
    return obj;
  }

  // 数组类型，递归处理
  if (Array.isArray(obj)) {
    return obj.map(item => maskObject(item));
  }

  // 对象类型，递归处理每个属性
  if (typeof obj === 'object') {
    const masked = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 检查是否为敏感字段
      const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()));

      if (isSensitive) {
        // 根据字段类型选择脱敏方式
        if (lowerKey.includes('cookie')) {
          masked[key] = maskCookie(String(value));
        } else if (lowerKey.includes('token') || lowerKey.includes('jwt')) {
          masked[key] = maskToken(String(value));
        } else if (lowerKey.includes('phone') || lowerKey.includes('mobile')) {
          masked[key] = maskPhone(String(value));
        } else if (lowerKey.includes('email')) {
          masked[key] = maskEmail(String(value));
        } else if (lowerKey.includes('idcard') || lowerKey.includes('id_card')) {
          masked[key] = maskIdCard(String(value));
        } else {
          masked[key] = MASK_PLACEHOLDERS.MEDIUM;
        }
      } else if (typeof value === 'object') {
        masked[key] = maskObject(value);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }

  return obj;
}

/**
 * 格式化日志消息
 * @param {string} message - 日志消息
 * @param {object} data - 附加数据
 * @returns {string} 格式化后的日志
 */
function formatMessage(message, data = {}) {
  const maskedData = Object.keys(data).length > 0 ? maskObject(data) : '';
  if (typeof maskedData === 'object' && Object.keys(maskedData).length > 0) {
    return `${message} ${JSON.stringify(maskedData)}`;
  }
  return message;
}

/**
 * 日志级别
 */
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

/**
 * 获取时间戳
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * 安全日志函数
 */
const logger = {
  /**
   * 输出错误日志
   */
  error(message, data) {
    console.error(`[${getTimestamp()}] [${LOG_LEVELS.ERROR}] ${formatMessage(message, data)}`);
  },

  /**
   * 输出警告日志
   */
  warn(message, data) {
    console.warn(`[${getTimestamp()}] [${LOG_LEVELS.WARN}] ${formatMessage(message, data)}`);
  },

  /**
   * 输出信息日志
   */
  info(message, data) {
    console.log(`[${getTimestamp()}] [${LOG_LEVELS.INFO}] ${formatMessage(message, data)}`);
  },

  /**
   * 输出调试日志
   */
  debug(message, data) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${getTimestamp()}] [${LOG_LEVELS.DEBUG}] ${formatMessage(message, data)}`);
    }
  },
};

/**
 * 创建带上下文的日志器
 * @param {string} context - 上下文标识（如模块名、功能名）
 * @returns {object} 带上下文的日志器
 */
function createLogger(context) {
  return {
    error(message, data) {
      logger.error(`[${context}] ${message}`, data);
    },
    warn(message, data) {
      logger.warn(`[${context}] ${message}`, data);
    },
    info(message, data) {
      logger.info(`[${context}] ${message}`, data);
    },
    debug(message, data) {
      logger.debug(`[${context}] ${message}`, data);
    },
  };
}

/**
 * 导出
 */
module.exports = {
  // 日志函数
  logger,
  createLogger,

  // 脱敏函数
  maskString,
  maskToken,
  maskCookie,
  maskCookieString,
  maskPhone,
  maskEmail,
  maskIdCard,
  maskObject,

  // 常量
  MASK_PLACEHOLDERS,
  SENSITIVE_FIELDS,
  LOG_LEVELS,
};
