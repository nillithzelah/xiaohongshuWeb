// 简单的API测试脚本
const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function testAPI() {
  try {
    console.log('开始API测试...');

    // 测试注册管理员用户
    console.log('1. 注册管理员用户...');
    const registerRes = await axios.post(`${API_BASE}/auth/register`, {
      username: 'admin',
      password: 'admin123',
      role: 'customer_service'
    });
    console.log('注册结果:', registerRes.data);

    // 测试登录
    console.log('2. 管理员登录...');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('登录结果:', loginRes.data);

    if (loginRes.data.success) {
      const token = loginRes.data.token;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // 测试获取用户资料
      console.log('3. 获取用户资料...');
      const profileRes = await axios.get(`${API_BASE}/users/profile`);
      console.log('用户资料:', profileRes.data);

      // 测试获取审核列表
      console.log('4. 获取审核列表...');
      const reviewsRes = await axios.get(`${API_BASE}/reviews`);
      console.log('审核列表:', reviewsRes.data);
    }

    console.log('API测试完成！');

  } catch (error) {
    console.error('API测试失败:', error.response?.data || error.message);
  }
}

testAPI();