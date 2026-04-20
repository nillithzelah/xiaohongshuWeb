/**
 * client.js - 客户端路由（已拆分）
 *
 * ⚠️ 此文件已被模块化拆分，所有功能已迁移到以下文件：
 *
 * - client-common.js    - 通用功能（心跳、验证、日志、系统配置等）
 * - client-tasks.js     - 任务管理（提交、查询、批量操作等）
 * - client-devices.js   - 设备管理（设备列表、审核状态等）
 * - client-discovery.js - 笔记发现（搜索、上报、采集队列等）
 * - client-harvest.js   - 采集功能（评论采集、黑名单管理等）
 * - client-link-convert.js - 短链接转换
 *
 * 路由注册在 server.js 中：
 * - /xiaohongshu/api/client -> client-tasks.js
 * - /xiaohongshu/api/client -> client-devices.js
 * - /xiaohongshu/api/client -> client-discovery.js
 * - /xiaohongshu/api/client -> client-harvest.js
 * - /xiaohongshu/api/client -> client-link-convert.js
 * - /xiaohongshu/api/client -> client-common.js
 *
 * 拆分日期：2026-03-03
 * 原文件行数：~4200 行
 */

const express = require('express');
const router = express.Router();

// 此路由文件不再被 server.js 注册
// 保留此文件仅作为历史参考

module.exports = router;
