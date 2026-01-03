/**
 * 测试评论昵称限制功能
 * 验证一个昵称在一个笔记链接下最多只能发两条审核通过的评论
 * 使用 CommentLimit 模型替代废弃的 SubmissionTracker
 */

const mongoose = require('mongoose');
const CommentLimit = require('./server/models/CommentLimit');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 测试评论限制功能
async function testCommentLimit() {
  console.log('🧪 开始测试评论昵称限制功能（使用CommentLimit）...\n');

  const testNoteUrl = 'https://xiaohongshu.com/test-note-123';
  const testNickname = '测试用户';
  const testComment1 = '这是第一条测试评论内容';
  const testComment2 = '这是第二条测试评论内容';
  const testComment3 = '这是第三条测试评论内容';

  try {
    // 清理测试数据
    console.log('🧹 清理测试数据...');
    await CommentLimit.deleteMany({
      noteUrl: testNoteUrl,
      authorNickname: testNickname
    });

    // 测试1: 初始状态，应该允许审核通过
    console.log('📝 测试1: 初始状态检查');
    const initialCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testNickname, testComment1);
    console.log('初始检查结果:', initialCheck);

    if (initialCheck.canApprove && initialCheck.currentCount === 0) {
      console.log('✅ 初始状态正确：可以审核通过，当前计数为0');
    } else {
      console.log('❌ 初始状态错误：', initialCheck);
    }

    // 模拟第一次审核通过
    console.log('\n📝 测试2: 记录第一次审核通过');
    const record1 = await CommentLimit.recordCommentApproval(testNoteUrl, testNickname, testComment1, 'test_review_id_1');
    console.log('记录结果:', {
      approvedCommentCount: record1.approvedCommentCount,
      approvedCommentsCount: record1.approvedComments.length
    });

    // 测试3: 第一次审核通过后检查状态
    console.log('\n📝 测试3: 第一次审核通过后检查');
    const afterFirstCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testNickname, testComment2);
    console.log('第一次审核通过后检查结果:', afterFirstCheck);

    if (afterFirstCheck.canApprove && afterFirstCheck.currentCount === 1) {
      console.log('✅ 第一次审核通过后状态正确：还可以审核通过，当前计数为1');
    } else {
      console.log('❌ 第一次审核通过后状态错误：', afterFirstCheck);
    }

    // 模拟第二次审核通过
    console.log('\n📝 测试4: 记录第二次审核通过');
    const record2 = await CommentLimit.recordCommentApproval(testNoteUrl, testNickname, testComment2, 'test_review_id_2');
    console.log('记录结果:', {
      approvedCommentCount: record2.approvedCommentCount,
      approvedCommentsCount: record2.approvedComments.length
    });

    // 测试5: 第二次审核通过后检查（应该达到上限）
    console.log('\n📝 测试5: 第二次审核通过后检查（应该被限制）');
    const afterSecondCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testNickname, testComment3);
    console.log('第二次审核通过后检查结果:', afterSecondCheck);

    if (!afterSecondCheck.canApprove && afterSecondCheck.currentCount === 2) {
      console.log('✅ 第二次审核通过后正确被限制，当前计数为2');
    } else {
      console.log('❌ 第二次审核通过后限制检查失败：', afterSecondCheck);
    }

    // 测试6: 内容重复检查（应该被拒绝）
    console.log('\n📝 测试6: 内容重复检查（应该被拒绝）');
    const duplicateCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testNickname, testComment1);
    console.log('内容重复检查结果:', duplicateCheck);

    if (!duplicateCheck.canApprove && duplicateCheck.isContentDuplicate) {
      console.log('✅ 内容重复正确被拒绝');
    } else {
      console.log('❌ 内容重复检查失败：', duplicateCheck);
    }

    // 测试7: 不同昵称应该不受影响
    console.log('\n📝 测试7: 不同昵称不受影响');
    const differentNicknameCheck = await CommentLimit.checkCommentApproval(testNoteUrl, '不同用户', '不同用户的评论');
    console.log('不同昵称检查结果:', differentNicknameCheck);

    if (differentNicknameCheck.canApprove && differentNicknameCheck.currentCount === 0) {
      console.log('✅ 不同昵称正确不受影响');
    } else {
      console.log('❌ 不同昵称错误受到影响：', differentNicknameCheck);
    }

    // 测试8: 不同链接应该不受影响
    console.log('\n📝 测试8: 不同链接不受影响');
    const differentUrlCheck = await CommentLimit.checkCommentApproval('https://xiaohongshu.com/different-note-456', testNickname, '不同链接的评论');
    console.log('不同链接检查结果:', differentUrlCheck);

    if (differentUrlCheck.canApprove && differentUrlCheck.currentCount === 0) {
      console.log('✅ 不同链接正确不受影响');
    } else {
      console.log('❌ 不同链接错误受到影响：', differentUrlCheck);
    }

    console.log('\n🎉 所有测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 主函数
async function main() {
  await connectDB();
  await testCommentLimit();

  // 关闭数据库连接
  await mongoose.connection.close();
  console.log('📪 数据库连接已关闭');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testCommentLimit };