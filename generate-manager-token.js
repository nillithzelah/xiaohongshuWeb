// 生成管理员测试token
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'xiaohongshu_prod_jwt_secret_2025_v2_a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
const managerUserId = '693d29b5cbc188007ecc5847'; // 主管张总的ID

const token = jwt.sign(
  {
    userId: managerUserId
  },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('生成的管理员测试token:');
console.log(token);