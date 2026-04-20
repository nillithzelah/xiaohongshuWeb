/**
 * 管理后台路由 - 主入口
 *
 * 模块化拆分后的路由结构：
 * - dashboard.js: 仪表板统计
 * - finance.js: 财务管理
 * - ai-prompts.js: AI 提示词管理
 * - comment-leads.js: 评论线索管理
 *
 * 兼容性处理：
 * - 原 admin.js 中的其他路由通过 fullAdminRoutes 兜底
 * - 新模块路由优先级高于原 admin.js
 */

const express = require('express');
const router = express.Router();

// ==================== 导入子模块 ====================

const dashboardRoutes = require('./dashboard');
const financeRoutes = require('./finance');
const aiPromptsRoutes = require('./ai-prompts');
const commentLeadsRoutes = require('./comment-leads');

// ==================== 挂载子模块路由 ====================

// 仪表板统计
router.use('/', dashboardRoutes);

// 财务管理 - /finance/*
router.use('/finance', financeRoutes);

// AI 提示词管理 - /ai-prompts/*
router.use('/ai-prompts', aiPromptsRoutes);

// 评论线索管理 - /comment-leads/*
router.use('/comment-leads', commentLeadsRoutes);

// ==================== 兜底路由 ====================
// 原 admin.js 中剩余的路由（公告、Cookie、投诉、关键词等）
// TODO: 逐步迁移到独立模块后移除此引用

const fullAdminRoutes = require('../admin');
router.use('/', fullAdminRoutes);

// ==================== 导出 ====================

module.exports = router;
