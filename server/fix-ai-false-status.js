#!/usr/bin/env node
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 修复 AI判断为false 但状态不正确的笔记');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 修复 active + AI判断为false -> ai_rejected
  const r1 = await db.collection('discoverednotes').updateMany(
    { noteStatus: 'active', 'aiAnalysis.is_genuine_victim_post': false },
    { $set: { noteStatus: 'ai_rejected' } }
  );
  console.log(`修复 active -> ai_rejected: ${r1.modifiedCount} 条`);

  // 修复 deleted + AI判断为false -> ai_rejected
  const r2 = await db.collection('discoverednotes').updateMany(
    { noteStatus: 'deleted', 'aiAnalysis.is_genuine_victim_post': false },
    { $set: { noteStatus: 'ai_rejected' } }
  );
  console.log(`修复 deleted -> ai_rejected: ${r2.modifiedCount} 条`);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 修复后状态统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const stats = await db.collection('discoverednotes').aggregate([
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  for (const s of stats) {
    console.log(`  ${s._id || 'null'.padEnd(20)} : ${s.count} 条`);
  }

  console.log('');
  console.log('✅ 修复完成!');

  await mongoose.disconnect();
}

main().catch(console.error);
