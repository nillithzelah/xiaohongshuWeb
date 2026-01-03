const mongoose = require('mongoose');
const CommentLimit = require('./server/models/CommentLimit');

async function testCommentLimitOnServer() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 服务器数据库连接成功');

    const testNoteUrl = 'https://xiaohongshu.com/test-server-123';
    const testAuthor = '测试服务器昵称';
    const testComment1 = '这是服务器测试评论内容1';
    const testComment2 = '这是服务器测试评论内容2';

    console.log('\n🧪 开始服务器CommentLimit功能测试...');

    // 测试1: 初始状态检查
    console.log('\n📋 测试1: 初始状态检查');
    const initialCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testAuthor, testComment1);
    console.log('初始检查结果:', initialCheck);

    // 测试2: 记录第一条评论审核通过
    console.log('\n📝 测试2: 记录第一条评论审核通过');
    const record1 = await CommentLimit.recordCommentApproval(testNoteUrl, testAuthor, testComment1, '507f1f77bcf86cd799439011');
    console.log('记录结果:', {
      noteUrl: record1.noteUrl,
      authorNickname: record1.authorNickname,
      approvedCommentCount: record1.approvedCommentCount,
      approvedCommentsCount: record1.approvedComments.length
    });

    // 测试3: 记录后检查状态
    console.log('\n📋 测试3: 记录后检查状态');
    const afterFirstCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testAuthor, testComment2);
    console.log('第一次记录后检查结果:', afterFirstCheck);

    // 测试4: 记录第二条评论审核通过
    console.log('\n📝 测试4: 记录第二条评论审核通过');
    const record2 = await CommentLimit.recordCommentApproval(testNoteUrl, testAuthor, testComment2, '507f1f77bcf86cd799439012');
    console.log('记录结果:', {
      noteUrl: record2.noteUrl,
      authorNickname: record2.authorNickname,
      approvedCommentCount: record2.approvedCommentCount,
      approvedCommentsCount: record2.approvedComments.length
    });

    // 测试5: 检查第三条评论（应该被拒绝 - 超过次数限制）
    console.log('\n📋 测试5: 检查第三条评论（应该被拒绝）');
    const thirdCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testAuthor, '这是第三条评论内容');
    console.log('第三次检查结果:', thirdCheck);

    // 测试6: 检查内容重复（应该被拒绝）
    console.log('\n📋 测试6: 检查内容重复（应该被拒绝）');
    const duplicateCheck = await CommentLimit.checkCommentApproval(testNoteUrl, testAuthor, testComment1);
    console.log('内容重复检查结果:', duplicateCheck);

    // 测试7: 检查不同昵称（应该允许）
    console.log('\n📋 测试7: 检查不同昵称（应该允许）');
    const differentAuthorCheck = await CommentLimit.checkCommentApproval(testNoteUrl, '不同服务器昵称', '这是不同昵称的评论');
    console.log('不同昵称检查结果:', differentAuthorCheck);

    // 测试8: 检查不同链接（应该允许）
    console.log('\n📋 测试8: 检查不同链接（应该允许）');
    const differentUrlCheck = await CommentLimit.checkCommentApproval('https://xiaohongshu.com/different-server-456', testAuthor, '这是不同链接的评论');
    console.log('不同链接检查结果:', differentUrlCheck);

    console.log('\n✅ 服务器CommentLimit功能测试完成！');

    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
    await CommentLimit.deleteMany({
      noteUrl: testNoteUrl
    });
    console.log('✅ 测试数据已清理');

    await mongoose.disconnect();
    console.log('✅ 数据库连接已关闭');

  } catch (error) {
    console.error('❌ 服务器测试失败:', error);
  }
}

// 只有在直接运行此脚本时才执行测试
if (require.main === module) {
  testCommentLimitOnServer();
}

module.exports = { testCommentLimitOnServer };