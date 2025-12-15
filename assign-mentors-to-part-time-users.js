// 为兼职用户分配带教老师
const { MongoClient, ObjectId } = require('mongodb');

async function assignMentors() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();
    const usersCollection = db.collection('users');

    // 获取所有mentor用户
    const mentors = await usersCollection.find({ role: 'mentor' }).toArray();
    console.log(`📋 找到 ${mentors.length} 个带教老师:`);
    mentors.forEach((mentor, index) => {
      console.log(`  ${index + 1}. ${mentor.username} (${mentor.nickname}) - ID: ${mentor._id}`);
    });

    if (mentors.length === 0) {
      console.log('❌ 没有找到带教老师，无法分配');
      return;
    }

    // 获取所有part_time用户
    const partTimeUsers = await usersCollection.find({ role: 'part_time', is_deleted: { $ne: true } }).toArray();
    console.log(`👥 找到 ${partTimeUsers.length} 个兼职用户:`);
    partTimeUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - 当前mentor_id: ${user.mentor_id}`);
    });

    // 为每个兼职用户分配带教老师（轮流分配）
    for (let i = 0; i < partTimeUsers.length; i++) {
      const user = partTimeUsers[i];
      const mentor = mentors[i % mentors.length]; // 轮流分配

      await usersCollection.updateOne(
        { _id: user._id },
        {
          $set: {
            mentor_id: mentor._id,
            assigned_to_mentor_at: new Date()
          }
        }
      );

      console.log(`✅ 为用户 ${user.username} 分配带教老师 ${mentor.username}`);
    }

    console.log('\n🎉 带教老师分配完成！');

    // 验证分配结果
    const updatedUsers = await usersCollection.find({ role: 'part_time', is_deleted: { $ne: true } }).toArray();
    console.log('\n📊 分配结果验证:');
    for (const user of updatedUsers) {
      const mentor = mentors.find(m => m._id.toString() === user.mentor_id?.toString());
      console.log(`  ${user.username} -> 带教老师: ${mentor ? mentor.username : '未分配'}`);
    }

  } catch (error) {
    console.error('❌ 分配失败:', error.message);
  } finally {
    await client.close();
  }
}

assignMentors();