// 手动插入taskconfigs数据到本地数据库
const { MongoClient } = require('mongodb');

const DB_NAME = 'xiaohongshu_audit';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// 从服务器获取的taskconfigs数据
const { ObjectId } = require('mongodb');

const taskConfigsData = [
  {
    _id: new ObjectId('6949fbde21338865fa4bafe5'),
    type_key: 'customer_resource',
    name: '客资',
    price: 1000,
    commission_1: 100,
    commission_2: 50,
    is_active: true
  },
  {
    _id: new ObjectId('6949fbde21338865fa4bafe6'),
    type_key: 'note',
    name: '笔记',
    price: 500,
    commission_1: 50,
    commission_2: 25,
    is_active: true
  },
  {
    _id: new ObjectId('6949fbde21338865fa4bafe7'),
    type_key: 'comment',
    name: '评论',
    price: 300,
    commission_1: 30,
    commission_2: 15,
    is_active: true
  }
];

async function insertTaskConfigs() {
  let client;

  try {
    console.log('🚀 开始插入taskconfigs数据到本地数据库...');
    console.log(`📍 数据库: ${DB_NAME}`);
    console.log(`🔗 MongoDB URI: ${MONGODB_URI}`);

    // 连接到MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB连接成功');

    const db = client.db(DB_NAME);
    const collection = db.collection('taskconfigs');

    // 清空现有数据
    console.log('🗑️  清空taskconfigs集合...');
    const deleteResult = await collection.deleteMany({});
    console.log(`🗑️  删除 ${deleteResult.deletedCount} 条现有记录`);

    // 插入新数据
    console.log('📥 开始插入taskconfigs数据...');
    const insertResult = await collection.insertMany(taskConfigsData);
    console.log(`✅ 成功插入 ${insertResult.insertedCount} 条记录`);

    // 验证插入结果
    const count = await collection.countDocuments();
    console.log(`📊 当前集合包含 ${count} 条记录`);

    // 显示插入的数据
    const configs = await collection.find({}).toArray();
    console.log('📋 插入的数据:');
    configs.forEach((config, index) => {
      console.log(`  ${index + 1}. ${config.name} (${config.type_key})`);
      console.log(`     价格: ${config.price}元, 佣金1: ${config.commission_1}元, 佣金2: ${config.commission_2}元`);
      console.log(`     ID: ${config._id}, 状态: ${config.is_active ? '启用' : '禁用'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 插入taskconfigs失败:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB连接已关闭');
    }
  }
}

// 主函数
async function main() {
  await insertTaskConfigs();
}

main().catch(console.error);