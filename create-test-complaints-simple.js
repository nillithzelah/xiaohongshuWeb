const mongoose = require('mongoose');
const Complaint = require('./server/models/Complaint');

// 连接到数据库
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB 连接成功');
    createTestComplaints();
  })
  .catch((error) => {
    console.error('❌ MongoDB 连接失败:', error.message);
    process.exit(1);
  });

async function createTestComplaints() {
  try {
    // 创建测试投诉数据
    const testComplaints = [
      {
        userId: '694cef9c6e4e2580b6da1188', // 兼职用户
        content: '测试投诉：平台结算延迟，已经等了3天还没到账',
        status: 'pending'
      },
      {
        userId: '694cef9c6e4e2580b6da1188', // 兼职用户
        content: '测试投诉：任务要求不明确，导致我重复提交多次',
        status: 'processing'
      },
      {
        userId: '694cef9c6e4e2580b6da1188', // 兼职用户
        content: '测试投诉：带教老师态度不好，不耐心解答问题',
        status: 'resolved',
        adminResponse: '已经与带教老师沟通，会改进服务态度',
        respondedBy: '693d29b5cbc188007ecc5847', // 主管
        respondedAt: new Date()
      }
    ];

    // 插入测试数据
    const result = await Complaint.insertMany(testComplaints);
    console.log(`✅ 已成功创建 ${result.length} 条测试投诉数据`);
    console.log('📋 创建的投诉ID:', result.map(c => c._id));

    // 查询所有投诉以验证
    const allComplaints = await Complaint.find().populate('userId', 'username nickname phone');
    console.log(`📊 当前数据库中共有 ${allComplaints.length} 条投诉`);

    process.exit(0);
  } catch (error) {
    console.error('❌ 创建测试投诉数据失败:', error);
    process.exit(1);
  }
}