const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient('mongodb://127.0.0.1:27017', { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('xiaohongshu_audit');
    const coll = db.collection('discoverednotes');

    console.log('=== 无效笔记统计 ===\n');

    // 按 noteStatus 统计
    const byNoteStatus = await coll.aggregate([
      { $group: { _id: '$noteStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('按 noteStatus:');
    byNoteStatus.forEach(item => {
      console.log(`  ${item._id || 'null'}: ${item.count}`);
    });

    console.log('');

    // 按 shortUrlStatus 统计
    const byShortUrlStatus = await coll.aggregate([
      { $group: { _id: '$shortUrlStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();
    console.log('按 shortUrlStatus:');
    byShortUrlStatus.forEach(item => {
      console.log(`  ${item._id || 'null'}: ${item.count}`);
    });

    console.log('\n=== 无效笔记详情 ===');

    // 无效笔记总数
    const invalidCount = await coll.countDocuments({
      $or: [
        { noteStatus: { $in: ['deleted', 'ai_rejected'] } },
        { shortUrlStatus: { $in: ['deleted', 'invalid'] } }
      ]
    });
    console.log(`\n无效笔记总数: ${invalidCount}`);

    // 计算有效排队数（排除无效笔记）
    const now = new Date();
    const validPendingResult = await coll.aggregate([
      { $match: {
          noteStatus: { $in: ['active', null] },
          shortUrlStatus: { $nin: ['deleted', 'invalid'] }
        }
      },
      {
        $addFields: {
          intervalMs: {
            $switch: {
              branches: [
                { case: { $eq: ['$harvestPriority', 10] }, then: 10 * 60 * 1000 },
                { case: { $eq: ['$harvestPriority', 5] }, then: 60 * 60 * 1000 },
                { case: { $eq: ['$harvestPriority', 2] }, then: 360 * 60 * 1000 },
                { case: { $eq: ['$harvestPriority', 1] }, then: 720 * 60 * 1000 }
              ],
              default: 720 * 60 * 1000
            }
          }
        }
      },
      {
        $addFields: {
          nextHarvestTime: {
            $cond: {
              if: { $eq: ['$commentsHarvestedAt', null] },
              then: now,
              else: { $add: ['$commentsHarvestedAt', '$intervalMs'] }
            }
          }
        }
      },
      { $match: { nextHarvestTime: { $lte: now } } },
      { $count: 'validPending' }
    ]).toArray();

    const validPending = validPendingResult.length > 0 ? validPendingResult[0].validPending : 0;
    console.log(`有效排队中 (排除无效): ${validPending}`);
    console.log(`当前排队中 (包含无效): 906`);
    console.log(`无效笔记占比: ${invalidCount} (${((invalidCount/1863)*100).toFixed(1)}%)`);

  } finally {
    await client.close();
  }
}
check().catch(console.error);
