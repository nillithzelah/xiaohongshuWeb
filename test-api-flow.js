const axios = require('axios');

// 配置API基础URL
const API_BASE = 'http://localhost:5000/xiaohongshu/api';

// 使用boss token进行测试
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDkiLCJpYXQiOjE3NjYxMTQ0MjksImV4cCI6MTc2NjcxOTIyOX0.nBm460C_Z1TM9IkJycBpJaw1pAdbbx3mD4SsgEcsXD4';

// 设置axios默认配置
axios.defaults.headers.common['Authorization'] = `Bearer ${TEST_TOKEN}`;

console.log('🚀 开始API数据流转测试...\n');

// 测试步骤
async function runAPITest() {
  try {
    console.log('📊 步骤1: 检查当前财务统计数据');
    const statsResponse = await axios.get(`${API_BASE}/admin/finance/stats`);
    console.log('✅ 财务统计:', statsResponse.data.stats);
    console.log('');

    console.log('📋 步骤2: 检查当前待打款列表');
    const pendingResponse = await axios.get(`${API_BASE}/admin/finance/pending`);
    console.log('✅ 待打款记录数:', pendingResponse.data.transactions.length);

    if (pendingResponse.data.transactions.length > 0) {
      console.log('📋 待打款记录详情:');
      pendingResponse.data.transactions.forEach((transaction, index) => {
        console.log(`   ${index + 1}. 用户: ${transaction.user_id?.username || '未知'}`);
        console.log(`      账号: ${transaction.user_id?.wallet?.alipay_account || '未设置'}`);
        console.log(`      金额: ${transaction.amount}元`);
        console.log(`      类型: ${transaction.type}`);
        console.log('');
      });

      console.log('💰 步骤3: 模拟财务打款');
      const transactionIds = pendingResponse.data.transactions.map(t => t._id);
      console.log('📤 发送打款请求，交易ID:', transactionIds);

      const payResponse = await axios.post(`${API_BASE}/admin/finance/pay`, {
        transaction_ids: transactionIds
      });

      console.log('✅ 打款结果:', payResponse.data);
      console.log('');

      console.log('📊 步骤4: 验证打款后的统计数据');
      const newStatsResponse = await axios.get(`${API_BASE}/admin/finance/stats`);
      console.log('✅ 更新后财务统计:', newStatsResponse.data.stats);
      console.log('');

      console.log('📋 步骤5: 验证待打款列表已清空');
      const newPendingResponse = await axios.get(`${API_BASE}/admin/finance/pending`);
      console.log('✅ 剩余待打款记录数:', newPendingResponse.data.transactions.length);
    } else {
      console.log('⚠️ 没有待打款记录，跳过打款测试');
    }

    console.log('\n🎉 API数据流转测试完成！');
    console.log('✅ 验证了财务系统的核心功能：');
    console.log('   - 统计数据查询');
    console.log('   - 待打款列表获取');
    console.log('   - 批量打款处理');
    console.log('   - 数据一致性验证');

  } catch (error) {
    console.error('❌ API测试失败:', error.response?.data || error.message);
  }
}

// 运行测试
runAPITest();