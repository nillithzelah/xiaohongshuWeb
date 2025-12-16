const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// 获取用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await require('../models/User').findById(req.user._id)
      .populate('parent_id', 'username')
      .select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: '用户不存在' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        openid: user.openid,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        wallet: user.wallet,
        points: user.points,
        totalEarnings: user.totalEarnings,
        parent: user.parent_id,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

module.exports = router;