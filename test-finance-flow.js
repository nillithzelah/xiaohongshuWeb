const axios = require('axios');

// 测试配置
const BASE_URL = 'http://localhost:5000/xiaohongshu/api';
const TEST_TOKENS = {
  BOSS_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjYxMTYwNjAsImV4cCI6MTc2NjcyMDg2MH0.A5IpulKUv1i-AmuYMnsSVptlD3H-Yv1AHJZMqb5QmPA',
  FINANCE_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjYxMTYwNjAsImV4cCI6MTc2NjcyMDg2MH0.A5IpulKUv1i-AmuYMnsSVptlD3H-Yv1AHJZMqb5QmPA'
};

const headers = {
  'Authorization': `Bearer ${TEST_TOKENS.BOSS_TOKEN}`,
  'Content-Type': 'application/json'
};

console.log('🧪 开始测试财务流程...\n');

// 测试步骤
async function testFinanceFlow() {
  try {
    // 步骤1: 获取待审核任务
    console.log('📋 步骤1: 获取待审核任务');
    console.log(`🔗 请求URL: ${BASE_URL}/reviews/pending`);
    console.log(`🔑 使用Token: ${TEST_TOKENS.BOSS_TOKEN.substring(0, 20)}...`);

    const pendingResponse = await axios.get(`${BASE_URL}/reviews/pending`, { headers });
    console.log(`✅ 找到 ${pendingResponse.data.reviews.length} 个待审核任务`);

    if (pendingResponse.data.reviews.length === 0) {
      console.log('⚠️ 没有待审核任务，跳过测试');
      return;
    }

    // 选择第一个待审核任务
    const testReview = pendingResponse.data.reviews[0];
    console.log(`🎯 选择测试任务: ${testReview._id} (${testReview.imageType})`);
    console.log(`💰 任务价格: ${testReview.snapshotPrice}元`);

    // 步骤2: 带教老师审核通过
    console.log('\n👨‍🏫 步骤2: 带教老师审核通过');
    const mentorReviewResponse = await axios.put(`${BASE_URL}/reviews/${testReview._id}/mentor-review`, {
      approved: true,
      comment: '测试审核通过'
    }, { headers });
    console.log('✅ 带教老师审核完成');

    // 步骤3: 主管确认通过
    console.log('\n👔 步骤3: 主管确认通过');
    const managerReviewResponse = await axios.put(`${BASE_URL}/reviews/${testReview._id}/manager-approve`, {
      approved: true,
      comment: '主管确认通过'
    }, { headers });
    console.log('✅ 主管确认完成');

    // 步骤4: 财务处理
    console.log('\n💰 步骤4: 财务处理');
    console.log(`💸 处理金额: ${testReview.snapshotPrice}元`);
    console.log(`💹 佣金: ${testReview.snapshotCommission1 || 0}元`);

    const financeResponse = await axios.put(`${BASE_URL}/reviews/${testReview._id}/finance-process`, {
      amount: testReview.snapshotPrice,
      commission: testReview.snapshotCommission1 || 0
    }, { headers });
    console.log('✅ 财务处理完成');

    // 步骤5: 验证财务打款
    console.log('\n💸 步骤5: 验证财务打款');
    const pendingPaymentsResponse = await axios.get(`${BASE_URL}/admin/finance/pending`, { headers });
    console.log(`📊 待打款记录数: ${pendingPaymentsResponse.data.transactions.length}`);

    if (pendingPaymentsResponse.data.transactions.length > 0) {
      console.log('🎯 找到待打款记录，执行打款...');

      // 执行打款
      const payResponse = await axios.post(`${BASE_URL}/admin/finance/pay`, {
        transaction_ids: pendingPaymentsResponse.data.transactions.map(t => t._id)
      }, { headers });

      console.log(`✅ 成功打款 ${payResponse.data.modifiedCount} 笔交易`);
    }

    // 步骤6: 验证最终状态
    console.log('\n🔍 步骤6: 验证最终状态');
    const finalReviewResponse = await axios.get(`${BASE_URL}/reviews/${testReview._id}`, { headers });
    console.log(`📋 任务最终状态: ${finalReviewResponse.data.review.status}`);

    console.log('\n🎉 财务流程测试完成！所有步骤都成功执行。');

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error('📋 错误信息:', error.message);

    if (error.response) {
      console.error('📊 响应状态:', error.response.status);
      console.error('📄 响应数据:', JSON.stringify(error.response.data, null, 2));
      console.error('🔗 请求URL:', error.config?.url);
      console.error('📨 请求方法:', error.config?.method);
    } else if (error.request) {
      console.error('🌐 网络错误，无法连接到服务器');
      console.error('💡 请检查服务器是否正在运行 (localhost:3000)');
    } else {
      console.error('🔧 其他错误:', error.message);
    }

    if (error.response?.status === 400) {
      console.log('💡 提示: 这可能是业务逻辑验证，请检查错误信息');
    } else if (error.response?.status === 403) {
      console.log('🔐 提示: 权限不足，请检查token');
    } else if (error.response?.status === 404) {
      console.log('🔍 提示: 资源不存在，请检查ID');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🔌 提示: 无法连接到服务器，请确保服务器正在运行');
    }
  }
}

// 运行测试
testFinanceFlow();