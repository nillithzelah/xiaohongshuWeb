const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB 连接成功'))
.catch(err => {
  console.error('❌ MongoDB 连接失败:', err);
  process.exit(1);
});

async function createBossUser() {
  try {
    // 删除已存在的boss用户
    await User.deleteMany({ username: 'boss' });
    console.log('🗑️ 已删除旧的boss用户');

    // 生成密码哈希
    const password = 'boss123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('🔐 生成的密码哈希:', hashedPassword);

    // 创建boss用户
    const bossUser = new User({
      username: 'boss',
      password: hashedPassword,
      role: 'boss',
      nickname: '老板',
      phone: '13800138000',
      wechat: 'boss_wechat',
      points: 0,
      wallet: {
        alipay_account: '',
        real_name: '',
        total_withdrawn: 0
      },
      is_deleted: false
    });

    await bossUser.save();
    console.log('✅ Boss用户创建成功');
    console.log('📋 用户信息:', {
      username: bossUser.username,
      role: bossUser.role,
      nickname: bossUser.nickname
    });

    // 验证密码
    const isValid = await bossUser.comparePassword(password);
    console.log('🔍 密码验证结果:', isValid);

    console.log('\n🎉 Boss用户创建完成！');
    console.log('登录信息:');
    console.log('  用户名: boss');
    console.log('  密码: boss123');

  } catch (error) {
    console.error('❌ 创建boss用户失败:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ 数据库连接已关闭');
    process.exit(0);
  }
}

createBossUser();
