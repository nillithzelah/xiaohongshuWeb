const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });

  const now = Date.now();

  // 优先级间隔
  const intervals = { 10: 10, 5: 60, 2: 360, 1: 1440 };

  console.log('=== 实际采集队列分析 ===\n');

  // 查询所有需要采集的笔记（与分发逻辑一致）
  const notes = await DiscoveredNote.find({
    needsCommentHarvest: true,
    noteStatus: 'active',
    status: { $in: ['discovered', 'verified'] }
  })
  .sort({ harvestPriority: -1, createdAt: 1 })
  .select('noteId harvestPriority commentsHarvestedAt createdAt')
  .limit(50);

  console.log('按优先级排序的前50条笔记:\n');

  const readyNotes = [];
  for (const note of notes) {
    const priority = note.harvestPriority || 1;
    const intervalMinutes = intervals[priority] || 1440;

    let waitTimeText = '';
    let isReady = false;

    if (!note.commentsHarvestedAt) {
      waitTimeText = '从未采集 → 立即可采';
      isReady = true;
      readyNotes.push({ note, priority, waitTimeText, isReady });
    } else {
      const harvestedAt = new Date(note.commentsHarvestedAt).getTime();
      const nextHarvestTime = harvestedAt + intervalMinutes * 60 * 1000;
      const waitMs = nextHarvestTime - now;

      if (waitMs <= 0) {
        const waitedMinutes = Math.floor((now - harvestedAt) / 60000);
        waitTimeText = `✅ 已等${Math.floor(waitedMinutes/60)}h${waitedMinutes%60}m → 可采`;
        isReady = true;
        readyNotes.push({ note, priority, waitTimeText, isReady });
      } else {
        const waitMinutes = Math.floor(waitMs / 60000);
        waitTimeText = `⏰ 还需等${Math.floor(waitMinutes/60)}h${waitMinutes%60}m`;
      }
    }

    console.log(`优先级${priority} | ${note.noteId.slice(-8)} | ${waitTimeText}`);
  }

  console.log(`\n=== 可立即采集: ${readyNotes.length} 条 ===`);

  if (readyNotes.length > 0) {
    console.log('\n可采集笔记的优先级分布:');
    const byPriority = {};
    for (const r of readyNotes) {
      byPriority[r.priority] = (byPriority[r.priority] || 0) + 1;
    }
    for (const [p, c] of Object.entries(byPriority).sort((a, b) => b[0] - a[0])) {
      console.log(`  优先级${p}: ${c}条`);
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
