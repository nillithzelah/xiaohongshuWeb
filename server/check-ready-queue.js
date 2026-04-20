const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });

  const now = Date.now();
  const intervals = { 10: 10, 5: 60, 2: 360, 1: 1440 };

  console.log('=== noteStatus=active + 时间间隔到了 ===\n');

  // 查询所有 active 状态的笔记
  const notes = await DiscoveredNote.find({
    noteStatus: 'active',
    commentsHarvestedAt: { $ne: null }  // 已采集过的
  })
  .select('harvestPriority commentsHarvestedAt');

  let readyCount = 0;
  let totalCount = 0;
  const byPriority = { 10: 0, 5: 0, 2: 0, 1: 0 };

  for (const note of notes) {
    totalCount++;
    const priority = note.harvestPriority || 1;
    const intervalMinutes = intervals[priority] || 1440;
    const nextHarvestTime = new Date(note.commentsHarvestedAt).getTime() + intervalMinutes * 60 * 1000;

    if (now >= nextHarvestTime) {
      readyCount++;
      byPriority[priority]++;
    }
  }

  console.log(`总数: ${totalCount}`);
  console.log(`时间到了: ${readyCount}`);
  console.log('\n按优先级分布（时间到了）:');
  for (const [p, c] of Object.entries(byPriority)) {
    if (c > 0) {
      console.log(`  优先级${p}: ${c}条`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
