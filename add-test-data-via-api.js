const axios = require('axios');

// 配置API基础URL
const API_BASE = 'http://localhost:5000/xiaohongshu/api';

// 使用boss token进行测试
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDkiLCJpYXQiOjE3NjYxMTQ0MjksImV4cCI6MTc2NjcxOTIyOX0.nBm460C_Z1TM9IkJycBpJaw1pAdbbx3mD4SsgEcsXD4';

// 设置axios默认配置
axios.defaults.headers.common['Authorization'] = `Bearer ${TEST_TOKEN}`;

console.log('🚀 开始通过API添加测试财务数据...\n');

// 创建模拟的审核记录（通过API调用）
async function createMockReviewData() {
  console.log('📝 创建模拟审核数据...');

  // 注意：这里我们无法直接通过API创建审核记录，因为需要用户提交
  // 但我们可以展示如何通过正常流程创建数据

  console.log('💡 正常数据创建流程：');
  console.log('   1. 用户提交审核记录 → ImageReview集合');
  console.log('   2. 带教老师审核通过 → status: mentor_approved');
  console.log('   3. 主管确认通过 → status: manager_approved');
  console.log('   4. 财务处理 → status: completed + 创建Transaction记录');
  console.log('   5. 财务打款 → Transaction.status: paid + 用户余额增加');

  console.log('\n📊 当前财务系统状态：');
}

// 检查财务系统数据
async function checkFinanceSystem() {
  try {
    console.log('📊 检查财务统计数据...');
    const statsResponse = await axios.get(`${API_BASE}/admin/finance/stats`);
    console.log('✅ 财务统计:', JSON.stringify(statsResponse.data.stats, null, 2));

    console.log('\n📋 检查待打款列表...');
    const pendingResponse = await axios.get(`${API_BASE}/admin/finance/pending`);
    console.log('✅ 待打款记录数:', pendingResponse.data.transactions.length);

    if (pendingResponse.data.transactions.length > 0) {
      console.log('\n📋 待打款记录详情:');
      pendingResponse.data.transactions.forEach((transaction, index) => {
        console.log(`   ${index + 1}. 用户: ${transaction.user_id?.username || '未知'}`);
        console.log(`      账号: ${transaction.user_id?.wallet?.alipay_account || '未设置'}`);
        console.log(`      金额: ${transaction.amount}元`);
        console.log(`      类型: ${transaction.type}`);
        console.log(`      创建时间: ${new Date(transaction.createdAt).toLocaleString('zh-CN')}`);
        console.log('');
      });

      console.log('💰 模拟财务打款流程...');
      console.log('📤 在财务界面点击"确认打款"按钮，系统会：');
      console.log('   1. 使用MongoDB事务确保数据一致性');
      console.log('   2. 更新Transaction状态为"paid"');
      console.log('   3. 增加用户钱包余额');
      console.log('   4. 记录打款时间戳');

      console.log('\n🎯 打款API调用示例:');
      console.log(`POST ${API_BASE}/admin/finance/pay`);
      console.log('Headers: Authorization: Bearer <token>');
      console.log('Body: { "transaction_ids": ["交易ID1", "交易ID2", ...] }');

    } else {
      console.log('⚠️ 暂无待打款记录');
      console.log('\n💡 如何添加测试数据：');
      console.log('   1. 让用户提交审核记录（通过小程序）');
      console.log('   2. 管理员审核通过记录');
      console.log('   3. 财务处理生成待打款记录');
      console.log('   4. 财务确认打款');
    }

  } catch (error) {
    console.error('❌ 检查财务系统失败:', error.response?.data || error.message);
  }
}

// 显示财务数据流转图
function showDataFlowDiagram() {
  console.log('\n📈 财务数据流转图：');
  console.log(`
用户提交审核
      ↓
审核记录创建 (ImageReview.status: 'pending')
      ↓
带教老师审核 (status: 'mentor_approved')
      ↓
主管确认 (status: 'manager_approved')
      ↓
财务处理 (status: 'completed')
  → 创建Transaction记录 (status: 'pending')
      ↓
财务打款 (Transaction.status: 'paid')
  → 用户钱包余额增加 (wallet.balance += amount)
  → 记录打款时间 (paid_at)
      ↓
统计更新 (totalPaid = Σ paid transactions)
`);
}

// 主函数
async function main() {
  try {
    console.log('🎯 财务系统数据流转演示\n');

    // 显示数据流转图
    showDataFlowDiagram();

    // 创建模拟数据说明
    await createMockReviewData();

    // 检查当前财务系统状态
    await checkFinanceSystem();

    console.log('\n🎉 财务系统检查完成！');
    console.log('💡 要添加真实数据，请按以下步骤操作：');
    console.log('   1. 使用小程序提交审核记录');
    console.log('   2. 在管理后台审核通过');
    console.log('   3. 在财务页面处理并确认打款');

  } catch (error) {
    console.error('❌ 演示失败:', error.message);
  }
}

// 运行演示
main();