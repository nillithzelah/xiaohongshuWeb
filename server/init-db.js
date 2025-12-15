const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
const User = require('./models/User');
const Device = require('./models/Device');

// 测试图片URL
const testImages = [
  'https://picsum.photos/400/300?random=1',
  'https://picsum.photos/400/300?random=2',
  'https://picsum.photos/400/300?random=3',
  'https://picsum.photos/400/300?random=4',
  'https://picsum.photos/400/300?random=5',
  'https://picsum.photos/400/300?random=6',
  'https://picsum.photos/400/300?random=7',
  'https://picsum.photos/400/300?random=8',
  'https://picsum.photos/400/300?random=9',
  'https://picsum.photos/400/300?random=10'
];

// 价格和佣金配置函数
function getPriceByType(imageType) {
  const priceMap = {
    'customer_resource': 10.00,
    'note': 8.00,
    'comment': 3.00
  };
  return priceMap[imageType] || 0;
}

function getCommission1ByType(imageType) {
  const commissionMap = {
    'customer_resource': 1.0,
    'note': 0.8,
    'comment': 0.3
  };
  return commissionMap[imageType] || 0;
}

function getCommission2ByType(imageType) {
  // 二级佣金通常是一级佣金的50%
  return getCommission1ByType(imageType) * 0.5;
}

async function initTestData() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 清空现有数据
    await ImageReview.deleteMany({});
    await User.deleteMany({});
    await Device.deleteMany({});
    console.log('🗑️  清除现有数据完成');

    // 创建测试用户
    const users = [
      // 兼职用户
      { username: 'user001', nickname: '张三', role: 'part_time', points: 100, totalEarnings: 150 },
      { username: 'user002', nickname: '李四', role: 'part_time', points: 200, totalEarnings: 300 },
      { username: 'user003', nickname: '王五', role: 'part_time', points: 50, totalEarnings: 80 },
      { username: 'user004', nickname: '赵六', role: 'part_time', points: 150, totalEarnings: 200 },
      { username: 'user005', nickname: '孙七', role: 'part_time', points: 300, totalEarnings: 450 },

      // 带教老师
      { username: 'cs001', nickname: '带教老师小王', role: 'mentor', password: '123456' },
      { username: 'cs002', nickname: '带教老师小李', role: 'mentor', password: '123456' },

      // 主管
      { username: 'manager001', nickname: '主管张总', role: 'manager', password: '123456' },

      // 老板
      { username: 'boss001', nickname: '老板王总', role: 'boss', password: '123456' },

      // 财务
      { username: 'finance001', nickname: '财务小刘', role: 'finance', password: '123456' }
    ];

    const createdUsers = await User.insertMany(users);
    console.log('👥 创建用户完成');

    // 获取用户ID映射
    const userMap = {};
    createdUsers.forEach(user => {
      userMap[user.role + user.username.slice(-3)] = user._id;
    });

    // 创建测试设备
    const devices = [
      { accountName: 'device001', assignedUser: userMap['user001'], status: 'online', influence: 'new', onlineDuration: 120, points: 0, remark: '测试设备1' },
      { accountName: 'device002', assignedUser: userMap['user002'], status: 'offline', influence: 'old', onlineDuration: 300, points: 0, remark: '测试设备2' },
      { accountName: 'device003', assignedUser: userMap['user003'], status: 'protected', influence: 'real_name', onlineDuration: 500, points: 0, remark: '测试设备3' },
      { accountName: 'device004', assignedUser: userMap['user004'], status: 'frozen', influence: 'opened_shop', onlineDuration: 800, points: 0, remark: '测试设备4' },
      { accountName: 'device005', assignedUser: userMap['user005'], status: 'online', influence: 'new', onlineDuration: 150, points: 0, remark: '测试设备5' }
    ];

    const createdDevices = await Device.insertMany(devices.map(device => ({
      ...device,
      createdBy: userMap['manager001'] // 主管创建的设备
    })));
    console.log('📱 创建设备完成');

    // 创建审核记录 - 模拟完整的审核流程
    const reviews = [];

    // 1. 待审核状态 (pending)
    for (let i = 0; i < 5; i++) {
      const device = createdDevices[i % createdDevices.length];
      const imageType = ['customer_resource', 'note', 'comment'][i % 3];
      reviews.push({
        userId: createdUsers[i]._id,
        imageUrls: [testImages[i]], // 多图格式：单图也存储为数组
        imageType: imageType,
        imageMd5s: [`test_md5_${i}_${Date.now()}`], // 多图MD5格式
        snapshotPrice: getPriceByType(imageType),
        snapshotCommission1: getCommission1ByType(imageType),
        snapshotCommission2: getCommission2ByType(imageType),
        status: 'pending',
        deviceInfo: {
          accountName: device.accountName,
          status: device.status,
          influence: device.influence
        },
        auditHistory: [{
          operator: createdUsers[i]._id,
          operatorName: createdUsers[i].nickname,
          action: 'submit',
          comment: '提交审核',
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // 随机过去7天内
        }]
      });
    }

    // 2. 带教老师已审核状态 (cs_approved)
    for (let i = 5; i < 8; i++) {
      const approved = Math.random() > 0.3; // 70%通过率
      const csUser = createdUsers.find(u => u.role === 'mentor');
      const device = createdDevices[i % createdDevices.length];
      const imageType = ['customer_resource', 'note', 'comment'][i % 3];
      reviews.push({
        userId: createdUsers[i % 5]._id,
        imageUrls: [testImages[i]], // 多图格式
        imageType: imageType,
        imageMd5s: [`test_md5_${i}_${Date.now()}`], // 多图MD5格式
        snapshotPrice: getPriceByType(imageType),
        snapshotCommission1: getCommission1ByType(imageType),
        snapshotCommission2: getCommission2ByType(imageType),
        status: approved ? 'mentor_approved' : 'rejected',
        deviceInfo: {
          accountName: device.accountName,
          status: device.status,
          influence: device.influence
        },
        mentorReview: {
          reviewer: csUser._id,
          approved: approved,
          comment: approved ? '审核通过，图片清晰' : '审核驳回，图片不符合要求',
          reviewedAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000) // 随机过去3天内
        },
        auditHistory: [
          {
            operator: createdUsers[i % 5]._id,
            operatorName: createdUsers[i % 5].nickname,
            action: 'submit',
            comment: '提交审核',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
          },
          {
            operator: csUser._id,
            operatorName: csUser.nickname,
            action: approved ? 'mentor_pass' : 'mentor_reject',
            comment: approved ? '审核通过，图片清晰' : '审核驳回，图片不符合要求',
            timestamp: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000)
          }
        ]
      });
    }

    // 3. 主管审核中状态 (cs_approved)
    for (let i = 8; i < 10; i++) {
      const csUser = createdUsers.find(u => u.role === 'mentor');
      const device = createdDevices[i % createdDevices.length];
      const imageType = ['customer_resource', 'note', 'comment'][i % 3];
      reviews.push({
        userId: createdUsers[i % 5]._id,
        imageUrls: [testImages[i]], // 多图格式
        imageType: imageType,
        imageMd5s: [`test_md5_${i}_${Date.now()}`], // 多图MD5格式
        snapshotPrice: getPriceByType(imageType),
        snapshotCommission1: getCommission1ByType(imageType),
        snapshotCommission2: getCommission2ByType(imageType),
        status: 'mentor_approved',
        deviceInfo: {
          accountName: device.accountName,
          status: device.status,
          influence: device.influence
        },
        mentorReview: {
          reviewer: csUser._id,
          approved: true,
          comment: '带教老师审核通过，提交主管确认',
          reviewedAt: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000)
        },
        auditHistory: [
          {
            operator: createdUsers[i % 5]._id,
            operatorName: createdUsers[i % 5].nickname,
            action: 'submit',
            comment: '提交审核',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
          },
          {
            operator: csUser._id,
            operatorName: csUser.nickname,
            action: 'mentor_pass',
            comment: '带教老师审核通过，提交主管确认',
            timestamp: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000)
          }
        ]
      });
    }

    // 4. 已完成状态 (completed)
    for (let i = 10; i < 12; i++) {
      const csUser = createdUsers.find(u => u.role === 'mentor');
      const managerUser = createdUsers.find(u => u.role === 'manager');
      const financeUser = createdUsers.find(u => u.role === 'finance');
      const device = createdDevices[i % createdDevices.length];
      const imageType = ['customer_resource', 'note', 'comment'][i % 3];

      reviews.push({
        userId: createdUsers[i % 5]._id,
        imageUrls: [testImages[i % 10]], // 多图格式
        imageType: imageType,
        imageMd5s: [`test_md5_${i}_${Date.now()}`], // 多图MD5格式
        snapshotPrice: getPriceByType(imageType),
        snapshotCommission1: getCommission1ByType(imageType),
        snapshotCommission2: getCommission2ByType(imageType),
        status: 'completed',
        deviceInfo: {
          accountName: device.accountName,
          status: device.status,
          influence: device.influence
        },
        mentorReview: {
          reviewer: csUser._id,
          approved: true,
          comment: '审核通过',
          reviewedAt: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000)
        },
        managerApproval: {
          approved: true,
          comment: '主管确认通过',
          approvedAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000)
        },
        financeProcess: {
          amount: getPriceByType(imageType), // 使用实际价格
          commission: getCommission1ByType(imageType), // 使用一级佣金
          processedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
        },
        auditHistory: [
          {
            operator: createdUsers[i % 5]._id,
            operatorName: createdUsers[i % 5].nickname,
            action: 'submit',
            comment: '提交审核',
            timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
          },
          {
            operator: csUser._id,
            operatorName: csUser.nickname,
            action: 'mentor_pass',
            comment: '带教老师审核通过',
            timestamp: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000)
          },
          {
            operator: managerUser._id,
            operatorName: managerUser.nickname,
            action: 'manager_approve',
            comment: '主管确认通过',
            timestamp: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000)
          },
          {
            operator: financeUser._id,
            operatorName: financeUser.nickname,
            action: 'finance_process',
            comment: '财务处理完成',
            timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000)
          }
        ]
      });
    }

    await ImageReview.insertMany(reviews);
    console.log('📋 创建审核记录完成');

    // 统计信息
    const stats = {
      totalUsers: createdUsers.length,
      totalDevices: createdDevices.length,
      totalReviews: reviews.length,
      pendingReviews: reviews.filter(r => r.status === 'pending').length,
      mentorReviewed: reviews.filter(r => r.status === 'mentor_approved').length,
      managerReview: reviews.filter(r => r.status === 'mentor_approved').length,
      completed: reviews.filter(r => r.status === 'completed').length,
      rejected: reviews.filter(r => r.status === 'rejected').length
    };

    console.log('\n📊 数据统计:');
    console.log(`👥 用户数量: ${stats.totalUsers}`);
    console.log(`📱 设备数量: ${stats.totalDevices}`);
    console.log(`📋 审核记录总数: ${stats.totalReviews}`);
    console.log(`⏳ 待审核: ${stats.pendingReviews}`);
    console.log(`✅ 带教老师已审核: ${stats.mentorReviewed}`);
    console.log(`👔 主管审核中: ${stats.managerReview}`);
    console.log(`💰 已完成: ${stats.completed}`);
    console.log(`❌ 已驳回: ${stats.rejected}`);

    console.log('\n🎉 测试数据初始化完成！');
    console.log('💡 现在可以登录不同角色账号测试审核功能了');

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ 初始化测试数据失败:', error);
    process.exit(1);
  }
}

initTestData();