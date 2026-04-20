const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient('mongodb://127.0.0.1:27017', { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('xiaohongshu_audit');
    const coll = db.collection('searchkeywords');

    // 总数
    const total = await coll.countDocuments({ status: 'active' });
    console.log(`\n搜索关键词总数: ${total}\n`);

    // 按分类统计
    const byCategory = await coll.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('按分类统计:');
    byCategory.forEach(item => {
      console.log(`  ${item._id || '(未分类)'}: ${item.count}`);
    });

    // 示例关键词
    console.log('\n示例关键词 (每个分类取3个):');
    const examples = await coll.aggregate([
      { $match: { status: 'active' } },
      { $sort: { category: 1 } },
      { $group: { _id: '$category', keywords: { $push: '$keyword' } } }
    ]).toArray();

    examples.forEach(cat => {
      const sample = cat.keywords.slice(0, 3).join(', ');
      const more = cat.keywords.length > 3 ? `... (+${cat.keywords.length - 3}更多)` : '';
      console.log(`  ${cat._id || '(未分类)'}: ${sample}${more}`);
    });

  } finally {
    await client.close();
  }
}
check().catch(console.error);
