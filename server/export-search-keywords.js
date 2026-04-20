const { MongoClient } = require('mongodb');
const fs = require('fs');

async function exportKeywords() {
  const client = new MongoClient('mongodb://127.0.0.1:27017', { useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('xiaohongshu_audit');
    const coll = db.collection('searchkeywords');

    // 导出所有活跃关键词
    const keywords = await coll.find({ status: 'active' })
      .sort({ category: 1, keyword: 1 })
      .toArray();

    console.log(`\n共 ${keywords.length} 个搜索关键词\n`);
    console.log('=' .repeat(60));

    // 按分类分组
    const grouped = {};
    keywords.forEach(kw => {
      const cat = kw.category || '未分类';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(kw.keyword);
    });

    // 输出每个分类的关键词
    for (const [category, kws] of Object.entries(grouped)) {
      console.log(`\n【${category}】${kws.length}个`);
      kws.forEach(kw => console.log(`  - ${kw}`));
    }

    // 生成 JavaScript 格式
    console.log('\n\n' + '='.repeat(60));
    console.log('JavaScript 格式输出:\n');

    for (const [category, kws] of Object.entries(grouped)) {
      const weight = 1.0;
      console.log(`  {\n    keywords: [`);
      kws.forEach(kw => {
        // 转义单引号
        const escaped = kw.replace(/'/g, "\\'");
        console.log(`      '${escaped}',`);
      });
      console.log(`    ],\n    weight: ${weight},\n    category: '${category}'\n  },`);
    }

  } finally {
    await client.close();
  }
}
exportKeywords().catch(console.error);
