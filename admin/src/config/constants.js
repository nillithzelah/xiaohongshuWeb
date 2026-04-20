/**
 * 前端配置常量
 *
 * 统一管理前端使用的配置值、魔法数字和枚举
 */

/**
 * 响应式断点
 */
export const BREAKPOINTS = {
  XS: 480,
  SM: 576,
  MD: 768,
  LG: 992,
  XL: 1200,
  XXL: 1600,
};

/**
 * 屏幕类型
 */
export const SCREEN_TYPES = {
  MOBILE: 'mobile',     // < 768px
  TABLET: 'tablet',     // 768px - 1024px
  DESKTOP: 'desktop',   // > 1024px
};

/**
 * 分页配置
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: ['10', '20', '50', '100'],
  SHOW_SIZE_CHANGER: true,
  SHOW_QUICK_JUMPER: true,
  SHOW_TOTAL: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
};

/**
 * 状态颜色映射
 */
export const STATUS_COLORS = {
  // 审核状态
  pending: 'default',
  ai_approved: 'processing',
  approved: 'success',
  rejected: 'error',
  completed: 'success',
  cancelled: 'default',

  // 设备状态
  online: 'success',
  offline: 'default',
  reviewing: 'processing',

  // 任务状态
  task_pending: 'default',
  task_processing: 'processing',
  task_completed: 'success',
  task_failed: 'error',

  // 交易状态
  transaction_pending: 'processing',
  transaction_completed: 'success',
  transaction_failed: 'error',
};

/**
 * 审核状态标签
 */
export const REVIEW_STATUS_LABELS = {
  pending: '待审核',
  ai_approved: 'AI 通过',
  approved: '人工通过',
  rejected: '已拒绝',
  completed: '已完成',
  cancelled: '已取消',
};

/**
 * 用户角色标签
 */
export const ROLE_LABELS = {
  boss: '老板',
  manager: '主管',
  hr: 'HR',
  mentor: '带教老师',
  finance: '财务',
  promoter: '引流人员',
  part_time: '兼职用户',
  lead: '线索',
};

/**
 * 角色颜色
 */
export const ROLE_COLORS = {
  boss: 'red',
  manager: 'orange',
  hr: 'blue',
  mentor: 'green',
  finance: 'purple',
  promoter: 'cyan',
  part_time: 'default',
  lead: 'default',
};

/**
 * 图片类型标签
 */
export const IMAGE_TYPE_LABELS = {
  note: '笔记',
  comment: '评论',
};

/**
 * 本地存储键名
 */
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER_INFO: 'userInfo',
  THEME: 'theme',
  SIDEBAR_COLLAPSED: 'sidebarCollapsed',
  TABLE_PAGE_SIZE: 'tablePageSize_',
};

/**
 * 路由路径
 */
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  USERS: '/users',
  DEVICES: '/devices',
  REVIEWS: '/reviews',
  COMMENTS: '/comments',
  LEADS: '/leads',
  FINANCE: '/finance',
  SETTINGS: '/settings',
  PERMISSIONS: '/permissions',
};

/**
 * 菜单项
 */
export const MENU_ITEMS = [
  {
    key: 'dashboard',
    path: '/',
    icon: 'DashboardOutlined',
    label: '仪表板',
    roles: ['boss', 'manager', 'hr', 'mentor', 'finance'],
  },
  {
    key: 'reviews',
    path: '/reviews',
    icon: 'FileTextOutlined',
    label: '审核管理',
    roles: ['boss', 'manager', 'hr', 'mentor'],
    children: [
      {
        key: 'reviews-pending',
        path: '/reviews/pending',
        label: '待审核',
      },
      {
        key: 'reviews-approved',
        path: '/reviews/approved',
        label: '已通过',
      },
      {
        key: 'reviews-rejected',
        path: '/reviews/rejected',
        label: '已拒绝',
      },
    ],
  },
  {
    key: 'comments',
    path: '/comments',
    icon: 'MessageOutlined',
    label: '评论管理',
    roles: ['boss', 'manager', 'hr', 'mentor', 'promoter'],
  },
  {
    key: 'leads',
    path: '/leads',
    icon: 'UserSwitchOutlined',
    label: '评论线索',
    roles: ['boss', 'manager', 'hr', 'mentor', 'promoter'],
  },
  {
    key: 'users',
    path: '/users',
    icon: 'TeamOutlined',
    label: '用户管理',
    roles: ['boss', 'manager', 'hr', 'mentor'],
  },
  {
    key: 'devices',
    path: '/devices',
    icon: 'MobileOutlined',
    label: '设备管理',
    roles: ['boss', 'manager', 'hr', 'mentor'],
  },
  {
    key: 'finance',
    path: '/finance',
    icon: 'DollarOutlined',
    label: '财务管理',
    roles: ['boss', 'manager', 'finance'],
  },
  {
    key: 'settings',
    path: '/settings',
    icon: 'SettingOutlined',
    label: '系统设置',
    roles: ['boss', 'manager'],
  },
];

/**
 * 主题配置
 */
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  COMPACT: 'compact',
};

/**
 * 颜色主题
 */
export const THEME_COLORS = {
  PRIMARY: '#1890ff',
  SUCCESS: '#52c41a',
  WARNING: '#faad14',
  ERROR: '#f5222d',
  INFO: '#1890ff',
};

/**
 * 文件上传配置
 */
export const UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_FORMATS: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  ACCEPTED_FORMATS_LABEL: 'JPG、PNG、WebP',
};

/**
 * 表格配置
 */
export const TABLE_CONFIG = {
  DEFAULT_SCROLL_Y: 400,
  DEFAULT_SCROLL_X: 1200,
  ROW_KEY: 'id',
  BORDERED: false,
  SIZE: 'middle',
};

/**
 * 消息提示持续时间（毫秒）
 */
export const MESSAGE_DURATION = {
  SHORT: 2000,
  MEDIUM: 3000,
  LONG: 5000,
};

/**
 * 防抖/节流延迟（毫秒）
 */
export const DELAY = {
  DEBOUNCE: 300,
  THROTTLE: 200,
  SEARCH: 500,
};

/**
 * 日期格式
 */
export const DATE_FORMATS = {
  DATE: 'YYYY-MM-DD',
  TIME: 'HH:mm:ss',
  DATETIME: 'YYYY-MM-DD HH:mm:ss',
  DATETIME_SHORT: 'MM-DD HH:mm',
  MONTH: 'YYYY-MM',
  YEAR: 'YYYY',
};

/**
 * 导出文件名日期格式
 */
export const EXPORT_FILENAME_FORMAT = 'YYYYMMDD_HHmmss';

/**
 * 导出配置
 */
export const EXPORT = {
  DEFAULT_FILENAME: (name) => `${name}_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}`,
};

/**
 * 定时刷新间隔（毫秒）
 */
export const REFRESH_INTERVALS = {
  FAST: 5000,    // 5秒
  NORMAL: 30000, // 30秒
  SLOW: 60000,   // 1分钟
};

/**
 * 本地缓存过期时间（毫秒）
 */
export const CACHE_EXPIRY = {
  SHORT: 5 * 60 * 1000,      // 5分钟
  MEDIUM: 30 * 60 * 1000,    // 30分钟
  LONG: 60 * 60 * 1000,      // 1小时
  DAY: 24 * 60 * 60 * 1000,  // 1天
};

/**
 * 数字格式化配置
 */
export const NUMBER_FORMAT = {
  DECIMAL_PLACES: 2,
  THOUSAND_SEPARATOR: ',',
};

/**
 * 金额格式化
 */
export const MONEY_FORMAT = {
  DECIMAL_PLACES: 2,
  SYMBOL: '¥',
  THOUSAND_SEPARATOR: ',',
};

/**
 * 导出所有常量
 */
export default {
  BREAKPOINTS,
  SCREEN_TYPES,
  PAGINATION,
  STATUS_COLORS,
  REVIEW_STATUS_LABELS,
  ROLE_LABELS,
  ROLE_COLORS,
  IMAGE_TYPE_LABELS,
  STORAGE_KEYS,
  ROUTES,
  MENU_ITEMS,
  THEMES,
  THEME_COLORS,
  UPLOAD,
  TABLE_CONFIG,
  MESSAGE_DURATION,
  DELAY,
  DATE_FORMATS,
  EXPORT_FILENAME_FORMAT,
  EXPORT,
  REFRESH_INTERVALS,
  CACHE_EXPIRY,
  NUMBER_FORMAT,
  MONEY_FORMAT,
};
