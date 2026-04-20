#!/usr/bin/env node
/**
 * 恢复被错误删除的笔记
 *
 * 恢复条件：
 * 1. noteStatus = 'deleted'
 * 2. aiAnalysis.is_genuine_victim_post = true (AI判断为符合)
 */
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 统计需要恢复的笔记');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const toRestore = await DiscoveredNote.countDocuments({
    noteStatus: 'deleted',
    'aiAnalysis.is_genuine_victim_post': true
  });

  console.log(`需要恢复的笔记数: ${toRestore}`);

  if (toRestore === 0) {
    console.log('✅ 没有需要恢复的笔记');
    await mongoose.disconnect();
    return;
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 开始恢复...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 一次性恢复所有符合条件的笔记
  const result = await DiscoveredNote.updateMany(
    {
      noteStatus: 'deleted',
      'aiAnalysis.is_genuine_victim_post': true
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

  const stats = await DiscoveredNote.aggregate([
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  for (const stat of stats) {
    const status = stat._id || 'null';
    console.log(`  ${status.padEnd(20)} ${stat.count} 条`);
  }

  console.log('');
  console.log(`✅ 恢复完成! 共恢复 ${result.modifiedCount} 条笔记`);

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
