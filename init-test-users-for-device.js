// 初始化测试用户用于设备分配
const mongoose = require('mongoose');
const User = require('./server/models/User');

async function initTestUsers() {
  try {
    console.log('🔍 连接数据库...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功\n');

    // 检查现有用户
    const existingUsers = await User.find({is_deleted: {$ne: true}});
    console.log(`📊 现有活跃用户: ${existingUsers.length}个`);

    // 需要创建的用户
    const testUsers = [
      // 兼职用户（可分配设备）
      { username: 'mentor001', nickname: '小王老师', role: 'mentor', password: 'admin123' },
      { username: 'mentor002', nickname: '小李老师', role: 'mentor', password: 'admin123' },
      { username: 'user001', nickname: '张三', role: 'user', password: 'admin123' },
      { username: 'user002', nickname: '李四', role: 'user', password: 'admin123' },
      { username: 'user003', nickname: '王五', role: 'user', password: 'admin123' },

      // 管理员用户（用于登录管理后台）
      { username: 'boss001', nickname: '老板王总', role: 'boss', password: 'admin123' },
      { username: 'manager001', nickname: '主管张总', role: 'manager', password: 'admin123' },
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const userData of testUsers) {
      const existing = await User.findOne({
        username: userData.username,
        is_deleted: {$ne: true}
      });

      if (existing) {
        console.log(`⏭️  ${userData.username} 已存在，跳过`);
        skippedCount++;
        continue;
      }

      const newUser = new User(userData);
      await newUser.save();
      console.log(`✅ 创建用户: ${userData.username} (${userData.nickname}) - 角色: ${userData.role}`);
      createdCount++;
    }

    console.log(`\n📊 创建结果: 新建 ${createdCount}个，跳过 ${skippedCount}个`);

    // 最终统计
    const finalUsers = await User.find({is_deleted: {$ne: true}});
    const assignableUsers = await User.find({
      role: {$in: ['user', 'mentor']},
      is_deleted: {$ne: true}
    });

    console.log(`\n📈 最终统计:`);
    console.log(`  总用户数: ${finalUsers.length}`);
    console.log(`  可分配设备用户数: ${assignableUsers.length}`);

    console.log(`\n👥 可分配设备用户列表:`);
    assignableUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - ${user.role}`);
    });

    console.log(`\n🎉 初始化完成！现在可以测试设备管理功能了。`);
    console.log(`💡 管理后台登录:`);
    console.log(`   老板账号: boss001 / admin123`);
    console.log(`   主管账号: manager001 / admin123`);

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📪 数据库连接已关闭');
  }
}

// 运行初始化
if (require.main === module) {
  initTestUsers().catch(console.error);
}

module.exports = { initTestUsers };