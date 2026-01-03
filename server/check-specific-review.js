// 检查特定审核记录的详细信息
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function checkSpecificReview(reviewId) {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 查询特定记录
    const review = await ImageReview.findById(reviewId)
      .select('-__v');

    if (!review) {
      console.log(`❌ 找不到ID为 ${reviewId} 的记录`);
      return;
    }

    console.log('\n📋 审核记录详情：\n');
    console.log(`ID: ${review._id}`);
    console.log(`类型: ${review.imageType}`);
    console.log(`状态: ${review.status}`);
    console.log(`链接: ${review.noteUrl}`);
    console.log(`用户ID: ${review.userId}`);
    console.log(`驳回原因: ${review.rejectionReason || '无'}`);
    console.log(`审核尝试次数: ${review.reviewAttempt || 1}`);
    console.log(`提交时间: ${review.createdAt.toISOString()}`);
    console.log(`更新时间: ${review.updatedAt.toISOString()}`);

    if (review.aiReviewResult) {
      console.log('\n🤖 AI审核结果:');
      console.log(`  通过: ${review.aiReviewResult.passed}`);
      console.log(`  置信度: ${review.aiReviewResult.confidence}`);
      console.log(`  风险等级: ${review.aiReviewResult.riskLevel}`);
      if (review.aiReviewResult.reasons) {
        console.log(`  原因: ${review.aiReviewResult.reasons.join('; ')}`);
      }
      if (review.aiReviewResult.commentVerification) {
        console.log(`  评论验证: ${JSON.stringify(review.aiReviewResult.commentVerification, null, 2)}`);
      }
    }

    if (review.userNoteInfo) {
      console.log('\n👤 用户提交信息:');
      console.log(JSON.stringify(review.userNoteInfo, null, 2));
    }

    if (review.aiParsedNoteInfo) {
      console.log('\n🔍 AI解析信息:');
      console.log(JSON.stringify(review.aiParsedNoteInfo, null, 2));
    }

    if (review.auditHistory && review.auditHistory.length > 0) {
      console.log('\n📝 审核历史:');
      review.auditHistory.forEach((history, index) => {
        console.log(`  ${index + 1}. ${history.timestamp.toISOString()} - ${history.action}`);
        console.log(`     操作人: ${history.operatorName || '系统'}`);
        console.log(`     备注: ${history.comment}`);
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// 查询所有被驳回的记录
async function checkAllRejected() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    const rejectedReviews = await ImageReview.find({ status: 'rejected' })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`\n📋 最近 ${rejectedReviews.length} 条驳回记录：\n`);

    rejectedReviews.forEach((review, index) => {
      console.log(`${index + 1}. ID: ${review._id} (短ID: ${review._id.toString().slice(-8)})`);
      console.log(`   类型: ${review.imageType}`);
      console.log(`   状态: ${review.status}`);
      console.log(`   驳回原因: ${review.rejectionReason}`);
      console.log(`   用户ID: ${review.userId}`);
      console.log(`   提交时间: ${review.createdAt.toISOString()}`);
      console.log('   ---');
    });

    // 如果有记录，显示第一条的详细信息
    if (rejectedReviews.length > 0) {
      console.log('\n📋 第一条记录的详细信息：\n');
      await checkSpecificReview(rejectedReviews[0]._id);
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// 从命令行参数获取ID，或者查询所有被驳回记录
const reviewId = process.argv[2];
if (reviewId) {
  checkSpecificReview(reviewId);
} else {
  checkAllRejected();
}