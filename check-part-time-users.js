// 检查数据库中的 part_time 用户
const { MongoClient } = require('mongodb');

async function checkPartTimeUsers() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();
    const usersCollection = db.collection('users');

    // 查询所有未删除的用户
    const allUsers = await usersCollection.find({
      is_deleted: { $ne: true }
    }).toArray();

    console.log(`📊 数据库总用户数: ${allUsers.length}`);

    // 按角色分组统计
    const roleStats = {};
    allUsers.forEach(user => {
      roleStats[user.role] = (roleStats[user.role] || 0) + 1;
    });

    console.log('\n📈 用户角色分布:');
    Object.entries(roleStats).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} 个`);
    });

    // 重点检查 part_time 用户
    const partTimeUsers = allUsers.filter(user => user.role === 'part_time');
    console.log(`\n👥 part_time 角色用户: ${partTimeUsers.length} 个`);

    if (partTimeUsers.length === 0) {
      console.log('❌ 没有找到任何 part_time 角色的用户！');
      console.log('💡 这就是设备管理页面没有兼职用户选项的原因。');
      console.log('🔧 解决方案: 需要创建 part_time 角色的用户。');
    } else {
      console.log('✅ 找到的 part_time 用户:');
      partTimeUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - ID: ${user._id}`);
      });
      console.log('\n🎉 设备管理页面应该能显示这些用户了！');
    }

    // 检查是否有其他可能的用户
    const otherPotentialUsers = allUsers.filter(user =>
      user.role !== 'boss' &&
      user.role !== 'manager' &&
      user.role !== 'finance' &&
      user.role !== 'hr' &&
      user.role !== 'mentor'
    );

    if (otherPotentialUsers.length > partTimeUsers.length) {
      console.log(`\n⚠️ 发现其他可能的用户: ${otherPotentialUsers.length - partTimeUsers.length} 个`);
      console.log('可能需要将一些用户角色改为 part_time');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await client.close();
    console.log('\n📪 数据库连接已关闭');
  }
}

// 运行检查
if (require.main === module) {
  checkPartTimeUsers().catch(console.error);
}

module.exports = { checkPartTimeUsers };