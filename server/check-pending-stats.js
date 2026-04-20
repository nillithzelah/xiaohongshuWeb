const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient('mongodb://127.0.0.1:27017', { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('xiaohongshu_audit');
    const coll = db.collection('discoverednotes');

    const total = await coll.countDocuments();
    console.log('总笔记数:', total);

    const neverHarvested = await coll.countDocuments({ commentsHarvestedAt: null });
    console.log('从未采集过:', neverHarvested);

    // 用aggregate计算排队中
    const now = new Date();
    const pendingResult = await coll.aggregate([
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
      { $count: 'pending' }
    ]).toArray();

    const pending = pendingResult.length > 0 ? pendingResult[0].pending : 0;
    console.log('排队中 (可立即采集):', pending);

  } finally {
    await client.close();
  }
}
check().catch(console.error);
