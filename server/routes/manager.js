const express = require('express');
const User = require('../models/User');
const { authenticateToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// 获取待分配线索列表
router.get('/leads', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    let query = {
      role: 'part_time', // 只获取兼职用户
      mentor_id: null, // 未分配带教老师
      is_deleted: { $ne: true }
    };

    // 如果有搜索条件
    if (search) {
      query.$or = [
        { nickname: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { wechat: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await User.find(query)
      .populate('hr_id', 'username nickname') // 关联HR信息
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      leads: leads.map(lead => ({
        id: lead._id,
        nickname: lead.nickname,
        phone: lead.phone,
        wechat: lead.wechat,
        notes: lead.notes,
        hr_id: lead.hr_id,
        xiaohongshuAccounts: lead.xiaohongshuAccounts, // 添加小红书账号信息
        createdAt: lead.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取待分配线索错误:', error);
    res.status(500).json({
      success: false,
      message: '获取待分配线索失败'
    });
  }
});

// 分配用户给带教老师
router.put('/assign-mentor/:leadId', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { mentor_id } = req.body;

    if (!mentor_id) {
      return res.status(400).json({
        success: false,
        message: '请选择要分配的带教老师'
      });
    }

    // 查找线索用户
    const leadUser = await User.findById(leadId);

    if (!leadUser) {
      return res.status(404).json({
        success: false,
        message: '线索不存在'
      });
    }

    if (leadUser.role !== 'part_time') {
      return res.status(400).json({
        success: false,
        message: '该用户不是兼职用户'
      });
    }

    if (leadUser.mentor_id) {
      return res.status(400).json({
        success: false,
        message: '该用户已被分配带教老师'
      });
    }

    // 验证带教老师是否存在且角色正确
    const mentorUser = await User.findById(mentor_id);
    if (!mentorUser || mentorUser.role !== 'mentor') {
      return res.status(400).json({
        success: false,
        message: '选择的带教老师不存在或角色不正确'
      });
    }

    // 分配带教老师
    leadUser.mentor_id = mentor_id;
    leadUser.assigned_to_mentor_at = new Date();
    leadUser.training_status = '培训中'; // 分配后更新培训状态

    // 更新已存在的小红书账号设备信息（复用HR创建时已创建设备）
    const Device = require('../models/Device');

    if (leadUser.xiaohongshuAccounts && leadUser.xiaohongshuAccounts.length > 0) {
      for (let i = 0; i < leadUser.xiaohongshuAccounts.length; i++) {
        const account = leadUser.xiaohongshuAccounts[i];

        // 如果已经有设备ID，说明HR创建时已创建设备，直接更新设备信息
        if (account.deviceId) {
          await Device.findByIdAndUpdate(account.deviceId, {
            assignedUser: leadUser._id,
            mentor_id: mentor_id,
            updatedAt: new Date()
          });
        } else {
          // 如果没有设备ID（兼容旧数据），按昵称查找设备并更新
          const existingDevice = await Device.findOne({ accountName: account.nickname.trim() });
          if (existingDevice) {
            await Device.findByIdAndUpdate(existingDevice._id, {
              assignedUser: leadUser._id,
              mentor_id: mentor_id,
              updatedAt: new Date()
            });
            // 更新账号关联
            leadUser.xiaohongshuAccounts[i].deviceId = existingDevice._id;
          } else {
            // 如果设备不存在，创建新设备（兜底逻辑）
            const device = new Device({
              accountName: account.nickname,  // 小红书昵称
              accountId: account.account,     // 小红书账号ID
              assignedUser: leadUser._id,
              mentor_id: mentor_id,
              status: 'online',
              influence: ['new'],
              createdBy: req.user._id
            });
            await device.save();
            leadUser.xiaohongshuAccounts[i].deviceId = device._id;
          }
        }

        // 更新账号状态
        leadUser.xiaohongshuAccounts[i].status = 'assigned';
      }

      // 标记数组已修改，确保保存到数据库
      leadUser.markModified('xiaohongshuAccounts');
    }

    await leadUser.save();

    res.json({
      success: true,
      message: '用户分配成功',
      lead: {
        id: leadUser._id,
        nickname: leadUser.nickname,
        phone: leadUser.phone,
        mentor_id: {
          id: mentorUser._id,
          username: mentorUser.username,
          nickname: mentorUser.nickname
        },
        role: leadUser.role
      }
    });

  } catch (error) {
    console.error('分配线索错误:', error);
    res.status(500).json({
      success: false,
      message: '分配线索失败'
    });
  }
});

// 获取所有带教老师列表（用于分配选择）
router.get('/mentor-list', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const mentorUsers = await User.find({
      role: 'mentor',
      is_deleted: { $ne: true }
    })
    .select('username nickname phone')
    .sort({ username: 1 });

    res.json({
      success: true,
      mentorList: mentorUsers.map(mentor => ({
        id: mentor._id,
        username: mentor.username,
        nickname: mentor.nickname,
        phone: mentor.phone
      }))
    });

  } catch (error) {
    console.error('获取客服列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取客服列表失败'
    });
  }
});

// 获取主管管理的分配统计
router.get('/stats', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const stats = {
      pendingLeads: await User.countDocuments({
        role: 'part_time',
        mentor_id: null,
        is_deleted: { $ne: true }
      }),
      totalMentors: await User.countDocuments({
        role: 'mentor',
        is_deleted: { $ne: true }
      }),
      assignedUsers: await User.countDocuments({
        role: 'part_time',
        mentor_id: { $ne: null },
        is_deleted: { $ne: true }
      })
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('获取主管统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败'
    });
  }
});

module.exports = router;