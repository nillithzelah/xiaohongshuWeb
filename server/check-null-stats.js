const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const coll = mongoose.connection.collection('discoverednotes');

  console.log('=== DiscoveredNote 状态统计 ===\n');

  // noteStatus 统计
  const noteStatusStats = await coll.aggregate([
    { $group: { _id: '$noteStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('noteStatus 分布:');
  noteStatusStats.forEach(s => {
    console.log(`  - ${s._id === null ? 'null' : s._id || '(empty)'}: ${s.count}`);
  });

  // shortUrlStatus 统计
  const shortUrlStatusStats = await coll.aggregate([
    { $group: { _id: '$shortUrlStatus', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();
  console.log('\nshortUrlStatus 分布:');
  shortUrlStatusStats.forEach(s => {
    console.log(`  - ${s._id === null ? 'null' : s._id || '(empty)'}: ${s.count}`);
  });

  // 交叉统计
  const crossStats = await coll.aggregate([
    { $group: { _id: { noteStatus: '$noteStatus', shortUrlStatus: '$shortUrlStatus' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 }
  ]).toArray();
  console.log('\n交叉统计 (noteStatus x shortUrlStatus) TOP 15:');
  crossStats.forEach(s => {
    const ns = s._id.noteStatus === null ? 'null' : s._id.noteStatus || '(empty)';
    const ss = s._id.shortUrlStatus === null ? 'null' : s._id.shortUrlStatus || '(empty)';
    console.log(`  - (${ns}, ${ss}): ${s.count}`);
  });

  // null 记录的采集情况
  const nullHarvestStats = await coll.aggregate([
    { $match: { noteStatus: null } },
    { $group: {
      _id: '$shortUrlStatus',
      count: { $sum: 1 },
      hasComment: { $sum: { $cond: [{ $ne: ['$commentsHarvestedAt', null] }, 1, 0] } },
      neverHarvested: { $sum: { $cond: [{ $eq: ['$commentsHarvestedAt', null] }, 1, 0] } }
    }}
  ]).toArray();
  console.log('\nnoteStatus=null 记录的采集情况:');
  nullHarvestStats.forEach(s => {
    const ss = s._id === null ? 'null' : s._id || '(empty)';
    console.log(`  - shortUrlStatus=${ss}: 总数=${s.count}, 已采集=${s.hasComment}, 未采集=${s.neverHarvested}`);
  });

  // null 记录的发现时间分布
  const nullTimeStats = await coll.aggregate([
    { $match: { noteStatus: null } },
    { $group: {
      _id: null,
      oldest: { $min: '$createdAt' },
      newest: { $max: '$createdAt' },
      count: { $sum: 1 }
    }}
  ]).toArray();
  if (nullTimeStats.length > 0) {
    console.log(`\nnoteStatus=null 记录的时间范围:`);
    console.log(`  - 最早: ${nullTimeStats[0].oldest}`);
    console.log(`  - 最新: ${nullTimeStats[0].newest}`);
    console.log(`  - 总数: ${nullTimeStats[0].count}`);
  }

  // 抽样几条 null 记录查看详情
  const samples = await coll.find({ noteStatus: null })
    .limit(5)
    .project({ noteId: 1, title: 1, noteStatus: 1, shortUrlStatus: 1, commentsHarvestedAt: 1, createdAt: 1 })
    .toArray();
  console.log('\nnoteStatus=null 抽样记录:');
  samples.forEach(s => {
    console.log(`  - ${s.noteId}: status=(${s.noteStatus}, ${s.shortUrlStatus}), created=${s.createdAt}, harvested=${s.commentsHarvestedAt ? '是' : '否'}`);
  });

  await mongoose.disconnect();
})();
