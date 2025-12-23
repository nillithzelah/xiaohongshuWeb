require('dotenv').config();
const mongoose = require('mongoose');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

// 修复用户wallet数据
async function fixUserWallet() {
  try {
    const User = require('./server/models/User');

    // 更新user001
    await User.findOneAndUpdate(
      { username: 'user001' },
      {
        points: 7.5,
        wallet: {
          balance: 10,
          total_earned: 46,
          total_withdrawn: 36
        }
      },
      { upsert: false }
    );

    // 更新user002
    await User.findOneAndUpdate(
      { username: 'user002' },
      {
        points: 0,
        wallet: {
          balance: 0,
          total_earned: 6,
          total_withdrawn: 0
        }
      },
      { upsert: false }
    );

    console.log('✅ 用户wallet数据修复完成');

    // 验证数据
    const user001 = await User.findOne({ username: 'user001' });
    const user002 = await User.findOne({ username: 'user002' });

    console.log('📊 user001数据:', {
      points: user001.points,
      wallet: user001.wallet
    });

    console.log('📊 user002数据:', {
      points: user002.points,
      wallet: user002.wallet
    });

  } catch (error) {
    console.error('❌ 修复失败:', error);
  }
}

// 主函数
async function main() {
  await connectDB();
  await fixUserWallet();
  await mongoose.connection.close();
  console.log('📪 数据库连接已关闭');
}

main().catch(console.error);