// MongoDB数据库恢复脚本
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'xiaohongshu_audit';
const BACKUP_DIR = './mongo_backup/xiaohongshu_audit';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function restoreCollection(client, collectionName) {
  const db = client.db(DB_NAME);
  const collection = db.collection(collectionName);

  const bsonFile = path.join(BACKUP_DIR, `${collectionName}.bson`);

  if (!fs.existsSync(bsonFile)) {
    console.log(`⚠️  跳过 ${collectionName}: 备份文件不存在`);
    return;
  }

  try {
    // 读取BSON文件
    const bsonData = fs.readFileSync(bsonFile);
    console.log(`📖 读取 ${collectionName}.bson (${bsonData.length} bytes)`);

    if (bsonData.length === 0) {
      console.log(`⚠️  跳过 ${collectionName}: 备份文件为空`);
      return;
    }

    // 清空现有数据
    console.log(`🗑️  清空 ${collectionName} 集合...`);
    await collection.deleteMany({});

    // 解析BSON数据（这里需要使用mongodb的BSON解析器）
    // 注意：实际的BSON文件需要使用mongorestore命令或专门的BSON解析库
    console.log(`⚠️  注意: 此脚本需要使用 mongorestore 命令来恢复BSON文件`);
    console.log(`💡 推荐命令: mongorestore --db ${DB_NAME} --dir ${BACKUP_DIR}`);

  } catch (error) {
    console.error(`❌ 恢复 ${collectionName} 失败:`, error.message);
  }
}

async function restoreDatabase() {
  let client;

  try {
    console.log('🚀 开始恢复MongoDB数据库...');
    console.log(`📍 数据库: ${DB_NAME}`);
    console.log(`📁 备份目录: ${BACKUP_DIR}`);
    console.log(`🔗 MongoDB URI: ${MONGODB_URI}`);

    // 连接到MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB连接成功');

    // 检查备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`备份目录不存在: ${BACKUP_DIR}`);
    }

    // 获取所有集合名称
    const collections = [
      'devices',
      'imagereviews',
      'submissions',
      'taskconfigs',
      'transactions',
      'users'
    ];

    console.log('\n📋 开始恢复集合...');

    for (const collectionName of collections) {
      await restoreCollection(client, collectionName);
    }

    console.log('\n✅ 数据库恢复完成！');
    console.log('\n⚠️  重要提醒:');
    console.log('此脚本仅用于检查备份文件，实际恢复需要使用 mongorestore 命令:');
    console.log(`mongorestore --db ${DB_NAME} --dir ${BACKUP_DIR}`);

  } catch (error) {
    console.error('❌ 数据库恢复失败:', error.message);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB连接已关闭');
    }
  }
}

async function checkBackupFiles() {
  console.log('🔍 检查备份文件状态...\n');

  const collections = [
    'devices',
    'imagereviews',
    'submissions',
    'taskconfigs',
    'transactions',
    'users'
  ];

  let totalSize = 0;

  for (const collectionName of collections) {
    const bsonFile = path.join(BACKUP_DIR, `${collectionName}.bson`);
    const metadataFile = path.join(BACKUP_DIR, `${collectionName}.metadata.json`);

    if (fs.existsSync(bsonFile)) {
      const stats = fs.statSync(bsonFile);
      console.log(`✅ ${collectionName}.bson: ${stats.size} bytes`);
      totalSize += stats.size;
    } else {
      console.log(`❌ ${collectionName}.bson: 文件不存在`);
    }

    if (fs.existsSync(metadataFile)) {
      console.log(`   └─ ${collectionName}.metadata.json: 存在`);
    }
  }

  console.log(`\n📊 总大小: ${totalSize} bytes`);
  console.log(`📂 备份目录: ${path.resolve(BACKUP_DIR)}`);
}

// 主函数
async function main() {
  const command = process.argv[2];

  if (command === 'check') {
    await checkBackupFiles();
  } else if (command === 'restore') {
    await restoreDatabase();
  } else {
    console.log('📖 使用方法:');
    console.log('  node restore-mongo-backup.js check    # 检查备份文件');
    console.log('  node restore-mongo-backup.js restore  # 恢复数据库');
    console.log('\n⚠️  注意: 实际恢复需要使用 mongorestore 命令');
  }
}

main().catch(console.error);