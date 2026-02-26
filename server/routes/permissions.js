const express = require('express');
const MenuDefinition = require('../models/MenuDefinition');
const RolePermission = require('../models/RolePermission');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// ==================== 获取当前用户权限配置 ====================

/**
 * GET /xiaohongshu/api/permissions/mine
 * 获取当前用户的菜单权限（返回树形结构，直接用于前端渲染）
 */
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user;

    // 获取角色权限配置
    const rolePermission = await RolePermission.findOne({ role });
    if (!rolePermission) {
      return res.json({ success: true, menus: [], flatMenus: [] });
    }

    // 获取所有启用的菜单定义
    const allMenus = await MenuDefinition.find({ enabled: true }).sort({ sortOrder: 1 });

    // 构建菜单树
    const menuTree = buildMenuTree(allMenus, rolePermission.allowedMenus);

    res.json({
      success: true,
      menus: menuTree,
      flatMenus: rolePermission.allowedMenus || [] // 用于权限判断
    });
  } catch (error) {
    console.error('获取用户权限失败:', error);
    res.status(500).json({ success: false, message: '获取权限失败' });
  }
});

// ==================== 获取完整菜单树（用于权限管理页面）====================

/**
 * GET /xiaohongshu/api/permissions/menu-tree
 * 获取完整的菜单树结构（管理员配置权限时使用）
 */
router.get('/menu-tree', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const allMenus = await MenuDefinition.find({}).sort({ sortOrder: 1 });
    const menuTree = buildCompleteMenuTree(allMenus);

    res.json({
      success: true,
      menus: menuTree
    });
  } catch (error) {
    console.error('获取菜单树失败:', error);
    res.status(500).json({ success: false, message: '获取菜单树失败' });
  }
});

// ==================== 获取角色权限配置 ====================

/**
 * GET /xiaohongshu/api/permissions/role/:role
 * 获取指定角色的权限配置
 */
router.get('/role/:role', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { role } = req.params;

    const rolePermission = await RolePermission.findOne({ role });
    if (!rolePermission) {
      return res.json({ success: true, allowedMenus: [] });
    }

    res.json({
      success: true,
      allowedMenus: rolePermission.allowedMenus || []
    });
  } catch (error) {
    console.error('获取角色权限失败:', error);
    res.status(500).json({ success: false, message: '获取角色权限失败' });
  }
});

// ==================== 更新角色权限 ====================

/**
 * PUT /xiaohongshu/api/permissions/role/:role
 * 更新指定角色的权限配置
 */
router.put('/role/:role', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { role } = req.params;
    const { allowedMenus } = req.body;

    // 验证菜单key是否存在
    const existingKeys = await MenuDefinition.distinct('key');
    const invalidKeys = (allowedMenus || []).filter(k => !existingKeys.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `无效的菜单key: ${invalidKeys.join(', ')}`
      });
    }

    const rolePermission = await RolePermission.findOneAndUpdate(
      { role },
      {
        allowedMenus: allowedMenus || [],
        updatedBy: req.user.id,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: '权限配置已更新',
      data: rolePermission
    });
  } catch (error) {
    console.error('更新角色权限失败:', error);
    res.status(500).json({ success: false, message: '更新权限失败' });
  }
});

// ==================== 获取所有角色权限概览 ====================

/**
 * GET /xiaohongshu/api/permissions/overview
 * 获取所有角色的权限概览
 */
router.get('/overview', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const rolePermissions = await RolePermission.find({})
      .populate('updatedBy', 'username')
      .sort({ role: 1 });

    res.json({
      success: true,
      roles: rolePermissions
    });
  } catch (error) {
    console.error('获取权限概览失败:', error);
    res.status(500).json({ success: false, message: '获取权限概览失败' });
  }
});

// ==================== 菜单管理CRUD ====================

/**
 * POST /xiaohongshu/api/permissions/menu
 * 创建新菜单
 */
router.post('/menu', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const menuData = req.body;
    const menu = await MenuDefinition.create(menuData);

    res.json({
      success: true,
      message: '菜单创建成功',
      data: menu
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: '菜单key已存在' });
    }
    console.error('创建菜单失败:', error);
    res.status(500).json({ success: false, message: '创建菜单失败' });
  }
});

/**
 * PUT /xiaohongshu/api/permissions/menu/:key
 * 更新菜单
 */
router.put('/menu/:key', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { key } = req.params;
    const menu = await MenuDefinition.findOneAndUpdate(
      { key },
      req.body,
      { new: true }
    );

    if (!menu) {
      return res.status(404).json({ success: false, message: '菜单不存在' });
    }

    res.json({
      success: true,
      message: '菜单更新成功',
      data: menu
    });
  } catch (error) {
    console.error('更新菜单失败:', error);
    res.status(500).json({ success: false, message: '更新菜单失败' });
  }
});

/**
 * DELETE /xiaohongshu/api/permissions/menu/:key
 * 删除菜单（软删除，设置enabled=false）
 */
router.delete('/menu/:key', authenticateToken, requireRole(['boss']), async (req, res) => {
  try {
    const { key } = req.params;
    const menu = await MenuDefinition.findOneAndUpdate(
      { key },
      { enabled: false },
      { new: true }
    );

    if (!menu) {
      return res.status(404).json({ success: false, message: '菜单不存在' });
    }

    res.json({
      success: true,
      message: '菜单已禁用',
      data: menu
    });
  } catch (error) {
    console.error('删除菜单失败:', error);
    res.status(500).json({ success: false, message: '删除菜单失败' });
  }
});

// ==================== 辅助函数 ====================

/**
 * 构建用户菜单树（只包含用户有权限的菜单）
 */
function buildMenuTree(allMenus, allowedMenuKeys) {
  const menuMap = new Map();
  const rootMenus = [];

  // 创建映射
  allMenus.forEach(menu => {
    if ((allowedMenuKeys || []).includes(menu.key)) {
      menuMap.set(menu.key, { ...menu.toObject(), children: [] });
    }
  });

  // 构建树形结构
  menuMap.forEach(menu => {
    if (menu.parentKey && menuMap.has(menu.parentKey)) {
      menuMap.get(menu.parentKey).children.push(menu);
    } else if (!menu.parentKey) {
      rootMenus.push(menu);
    }
  });

  // 清理空children
  const cleanEmptyChildren = (menus) => {
    menus.forEach(menu => {
      if (menu.children && menu.children.length === 0) {
        delete menu.children;
      } else if (menu.children) {
        cleanEmptyChildren(menu.children);
      }
    });
  };
  cleanEmptyChildren(rootMenus);

  return rootMenus;
}

/**
 * 构建完整菜单树（用于权限配置界面）
 */
function buildCompleteMenuTree(allMenus) {
  const menuMap = new Map();
  const rootMenus = [];

  allMenus.forEach(menu => {
    menuMap.set(menu.key, { ...menu.toObject(), children: [] });
  });

  menuMap.forEach(menu => {
    if (menu.parentKey && menuMap.has(menu.parentKey)) {
      menuMap.get(menu.parentKey).children.push(menu);
    } else if (!menu.parentKey) {
      rootMenus.push(menu);
    }
  });

  // 清理空children
  const cleanEmptyChildren = (menus) => {
    menus.forEach(menu => {
      if (menu.children && menu.children.length === 0) {
        delete menu.children;
      } else if (menu.children) {
        cleanEmptyChildren(menu.children);
      }
    });
  };
  cleanEmptyChildren(rootMenus);

  return rootMenus;
}

module.exports = router;
