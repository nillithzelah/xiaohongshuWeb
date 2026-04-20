const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });
  const now = Date.now();

  console.log('=== 采集队列分析 ===\n');

  // 优先级分布
  const byPriority = await DiscoveredNote.aggregate([
    { $match: { needsCommentHarvest: true, noteStatus: 'active', status: { $in: ['discovered', 'verified'] } } },
    { $group: { _id: '$harvestPriority', count: { $sum: 1 } } },
    { $sort: { _id: -1 } }
  ]);
  console.log('优先级分布:');
  byPriority.forEach(p => console.log(`  优先级${p._id || 1}: ${p.count}条`));

  // 采集时间分析
  const notes = await DiscoveredNote.find({
    needsCommentHarvest: true,
    noteStatus: 'active',
    status: { $in: ['discovered', 'verified'] }
  }).select('harvestPriority commentsHarvestedAt').limit(200);

  // 定义间隔
  const intervals = { 10: 10, 5: 60, 2: 360, 1: 1440 };
  let readyCount = 0;
  let waitingCount = 0;
  let neverHarvested = 0;

  // 等待时间分布
  const waitTimeRanges = {
    '10分钟内': 0,
    '10分钟-1小时': 0,
    '1-6小时': 0,
    '6-24小时': 0,
    '24小时以上': 0
  };

  for (const note of notes) {
    if (!note.commentsHarvestedAt) {
      neverHarvested++;
      readyCount++;
      continue;
    }
    const priority = note.harvestPriority || 1;
    const intervalMinutes = intervals[priority] || 1440;
    const nextHarvestTime = note.commentsHarvestedAt.getTime() + intervalMinutes * 60 * 1000;
    const waitMs = nextHarvestTime - now;

    if (waitMs <= 0) {
      readyCount++;
    } else {
      waitingCount++;
      const waitMinutes = Math.floor(waitMs / 60000);
      if (waitMinutes <= 10) {
        waitTimeRanges['10分钟内']++;
      } else if (waitMinutes <= 60) {
        waitTimeRanges['10分钟-1小时']++;
      } else if (waitMinutes <= 360) {
        waitTimeRanges['1-6小时']++;
      } else if (waitMinutes <= 1440) {
        waitTimeRanges['6-24小时']++;
      } else {
        waitTimeRanges['24小时以上']++;
      }
    }
  }

  console.log('\n采样200条笔记:');
  console.log(`  可立即采集: ${readyCount}`);
  console.log(`  从未采集: ${neverHarvested}`);
  console.log(`  等待中: ${waitingCount}`);
  console.log('\n等待时间分布:');
  for (const [range, count] of Object.entries(waitTimeRanges)) {
    if (count > 0) {
      console.log(`  ${range}: ${count}条`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
