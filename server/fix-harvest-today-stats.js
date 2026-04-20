/**
 * 修复 harvest 客户端的今日统计重复累加问题
 * 运行方式: node server/fix-harvest-today-stats.js
 */

require('dotenv').config({ path: './server/.env' });
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function fixHarvestStats() {
  let client;
  try {
    console.log('🔄 连接数据库...');
    client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    const db = client.db();
    // 从URI中提取数据库名或使用默认值
    const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'xiaohongshu_audit';
    const dbToUse = client.db(dbName);
    const collection = dbToUse.collection('clientheartbeats');
    console.log(`✅ 数据库连接成功 (使用数据库: ${dbName})\n`);

    // 查找所有 harvest 客户端
    const clients = await collection.find({ clientType: 'harvest' }).toArray();

    console.log(`📊 找到 ${clients.length} 个 harvest 客户端\n`);

    const today = new Date().toISOString().split('T')[0]; // 今天的日期 YYYY-MM-DD
    let fixedCount = 0;

    for (const doc of clients) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`客户端: ${doc.clientId}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // 显示修复前的数据
      const todayNotes = doc.todayNotesProcessed || 0;
      const todayLeads = doc.todayValidLeads || 0;
      const todayComments = doc.todayCommentsCollected || 0;
      const totalNotes = doc.totalNotesProcessed || 0;
      const totalLeads = doc.totalValidLeads || 0;
      const totalComments = doc.totalCommentsCollected || 0;

      console.log('修复前:');
      console.log(`  todayNotesProcessed: ${todayNotes}`);
      console.log(`  todayValidLeads: ${todayLeads}`);
      console.log(`  todayCommentsCollected: ${todayComments}`);
      console.log(`  totalNotesProcessed: ${totalNotes}`);
      console.log(`  totalValidLeads: ${totalLeads}`);
      console.log(`  totalCommentsCollected: ${totalComments}`);

      // 检查是否需要修复（今日统计 > 累计统计 * 10，明显异常）
      const needsFix =
        todayNotes > (totalNotes * 10) ||
        todayLeads > (totalLeads * 10) ||
        todayComments > (totalComments * 10);

      if (needsFix) {
        // 重置今日统计为0，更新今天日期
        await collection.updateOne(
          { _id: doc._id },
          {
            $set: {
              todayNotesProcessed: 0,
              todayValidLeads: 0,
              todayCommentsCollected: 0,
              todayDate: today
            }
          }
        );
        fixedCount++;

        console.log('修复后:');
        console.log(`  todayNotesProcessed: 0 ✅`);
        console.log(`  todayValidLeads: 0 ✅`);
        console.log(`  todayCommentsCollected: 0 ✅`);
        console.log(`  todayDate: ${today}`);
      } else {
        console.log('✅ 数据正常，无需修复');
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 修复完成！共修复 ${fixedCount} 个客户端`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('👋 数据库连接已关闭');
    }
  }
}

fixHarvestStats();
