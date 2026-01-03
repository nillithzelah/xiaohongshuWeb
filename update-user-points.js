const mongoose = require('mongoose');

// 连接数据库
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit';
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB连接成功');
  } catch (error) {
    console.error('❌ MongoDB连接失败:', error);
    process.exit(1);
  }
};

// 更新用户积分
const updateUserPoints = async () => {
  try {
    // 查找username为'123'的用户
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    // 先列出所有用户
    console.log('📋 数据库中的所有用户:');
    const allUsers = await User.find({}, 'username points role phone').limit(50);
    allUsers.forEach(user => {
      console.log(`  - ${user.username}: ${user.points}积分 (${user.role}) ${user.phone ? '- ' + user.phone : ''}`);
    });

    // 也查找所有part_time用户
    console.log('📋 兼职用户列表:');
    const partTimeUsers = await User.find({ role: 'part_time' }, 'username points role phone').limit(20);
    partTimeUsers.forEach(user => {
      console.log(`  - ${user.username}: ${user.points}积分 (${user.role}) ${user.phone ? '- ' + user.phone : ''}`);
    });

    const user = await User.findOne({ username: '123' });

    if (!user) {
      console.log('❌ 未找到username为"123"的用户');
      return;
    }

    console.log('📋 找到用户:', {
      id: user._id,
      username: user.username,
      currentPoints: user.points,
      role: user.role
    });

    // 更新积分
    const oldPoints = user.points;
    user.points = 100;

    await user.save();

    console.log(`✅ 用户积分更新成功: ${oldPoints} → 100`);

  } catch (error) {
    console.error('❌ 更新用户积分失败:', error);
  }
};

// 主函数
const main = async () => {
  await connectDB();
  await updateUserPoints();
  await mongoose.connection.close();
  console.log('🔚 数据库连接已关闭');
};

// 执行
main().catch(console.error);