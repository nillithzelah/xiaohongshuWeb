// 设置兼职用户的带教老师关系
const { MongoClient, ObjectId } = require('mongodb');

async function setupMentors() {
  const client = new MongoClient('mongodb://127.0.0.1:27017/xiaohongshu_audit');

  try {
    await client.connect();
    const db = client.db();
    const users = db.collection('users');

    // 查找所有mentor用户
    const mentors = await users.find({ role: 'mentor' }).toArray();
    console.log('找到的mentor用户:');
    mentors.forEach(m => console.log(`  ${m.username} (${m.nickname}) - ${m._id}`));

    // 查找所有part_time用户
    const partTimeUsers = await users.find({ role: 'part_time' }).toArray();
    console.log('\n找到的part_time用户:');
    partTimeUsers.forEach(u => console.log(`  ${u.username} (${u.nickname}) - mentor_id: ${u.mentor_id || 'null'}`));

    // 为每个part_time用户分配mentor（轮流分配）
    for (let i = 0; i < partTimeUsers.length; i++) {
      const user = partTimeUsers[i];
      const mentor = mentors[i % mentors.length];

      const result = await users.updateOne(
        { _id: user._id },
        {
          $set: {
            mentor_id: mentor._id,
            assigned_to_mentor_at: new Date()
          }
        }
      );

      console.log(`✅ ${user.username} -> ${mentor.username} (更新: ${result.modifiedCount})`);
    }

    console.log('\n🎉 带教老师分配完成！');

    // 验证结果
    const updatedUsers = await users.find({ role: 'part_time' }).toArray();
    console.log('\n验证结果:');
    for (const user of updatedUsers) {
      const mentor = mentors.find(m => m._id.toString() === user.mentor_id?.toString());
      console.log(`  ${user.username} -> ${mentor ? mentor.username : '未分配'}`);
    }

  } catch (error) {
    console.error('设置失败:', error);
  } finally {
    await client.close();
  }
}

setupMentors();