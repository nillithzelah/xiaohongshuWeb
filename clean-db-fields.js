const mongoose = require('mongoose');
require('dotenv').config();

async function cleanDBFields() {
  try {
    console.log('🧹 开始清理数据库中的废弃字段...');

    // 连接数据库
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';
    console.log('🔗 连接到:', mongoUri);

    await mongoose.connect(mongoUri);
    console.log('✅ 数据库连接成功');

    const db = mongoose.connection.db;

    // 清理 users 集合中的 continuousCheckPoints 字段
    console.log('🔍 检查 users 集合中的 continuousCheckPoints 字段...');
    const usersWithField = await db.collection('users').find({
      continuousCheckPoints: { $exists: true }
    }).toArray();

    console.log(`📊 找到 ${usersWithField.length} 个用户包含 continuousCheckPoints 字段`);

    if (usersWithField.length > 0) {
      console.log('👥 包含该字段的用户:');
      usersWithField.forEach(user => {
        console.log(`   - ${user.username}: ${user.continuousCheckPoints}`);
      });

      // 清理字段
      const result = await db.collection('users').updateMany(
        { continuousCheckPoints: { $exists: true } },
        { $unset: { continuousCheckPoints: 1 } }
      );

      console.log(`✅ 成功清理了 ${result.modifiedCount} 个用户的 continuousCheckPoints 字段`);
    } else {
      console.log('✅ 没有找到需要清理的 continuousCheckPoints 字段');
    }

    // 清理 users 集合中的 totalEarnings 字段
    console.log('🔍 检查 users 集合中的 totalEarnings 字段...');
    const usersWithTotalEarnings = await db.collection('users').find({
      totalEarnings: { $exists: true }
    }).toArray();

    console.log(`📊 找到 ${usersWithTotalEarnings.length} 个用户包含 totalEarnings 字段`);

    if (usersWithTotalEarnings.length > 0) {
      console.log('👥 包含该字段的用户:');
      usersWithTotalEarnings.forEach(user => {
        console.log(`   - ${user.username}: ${user.totalEarnings}`);
      });

      // 清理字段
      const result = await db.collection('users').updateMany(
        { totalEarnings: { $exists: true } },
        { $unset: { totalEarnings: 1 } }
      );

      console.log(`✅ 成功清理了 ${result.modifiedCount} 个用户的 totalEarnings 字段`);
    } else {
      console.log('✅ 没有找到需要清理的 totalEarnings 字段');
    }

    // 验证清理结果
    const remainingContinuousCheckPoints = await db.collection('users').countDocuments({
      continuousCheckPoints: { $exists: true }
    });

    const remainingTotalEarnings = await db.collection('users').countDocuments({
      totalEarnings: { $exists: true }
    });

    console.log(`🔍 验证结果:`);
    console.log(`   - continuousCheckPoints 剩余: ${remainingContinuousCheckPoints}`);
    console.log(`   - totalEarnings 剩余: ${remainingTotalEarnings}`);

    if (remainingContinuousCheckPoints === 0 && remainingTotalEarnings === 0) {
      console.log('🎉 所有废弃字段清理完成！');
    } else {
      console.log('⚠️ 还有一些字段没有清理完，请检查');
    }

  } catch (error) {
    console.error('❌ 清理失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 数据库连接已关闭');
  }
}

cleanDBFields();