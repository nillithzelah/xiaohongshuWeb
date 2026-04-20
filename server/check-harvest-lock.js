const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const DiscoveredNote = mongoose.model('DiscoveredNote', new mongoose.Schema({
    noteId: String, harvestLock: Object, commentsHarvestedAt: Date
  }, { collection: 'discoverednotes', timestamps: false }));

  const total = await DiscoveredNote.countDocuments();
  const withLock = await DiscoveredNote.countDocuments({ 'harvestLock.lockedUntil': { $exists: true } });
  const activeLocks = await DiscoveredNote.countDocuments({
    'harvestLock.lockedUntil': { $gt: new Date() }
  });
  const sample = await DiscoveredNote.findOne({ 'harvestLock.lockedUntil': { $gt: new Date() } }).lean();

  console.log('总笔记:', total);
  console.log('有锁记录:', withLock);
  console.log('锁有效中:', activeLocks);
  if (sample) console.log('示例:', sample.noteId, sample.harvestLock);
  await mongoose.disconnect();
})();
