/**
 * AI 提示词管理路由模块
 *
 * 从 admin.js 拆分出的 AI 提示词相关路由
 */

const express = require('express');
const AiPrompt = require('../../models/AiPrompt');
const { authenticateToken, requireRole } = require('../../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();
const log = logger.module('AiPrompts');

/**
 * 获取所有 AI 提示词
 * GET /ai-prompts
 */
router.get('/', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const prompts = await AiPrompt.find().sort({ type: 1, name: 1 }).lean();
    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    log.error('获取 AI 提示词失败:', error);
    res.status(500).json({
      success: false,
      message: '获取 AI 提示词失败'
    });
  }
});

/**
 * 创建 AI 提示词
 * POST /ai-prompts
 */
router.post('/', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const data = req.body;
    const prompt = new AiPrompt({
      ...data,
      updatedBy: req.user.username
    });
    await prompt.save();
    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    log.error('创建 AI 提示词失败:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: '提示词名称已存在'
      });
    }
    res.status(500).json({
      success: false,
      message: '创建 AI 提示词失败'
    });
  }
});

/**
 * 更新 AI 提示词
 * PUT /ai-prompts/:name
 */
router.put('/:name', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { name } = req.params;
    const data = req.body;
    const prompt = await AiPrompt.findOneAndUpdate(
      { name },
      {
        ...data,
        updatedBy: req.user.username,
        updatedAt: new Date()
      },
      { new: true }
    );
    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: '提示词不存在'
      });
    }
    res.json({
      success: true,
      data: prompt
    });
  } catch (error) {
    log.error('更新 AI 提示词失败:', error);
    res.status(500).json({
      success: false,
      message: '更新 AI 提示词失败'
    });
  }
});

/**
 * 删除 AI 提示词
 * DELETE /ai-prompts/:name
 */
router.delete('/:name', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { name } = req.params;
    const result = await AiPrompt.deleteOne({ name });
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: '提示词不存在'
      });
    }
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    log.error('删除 AI 提示词失败:', error);
    res.status(500).json({
      success: false,
      message: '删除 AI 提示词失败'
    });
  }
});

/**
 * 测试 AI 提示词
 * POST /ai-prompts/:name/test
 */
router.post('/:name/test', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { name } = req.params;
    const { testData } = req.body;
    const prompt = await AiPrompt.findOne({ name });
    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: '提示词不存在'
      });
    }

    // 调用 AI 服务进行测试
    const aiService = require('../../services/aiContentAnalysisService');
    const testResult = await aiService.testPrompt(prompt, testData);

    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    log.error('测试 AI 提示词失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '测试 AI 提示词失败'
    });
  }
});

/**
 * 重新加载提示词到内存
 * POST /ai-prompts/reload
 */
router.post('/reload', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const aiService = require('../../services/aiContentAnalysisService');
    await aiService.initialize();

    res.json({
      success: true,
      message: 'AI 提示词已重新加载'
    });
  } catch (error) {
    log.error('重新加载 AI 提示词失败:', error);
    res.status(500).json({
      success: false,
      message: '重新加载 AI 提示词失败'
    });
  }
});

module.exports = router;
