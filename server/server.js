const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu')
.then(async () => {
  console.log('MongoDB connected');

  // 确保测试用户存在
  const User = require('./models/User');
  const testUsers = [
    { username: 'TEST_BOSS', role: 'boss', openid: 'test_boss_openid' },
    { username: 'TEST_CS', role: 'cs', openid: 'test_cs_openid' },
    { username: 'TEST_FINANCE', role: 'finance', openid: 'test_finance_openid' }
  ];

  for (const userData of testUsers) {
    const existing = await User.findOne({ username: userData.username });
    if (!existing) {
      const user = new User(userData);
      await user.save();
      console.log(`✅ Created test user: ${userData.username}`);
    }
  }
})
.catch(err => console.log(err));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/client', require('./routes/client'));
app.use('/api/upload', require('./routes/upload'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});