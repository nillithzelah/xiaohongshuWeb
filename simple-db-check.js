// 简单数据库检查
const { MongoClient } = require('mongodb');

async function checkDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();

    // 直接查询users集合
    const users = await db.collection('users').find({}).toArray();

    console.log(`📊 数据库中的用户总数: ${users.length}`);

    // 按角色分组
    const roles = {};
    users.forEach(user => {
      roles[user.role] = (roles[user.role] || 0) + 1;
    });

    console.log('\n📈 角色分布:');
    Object.entries(roles).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} 个`);
    });

    // 查找part_time用户
    const partTimeUsers = users.filter(u => u.role === 'part_time');
    console.log(`\n👥 part_time 用户: ${partTimeUsers.length} 个`);

    if (partTimeUsers.length > 0) {
      console.log('part_time 用户列表:');
      partTimeUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - is_deleted: ${user.is_deleted}`);
      });
    } else {
      console.log('❌ 没有找到任何 part_time 用户');
    }

    // 检查是否有未删除的part_time用户
    const activePartTimeUsers = users.filter(u => u.role === 'part_time' && !u.is_deleted);
    console.log(`\n✅ 活跃的part_time用户: ${activePartTimeUsers.length} 个`);

    if (activePartTimeUsers.length > 0) {
      console.log('活跃part_time用户列表:');
      activePartTimeUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - ID: ${user._id}`);
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await client.close();
  }
}

checkDB();