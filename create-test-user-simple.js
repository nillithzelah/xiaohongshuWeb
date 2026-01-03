// 创建测试用户并获取token - 简化版
const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const User = require('./server/models/User');

async function createTestUser() {
  try {
    console.log('📝 创建测试用户...');
    
    // 检查用户是否已存在
    const existingUser = await User.findOne({ username: 'testuser' });
    if (existingUser) {
      console.log('✅ 测试用户已存在');
      return existingUser;
    }
    
    // 创建测试用户（不加密密码，直接使用明文）
    const testUser = new User({
      username: 'testuser',
      password: 'testpassword', // 明文密码
      nickname: '测试用户',
      role: 'part_time',
      points: 100,
      wallet: {
        balance: 0,
        total_earned: 0
      }
    });
    
    await testUser.save();
    console.log('✅ 测试用户创建成功');
    return testUser;
  } catch (error) {
    console.error('❌ 创建测试用户失败:', error);
    throw error;
  }
}

function generateToken(user) {
  const jwt = require('jsonwebtoken');
  const payload = {
    userId: user._id,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24小时过期
  };
  
  return jwt.sign(payload, 'xiaohongshu_prod_jwt');
}

async function main() {
  try {
    const user = await createTestUser();
    const token = generateToken(user);
    
    console.log('\n🎉 测试用户信息:');
    console.log('用户名: testuser');
    console.log('密码: testpassword');
    console.log('角色: part_time');
    console.log('用户ID:', user._id);
    console.log('\n🔑 JWT Token:');
    console.log(token);
    
    // 保存token到文件
    require('fs').writeFileSync('test-token.txt', token);
    console.log('\n💾 Token已保存到 test-token.txt');
    
  } catch (error) {
    console.error('❌ 执行失败:', error);
  } finally {
    mongoose.connection.close();
  }
}

main();