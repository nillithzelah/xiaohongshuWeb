const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
const User = require('./models/User');
const asyncAiReviewService = require('./services/asyncAiReviewService');

// 测试AI审核失败流程
async function testAiReviewFailure() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 创建测试用户
    const testUser = await User.findOne({ username: 'test_user' });
    let userId = testUser ? testUser._id : null;

    if (!userId) {
      const newUser = new User({
        username: 'test_user',
        nickname: '测试用户',
        password: 'hashed_password',
        role: 'part_time',
        points: 100
      });
      await newUser.save();
      userId = newUser._id;
      console.log('✅ 创建测试用户成功');
    }

    // 创建测试审核记录（模拟第二次审核失败的情况）
    const testReview = new ImageReview({
      userId: userId,
      imageUrls: ['https://example.com/test-image.jpg'],
      imageType: 'note', // 测试笔记类型
      snapshotPrice: 8,
      snapshotCommission1: 2,
      snapshotCommission2: 1,
      noteUrl: 'https://xiaohongshu.com/test-note-url',
      userNoteInfo: {
        author: '测试作者',
        title: '测试标题'
      },
      status: 'pending',
      reviewAttempt: 2, // 设置为第二次审核
      createdAt: new Date(Date.now() - 10000) // 创建时间较早
    });

    await testReview.save();
    console.log(`✅ 创建测试审核记录成功，ID: ${testReview._id}`);

    console.log('\n=== 开始测试AI审核失败流程 ===\n');

    // 模拟performFullAiReview返回undefined的情况
    const originalPerformFullAiReview = asyncAiReviewService.performFullAiReview;
    asyncAiReviewService.performFullAiReview = async () => {
      console.log('🔧 模拟performFullAiReview返回undefined');
      return undefined; // 模拟失败
    };

    // 调用审核服务
    console.log(`🤖 开始处理审核任务: ${testReview._id}`);
    await asyncAiReviewService.processReview(testReview._id);

    // 等待处理完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 检查审核结果
    const updatedReview = await ImageReview.findById(testReview._id);
    console.log(`📊 审核结果检查:`);
    console.log(`   状态: ${updatedReview.status}`);
    console.log(`   拒绝原因: ${updatedReview.rejectionReason}`);
    console.log(`   审核历史长度: ${updatedReview.auditHistory.length}`);

    if (updatedReview.auditHistory.length > 0) {
      const lastHistory = updatedReview.auditHistory[updatedReview.auditHistory.length - 1];
      console.log(`   最后审核历史:`);
      console.log(`     操作人: ${lastHistory.operatorName}`);
      console.log(`     动作: ${lastHistory.action}`);
      console.log(`     备注: ${lastHistory.comment}`);
    }

    // 验证结果
    if (updatedReview.status === 'rejected' && updatedReview.rejectionReason === 'AI审核过程异常失败') {
      console.log('✅ 测试通过：第二次审核失败时正确返回rejected状态');
    } else {
      console.log('❌ 测试失败：审核状态未正确更新');
      console.log(`   期望状态: rejected`);
      console.log(`   实际状态: ${updatedReview.status}`);
      console.log(`   期望拒绝原因: AI审核过程异常失败`);
      console.log(`   实际拒绝原因: ${updatedReview.rejectionReason}`);
    }

    // 恢复原始方法
    asyncAiReviewService.performFullAiReview = originalPerformFullAiReview;

    // 清理测试数据
    await ImageReview.findByIdAndDelete(testReview._id);
    console.log('🧹 清理测试数据完成');

    await mongoose.disconnect();
    console.log('🎉 数据库连接已关闭');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testAiReviewFailure();