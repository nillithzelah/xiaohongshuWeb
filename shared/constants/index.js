/**
 * 全局常量定义
 * 统一管理项目中使用的硬编码值，便于维护和复用
 * 使用 CommonJS 格式以兼容 Node.js 后端
 */

// ============================================
// 类别相关常量
// ============================================

/**
 * 支持的14个受骗类别
 * 用于 AI 审核、关键词匹配、内容过滤等
 */
const SCAM_CATEGORIES = [
  '减肥',
  '医美',
  '祛斑',
  '祛痘',
  '丰胸',
  '护肤',
  '眼袋',
  '育发',
  '玉石',
  '女性调理',
  '增高',
  'HPV',
  '赌石',
  '保健品'
];

/**
 * 类别关键词映射（用于白名单检查）
 * 从 server/config/keywords.js 迁移
 */
const CATEGORY_KEYWORDS = {
  HPV被骗: [
    'HPV疫苗', 'HPV感染', 'HPV治疗', '九价HPV', '四价HPV',
    '宫颈疫苗', '宫颈癌疫苗', 'HPV预约', 'HPV骗局'
  ],
  减肥诈骗: [
    '减肥药', '减肥产品', '瘦身', '减脂', '减肥茶',
    '减肥咖啡', '减肥胶囊', '燃脂', '溶脂', '瘦身霜'
  ],
  护肤诈骗: [
    '护肤', '护肤品', '护肤品牌', '面膜', '精华液',
    '爽肤水', '乳液', '面霜', '护肤套装', '美容院'
  ],
  祛斑诈骗: [
    '祛斑', '雀斑', '黄褐斑', '老年斑', '祛斑产品',
    '淡斑', '美白祛斑', '激光祛斑', '祛斑霜', '斑点'
  ],
  丰胸诈骗: [
    '丰胸', '丰胸产品', '丰胸霜', '丰胸按摩', '丰胸药',
    '美胸', '胸部护理', '丰胸精油', '隆胸', '胸部'
  ],
  医美诈骗: [
    '医美', '医疗美容', '整形', '整形医院', '整形手术',
    '微整形', '医美机构', '美容院', '医美项目', '医美陷阱'
  ],
  白发转黑诈骗: [
    '白发转黑', '黑发', '染发', '白发', '生发',
    '防脱发', '脱发', '生发产品', '育发', '白发产品'
  ],
  增高诈骗: [
    '增高', '增高药', '增高鞋', '长高', '增高产品',
    '增高训练', '成人增高', '增高课程', '骨骼', '生长'
  ],
  手镯定制诈骗: [
    '玉石', '翡翠', '手镯', '玉镯', '手镯定制',
    '翡翠手镯', '玉石鉴定', '翡翠A货', '玉石投资', '翡翠原石'
  ],
  女性调理诈骗: [
    '女性调理', '妇科', '妇科炎症', '盆腔炎', '月经不调',
    '女性健康', '调理', '痛经', '内分泌', '卵巢'
  ]
};

// ============================================
// 用户角色常量
// ============================================

/**
 * 用户角色枚举
 */
const USER_ROLES = {
  PART_TIME: 'part_time',      // 兼职用户
  MENTOR: 'mentor',            // 带教老师
  BOSS: 'boss',                // 老板
  FINANCE: 'finance',          // 财务
  MANAGER: 'manager',          // 经理
  HR: 'hr',                    // HR
  LEAD: 'lead',                // 团队长
  PROMOTER: 'promoter'         // 推广员
};

/**
 * 角色列表（用于枚举验证）
 */
const USER_ROLE_LIST = Object.values(USER_ROLES);

// ============================================
// 图片类型常量
// ============================================

/**
 * 图片类型枚举
 */
const IMAGE_TYPES = {
  CUSTOMER_RESOURCE: 'customer_resource',  // 客资
  NOTE: 'note',                          // 笔记
  COMMENT: 'comment'                     // 评论
};

/**
 * 图片类型列表
 */
const IMAGE_TYPE_LIST = Object.values(IMAGE_TYPES);

/**
 * 图片类型价格映射
 */
const IMAGE_TYPE_PRICES = {
  [IMAGE_TYPES.CUSTOMER_RESOURCE]: 10,
  [IMAGE_TYPES.NOTE]: 8,
  [IMAGE_TYPES.COMMENT]: 3
};

// ============================================
// 审核状态常量
// ============================================

/**
 * 审核状态枚举
 */
const REVIEW_STATUS = {
  PENDING: 'pending',                       // 待审核
  PROCESSING: 'processing',                 // 处理中
  AI_APPROVED: 'ai_approved',               // AI通过
  MENTOR_APPROVED: 'mentor_approved',       // 带教通过
  MANAGER_APPROVED: 'manager_approved',     // 经理通过
  MANAGER_REJECTED: 'manager_rejected',     // 经理拒绝
  FINANCE_PROCESSING: 'finance_processing', // 财务处理中
  COMPLETED: 'completed',                   // 已完成
  REJECTED: 'rejected',                     // 已拒绝
  CLIENT_VERIFICATION_PENDING: 'client_verification_pending', // 客户端验证待处理
  CLIENT_VERIFICATION_FAILED: 'client_verification_failed'    // 客户端验证失败
};

/**
 * 审核状态列表
 */
const REVIEW_STATUS_LIST = Object.values(REVIEW_STATUS);

/**
 * 终态状态（不再变化）
 */
const FINAL_STATUS = [
  REVIEW_STATUS.MANAGER_APPROVED,
  REVIEW_STATUS.MANAGER_REJECTED,
  REVIEW_STATUS.COMPLETED,
  REVIEW_STATUS.REJECTED,
  REVIEW_STATUS.CLIENT_VERIFICATION_FAILED
];

// ============================================
// 设备状态常量
// ============================================

/**
 * 设备在线状态
 */
const DEVICE_STATUS = {
  ONLINE: 'online',       // 在线
  OFFLINE: 'offline',     // 离线
  PROTECTED: 'protected', // 保护中
  FROZEN: 'frozen',       // 冻结
  REVIEWING: 'reviewing'  // 审核中
};

/**
 * 设备状态列表
 */
const DEVICE_STATUS_LIST = Object.values(DEVICE_STATUS);

/**
 * 设备审核状态
 */
const DEVICE_REVIEW_STATUS = {
  PENDING: 'pending',           // 待审核
  AI_APPROVED: 'ai_approved',   // AI通过
  APPROVED: 'approved',         // 已通过
  REJECTED: 'rejected'          // 已拒绝
};

/**
 * 设备审核状态列表
 */
const DEVICE_REVIEW_STATUS_LIST = Object.values(DEVICE_REVIEW_STATUS);

// ============================================
// 笔记发现状态常量
// ============================================

/**
 * 笔记发现状态
 */
const DISCOVERY_STATUS = {
  DISCOVERED: 'discovered',   // 已发现
  VERIFIED: 'verified',       // 已验证
  CONVERTED: 'converted',     // 已转化
  REJECTED: 'rejected'        // 已拒绝
};

/**
 * 笔记发现状态列表
 */
const DISCOVERY_STATUS_LIST = Object.values(DISCOVERY_STATUS);

/**
 * 笔记状态
 */
const NOTE_STATUS = {
  ACTIVE: 'active',         // 有效
  DELETED: 'deleted',       // 已删除
  AI_REJECTED: 'ai_rejected' // AI拒绝
};

/**
 * 笔记状态列表
 */
const NOTE_STATUS_LIST = Object.values(NOTE_STATUS);

// ============================================
// 短链接状态常量
// ============================================

/**
 * 短链接状态
 */
const SHORTLINK_STATUS = {
  PENDING: 'pending',    // 待生成
  COMPLETED: 'completed', // 已完成
  DELETED: 'deleted',    // 已删除
  INVALID: 'invalid'     // 无效
};

/**
 * 短链接状态列表
 */
const SHORTLINK_STATUS_LIST = Object.values(SHORTLINK_STATUS);

// ============================================
// API 路径常量
// ============================================

/**
 * API 基础路径
 */
const API_PREFIX = '/xiaohongshu/api';

/**
 * API 路由
 */
const API_ROUTES = {
  AUTH: '/auth',
  USER: '/user',
  REVIEWS: '/reviews',
  CLIENT: '/client',
  DEVICES: '/devices',
  ADMIN: '/admin',
  HR: '/hr',
  UPLOAD: '/upload',
  MANAGER: '/manager',
  PERMISSIONS: '/permissions',
  SHORT_LINK_POOL: '/short-link-pool',
  COMPLAINTS: '/complaints'
};

// ============================================
// 导出所有常量（CommonJS）
// ============================================

module.exports = {
  // 类别
  SCAM_CATEGORIES,
  CATEGORY_KEYWORDS,

  // 用户角色
  USER_ROLES,
  USER_ROLE_LIST,

  // 图片类型
  IMAGE_TYPES,
  IMAGE_TYPE_LIST,
  IMAGE_TYPE_PRICES,

  // 审核状态
  REVIEW_STATUS,
  REVIEW_STATUS_LIST,
  FINAL_STATUS,

  // 设备状态
  DEVICE_STATUS,
  DEVICE_STATUS_LIST,
  DEVICE_REVIEW_STATUS,
  DEVICE_REVIEW_STATUS_LIST,

  // 笔记发现
  DISCOVERY_STATUS,
  DISCOVERY_STATUS_LIST,
  NOTE_STATUS,
  NOTE_STATUS_LIST,

  // 短链接
  SHORTLINK_STATUS,
  SHORTLINK_STATUS_LIST,

  // API
  API_PREFIX,
  API_ROUTES
};
