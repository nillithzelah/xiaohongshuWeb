const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');

  const now = new Date();
  const intervals = { 10: 10, 5: 60, 2: 360, 1: 1440 };

  const total = await DiscoveredNote.countDocuments({
    noteStatus: { $in: ['active', null] },
    shortUrlStatus: { $nin: ['deleted', 'invalid'] }
  });

  console.log('总 active 笔记:', total);

  const processing = await DiscoveredNote.countDocuments({
    noteStatus: { $in: ['active', null] },
    shortUrlStatus: { $nin: ['deleted', 'invalid'] },
    'harvestLock.lockedUntil': { $gt: now }
  });

  console.log('分发中（有活跃锁）:', processing);

  const neverHarvested = await DiscoveredNote.countDocuments({
    noteStatus: { $in: ['active', null] },
    shortUrlStatus: { $nin: ['deleted', 'invalid'] },
    commentsHarvestedAt: null
  });

  console.log('从未采集过:', neverHarvested);

  const harvested = await DiscoveredNote.countDocuments({
    noteStatus: { $in: ['active', null] },
    shortUrlStatus: { $nin: ['deleted', 'invalid'] },
    commentsHarvestedAt: { $ne: null }
  });

  console.log('已采集过的:', harvested);

  const samples = await DiscoveredNote.find({
    noteStatus: { $in: ['active', null] },
    commentsHarvestedAt: { $ne: null }
  }).limit(5).select('noteId commentsHarvestedAt harvestPriority harvestLock');

  console.log('\n抽样检查已采集笔记:');
  for (const s of samples) {
    const interval = intervals[s.harvestPriority] || 1440;
    const nextTime = new Date(s.commentsHarvestedAt).getTime() + interval * 60 * 1000;
    const isReady = nextTime <= Date.now();
    console.log('  ' + s.noteId, '优先级' + s.harvestPriority, '间隔' + interval + 'min', isReady ? '✅可采集' : '⏳等待中');
  }

  await mongoose.disconnect();
})();
