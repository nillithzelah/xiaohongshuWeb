#!/usr/bin/env node
/**
 * 将 deleted 状态中 AI 判断为 false 的笔记改为 ai_rejected
 */
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 将 deleted(AI判断为false) 改为 ai_rejected');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result = await DiscoveredNote.updateMany(
    {
      noteStatus: 'deleted',
      'aiAnalysis.is_genuine_victim_post': false
    },
    {
      $set: {
        noteStatus: 'ai_rejected'
      }
    }
  );

  console.log(`✅ 已修改: ${result.modifiedCount} 条笔记`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 最终状态统计');
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
  console.log('✅ 完成！');

  await mongoose.disconnect();
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
