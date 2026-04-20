const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });

  const now = new Date();
  const intervals = { 10: 10, 5: 60, 2: 360, 1: 1440 };

  console.log('=== 诊断：哪些笔记应该可采集 ===\n');

  // 与服务器代码完全一致的查询
  const notes = await DiscoveredNote.find({
    needsCommentHarvest: true,
    noteStatus: 'active',
    status: { $in: ['discovered', 'verified'] },
    $or: [
      { 'harvestLock.lockedUntil': { $exists: false } },
      { 'harvestLock.lockedUntil': { $lte: now } },
      { 'harvestLock.lockedUntil': null },
      { harvestLock: { $eq: {} } }
    ]
  })
  .select('noteId harvestPriority commentsHarvestedAt harvestLock createdAt');

  console.log(`总共查询到 ${notes.length} 条笔记\n`);

  let readyCount = 0;
  let lockedCount = 0;
  let notReadyCount = 0;
  let neverHarvested = 0;

  for (const note of notes) {
    // 检查是否被锁定
    const isLocked = note.harvestLock &&
                     note.harvestLock.lockedUntil &&
                     new Date(note.harvestLock.lockedUntil) > now;
    if (isLocked) {
      lockedCount++;
      continue;
    }

    // 从未采集过
    if (!note.commentsHarvestedAt) {
      readyCount++;
      neverHarvested++;
      console.log(`✅ ${note.noteId.slice(-8)} | 从未采集`);
      continue;
    }

    // 检查是否到达采集时间
    const priority = note.harvestPriority || 1;
    const intervalMinutes = intervals[priority] || 1440;
    const nextHarvestTime = new Date(note.commentsHarvestedAt.getTime() + intervalMinutes * 60 * 1000);

    if (now >= nextHarvestTime) {
      readyCount++;
      const waitedMinutes = Math.floor((now - note.commentsHarvestedAt) / 60000);
      console.log(`✅ ${note.noteId.slice(-8)} | 优先级${priority} | 已等${Math.floor(waitedMinutes/60)}h${waitedMinutes%60}m`);
    } else {
      notReadyCount++;
    }

    if (readyCount >= 20) {
      console.log(`... (只显示前20条)`);
      break;
    }
  }

  console.log(`\n=== 统计 ===`);
  console.log(`总查询: ${notes.length}`);
  console.log(`被锁定: ${lockedCount}`);
  console.log(`从未采集: ${neverHarvested}`);
  console.log(`已等到时间: ${readyCount - neverHarvested}`);
  console.log(`还没到时间: ${notReadyCount}`);
  console.log(`** 应该可采集: ${readyCount} **`);

  await mongoose.disconnect();
}

check().catch(console.error);
