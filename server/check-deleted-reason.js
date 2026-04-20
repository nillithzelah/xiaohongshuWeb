#!/usr/bin/env node
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);

  const notes = await DiscoveredNote.find({
    noteStatus: 'deleted',
    'aiAnalysis.is_genuine_victim_post': false
  }).limit(10);

  console.log('deleted (AI判断为false) 的笔记:');
  console.log('');

  for (const note of notes) {
    console.log(`noteId: ${note.noteId}`);
    console.log(`  标题: ${note.title}`);
    console.log(`  创建时间: ${note.createdAt}`);
    console.log(`  删除时间: ${note.deletedAt}`);
    console.log(`  时间差: ${note.deletedAt && note.createdAt ? Math.round((note.deletedAt - note.createdAt) / 1000) + '秒' : '未知'}`);
    console.log(`  AI结果: ${note.aiAnalysis?.is_genuine_victim_post}`);
    console.log(`  AI理由: ${note.aiAnalysis?.reason?.substring(0, 50) || '无'}...`);
    console.log('');
  }

  await mongoose.disconnect();
}

main().catch(console.error);
