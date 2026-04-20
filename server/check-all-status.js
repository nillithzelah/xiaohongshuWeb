#!/usr/bin/env node
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 所有状态统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const all = await db.collection('discoverednotes').aggregate([
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  for (const s of all) {
    console.log(`  ${s._id || 'null'.padEnd(20)} : ${s.count} 条`);
  }

  // 检查 AI 判断为 false 的笔记按状态分组
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AI判断为false的笔记按状态分组');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const aiFalseByStatus = await db.collection('discoverednotes').aggregate([
    { $match: { 'aiAnalysis.is_genuine_victim_post': false } },
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } }
  ]).toArray();

  let aiFalseTotal = 0;
  for (const s of aiFalseByStatus) {
    console.log(`  ${s._id || 'null'.padEnd(20)} : ${s.count} 条`);
    aiFalseTotal += s.count;
  }
  console.log(`  总计: ${aiFalseTotal} 条`);

  // 检查 AI 判断为 true 的笔记按状态分组
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 AI判断为true的笔记按状态分组');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const aiTrueByStatus = await db.collection('discoverednotes').aggregate([
    { $match: { 'aiAnalysis.is_genuine_victim_post': true } },
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } }
  ]).toArray();

  let aiTrueTotal = 0;
  for (const s of aiTrueByStatus) {
    console.log(`  ${s._id || 'null'.padEnd(20)} : ${s.count} 条`);
    aiTrueTotal += s.count;
  }
  console.log(`  总计: ${aiTrueTotal} 条`);

  await mongoose.disconnect();
}

main().catch(console.error);
