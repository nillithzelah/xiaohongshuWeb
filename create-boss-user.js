const mongoose = require('mongoose');

// 创建boss001老板用户
async function createBossUser() {
  try {
    console.log('🔍 正在连接数据库...');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 定义User模型（简化版）
    const userSchema = new mongoose.Schema({
      username: String,
      password: String,
      role: String,
      nickname: String,
      phone: String,
      wechat: String,
      avatar: String,
      notes: String,
      createdAt: { type: Date, default: Date.now }
    });

    const User = mongoose.model('User', userSchema, 'users');

    // 检查用户是否已存在
    const existingUser = await User.findOne({ username: 'boss001' });
    if (existingUser) {
      console.log('⚠️ 用户 boss001 已存在，跳过创建');
      console.log('📋 现有用户信息:');
      console.log('   ID:', existingUser._id);
      console.log('   用户名:', existingUser.username);
      console.log('   角色:', existingUser.role);
      console.log('   昵称:', existingUser.nickname);
      return;
    }

    // 创建新用户
    const bossUser = new User({
      username: 'boss001',
      password: '123456', // 明文密码，系统会自动加密
      role: 'boss',
      nickname: '老板001',
      phone: '13800138001',
      wechat: 'boss001_wechat',
      avatar: '',
      notes: '系统创建的老板账户'
    });

    // 保存用户（会触发密码加密）
    await bossUser.save();

    console.log('✅ 成功创建老板用户!');
    console.log('📋 用户信息:');
    console.log('   ID:', bossUser._id);
    console.log('   用户名: boss001');
    console.log('   密码: 123456');
    console.log('   角色: boss');
    console.log('   昵称: 老板001');
    console.log('   手机号: 13800138001');
    console.log('   微信号: boss001_wechat');

    // 验证创建的用户
    console.log('🔐 密码设置: 123456 (明文，系统会自动处理)');

  } catch (error) {
    console.error('❌ 创建用户失败:', error.message);
    console.error('🔍 错误详情:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

createBossUser();