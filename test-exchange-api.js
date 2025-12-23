const axios = require('axios');

// 测试积分兑换API
async function testExchangeAPI() {
  try {
    console.log('🔄 测试积分兑换API...');

    // 先获取token
    const loginResponse = await axios.post('http://112.74.163.102:3001/xiaohongshu/api/auth/login', {
      username: 'boss',
      password: '123456'
    });

    if (!loginResponse.data.success) {
      console.error('❌ 登录失败:', loginResponse.data.message);
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ 登录成功，获取到token');

    // 获取用户列表，找一个有积分的用户
    const usersResponse = await axios.get('http://112.74.163.102:3001/xiaohongshu/api/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!usersResponse.data.success) {
      console.error('❌ 获取用户列表失败:', usersResponse.data.message);
      return;
    }

    // 找一个有积分的兼职用户
    const partTimeUser = usersResponse.data.users.find(u => u.role === 'part_time' && u.points > 0);
    if (!partTimeUser) {
      console.error('❌ 没有找到有积分的兼职用户');
      return;
    }

    console.log(`🎯 找到用户: ${partTimeUser.username}, 积分: ${partTimeUser.points}`);

    // 测试积分兑换
    const exchangeResponse = await axios.post(
      `http://112.74.163.102:3001/xiaohongshu/api/users/${partTimeUser._id}/exchange-points`,
      { pointsToExchange: 10 },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (exchangeResponse.data.success) {
      console.log('✅ 积分兑换成功!');
      console.log('   兑换详情:', exchangeResponse.data.data);
    } else {
      console.error('❌ 积分兑换失败:', exchangeResponse.data.message);
    }

  } catch (error) {
    console.error('❌ 测试出错:', error.response?.data || error.message);
  }
}

testExchangeAPI();