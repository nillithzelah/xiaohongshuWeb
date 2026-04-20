const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });
  
  console.log('=== 各种查询条件 ===');
  
  const q1 = await DiscoveredNote.countDocuments({ noteStatus: 'active' });
  console.log('noteStatus=active: ' + q1);
  
  const q2 = await DiscoveredNote.countDocuments({ noteStatus: 'active', needsCommentHarvest: true });
  console.log('noteStatus=active + needsCommentHarvest=true: ' + q2);
  
  const q3 = await DiscoveredNote.countDocuments({ noteStatus: { $ne: 'deleted' }, needsCommentHarvest: true });
  console.log('noteStatus!=deleted + needsCommentHarvest=true: ' + q3);
  
  const q4 = await DiscoveredNote.countDocuments({ noteStatus: { $in: ['active', 'deleted'] }, needsCommentHarvest: true });
  console.log('noteStatus in [active,deleted] + needsCommentHarvest=true: ' + q4);
  
  const byNoteStatus = await DiscoveredNote.aggregate([
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } }
  ]);
  console.log('\nnoteStatus 分布:');
  for (const s of byNoteStatus) {
    console.log('  ' + (s._id || 'null') + ': ' + s.count);
  }
  
  await mongoose.disconnect();
}

check().catch(console.error);
