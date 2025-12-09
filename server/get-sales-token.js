const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function getSalesToken() {
  try {
    console.log('🔑 获取销售用户token...\n');

    const loginData = {
      username: 'sales_new',
      password: '123456'
    };

    console.log('📝 登录信息:', loginData);

    const response = await axios.post(`${API_BASE}/auth/admin-login`, loginData);

    if (response.data.success) {
      console.log('✅ 登录成功!');
      console.log('👤 用户信息:', {
        username: response.data.user.username,
        role: response.data.user.role,
        nickname: response.data.user.nickname
      });
      console.log('🔑 Token:', response.data.token);
      console.log('\n📋 请将此token复制到test-create-lead.js中使用');
    } else {
      console.log('❌ 登录失败:', response.data.message);
    }

  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.log('❌ 登录错误:', message);
  }
}

// 运行获取token
getSalesToken();