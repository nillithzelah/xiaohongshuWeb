// 恢复taskconfigs集合的脚本
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'xiaohongshu_audit';
const BACKUP_DIR = './mongo_backup/xiaohongshu_audit';

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function restoreTaskConfigs() {
  let client;

  try {
    console.log('🚀 开始恢复taskconfigs集合...');
    console.log(`📍 数据库: ${DB_NAME}`);
    console.log(`🔗 MongoDB URI: ${MONGODB_URI}`);

    // 连接到MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ MongoDB连接成功');

    const db = client.db(DB_NAME);
    const collection = db.collection('taskconfigs');

    // 检查备份文件
    const bsonFile = path.join(BACKUP_DIR, 'taskconfigs.bson');
    if (!fs.existsSync(bsonFile)) {
      throw new Error(`备份文件不存在: ${bsonFile}`);
    }

    const stats = fs.statSync(bsonFile);
    console.log(`📖 备份文件: ${bsonFile} (${stats.size} bytes)`);

    if (stats.size === 0) {
      console.log('⚠️  备份文件为空，跳过恢复');
      return;
    }

    // 清空现有数据
    console.log('🗑️  清空taskconfigs集合...');
    const deleteResult = await collection.deleteMany({});
    console.log(`🗑️  删除 ${deleteResult.deletedCount} 条现有记录`);

    // 使用mongorestore命令恢复数据
    console.log('📥 开始恢复taskconfigs数据...');

    // 由于Node.js中直接解析BSON比较复杂，我们使用系统命令
    const { execSync } = require('child_process');

    try {
      const command = `mongorestore --db ${DB_NAME} --collection taskconfigs "${bsonFile}"`;
      console.log(`🔧 执行命令: ${command}`);

      const result = execSync(command, { encoding: 'utf8' });
      console.log('✅ mongorestore执行结果:', result);

    } catch (execError) {
      console.error('❌ mongorestore执行失败:', execError.message);

      // 如果mongorestore不可用，尝试手动解析（简化版）
      console.log('🔄 尝试手动解析BSON文件...');

      // 这里可以添加手动解析BSON的逻辑
      // 但通常建议使用mongorestore
      console.log('💡 建议手动执行: mongorestore --db xiaohongshu_audit --collection taskconfigs ./mongo_backup/xiaohongshu_audit/taskconfigs.bson');
    }

    // 验证恢复结果
    const count = await collection.countDocuments();
    console.log(`✅ 恢复完成，当前集合包含 ${count} 条记录`);

    // 显示恢复的数据
    const configs = await collection.find({}).limit(5).toArray();
    console.log('📋 恢复的数据示例:');
    configs.forEach((config, index) => {
      console.log(`  ${index + 1}. ${config.name} (${config.type_key}): ${config.price}元`);
    });

  } catch (error) {
    console.error('❌ 恢复taskconfigs失败:', error.message);
    console.error('🔧 请确保:');
    console.log('  1. MongoDB正在运行');
    console.log('  2. 已安装mongorestore工具');
    console.log('  3. 备份文件有效');
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB连接已关闭');
    }
  }
}

// 检查当前taskconfigs数据
async function checkCurrentData() {
  let client;

  try {
    console.log('🔍 检查当前taskconfigs数据...');

    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(DB_NAME);
    const collection = db.collection('taskconfigs');

    const count = await collection.countDocuments();
    console.log(`📊 当前集合包含 ${count} 条记录`);

    if (count > 0) {
      const configs = await collection.find({}).toArray();
      console.log('📋 当前配置:');
      configs.forEach((config, index) => {
        console.log(`  ${index + 1}. ${config.name} (${config.type_key})`);
        console.log(`     价格: ${config.price}元, 佣金1: ${config.commission_1}, 佣金2: ${config.commission_2}`);
      });
    }

  } catch (error) {
    console.error('❌ 检查数据失败:', error.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// 主函数
async function main() {
  const command = process.argv[2];

  if (command === 'check') {
    await checkCurrentData();
  } else if (command === 'restore') {
    await restoreTaskConfigs();
  } else {
    console.log('📖 使用方法:');
    console.log('  node restore-taskconfigs.js check    # 检查当前数据');
    console.log('  node restore-taskconfigs.js restore  # 恢复taskconfigs数据');
    console.log('\n⚠️  注意: 需要MongoDB和mongorestore工具');
  }
}

main().catch(console.error);