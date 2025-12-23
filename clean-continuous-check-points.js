const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');

async function cleanContinuousCheckPoints() {
  try {
    console.log('🧹 开始清理 continuousCheckPoints 字段...');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 查找所有包含 continuousCheckPoints 字段的用户
    const usersWithField = await User.find({
      continuousCheckPoints: { $exists: true }
    }).select('username continuousCheckPoints');

    console.log(`📊 找到 ${usersWithField.length} 个用户包含 continuousCheckPoints 字段`);

    if (usersWithField.length > 0) {
      console.log('👥 包含该字段的用户:');
      usersWithField.forEach(user => {
        console.log(`   - ${user.username}: ${user.continuousCheckPoints}`);
      });

      // 清理字段
      const result = await User.updateMany(
        { continuousCheckPoints: { $exists: true } },
        { $unset: { continuousCheckPoints: 1 } }
      );

      console.log(`✅ 成功清理了 ${result.modifiedCount} 个用户的 continuousCheckPoints 字段`);
    } else {
      console.log('✅ 没有找到需要清理的 continuousCheckPoints 字段');
    }

    // 验证清理结果
    const remainingUsers = await User.find({
      continuousCheckPoints: { $exists: true }
    }).countDocuments();

    console.log(`🔍 验证结果: 剩余 ${remainingUsers} 个用户包含该字段`);

    if (remainingUsers === 0) {
      console.log('🎉 continuousCheckPoints 字段清理完成！');
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

cleanContinuousCheckPoints();