const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
const User = require('./models/User');
const asyncAiReviewService = require('./services/asyncAiReviewService');

async function testNoteSecondReview() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 创建一个测试笔记审核记录，模拟第二次审核失败的情况
    const testReview = new ImageReview({
      userId: '6952518717cd0e4322fed437', // 使用现有用户ID
      imageType: 'note',
      noteUrl: 'https://www.xiaohongshu.com/discovery/item/test123',
      userNoteInfo: {
        title: '测试笔记标题',
        author: '测试作者'
      },
      status: 'pending',
      reviewAttempt: 2, // 模拟第二次审核
      createdAt: new Date(Date.now() - 5 * 1000), // 创建时间为5秒前，确保超过第二次审核的等待时间
      auditHistory: [{
        operator: null,
        operatorName: '测试用户',
        action: 'submit',
        comment: '测试提交',
        timestamp: new Date(Date.now() - 200 * 1000)
      }]
    });

    await testReview.save();
    console.log(`✅ 创建测试笔记审核记录: ${testReview._id}`);

    // 添加到审核队列
    asyncAiReviewService.addToQueue(testReview._id);
    console.log('✅ 已添加到审核队列');

    // 等待一段时间让审核完成
    console.log('⏳ 等待审核完成...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 检查结果
    const updatedReview = await ImageReview.findById(testReview._id);
    console.log(`📊 审核结果: status=${updatedReview.status}, rejectionReason=${updatedReview.rejectionReason}`);

    // 清理测试数据
    await ImageReview.findByIdAndDelete(testReview._id);
    console.log('🧹 清理测试数据完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 数据库连接已关闭');
  }
}

testNoteSecondReview();