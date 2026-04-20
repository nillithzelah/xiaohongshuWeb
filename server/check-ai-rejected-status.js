#!/usr/bin/env node
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // 检查 ai_rejected 笔记的 status 分布
  const result = await db.collection('discoverednotes').aggregate([
    { $match: { noteStatus: 'ai_rejected' } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]).toArray();

  console.log('ai_rejected 笔记按 status 分组:');
  for (const r of result) {
    console.log(`  status=${r._id || 'null'}: ${r.count} 条`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
