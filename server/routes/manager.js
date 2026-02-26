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
      is_deleted: { $ne: true },
      // 排除小程序自动创建的没有姓名的用户
      nickname: { $ne: null, $ne: '', $exists: true }
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

    // 验证带教老师是否存在且角色正确（允许 mentor 或 manager）
    const mentorUser = await User.findById(mentor_id);
    if (!mentorUser || !['mentor', 'manager'].includes(mentorUser.role)) {
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
      // 优化：批量操作，避免 N+1 查询
      const updateData = {
        assignedUser: leadUser._id,
        mentor_id: mentor_id,
        updatedAt: new Date()
      };

      // 收集需要更新的设备 ID 和需要查找的昵称
      const deviceIdsToUpdate = [];
      const nicknamesToFind = [];
      const accountIndexMap = new Map(); // 映射索引到设备

      for (let i = 0; i < leadUser.xiaohongshuAccounts.length; i++) {
        const account = leadUser.xiaohongshuAccounts[i];
        if (account.deviceId) {
          deviceIdsToUpdate.push(account.deviceId);
          accountIndexMap.set(i, { deviceId: account.deviceId });
        } else {
          nicknamesToFind.push(account.nickname.trim());
          accountIndexMap.set(i, { nickname: account.nickname.trim() });
        }
      }

      // 批量更新已有设备 ID 的设备
      if (deviceIdsToUpdate.length > 0) {
        await Device.updateMany(
          { _id: { $in: deviceIdsToUpdate } },
          updateData
        );
      }

      // 批量查找没有设备 ID 的账号对应的设备
      const devicesToCreate = [];
      if (nicknamesToFind.length > 0) {
        const existingDevices = await Device.find({ accountName: { $in: nicknamesToFind } }).select('_id accountName');
        const existingDeviceMap = new Map(existingDevices.map(d => [d.accountName, d._id]));

        // 更新或创建设备
        for (let i = 0; i < leadUser.xiaohongshuAccounts.length; i++) {
          const account = leadUser.xiaohongshuAccounts[i];
          if (!account.deviceId) {
            const trimmedNickname = account.nickname.trim();
            const existingId = existingDeviceMap.get(trimmedNickname);

            if (existingId) {
              // 批量更新现有设备（已在上面批量处理，这里只需记录ID）
              account.deviceId = existingId;
            } else {
              // 记录需要创建的设备
              devicesToCreate.push({
                accountName: trimmedNickname,
                accountId: account.account,
                assignedUser: leadUser._id,
                mentor_id: mentor_id,
                status: 'online',
                influence: ['new'],
                createdBy: req.user._id
              });
            }
          }
        }

        // 批量创建新设备
        if (devicesToCreate.length > 0) {
          const createdDevices = await Device.insertMany(devicesToCreate);
          const createdDeviceMap = new Map(createdDevices.map(d => [d.accountName, d._id]));

          // 更新账号关联
          for (let i = 0; i < leadUser.xiaohongshuAccounts.length; i++) {
            const account = leadUser.xiaohongshuAccounts[i];
            if (!account.deviceId) {
              const trimmedNickname = account.nickname.trim();
              const newId = createdDeviceMap.get(trimmedNickname);
              if (newId) {
                account.deviceId = newId;
              }
            }
          }
        }
      }

      // 更新账号状态
      for (let i = 0; i < leadUser.xiaohongshuAccounts.length; i++) {
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

// 获取所有带教老师列表（用于分配选择，包括主管）
router.get('/mentor-list', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const mentorUsers = await User.find({
      role: { $in: ['mentor', 'manager'] },
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
        role: { $in: ['mentor', 'manager'] },
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

// HR团队管理 - 获取HR名下的带教老师列表
router.get('/hr-team', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    let query = {
      role: 'mentor',
      is_deleted: { $ne: true }
    };
    
    // 如果有搜索条件
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { nickname: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const mentors = await User.find(query)
      .select('username nickname phone')
      .sort({ username: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await User.countDocuments(query);
    
    res.json({
      success: true,
      mentors,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取HR团队管理列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取HR团队管理列表失败'
    });
  }
});

module.exports = router;