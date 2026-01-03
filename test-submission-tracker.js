/*
 * 此测试文件已被废弃
 * SubmissionTracker 模型已被 CommentLimit 模型替代
 * 请使用 test-comment-limit.js 进行评论限制功能测试
 */

/*
const mongoose = require('mongoose');
const SubmissionTracker = require('./server/models/SubmissionTracker');

async function testSubmissionTracker() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库成功');

    // 手动创建一条测试记录
    const testData = {
      noteUrl: 'https://xiaohongshu.com/test123',
      nickname: '测试昵称',
      count: 1,
      comments: ['这是测试评论内容'],
      lastSubmissionTime: new Date()
    };

    const tracker = new SubmissionTracker(testData);
    await tracker.save();

    console.log('✅ 测试记录创建成功:', tracker._id);

    // 查询刚创建的记录
    const found = await SubmissionTracker.findById(tracker._id);
    console.log('📋 查询结果:', {
      id: found._id,
      noteUrl: found.noteUrl,
      nickname: found.nickname,
      count: found.count,
      comments: found.comments,
      lastSubmissionTime: found.lastSubmissionTime
    });

    // 再次更新这条记录（模拟第二次提交）
    await SubmissionTracker.findOneAndUpdate(
      {
        noteUrl: testData.noteUrl,
        nickname: testData.nickname
      },
      {
        $inc: { count: 1 },
        $push: { comments: '这是第二次测试评论内容' },
        $set: { lastSubmissionTime: new Date() }
      },
      {
        upsert: true,
        new: true
      }
    );

    // 查询更新后的记录
    const updated = await SubmissionTracker.findOne({
      noteUrl: testData.noteUrl,
      nickname: testData.nickname
    });

    console.log('📊 更新后结果:', {
      id: updated._id,
      noteUrl: updated.noteUrl,
      nickname: updated.nickname,
      count: updated.count,
      comments: updated.comments,
      lastSubmissionTime: updated.lastSubmissionTime
    });

    // 清理测试数据
    await SubmissionTracker.deleteOne({ _id: tracker._id });
    console.log('🧹 测试数据已清理');

    await mongoose.disconnect();
    console.log('✅ 测试完成，数据库连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testSubmissionTracker();
*/