// 生成测试token
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'xiaohongshu_prod_jwt';
const userId = '693d29b5cbc188007ecc5848';

const token = jwt.sign(
  { userId: userId },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('生成的测试token:');
console.log(token);