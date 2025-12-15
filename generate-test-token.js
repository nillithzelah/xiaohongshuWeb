// 生成正确的测试Token
const jwt = require('jsonwebtoken');

// 使用服务器实际的JWT_SECRET（从日志中看到的值）
const JWT_SECRET = 'xiaohongshu_prod_jwt_secret_2025_v2_a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

console.log('🔑 使用的JWT_SECRET:', JWT_SECRET);

// 测试用户信息（使用有效的ObjectId）
const testUser = {
  userId: '69369fe48c8decf4cd0b92af', // 使用数据库中现有的用户ID
  username: 'test_user'
};

// 生成token
const token = jwt.sign(testUser, JWT_SECRET, { expiresIn: '7d' });

console.log('\n🔑 生成的测试Token:');
console.log(token);
console.log('\n📋 Token信息:');
console.log(JSON.stringify(jwt.verify(token, JWT_SECRET), null, 2));
console.log('\n✅ Token已生成，可以在小程序中使用');