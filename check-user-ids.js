// 检查数据库中用户ID的格式
const { MongoClient, ObjectId } = require('mongodb');

async function checkUserIds() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ 数据库连接成功');

    const db = client.db();
    const usersCollection = db.collection('users');

    // 获取所有用户
    const users = await usersCollection.find({}).toArray();

    console.log(`📊 数据库中的用户总数: ${users.length}`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. 用户名: ${user.username}, ID: ${user._id}, 类型: ${typeof user._id}`);
    });

    // 检查token中的userId
    const tokenUserIds = [
      '693d1993b991905891064373', // boss用户
      '693d1993b991905891064372', // manager用户
      '69369fe48c8decf4cd0b92af'  // 其他用户
    ];

    console.log('\n🔍 检查token中的userId:');
    tokenUserIds.forEach(tokenUserId => {
      const foundUser = users.find(user => user._id.toString() === tokenUserId);
      if (foundUser) {
        console.log(`✅ ${tokenUserId} -> 找到用户: ${foundUser.username} (${foundUser.role})`);
      } else {
        console.log(`❌ ${tokenUserId} -> 用户不存在`);
      }
    });

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await client.close();
  }
}

checkUserIds();