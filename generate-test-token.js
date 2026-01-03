const jwt = require('jsonwebtoken');

const JWT_SECRET = 'xiaohongshu_prod_jwt_secret_2025_v2_a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

const token = jwt.sign(
  { userId: '6952518717cd0e4322fed437', username: 'feng', role: 'part_time' },
  JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('Generated token:', token);
console.log('Expires at:', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());