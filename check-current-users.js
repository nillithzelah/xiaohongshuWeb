// 检查当前数据库中的用户
const { MongoClient } = require('mongodb');

async function checkUsers() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();
    const usersCollection = db.collection('users');

    const users = await usersCollection.find({}).toArray();
    console.log(`📊 数据库中的用户总数: ${users.length}`);

    console.log('\n👥 所有用户列表:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (${user.nickname}) - 角色: ${user.role} - ID: ${user._id} - 删除: ${user.is_deleted}`);
    });

    const partTimeUsers = users.filter(u => u.role === 'part_time' && !u.is_deleted);
    console.log(`\n✅ 活跃的part_time用户: ${partTimeUsers.length} 个`);

    if (partTimeUsers.length > 0) {
      console.log('part_time用户详情:');
      partTimeUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - ID: ${user._id}`);
      });
    }

    // 查找管理员用户用于测试
    const adminUsers = users.filter(u => ['boss', 'manager'].includes(u.role) && !u.is_deleted);
    if (adminUsers.length > 0) {
      console.log(`\n👑 可用于测试的管理员用户:`);
      adminUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} - 角色: ${user.role} - ID: ${user._id}`);
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await client.close();
  }
}

checkUsers();