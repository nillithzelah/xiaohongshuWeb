const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });

  console.log('=== 笔记状态分布 ===');

  const byStatus = await DiscoveredNote.aggregate([
    { $group: { _id: { noteStatus: '$noteStatus', status: '$status' }, count: { $sum: 1 } } },
    { $sort: { '_id.noteStatus': 1, '_id.status': 1 } }
  ]);

  console.log('\nnoteStatus + status 分布:');
  for (const s of byStatus) {
    const noteStatus = s._id.noteStatus || 'null';
    const status = s._id.status || 'null';
    console.log(`  ${noteStatus} / ${status}: ${s.count}`);
  }

  console.log('\n=== needsCommentHarvest 统计 ===');
  const byNeed = await DiscoveredNote.aggregate([
    { $group: { _id: '$needsCommentHarvest', count: { $sum: 1 } } }
  ]);
  for (const s of byNeed) {
    console.log(`  needsCommentHarvest=${s._id}: ${s.count}`);
  }

  console.log('\n=== 用户要求的查询 ===');
  const count = await DiscoveredNote.countDocuments({
    noteStatus: 'active',
    needsCommentHarvest: true
  });
  console.log(`noteStatus=active + needsCommentHarvest=true: ${count}`);

  const byOnlyStatus = await DiscoveredNote.aggregate([
    { $match: { noteStatus: 'active', needsCommentHarvest: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('\nnoteStatus=active + needsCommentHarvest=true 按status分组:');
  for (const s of byOnlyStatus) {
    console.log(`  status=${s._id}: ${s.count}`);
  }

  await mongoose.disconnect();
}

check().catch(console.error);
