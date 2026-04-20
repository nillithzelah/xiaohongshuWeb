#!/usr/bin/env node
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  // 检查 ai_rejected 笔记的 deletedAt 情况
  const withDeletedAt = await db.collection('discoverednotes').countDocuments({
    noteStatus: 'ai_rejected',
    deletedAt: { $exists: true, $ne: null }
  });

  const withoutDeletedAt = await db.collection('discoverednotes').countDocuments({
    noteStatus: 'ai_rejected',
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  });

  console.log('ai_rejected 笔记:');
  console.log(`  有 deletedAt: ${withDeletedAt} 条`);
  console.log(`  无 deletedAt: ${withoutDeletedAt} 条`);

  // 看一个示例
  const sample = await db.collection('discoverednotes').findOne({
    noteStatus: 'ai_rejected'
  });
  if (sample) {
    console.log('\n示例:');
    console.log(`  noteId: ${sample.noteId}`);
    console.log(`  deletedAt: ${sample.deletedAt}`);
    console.log(`  noteStatus: ${sample.noteStatus}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
