const mongoose = require('mongoose');
const CommentLimit = require('./models/CommentLimit');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 测试评论限制功能
async function testCommentLimit() {
  try {
    const userId = '693d29b5cbc188007ecc5848'; // 测试用户ID
    const noteUrl = 'https://www.xiaohongshu.com/explore/test123'; // 测试链接
    const authorNickname = '测试用户001'; // 测试昵称

    console.log('🧪 开始测试评论限制功能...');
    console.log(`用户ID: ${userId}`);
    console.log(`链接: ${noteUrl}`);
    console.log(`昵称: ${authorNickname}`);

    // 测试1: 检查初始状态（应该允许审核通过）
    console.log('\n📋 测试1: 检查初始状态');
    const initialCheck = await CommentLimit.checkCommentApproval(noteUrl, authorNickname, '这是第一条评论内容');
    console.log('初始检查结果:', initialCheck);

    // 测试2: 记录第一条评论审核通过
    console.log('\n📝 测试2: 记录第一条评论审核通过');
    const record1 = await CommentLimit.recordCommentApproval(noteUrl, authorNickname, '这是第一条评论内容', '507f1f77bcf86cd799439011');
    console.log('记录结果:', {
      approvedCommentCount: record1.approvedCommentCount,
      lastApprovedAt: record1.lastApprovedAt
    });

    // 测试3: 再次检查（应该仍然允许审核通过）
    console.log('\n📋 测试3: 记录后检查状态');
    const afterFirstCheck = await CommentLimit.checkCommentApproval(noteUrl, authorNickname, '这是第二条评论内容');
    console.log('第一次记录后检查结果:', afterFirstCheck);

    // 测试4: 记录第二条评论审核通过
    console.log('\n📝 测试4: 记录第二条评论审核通过');
    const record2 = await CommentLimit.recordCommentApproval(noteUrl, authorNickname, '这是第二条评论内容', '507f1f77bcf86cd799439012');
    console.log('记录结果:', {
      approvedCommentCount: record2.approvedCommentCount,
      lastApprovedAt: record2.lastApprovedAt
    });

    // 测试5: 检查第三条评论（应该被拒绝 - 超过次数限制）
    console.log('\n📋 测试5: 检查第三条评论（应该被拒绝）');
    const thirdCheck = await CommentLimit.checkCommentApproval(noteUrl, authorNickname, '这是第三条评论内容');
    console.log('第三次检查结果:', thirdCheck);

    // 测试6: 检查内容重复（应该被拒绝）
    console.log('\n📋 测试6: 检查内容重复（应该被拒绝）');
    const duplicateCheck = await CommentLimit.checkCommentApproval(noteUrl, authorNickname, '这是第一条评论内容');
    console.log('内容重复检查结果:', duplicateCheck);

    // 测试7: 检查不同昵称（应该允许）
    console.log('\n📋 测试7: 检查不同昵称（应该允许）');
    const differentAuthorCheck = await CommentLimit.checkCommentApproval(noteUrl, '不同昵称', '这是不同昵称的评论');
    console.log('不同昵称检查结果:', differentAuthorCheck);

    // 测试8: 检查不同链接（应该允许）
    console.log('\n📋 测试8: 检查不同链接（应该允许）');
    const differentUrlCheck = await CommentLimit.checkCommentApproval('https://www.xiaohongshu.com/explore/different', authorNickname, '这是不同链接的评论');
    console.log('不同链接检查结果:', differentUrlCheck);

    console.log('\n✅ 所有测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 清理测试数据
async function cleanupTestData() {
  try {
    console.log('🧹 清理测试数据...');
    const noteUrl = 'https://www.xiaohongshu.com/explore/test123';
    const authorNickname = '测试用户001';

    await CommentLimit.deleteMany({
      noteUrl: noteUrl,
      authorNickname: authorNickname
    });

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理测试数据失败:', error);
  }
}

// 主函数
async function main() {
  await connectDB();

  const args = process.argv.slice(2);
  if (args.includes('--cleanup')) {
    await cleanupTestData();
  } else {
    await testCommentLimit();
  }

  await mongoose.disconnect();
  console.log('📪 数据库连接已关闭');
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testCommentLimit, cleanupTestData };