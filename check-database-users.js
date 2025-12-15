// 检查数据库中的用户数据
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');

async function checkUsers() {
  try {
    console.log('🔍 连接数据库...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功\n');

    // 查询所有未删除的用户
    const allUsers = await User.find({ is_deleted: { $ne: true } })
      .select('username nickname role phone wechat')
      .sort({ createdAt: -1 });

    console.log('📊 数据库中的所有用户:');
    console.log('='.repeat(80));

    const usersByRole = {};
    allUsers.forEach(user => {
      if (!usersByRole[user.role]) {
        usersByRole[user.role] = [];
      }
      usersByRole[user.role].push(user);
    });

    // 按角色分组显示
    Object.keys(usersByRole).forEach(role => {
      console.log(`\n👥 ${role.toUpperCase()} 用户 (${usersByRole[role].length}个):`);
      usersByRole[role].forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - 电话: ${user.phone || '无'}`);
      });
    });

    console.log('\n' + '='.repeat(80));

    // 重点检查可分配设备的用户
    const assignableUsers = allUsers.filter(user => ['user', 'mentor'].includes(user.role));
    console.log(`\n🎯 可分配设备的用户 (${assignableUsers.length}个):`);
    assignableUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - 角色: ${user.role}`);
    });

    // 检查是否有mentor用户
    const mentors = allUsers.filter(user => user.role === 'mentor');
    console.log(`\n👨‍🏫 兼职用户 (mentor) 数量: ${mentors.length}`);
    if (mentors.length === 0) {
      console.log('⚠️  没有找到任何兼职用户！这可能是设备分配列表为空的原因。');
      console.log('💡 建议: 通过管理后台创建一些mentor角色的用户');
    } else {
      console.log('✅ 兼职用户列表:');
      mentors.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname})`);
      });
    }

    // 检查普通用户
    const regularUsers = allUsers.filter(user => user.role === 'user');
    console.log(`\n👤 普通用户 (user) 数量: ${regularUsers.length}`);
    if (regularUsers.length === 0) {
      console.log('⚠️  没有找到任何普通用户！');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📪 数据库连接已关闭');
  }
}

// 运行检查
if (require.main === module) {
  checkUsers().catch(console.error);
}

module.exports = { checkUsers };