const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

// 主管账号信息（用于创建销售用户）
const MANAGER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJmZWNhNmRlOTAyMjZkOWUxZmUyMGIiLCJpYXQiOjE3NjQ3NTAxMTgsImV4cCI6MTc2NTM1NDkxOH0.WXqey1mBDENtLeOA0-r65nuctql2CatJGCr51SjuhKY';

async function addSalesUser() {
  try {
    console.log('🧪 开始创建新的销售用户...\n');

    const newSalesUser = {
      username: 'sales_new',
      password: '123456',
      role: 'sales',
      nickname: '新销售',
      phone: '13800138000',
      notes: '通过主管创建的新销售用户'
    };

    console.log('📝 用户信息:', newSalesUser);

    const response = await axios.post(`${API_BASE}/auth/register`, newSalesUser, {
      headers: {
        'Authorization': `Bearer ${MANAGER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.success) {
      console.log('✅ 销售用户创建成功!');
      console.log('👤 用户详情:', {
        id: response.data.user.id,
        username: response.data.user.username,
        role: response.data.user.role,
        nickname: response.data.user.nickname
      });
    } else {
      console.log('❌ 创建失败:', response.data.message);
    }

  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.log('❌ 创建用户错误:', message);
  }
}

// 运行创建用户
addSalesUser();