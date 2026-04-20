const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const DiscoveredNote = mongoose.model('DiscoveredNote', new mongoose.Schema({
    noteId: String, noteStatus: String, harvestLock: Object, 
    commentsHarvestedAt: Date, harvestPriority: Number
  }, { collection: 'discoverednotes', timestamps: false }));

  const now = new Date();
  const intervals = { 10: 10, 5: 60, 2: 360, 1: 720 };

  // 只检查 noteStatus=active 的笔记
  const allActive = await DiscoveredNote.find({ noteStatus: 'active' }).lean();
  console.log('noteStatus=active 总数:', allActive.length);

  let canHarvest = 0;
  let inQueue = 0;
  let both = 0;
  let neither = 0;
  let edgeCases = [];

  for (const note of allActive) {
    // 计算 hasActiveLock
    let hasActiveLock = false;
    if (note.harvestLock && note.harvestLock.lockedUntil) {
      const lockedUntil = new Date(note.harvestLock.lockedUntil);
      hasActiveLock = lockedUntil > now;
    }

    // 计算 nextHarvestTime
    const priority = note.harvestPriority || 1;
    const intervalMinutes = intervals[priority] || 720;
    let nextHarvestTime;
    if (!note.commentsHarvestedAt) {
      nextHarvestTime = new Date(0);
    } else {
      nextHarvestTime = new Date(note.harvestedAt.getTime() + intervalMinutes * 60 * 1000);
    }
    const canHarvestByTime = nextHarvestTime <= now;

    // 判断分类
    const isCanHarvest = !hasActiveLock && canHarvestByTime;
    const isInQueue = hasActiveLock || !canHarvestByTime;

    if (isCanHarvest && isInQueue) {
      both++;
      edgeCases.push({ noteId: note.noteId, hasActiveLock, canHarvestByTime, nextHarvestTime, lockedUntil: note.harvestLock?.lockedUntil });
    } else if (isCanHarvest) {
      canHarvest++;
    } else if (isInQueue) {
      inQueue++;
    } else {
      neither++;
    }
  }

  console.log('可采集:', canHarvest);
  console.log('排队中:', inQueue);
  console.log('同时满足两者:', both);
  console.log('都不满足:', neither);
  console.log('总计:', canHarvest + inQueue + both + neither);

  if (edgeCases.length > 0) {
    console.log('\n边缘情况（同时满足两者）:');
    edgeCases.slice(0, 5).forEach(c => console.log(JSON.stringify(c)));
  }

  await mongoose.disconnect();
})();
