const express = require('express');
const Complaint = require('../models/Complaint');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 提交投诉（用户）
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: '投诉内容不能为空' });
    }

    if (content.length > 1000) {
      return res.status(400).json({ success: false, message: '投诉内容不能超过1000个字符' });
    }

    const complaint = new Complaint({
      userId: req.user._id,
      content: content.trim()
    });

    await complaint.save();

    res.json({
      success: true,
      message: '投诉提交成功',
      complaint: {
        id: complaint._id,
        content: complaint.content,
        status: complaint.status,
        createdAt: complaint.createdAt
      }
    });

  } catch (error) {
    console.error('提交投诉错误:', error);
    res.status(500).json({ success: false, message: '提交投诉失败' });
  }
});

// 获取投诉列表（管理员）
router.get('/', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, keyword } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // 状态过滤
    if (status) {
      query.status = status;
    }

    // 搜索投诉内容
    if (keyword) {
      query.content = { $regex: keyword, $options: 'i' };
    }

    const complaints = await Complaint.find(query)
      .populate('userId', 'username nickname phone')
      .populate('respondedBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Complaint.countDocuments(query);

    res.json({
      success: true,
      data: complaints,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取投诉列表错误:', error);
    res.status(500).json({ success: false, message: '获取投诉列表失败' });
  }
});

// 更新投诉状态和回复（管理员）
router.put('/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_reply } = req.body;

    const updateData = {};

    if (status) {
      updateData.status = status;
    }

    if (admin_reply !== undefined) {
      updateData.admin_reply = admin_reply;
      if (admin_reply && admin_reply.trim()) {
        updateData.replied_at = new Date();
        updateData.replied_by = req.user._id;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: '没有有效的更新内容' });
    }

    const complaint = await Complaint.findByIdAndUpdate(id, updateData, { new: true })
      .populate('userId', 'username nickname phone')
      .populate('respondedBy', 'username nickname');

    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉不存在' });
    }

    res.json({
      success: true,
      message: '投诉更新成功',
      data: complaint
    });

  } catch (error) {
    console.error('更新投诉错误:', error);
    res.status(500).json({ success: false, message: '更新投诉失败' });
  }
});

// 获取单个投诉详情（管理员）
router.get('/:id', authenticateToken, requireRole(['boss', 'manager']), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('userId', 'username nickname phone')
      .populate('respondedBy', 'username nickname');

    if (!complaint) {
      return res.status(404).json({ success: false, message: '投诉不存在' });
    }

    res.json({
      success: true,
      data: complaint
    });

  } catch (error) {
    console.error('获取投诉详情错误:', error);
    res.status(500).json({ success: false, message: '获取投诉详情失败' });
  }
});

module.exports = router;