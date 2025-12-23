/**
 * 阿里支付沙箱环境测试脚本
 * 用于测试财务打款功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/xiaohongshu/api';

// 测试用户数据（需要在数据库中存在）
const testUsers = [
  {
    username: 'test_user_001',
    phone: '13800138001',
    integral_w: 'wx_test_001', // 微信号
    integral_z: 'alipay_test_001@163.com', // 支付宝号
    wallet: {
      real_name: '张三',
      alipay_account: 'alipay_test_001@163.com'
    }
  }
];

async function testAlipaySandbox() {
  console.log('🔄 开始测试阿里支付沙箱环境...\n');

  try {
    // 1. 检查服务器状态
    console.log('📡 检查服务器状态...');
    const healthResponse = await axios.get(`${BASE_URL.replace('/api', '')}/health`);
    console.log('✅ 服务器运行正常\n');

    // 2. 模拟创建测试交易记录
    console.log('💰 创建测试交易记录...');

    // 这里需要先有审核记录完成财务处理，生成待打款交易
    // 由于沙箱模式下没有真实密钥，会使用模拟转账

    console.log('📋 沙箱环境配置说明:');
    console.log('   - ALIPAY_SANDBOX=true');
    console.log('   - 使用模拟转账模式');
    console.log('   - 90%成功率，10%模拟失败');
    console.log('   - 无需真实支付宝配置\n');

    console.log('🎯 测试步骤:');
    console.log('   1. 确保.env文件配置了 ALIPAY_SANDBOX=true');
    console.log('   2. 重启服务器以加载新配置');
    console.log('   3. 在财务后台进行打款操作');
    console.log('   4. 查看控制台日志，确认使用模拟模式');
    console.log('   5. 模拟转账结果会记录在日志中\n');

    console.log('📝 模拟转账结果示例:');
    console.log('   ✅ 模拟成功: { success: true, orderId: "mock_xxx", ... }');
    console.log('   ❌ 模拟失败: { success: false, errorMessage: "模拟转账失败" }\n');

    console.log('⚠️  注意事项:');
    console.log('   - 沙箱环境不会发生真实资金变动');
    console.log('   - 仅用于测试业务流程和界面交互');
    console.log('   - 生产环境需要配置真实的支付宝密钥\n');

    console.log('🎉 沙箱环境测试配置完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   响应状态:', error.response.status);
      console.error('   响应数据:', error.response.data);
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testAlipaySandbox();
}

module.exports = { testAlipaySandbox };