/**
 * 输入验证中间件
 *
 * 提供常用的验证规则和验证中间件
 * 无外部依赖，使用原生 JavaScript 实现
 */

const { isValidObjectId } = require('../utils/security');

/**
 * 验证错误类
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.status = 400;
  }
}

/**
 * 验证规则集合
 */
const rules = {
  /**
   * 验证 MongoDB ObjectId
   * @param {string} field - 字段名
   * @param {string} location - 参数位置 (params, body, query)
   */
  objectId: (field, location = 'params') => {
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value && !isValidObjectId(value)) {
        return res.status(400).json({
          success: false,
          message: `无效的 ${field} 格式`
        });
      }
      next();
    };
  },

  /**
   * 验证必填字段
   * @param {string[]} fields - 字段名数组
   * @param {string} location - 参数位置
   */
  required: (fields, location = 'body') => {
    return (req, res, next) => {
      const missing = [];
      for (const field of fields) {
        const value = req[location]?.[field];
        if (value === undefined || value === null || value === '') {
          missing.push(field);
        }
      }
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `缺少必填字段: ${missing.join(', ')}`
        });
      }
      next();
    };
  },

  /**
   * 验证分页参数
   */
  pagination: () => {
    return (req, res, next) => {
      // 处理 page
      if (req.query.page) {
        const page = parseInt(req.query.page, 10);
        if (isNaN(page) || page < 1) {
          req.query.page = 1;
        } else {
          req.query.page = page;
        }
      } else {
        req.query.page = 1;
      }

      // 处理 limit
      if (req.query.limit) {
        const limit = parseInt(req.query.limit, 10);
        if (isNaN(limit) || limit < 1) {
          req.query.limit = 20;
        } else if (limit > 100) {
          req.query.limit = 100; // 最大限制
        } else {
          req.query.limit = limit;
        }
      } else {
        req.query.limit = 20;
      }

      next();
    };
  },

  /**
   * 验证字符串长度
   * @param {string} field - 字段名
   * @param {object} options - 选项 { min, max, location }
   */
  stringLength: (field, options = {}) => {
    const { min = 0, max = 1000, location = 'body' } = options;
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value !== undefined && value !== null) {
        const str = String(value);
        if (str.length < min) {
          return res.status(400).json({
            success: false,
            message: `${field} 长度不能少于 ${min} 个字符`
          });
        }
        if (str.length > max) {
          return res.status(400).json({
            success: false,
            message: `${field} 长度不能超过 ${max} 个字符`
          });
        }
      }
      next();
    };
  },

  /**
   * 验证枚举值
   * @param {string} field - 字段名
   * @param {any[]} allowedValues - 允许的值数组
   * @param {string} location - 参数位置
   */
  enum: (field, allowedValues, location = 'body') => {
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value !== undefined && !allowedValues.includes(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} 的值必须是: ${allowedValues.join(', ')}`
        });
      }
      next();
    };
  },

  /**
   * 验证数字范围
   * @param {string} field - 字段名
   * @param {object} options - 选项 { min, max, location, integer }
   */
  numberRange: (field, options = {}) => {
    const { min, max, location = 'body', integer = false } = options;
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value !== undefined && value !== null && value !== '') {
        const num = Number(value);
        if (isNaN(num)) {
          return res.status(400).json({
            success: false,
            message: `${field} 必须是有效的数字`
          });
        }
        if (integer && !Number.isInteger(num)) {
          return res.status(400).json({
            success: false,
            message: `${field} 必须是整数`
          });
        }
        if (min !== undefined && num < min) {
          return res.status(400).json({
            success: false,
            message: `${field} 不能小于 ${min}`
          });
        }
        if (max !== undefined && num > max) {
          return res.status(400).json({
            success: false,
            message: `${field} 不能大于 ${max}`
          });
        }
        // 转换为数字类型
        req[location][field] = num;
      }
      next();
    };
  },

  /**
   * 验证日期格式
   * @param {string} field - 字段名
   * @param {string} location - 参数位置
   */
  date: (field, location = 'body') => {
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value !== undefined && value !== null && value !== '') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return res.status(400).json({
            success: false,
            message: `${field} 必须是有效的日期`
          });
        }
        req[location][field] = date;
      }
      next();
    };
  },

  /**
   * 验证手机号（中国大陆）
   * @param {string} field - 字段名
   * @param {string} location - 参数位置
   */
  phone: (field, location = 'body') => {
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value && !/^1[3-9]\d{9}$/.test(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} 必须是有效的手机号`
        });
      }
      next();
    };
  },

  /**
   * 验证邮箱格式
   * @param {string} field - 字段名
   * @param {string} location - 参数位置
   */
  email: (field, location = 'body') => {
    return (req, res, next) => {
      const value = req[location]?.[field];
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return res.status(400).json({
          success: false,
          message: `${field} 必须是有效的邮箱地址`
        });
      }
      next();
    };
  }
};

/**
 * 组合多个验证规则
 * @param {...Function} validators - 验证中间件数组
 * @returns {Function} 组合后的中间件
 */
function combine(...validators) {
  return (req, res, next) => {
    const runValidator = (index) => {
      if (index >= validators.length) {
        return next();
      }
      validators[index](req, res, (err) => {
        if (err) return next(err);
        runValidator(index + 1);
      });
    };
    runValidator(0);
  };
}

/**
 * 创建自定义验证中间件
 * @param {Function} validator - 自定义验证函数 (req) => { valid: boolean, message?: string }
 * @returns {Function} Express 中间件
 */
function custom(validator) {
  return async (req, res, next) => {
    try {
      const result = await validator(req);
      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message || '验证失败'
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 常用验证规则组合
 */
const common = {
  /**
   * 分页查询验证
   */
  paginatedList: combine(
    rules.pagination(),
    rules.stringLength('keyword', { max: 100, location: 'query' })
  ),

  /**
   * MongoDB ID 验证
   */
  mongoId: (field = 'id') => rules.objectId(field, 'params'),

  /**
   * 用户更新验证
   */
  userUpdate: combine(
    rules.stringLength('nickname', { min: 2, max: 20 }),
    rules.phone('phone')
  ),

  /**
   * 审核操作验证
   */
  reviewAction: combine(
    rules.required(['action'], 'body'),
    rules.enum('action', ['approve', 'reject', 'pending'], 'body'),
    rules.stringLength('reason', { max: 500, location: 'body' })
  )
};

module.exports = {
  ValidationError,
  rules,
  combine,
  custom,
  common
};
