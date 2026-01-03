const mongoose = require('mongoose');

// 确保所有模型都被注册
require('./models/User');
require('./models/ImageReview');
require('./models/TaskConfig');
require('./models/Device');
require('./models/CommentLimit');

const ImageReview = require('./models/ImageReview');
const asyncAiReviewService = require('./services/asyncAiReviewService');

async function reloadPendingReviews() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 查找所有pending状态的审核记录
    const pendingReviews = await ImageReview.find({
      status: 'pending',
      imageType: { $in: ['note', 'comment'] }
    }).select('_id imageType status createdAt');

    console.log(`📋 找到 ${pendingReviews.length} 个待审核任务`);

    // 将任务添加到AI审核队列
    let addedCount = 0;
    for (const review of pendingReviews) {
      try {
        asyncAiReviewService.addToQueue(review._id);
        addedCount++;
        console.log(`✅ 已添加任务 ${review._id} 到队列 (${review.imageType})`);
      } catch (error) {
        console.error(`❌ 添加任务 ${review._id} 失败:`, error.message);
      }
    }

    console.log(`🎉 成功添加 ${addedCount} 个任务到AI审核队列`);

    // 显示服务状态
    console.log('🤖 当前AI审核服务状态:');
    console.log(asyncAiReviewService.getStatus());

    // 等待所有异步任务完成
    console.log('⏳ 等待异步AI审核任务完成...');

    // 定期检查队列状态
    const checkInterval = setInterval(() => {
      const status = asyncAiReviewService.getStatus();
      console.log(`📊 AI审核服务状态 - 队列长度: ${status.queueLength}, 活跃任务: ${status.activeReviews}`);

      if (status.queueLength === 0 && status.activeReviews === 0) {
        console.log('✅ 所有AI审核任务已完成');
        clearInterval(checkInterval);

        // 延迟断开数据库连接，确保所有异步操作都已完成
        setTimeout(async () => {
          console.log('🔌 断开数据库连接');
          await mongoose.disconnect();
          console.log('📪 数据库连接已关闭');
          process.exit(0);
        }, 2000);
      }
    }, 5000); // 每5秒检查一次

    // 设置超时保护，防止无限等待
    setTimeout(async () => {
      console.log('⏰ 等待超时，强制退出');
      clearInterval(checkInterval);
      await mongoose.disconnect();
      process.exit(1);
    }, 300000); // 5分钟超时

  } catch (error) {
    console.error('❌ 重新加载待审核任务失败:', error);
  }
  // 移除 finally 块中的 mongoose.disconnect()，让数据库连接保持开放
}

reloadPendingReviews();