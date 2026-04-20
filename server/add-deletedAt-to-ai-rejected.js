#!/usr/bin/env node
/**
 * 为 ai_rejected 笔记补充 deletedAt 字段
 * 使用 updatedAt 作为时间参考
 */
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 为 ai_rejected 笔记补充 deletedAt');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 使用 updatedAt 作为 deletedAt
  const result = await db.collection('discoverednotes').updateMany(
    {
      noteStatus: 'ai_rejected',
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    },
    {
      $set: {
        deletedAt: new Date(),  // 使用当前时间作为标记时间
        needsCommentHarvest: false
      }
    }
  );

  console.log(`✅ 已更新: ${result.modifiedCount} 条笔记`);

  // 验证结果
  const withDeletedAt = await db.collection('discoverednotes').countDocuments({
    noteStatus: 'ai_rejected',
    deletedAt: { $exists: true, $ne: null }
  });

  console.log(`\n验证: 有 deletedAt 的 ai_rejected: ${withDeletedAt} 条`);

  await mongoose.disconnect();
}

main().catch(console.error);
