/**
 * 全局常量定义
 *
 * 统一管理项目中的魔法数字、字符串和配置值
 * 提高代码可维护性和可读性
 */

/**
 * 时间常量（毫秒为单位）
 */
const TIME = {
  // 分钟
  ONE_MINUTE: 60 * 1000,
  TWO_MINUTES: 2 * 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  TEN_MINUTES: 10 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,

  // 小时
  ONE_HOUR: 60 * 60 * 1000,
  TWO_HOURS: 2 * 60 * 60 * 1000,
  THREE_HOURS: 3 * 60 * 60 * 1000,
  SIX_HOURS: 6 * 60 * 60 * 1000,
  TWELVE_HOURS: 12 * 60 * 60 * 1000,

  // 天
  ONE_DAY: 24 * 60 * 60 * 1000,
  TWO_DAYS: 2 * 24 * 60 * 60 * 1000,
  THREE_DAYS: 3 * 24 * 60 * 60 * 1000,
  SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000,
  THIRTY_DAYS: 30 * 24 * 60 * 60 * 1000,

  // AI 审核延迟时间
  AI_REVIEW_FIRST_DELAY: 90 * 1000,  // 笔记第一次审核延迟（秒）
  AI_REVIEW_SECOND_DELAY: 150 * 1000, // 笔记第二次审核延迟（秒）
  COMMENT_REVIEW_FIRST_DELAY: 120 * 1000, // 评论第一次审核延迟（秒）
  COMMENT_REVIEW_SECOND_DELAY: 180 * 1000, // 评论第二次审核延迟（秒）
};

/**
 * 审核相关常量
 */
const REVIEW = {
  // 并发控制
  MAX_CONCURRENT_REVIEWS: 15,     // 最大并发审核数
  DEFAULT_RETRY_COUNT: 3,         // 默认重试次数

  // 超时时间
  TIMEOUT: TIME.TEN_MINUTES,      // 审核超时时间
  HEARTBEAT_INTERVAL: TIME.ONE_MINUTE, // 心跳间隔

  // 质量阈值
  SIMILARITY_THRESHOLD: 100,      // 相似度阈值（用于图片去重）
  CONFIDENCE_THRESHOLD: 0.8,      // AI 置信度阈值

  // 昵称限制
  NICKNAME_COOLDOWN_DAYS: 7,      // 昵称重用冷却天数
  NICKNAME_COOLDOWN_MS: 7 * TIME.ONE_DAY,
};

/**
 * API 路由前缀
 */
const API_PREFIX = {
  XIAOHONGSHU: '/xiaohongshu/api',
  ADMIN: '/xiaohongshu/api/admin',
  CLIENT: '/xiaohongshu/api/client',
  WEBHOOK: '/xiaohongshu/api/webhook',
};

/**
 * 用户角色
 */
const USER_ROLES = {
  BOSS: 'boss',
  MANAGER: 'manager',
  HR: 'hr',
  MENTOR: 'mentor',
  FINANCE: 'finance',
  PROMOTER: 'promoter',
  PART_TIME: 'part_time',
  LEAD: 'lead',
};

/**
 * 用户角色中文标签映射
 */
const ROLE_LABELS = {
  [USER_ROLES.BOSS]: '老板',
  [USER_ROLES.MANAGER]: '主管',
  [USER_ROLES.HR]: 'HR',
  [USER_ROLES.MENTOR]: '带教老师',
  [USER_ROLES.FINANCE]: '财务',
  [USER_ROLES.PROMOTER]: '引流人员',
  [USER_ROLES.PART_TIME]: '兼职用户',
  [USER_ROLES.LEAD]: '线索',
};

/**
 * 审核状态
 */
const REVIEW_STATUS = {
  PENDING: 'pending',           // 待审核
  AI_APPROVED: 'ai_approved',   // AI 通过
  APPROVED: 'approved',         // 人工通过
  REJECTED: 'rejected',         // 拒绝
  COMPLETED: 'completed',       // 已完成
  CANCELLED: 'cancelled',       // 已取消
};

/**
 * 图片类型
 */
const IMAGE_TYPES = {
  NOTE: 'note',       // 笔记
  COMMENT: 'comment', // 评论
};

/**
 * 采集优先级
 */
const HARVEST_PRIORITY = {
  HIGHEST: 10,   // 最高优先级（每10分钟采集）
  HIGH: 5,       // 高优先级（每1小时采集）
  MEDIUM: 2,     // 中优先级（每6小时采集）
  DEFAULT: 1,    // 默认优先级（每24小时采集）
};

/**
 * 采集优先级间隔（分钟）
 */
const HARVEST_INTERVALS = {
  [HARVEST_PRIORITY.HIGHEST]: 10,
  [HARVEST_PRIORITY.HIGH]: 60,
  [HARVEST_PRIORITY.MEDIUM]: 360,
  [HARVEST_PRIORITY.DEFAULT]: 1440,
};

/**
 * 笔记状态
 */
const NOTE_STATUS = {
  ACTIVE: 'active',       // 活跃
  DELETED: 'deleted',     // 已删除
  PRIVATE: 'private',     // 私密
  INVALID: 'invalid',     // 无效
};

/**
 * 发现笔记状态
 */
const DISCOVERED_NOTE_STATUS = {
  DISCOVERED: 'discovered',   // 已发现
  VERIFIED: 'verified',       // 已验证
  CONVERTED: 'converted',     // 已转化
  REJECTED: 'rejected',       // 已拒绝
};

/**
 * 评论线索状态
 */
const COMMENT_LEAD_STATUS = {
  PENDING: 'pending',       // 待处理
  CONTACTED: 'contacted',   // 已联系
  CONVERTED: 'converted',   // 已转化
  INVALID: 'invalid',       // 无效
};

/**
 * 任务类型
 */
const TASK_TYPES = {
  NOTE_REVIEW: 'note_review',       // 笔记审核
  COMMENT_REVIEW: 'comment_review', // 评论审核
  DEVICE_REVIEW: 'device_review',   // 设备审核
  HARVEST: 'harvest',               // 采集
  DISCOVERY: 'discovery',           // 发现
};

/**
 * 任务状态
 */
const TASK_STATUS = {
  PENDING: 'pending',     // 待处理
  PROCESSING: 'processing', // 处理中
  COMPLETED: 'completed', // 已完成
  FAILED: 'failed',       // 失败
  CANCELLED: 'cancelled', // 已取消
};

/**
 * 交易类型
 */
const TRANSACTION_TYPES = {
  WITHDRAW: 'withdraw',              // 提现
  COMMISSION: 'commission',          // 佣金
  REFERRAL_BONUS_1: 'referral_bonus_1', // 一级推荐奖励
  REFERRAL_BONUS_2: 'referral_bonus_2', // 二级推荐奖励
  REWARD: 'reward',                  // 奖励
  ADJUSTMENT: 'adjustment',          // 调整
};

/**
 * 交易状态
 */
const TRANSACTION_STATUS = {
  PENDING: 'pending',     // 待处理
  PROCESSING: 'processing', // 处理中
  COMPLETED: 'completed', // 已完成
  FAILED: 'failed',       // 失败
  CANCELLED: 'cancelled', // 已取消
};

/**
 * HTTP 状态码
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

/**
 * AI 分类结果
 */
const AI_CATEGORIES = {
  // 严格支持的类别
  WEIGHT_LOSS: '减肥',
  MEDICAL_BEAUTY: '医美',
  SPOT_REMOVAL: '祛斑',
  ACNE_REMOVAL: '祛痘',
  BREAST_ENHANCEMENT: '丰胸',
  SKINCARE: '护肤',
  EYE_BAG_REMOVAL: '眼袋',
  HAIR_GROWTH: '育发',
  JADE_STONE: '玉石',
  FEMALE_REGULATION: '女性调理',
  HEIGHT_INCREASE: '增高',
  HPV: 'HPV',
  GAMBLING_STONE: '赌石',
  SUPPLEMENTS: '保健品',
};

/**
 * 客户端类型
 */
const CLIENT_TYPES = {
  AUDIT: 'audit',                   // 审核客户端
  BLACKLIST_SCAN: 'blacklist-scan', // 黑名单扫描
  DISCOVERY: 'discovery',           // 笔记发现
  SHORT_LINK: 'short-link',         // 短链接转换
};

/**
 * 响应消息模板
 */
const MESSAGES = {
  SUCCESS: '操作成功',
  FAILED: '操作失败',
  UNAUTHORIZED: '未授权，请先登录',
  FORBIDDEN: '无权限访问',
  NOT_FOUND: '资源不存在',
  INVALID_PARAMS: '参数错误',
  SERVER_ERROR: '服务器错误',
  RATE_LIMITED: '请求过于频繁，请稍后再试',

  // 审核相关
  REVIEW_PENDING: '审核中，请耐心等待',
  REVIEW_APPROVED: '审核通过',
  REVIEW_REJECTED: '审核未通过',

  // 交易相关
  WITHDRAW_PENDING: '提现申请已提交，请等待审核',
  WITHDRAW_SUCCESS: '提现成功',
  INSUFFICIENT_BALANCE: '余额不足',
};

/**
 * 正则表达式模式
 */
const PATTERNS = {
  // ObjectId 格式
  OBJECT_ID: /^[0-9a-fA-F]{24}$/,

  // 小红书笔记 URL
  XHS_NOTE_URL: /xiaohongshu\.com\/explore\/([a-f0-9]{24,})/,

  // 小红书短链接
  XHS_SHORT_URL: /xhslink\.com\//,

  // 手机号（中国大陆）
  PHONE: /^1[3-9]\d{9}$/,

  // 邮箱
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // URL
  URL: /^https?:\/\/.+/,
};

/**
 * 分页默认值
 */
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

/**
 * 文件上传限制
 */
const UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
};

/**
 * 导出所有常量
 */
module.exports = {
  TIME,
  REVIEW,
  API_PREFIX,
  USER_ROLES,
  ROLE_LABELS,
  REVIEW_STATUS,
  IMAGE_TYPES,
  HARVEST_PRIORITY,
  HARVEST_INTERVALS,
  NOTE_STATUS,
  DISCOVERED_NOTE_STATUS,
  COMMENT_LEAD_STATUS,
  TASK_TYPES,
  TASK_STATUS,
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  HTTP_STATUS,
  AI_CATEGORIES,
  CLIENT_TYPES,
  MESSAGES,
  PATTERNS,
  PAGINATION,
  UPLOAD,
};
