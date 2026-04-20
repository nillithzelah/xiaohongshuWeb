#!/usr/bin/env node
/**
 * 批量修复 AI 分析结果与 noteStatus 不一致的问题
 *
 * 问题：aiAnalysis.is_genuine_victim_post = false 的笔记，noteStatus 应该是 ai_rejected，但实际是 active
 *
 * 运行方式：node server/fix-ai-rejected-status.js
 */

const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

// MongoDB 连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  console.log('🔄 开始连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 统计当前状态');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 统计总数
  const total = await DiscoveredNote.countDocuments();
  const withAI = await DiscoveredNote.countDocuments({ aiAnalysis: { $exists: true } });
  const aiFalse = await DiscoveredNote.countDocuments({ 'aiAnalysis.is_genuine_victim_post': false });
  const aiFalseActive = await DiscoveredNote.countDocuments({
    'aiAnalysis.is_genuine_victim_post': false,
    noteStatus: 'active'
  });
  const aiRejected = await DiscoveredNote.countDocuments({ noteStatus: 'ai_rejected' });

  console.log(`总笔记数: ${total}`);
  console.log(`有 AI 分析: ${withAI}`);
  console.log(`AI 判断为 false: ${aiFalse}`);
  console.log(`AI 判断为 false 但状态仍为 active: ${aiFalseActive} ← 需要修复`);
  console.log(`当前 ai_rejected 状态: ${aiRejected}`);
  console.log('');

  if (aiFalseActive === 0) {
    console.log('✅ 没有需要修复的笔记');
    await mongoose.disconnect();
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 开始修复...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 分批处理，每批 100 条
  const batchSize = 100;
  let processed = 0;
  let hasError = false;

  while (processed < aiFalseActive && !hasError) {
    try {
      const result = await DiscoveredNote.updateMany(
        {
          'aiAnalysis.is_genuine_victim_post': false,
          noteStatus: 'active'
        },
        {
          $set: {
            noteStatus: 'ai_rejected',
            deletedAt: new Date(),
            needsCommentHarvest: false,
            'harvestLock.clientId': null,
            'harvestLock.lockedAt': null,
            'harvestLock.lockedUntil': null,
            lockedBy: null,
            lockedAt: null
          }
        },
        { limit: batchSize }
      );

      console.log(`✅ 批次完成: 修改 ${result.modifiedCount} 条笔记`);
      processed += result.modifiedCount;

      if (result.modifiedCount === 0) break;

      // 短暂延迟避免数据库压力
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ 批次处理失败: ${error.message}`);
      hasError = true;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 修复后统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const newAiRejected = await DiscoveredNote.countDocuments({ noteStatus: 'ai_rejected' });
  const remaining = await DiscoveredNote.countDocuments({
    'aiAnalysis.is_genuine_victim_post': false,
    noteStatus: 'active'
  });

  console.log(`修复后 ai_rejected 状态: ${newAiRejected} (新增 ${newAiRejected - aiRejected})`);
  console.log(`剩余未修复: ${remaining}`);
  console.log('');

  if (remaining === 0) {
    console.log('✅ 修复完成！');
  } else {
    console.log('⚠️  部分笔记未修复，请检查日志');
  }

  await mongoose.disconnect();
  console.log('✅ 数据库连接已关闭');
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
