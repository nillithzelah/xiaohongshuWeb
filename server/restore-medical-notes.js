#!/usr/bin/env node
/**
 * 批量恢复被错误拒绝的医美相关笔记
 *
 * 恢复条件：
 * 1. noteStatus = 'ai_rejected'
 * 2. keyword 包含：医美、美容、祛斑、祛痘、丰胸、护肤、眼袋、减肥、育发、增高、HPV
 */

const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 支持的12类关键词
const supportedKeywords = [
  '减肥',
  '医美',
  '祛斑',
  '祛痘',
  '丰胸',
  '护肤',
  '眼袋',
  '育发',
  '玉石',
  '女性调理',
  '增高',
  'HPV',
  // 变体
  '美容',
  '白发',
  '手镯',
  '翡翠',
  '月经'
];

async function main() {
  console.log('🔄 开始连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 统计需要恢复的笔记');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 构建查询条件：noteStatus = ai_rejected 且关键词包含支持的关键词
  const keywordRegex = new RegExp(supportedKeywords.join('|'), 'i');

  // 先统计
  const totalAiRejected = await DiscoveredNote.countDocuments({ noteStatus: 'ai_rejected' });
  const toRestore = await DiscoveredNote.countDocuments({
    noteStatus: 'ai_rejected',
    keyword: { $regex: keywordRegex }
  });

  console.log(`总 ai_rejected 笔记: ${totalAiRejected}`);
  console.log(`符合恢复条件的笔记: ${toRestore}`);
  console.log('');

  if (toRestore === 0) {
    console.log('✅ 没有需要恢复的笔记');
    await mongoose.disconnect();
    return;
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 开始恢复...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // 分批恢复
  const batchSize = 50;
  let processed = 0;

  while (true) {
    const result = await DiscoveredNote.updateMany(
      {
        noteStatus: 'ai_rejected',
        keyword: { $regex: keywordRegex }
      },
      {
        $set: {
          noteStatus: 'active',
          deletedAt: null,
          needsCommentHarvest: true
        }
      },
      { limit: batchSize }
    );

    if (result.modifiedCount === 0) break;

    console.log(`✅ 批次完成: 恢复 ${result.modifiedCount} 条笔记`);
    processed += result.modifiedCount;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 恢复后统计');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const newAiRejected = await DiscoveredNote.countDocuments({ noteStatus: 'ai_rejected' });
  console.log(`恢复后 ai_rejected: ${newAiRejected} (恢复 ${processed} 条)`);
  console.log('');

  // 显示各类别恢复的笔记数
  console.log('📋 各类别恢复情况:');
  for (const keyword of ['医美', '美容', '祛斑', '祛痘', '减肥', '丰胸', '护肤', '眼袋', '育发', '增高', 'HPV', '玉石']) {
    const count = await DiscoveredNote.countDocuments({
      noteStatus: 'active',
      keyword: { $regex: keyword, $options: 'i' }
    });
    console.log(`  ${keyword}: ${count} 条`);
  }

  console.log('');
  console.log('✅ 恢复完成！');

  await mongoose.disconnect();
  console.log('✅ 数据库连接已关闭');
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
