// 测试用户列表API
const axios = require('axios');

// 使用有效的token（从服务器日志中获取）
const VALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMTk5M2I5OTE5MDU4OTEwNjQzNzMiLCJpYXQiOjE3NjU2MTMzNjIsImV4cCI6MTc2NjIxODE2Mn0.18ZI22QnLI_GXErMHoxb_sT58_Il39TXZAeJUaAfCWA';

async function testUserListAPI() {
  console.log('🧪 测试用户列表API...\n');

  try {
    const response = await axios.get('http://localhost:5000/xiaohongshu/api/devices/users/list', {
      headers: {
        'Authorization': `Bearer ${VALID_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ API调用成功');
    console.log('📊 返回数据:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data) {
      console.log(`\n👥 用户列表 (${response.data.data.length}个用户):`);
      response.data.data.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.username} (${user.nickname}) - 角色: ${user.role}`);
      });

      // 统计不同角色的用户
      const roleStats = {};
      response.data.data.forEach(user => {
        roleStats[user.role] = (roleStats[user.role] || 0) + 1;
      });

      console.log('\n📈 角色统计:');
      Object.entries(roleStats).forEach(([role, count]) => {
        console.log(`  ${role}: ${count}个`);
      });

    } else {
      console.log('❌ API返回失败或无数据');
    }

  } catch (error) {
    console.error('❌ API调用失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testUserListAPI();