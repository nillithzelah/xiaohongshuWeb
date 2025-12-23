const mongoose = require('mongoose');

async function checkServerDb() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到服务器数据库');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 数据库集合:');
    collections.forEach(c => console.log('  -', c.name));

    const taskconfigs = await mongoose.connection.db.collection('taskconfigs').find({}).toArray();
    console.log(`\n📋 taskconfigs集合内容 (${taskconfigs.length} 条记录):`);
    console.log(JSON.stringify(taskconfigs, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

checkServerDb();