const mongoose = require('mongoose');
const ImageReview = require('../models/ImageReview');

async function fixAuditActions() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    // 定义旧值到新值的映射
    const actionMapping = {
      'cs_pass': 'mentor_pass',
      'cs_reject': 'mentor_reject'
    };

    // 查找所有包含旧action值的记录
    const reviewsToUpdate = await ImageReview.find({
      'auditHistory.action': { $in: ['cs_pass', 'cs_reject'] }
    });

    console.log(`📊 找到 ${reviewsToUpdate.length} 条需要更新的记录`);

    let updatedCount = 0;

    for (const review of reviewsToUpdate) {
      let modified = false;

      // 更新每条审核历史中的action值
      for (const historyItem of review.auditHistory) {
        if (actionMapping[historyItem.action]) {
          historyItem.action = actionMapping[historyItem.action];
          modified = true;
        }
      }

      if (modified) {
        await review.save();
        updatedCount++;
        console.log(`✅ 更新记录 ${review._id}`);
      }
    }

    console.log(`🎉 完成！共更新了 ${updatedCount} 条记录`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

fixAuditActions();