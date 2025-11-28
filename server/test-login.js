// 简单测试上帝模式登录
const axios = require('axios');

async function testLogin() {
  console.log('🧪 测试上帝模式登录...\n');

  try {
    const response = await axios.post('http://localhost:5000/api/auth/wechat-login', {
      code: 'TEST_USER_001'
    });

    console.log('✅ 登录成功!');
    console.log('用户ID:', response.data.user.id);
    console.log('用户名:', response.data.user.username);
    console.log('角色:', response.data.user.role);
    console.log('Token:', response.data.token.substring(0, 50) + '...');

  } catch (error) {
    console.error('❌ 登录失败:', error.response?.data || error.message);
  }
}

testLogin();