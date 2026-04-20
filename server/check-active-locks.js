const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const DiscoveredNote = mongoose.model('DiscoveredNote', new mongoose.Schema({
    noteId: String, harvestLock: Object
  }, { collection: 'discoverednotes', timestamps: false }));

  const now = new Date();

  // Get first page notes (sorted by discoverTime desc, which is the default order)
  const firstPage = await DiscoveredNote.find()
    .sort({ discoverTime: -1 })
    .limit(20)
    .lean();

  console.log('第一页笔记的锁状态:');
  let activeCount = 0;
  firstPage.forEach(n => {
    const hasLock = n.harvestLock && n.harvestLock.lockedUntil;
    const isActive = hasLock && new Date(n.harvestLock.lockedUntil) > now;
    if (isActive) activeCount++;
    console.log('-', n.noteId.slice(-6), '锁存在:', !!hasLock, '锁有效:', isActive);
  });

  console.log('\n第一页中有效锁数量:', activeCount);

  // Also get all active lock notes
  const allActive = await DiscoveredNote.find({ 'harvestLock.lockedUntil': { $gt: now } })
    .limit(10)
    .lean();

  console.log('\n所有有效锁的笔记:');
  allActive.forEach(n => {
    console.log('-', n.noteId, 'lockedUntil:', n.harvestLock.lockedUntil);
  });

  await mongoose.disconnect();
})();
