/**
 * 权限系统初始化脚本
 *
 * 用途：
 * 1. 创建系统中所有菜单项定义
 * 2. 根据当前硬编码权限创建初始角色权限配置
 *
 * 运行方式：
 * node server/init/init-permissions.js
 */

require('dotenv').config({ path: './server/.env' });
const mongoose = require('mongoose');
const MenuDefinition = require('../models/MenuDefinition');
const RolePermission = require('../models/RolePermission');

// 连接数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 菜单初始数据
const initialMenus = [
  // 仪表板
  { key: '/', label: '仪表板', icon: 'DashboardOutlined', path: '/', sortOrder: 1, category: 'dashboard', description: '系统概览和统计' },

  // 审核管理（父菜单）
  { key: '/reviews', label: '审核管理', icon: 'AppstoreOutlined', parentKey: null, sortOrder: 2, isGroup: true, category: 'review', description: '笔记、评论、客资审核' },
  { key: '/reviews/note', label: '笔记审核', path: '/reviews/note', parentKey: '/reviews', sortOrder: 1, category: 'review' },
  { key: '/reviews/comment', label: '评论审核', path: '/reviews/comment', parentKey: '/reviews', sortOrder: 2, category: 'review' },
  { key: '/reviews/customer', label: '客资审核', path: '/reviews/customer', parentKey: '/reviews', sortOrder: 3, category: 'review' },

  // 系统监控
  { key: '/monitoring', label: '系统监控', icon: 'CloudOutlined', path: '/monitoring', sortOrder: 3, category: 'monitoring', description: '客户端状态监控' },

  // AI相关
  { key: '/ai-auto-approved', label: 'AI自动审核记录', icon: 'RobotOutlined', path: '/ai-auto-approved', sortOrder: 4, category: 'content', description: 'AI审核通过的记录' },
  { key: '/ai-prompts', label: 'AI提示词管理', icon: 'CodeOutlined', path: '/ai-prompts', sortOrder: 5, category: 'system', description: 'AI分析提示词配置' },

  // 内容发现
  { key: '/discovery-notes', label: '笔记发现管理', icon: 'RobotOutlined', path: '/discovery-notes', sortOrder: 6, category: 'content', description: '发现和管理的笔记' },
  { key: '/harvest-queue', label: '采集队列管理', icon: 'CloudOutlined', path: '/harvest-queue', sortOrder: 7, category: 'content', description: '评论采集任务队列' },
  { key: '/short-link-pool', label: '短链接池管理', icon: 'LinkOutlined', path: '/short-link-pool', sortOrder: 8, category: 'content', description: '短链接资源池管理' },

  // 评论管理
  { key: '/comment-leads', label: '评论线索管理', icon: 'StarOutlined', path: '/comment-leads', sortOrder: 9, category: 'content', description: '评论线索列表' },
  { key: '/comment-blacklist', label: '评论黑名单', icon: 'StopOutlined', path: '/comment-blacklist', sortOrder: 10, category: 'content', description: '黑名单用户管理' },
  { key: '/search-keywords', label: '搜索关键词管理', icon: 'SearchOutlined', path: '/search-keywords', sortOrder: 11, category: 'content', description: '搜索关键词配置' },

  // 用户管理
  { key: '/staff', label: '公司员工', icon: 'TeamOutlined', path: '/staff', sortOrder: 12, category: 'user', description: '公司员工管理' },
  { key: '/clients', label: '兼职用户', icon: 'UserOutlined', path: '/clients', sortOrder: 13, category: 'user', description: '兼职用户管理' },
  { key: '/manager', label: '分配带教老师', icon: 'UserOutlined', path: '/manager', sortOrder: 14, category: 'user', description: '带教老师分配管理' },

  // 设备管理
  { key: '/devices', label: '设备管理', icon: 'MobileOutlined', path: '/devices', sortOrder: 15, category: 'device', description: '设备列表管理' },
  { key: '/device-review', label: '设备审核', icon: 'MobileOutlined', path: '/device-review', sortOrder: 16, category: 'device', description: '设备审核队列' },

  // 财务管理（父菜单）
  { key: '/financial', label: '财务管理', icon: 'FundOutlined', parentKey: null, sortOrder: 17, isGroup: true, category: 'financial', description: '财务相关管理' },
  { key: '/financial/summary', label: '财务汇总', path: '/financial', parentKey: '/financial', sortOrder: 1, category: 'financial' },
  { key: '/financial/withdrawals', label: '兼职用户提现', path: '/financial/withdrawals', parentKey: '/financial', sortOrder: 2, category: 'financial' },
  { key: '/part-time-withdrawals', label: '兼职用户待打款', path: '/part-time-withdrawals', parentKey: '/financial', sortOrder: 3, category: 'financial' },

  // 系统设置
  { key: '/task-points', label: '任务积分管理', icon: 'SettingOutlined', path: '/task-points', sortOrder: 18, category: 'system', description: '积分任务配置' },
  { key: '/permissions', label: '权限管理', icon: 'SafetyOutlined', path: '/permissions', sortOrder: 19, category: 'system', description: '角色权限配置' }
];

// 所有菜单key列表（方便引用）
const allMenuKeys = initialMenus.map(m => m.key);

// 角色权限初始数据（基于当前硬编码权限）
const initialRolePermissions = [
  {
    role: 'boss',
    allowedMenus: [...allMenuKeys], // boss拥有所有权限
    description: '老板 - 最高权限'
  },
  {
    role: 'manager',
    allowedMenus: [
      '/', '/reviews', '/reviews/note', '/reviews/comment', '/reviews/customer',
      '/monitoring', '/discovery-notes', '/harvest-queue', '/short-link-pool',
      '/comment-leads', '/comment-blacklist', '/search-keywords', '/ai-prompts',
      '/staff', '/clients', '/manager', '/devices', '/device-review',
      '/task-points', '/financial', '/financial/summary', '/financial/withdrawals',
      '/part-time-withdrawals'
    ],
    description: '主管 - 高级管理权限'
  },
  {
    role: 'hr',
    allowedMenus: [
      '/', '/reviews', '/reviews/note', '/reviews/comment', '/reviews/customer',
      '/ai-auto-approved', '/staff', '/clients', '/devices', '/device-review'
    ],
    description: 'HR - 人力管理权限'
  },
  {
    role: 'mentor',
    allowedMenus: [
      '/', '/reviews', '/reviews/note', '/reviews/comment', '/reviews/customer',
      '/ai-auto-approved', '/staff', '/clients', '/devices', '/device-review'
    ],
    description: '带教老师 - 审核权限'
  },
  {
    role: 'finance',
    allowedMenus: [
      '/', '/reviews', '/reviews/note', '/reviews/comment', '/reviews/customer',
      '/financial', '/financial/summary', '/financial/withdrawals',
      '/part-time-withdrawals'
    ],
    description: '财务 - 财务管理权限'
  },
  {
    role: 'promoter',
    allowedMenus: ['/comment-leads', '/comment-blacklist'],
    description: '引流人员 - 评论管理权限'
  }
];

async function init() {
  try {
    console.log('🔄 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');

    // 1. 创建菜单定义
    console.log('\n📋 创建菜单定义...');
    let menuCount = 0;
    for (const menu of initialMenus) {
      const existing = await MenuDefinition.findOne({ key: menu.key });
      if (existing) {
        console.log(`   ⏭️  菜单已存在: ${menu.label} (${menu.key})`);
      } else {
        await MenuDefinition.create(menu);
        console.log(`   ✅ 创建菜单: ${menu.label} (${menu.key})`);
        menuCount++;
      }
    }
    console.log(`📊 菜单创建完成，新增 ${menuCount} 个菜单\n`);

    // 2. 创建角色权限
    console.log('🔑 创建角色权限...');
    let permCount = 0;
    for (const rolePerm of initialRolePermissions) {
      const existing = await RolePermission.findOne({ role: rolePerm.role });
      if (existing) {
        console.log(`   ⏭️  权限已存在: ${rolePerm.description}`);
      } else {
        await RolePermission.create({
          role: rolePerm.role,
          allowedMenus: rolePerm.allowedMenus
        });
        console.log(`   ✅ 创建权限: ${rolePerm.description} (${rolePerm.allowedMenus.length}个菜单)`);
        permCount++;
      }
    }
    console.log(`📊 权限创建完成，新增 ${permCount} 个角色权限\n`);

    // 3. 统计信息
    const totalMenus = await MenuDefinition.countDocuments();
    const totalPerms = await RolePermission.countDocuments();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 权限系统初始化完成！');
    console.log(`   菜单总数: ${totalMenus}`);
    console.log(`   角色权限总数: ${totalPerms}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 初始化失败:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 数据库连接已关闭');
  }
}

// 运行初始化
init();
