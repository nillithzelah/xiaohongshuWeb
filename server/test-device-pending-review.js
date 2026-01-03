const axios = require('axios');

const API_BASE = 'http://localhost:5000/xiaohongshu/api';

// 获取管理员token
async function getAdminToken() {
  try {
    console.log('🔑 获取管理员token...\n');

    const loginData = {
      username: 'boss', // 数据库中的boss用户名
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
      return response.data.token;
    } else {
      console.log('❌ 登录失败:', response.data.message);
      return null;
    }

  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.log('❌ 登录错误:', message);
    return null;
  }
}

// 测试设备审核API
async function testDevicePendingReview() {
  try {
    console.log('🔍 测试设备审核API...\n');

    // 直接使用已知的boss token
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyNTAzZTgwZTZiMTYzMWVkNDZmYWYiLCJpYXQiOjE3NjcxNDU5MzEsImV4cCI6MTc2Nzc1MDczMX0.SvGBrMZHS8aRsvMRolT7Ek9v6HQ7IdU8eMWhSqWG6NE';

    console.log('🔍 调用设备审核API...');

    const response = await axios.get(`http://localhost:5000/xiaohongshu/api/devices/pending-review`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 10
      }
    });

    console.log('✅ API响应成功:');
    console.log('📊 数据:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ API测试失败:');
    console.error('状态码:', error.response?.status);
    console.error('错误信息:', error.response?.data);
    console.error('完整错误:', error.message);
    if (error.response?.data?.error) {
      console.error('详细错误:', error.response.data.error);
    }
  }
}

testDevicePendingReview();