#!/usr/bin/env node
/**
 * 批量恢复被错误拒绝的赌石相关笔记
 */

const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  console.log('🔄 开始连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 统计需要恢复的赌石笔记');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 统计
  const totalAiRejected = await DiscoveredNote.countDocuments({ noteStatus: 'ai_rejected' });
  const gamblingStoneRejected = await DiscoveredNote.countDocuments({
    noteStatus: 'ai_rejected',
    $or: [
      { keyword: /赌石/ },
      { title: /赌石/ }
    ]
  });

  console.log(`总 ai_rejected 笔记: ${totalAiRejected}`);
  console.log(`赌石相关的 ai_rejected 笔记: ${gamblingStoneRejected}`);
  console.log('');

  if (gamblingStoneRejected === 0) {
    console.log('✅ 没有需要恢复的赌石笔记');
    await mongoose.disconnect();
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 开始恢复...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 恢复所有赌石相关的 ai_rejected 笔记
  const result = await DiscoveredNote.updateMany(
    {
      noteStatus: 'ai_rejected',
      $or: [
        { keyword: /赌石/ },
        { title: /赌石/ }
      ]
    },
    {
      $set: {
        noteStatus: 'active',
        deletedAt: null,
        needsCommentHarvest: true
      }
    }
  );

  console.log(`✅ 恢复完成: ${result.modifiedCount} 条笔记`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 恢复后统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const newAiRejected = await DiscoveredNote.countDocuments({ noteStatus: 'ai_rejected' });
  const activeGamblingStone = await DiscoveredNote.countDocuments({
    noteStatus: 'active',
    $or: [
      { keyword: /赌石/ },
      { title: /赌石/ }
    ]
  });

  console.log(`恢复后 ai_rejected: ${newAiRejected}`);
  console.log(`赌石相关 active 笔记: ${activeGamblingStone}`);
  console.log('');
  console.log('✅ 恢复完成！');

  await mongoose.disconnect();
  console.log('✅ 数据库连接已关闭');
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
