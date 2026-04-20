#!/usr/bin/env node
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);

  // 检查 deleted 状态的笔记中，AI 判断为 false 的数量
  const deletedWithAiFalse = await DiscoveredNote.countDocuments({
    noteStatus: 'deleted',
    'aiAnalysis.is_genuine_victim_post': false
  });

  const deletedWithAiTrue = await DiscoveredNote.countDocuments({
    noteStatus: 'deleted',
    'aiAnalysis.is_genuine_victim_post': true
  });

  const deletedNoAi = await DiscoveredNote.countDocuments({
    noteStatus: 'deleted',
    aiAnalysis: { $exists: false }
  });

  const deletedAiNull = await DiscoveredNote.countDocuments({
    noteStatus: 'deleted',
    'aiAnalysis.is_genuine_victim_post': { $exists: false }
  });

  console.log('deleted 状态笔记分类:');
  console.log(`  AI 判断为 false: ${deletedWithAiFalse} 条 (应改为 ai_rejected)`);
  console.log(`  AI 判断为 true: ${deletedWithAiTrue} 条 (应改为 active)`);
  console.log(`  无 AI 分析: ${deletedNoAi} 条`);
  console.log(`  AI 结果不存在: ${deletedAiNull} 条`);
  console.log(`  总计: ${await DiscoveredNote.countDocuments({ noteStatus: 'deleted' })} 条`);

  await mongoose.disconnect();
}

main().catch(console.error);
