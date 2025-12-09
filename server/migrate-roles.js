// server/migrate-roles.js - 简化的迁移脚本
const { MongoClient } = require('mongodb');

async function migrate() {
  const uri = 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('🔗 数据库连接成功，开始迁移...');

    const db = client.db('xiaohongshu_audit');
    const users = db.collection('users');

    // 1. 重命名 wallet.balance 字段为 wallet.points
    console.log('🔄 正在将余额(balance)转换为积分(points)...');
    const renameResult = await users.updateMany(
      {},
      { $rename: { "wallet.balance": "wallet.points" } }
    );
    console.log(`   - 重命名字段完成，影响了 ${renameResult.modifiedCount} 条记录`);

    // 2. 更新角色名称
    console.log('🔄 正在更新角色名称...');

    const r1 = await users.updateMany({ role: 'user' }, { $set: { role: 'part_time' } });
    console.log(`   - 普通用户 -> 兼职用户: 更新了 ${r1.modifiedCount} 条`);

    const r2 = await users.updateMany({ role: 'sales' }, { $set: { role: 'hr' } });
    console.log(`   - 销售 -> HR: 更新了 ${r2.modifiedCount} 条`);

    const r3 = await users.updateMany({ role: 'cs' }, { $set: { role: 'mentor' } });
    console.log(`   - 客服 -> 带教老师: 更新了 ${r3.modifiedCount} 条`);

    console.log('✅ 迁移完成！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
  } finally {
    await client.close();
    process.exit(0);
  }
}

migrate().catch(console.error);