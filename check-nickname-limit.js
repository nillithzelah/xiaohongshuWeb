const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

// 检查昵称7天使用限制
async function checkNicknameLimit(nickname, userId) {
  try {
    console.log(`🔍 检查昵称 "${nickname}" 的7天使用限制，用户ID: ${userId}`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log(`📅 7天前时间: ${sevenDaysAgo.toISOString()}`);

    const recentReview = await ImageReview.findOne({
      'aiParsedNoteInfo.author': nickname,
      userId: userId,
      status: { $in: ['manager_approved', 'completed'] },
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 });

    if (recentReview) {
      console.log(`❌ 发现最近使用记录:`);
      console.log(`   审核ID: ${recentReview._id}`);
      console.log(`   状态: ${recentReview.status}`);
      console.log(`   创建时间: ${recentReview.createdAt.toISOString()}`);
      console.log(`   天数差: ${Math.floor((Date.now() - recentReview.createdAt.getTime()) / (1000 * 60 * 60 * 24))}天`);
      return {
        canUse: false,
        reason: `昵称"${nickname}"在7天内已经被使用过`,
        lastUsed: recentReview.createdAt
      };
    } else {
      console.log(`✅ 昵称 "${nickname}" 在7天内未被使用，可以使用`);
      return {
        canUse: true,
        reason: '昵称可用'
      };
    }
  } catch (error) {
    console.error('检查昵称限制失败:', error);
    return {
      canUse: false,
      reason: '检查失败: ' + error.message
    };
  }
}

// 检查用户的所有审核记录
async function checkUserReviews(userId) {
  try {
    console.log(`📊 查询用户 ${userId} 的所有审核记录`);

    // 查询所有状态的记录，包括失败的
    const reviews = await ImageReview.find({
      userId: userId
    }).select('aiParsedNoteInfo.author status createdAt noteUrl rejectionReason auditHistory imageType').sort({ createdAt: -1 }).limit(20);

    console.log(`📋 找到 ${reviews.length} 条审核记录（最近20条）:`);

    reviews.forEach((review, index) => {
      const author = review.aiParsedNoteInfo?.author;
      const daysAgo = Math.floor((Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`\n${index + 1}. 审核ID: ${review._id}`);
      console.log(`   类型: ${review.imageType}`);
      console.log(`   状态: ${review.status}`);
      console.log(`   昵称: ${author || '无'}`);
      console.log(`   时间: ${review.createdAt.toISOString()} (${daysAgo}天前)`);
      console.log(`   链接: ${review.noteUrl || '无'}`);

      if (review.rejectionReason) {
        console.log(`   拒绝原因: ${review.rejectionReason}`);
      }

      // 检查auditHistory中的AI审核相关记录
      const aiHistory = review.auditHistory?.filter(h => h.action?.includes('ai') || h.comment?.includes('AI'));
      if (aiHistory && aiHistory.length > 0) {
        console.log(`   AI审核历史:`);
        aiHistory.forEach(h => {
          console.log(`     - ${h.timestamp?.toISOString()}: ${h.comment}`);
        });
      }
    });

    // 统计昵称使用情况
    const nicknameStats = {};
    const passedReviews = reviews.filter(r => ['manager_approved', 'completed'].includes(r.status));
    passedReviews.forEach(review => {
      const author = review.aiParsedNoteInfo?.author;
      if (author) {
        if (!nicknameStats[author]) {
          nicknameStats[author] = [];
        }
        nicknameStats[author].push({
          id: review._id,
          status: review.status,
          createdAt: review.createdAt,
          noteUrl: review.noteUrl
        });
      }
    });

    console.log('\n📈 昵称使用统计（仅审核通过的）:');
    Object.keys(nicknameStats).forEach(nickname => {
      const records = nicknameStats[nickname];
      console.log(`\n昵称: "${nickname}" - 使用次数: ${records.length}`);
      records.forEach((record, index) => {
        const daysAgo = Math.floor((Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  ${index + 1}. ${record.createdAt.toISOString()} (${daysAgo}天前) - ${record.status}`);
      });
    });

    return { reviews, nicknameStats };
  } catch (error) {
    console.error('查询用户审核记录失败:', error);
    return { reviews: [], nicknameStats: {} };
  }
}

// 主函数
async function main() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 从命令行参数获取用户ID和昵称
    const userId = process.argv[2];
    const nickname = process.argv[3];

    if (!userId) {
      console.log('❌ 请提供用户ID作为参数');
      console.log('用法: node check-nickname-limit.js <userId> [nickname]');
      process.exit(1);
    }

    // 检查用户的所有审核记录
    await checkUserReviews(userId);

    // 如果提供了昵称，检查限制
    if (nickname) {
      console.log('\n' + '='.repeat(50));
      const limitResult = await checkNicknameLimit(nickname, userId);
      console.log('\n🎯 检查结果:', limitResult);
    }

  } catch (error) {
    console.error('执行失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 数据库连接已关闭');
  }
}

main();