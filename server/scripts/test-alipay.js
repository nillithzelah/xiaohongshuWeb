/**
 * 阿里支付集成测试脚本
 * 用于测试阿里支付转账功能
 */

const alipayService = require('../services/alipayService');

async function testAlipayIntegration() {
  console.log('🧪 开始阿里支付集成测试...\n');

  // 检查配置
  console.log('1. 检查阿里支付配置...');
  if (!alipayService.isConfigured()) {
    console.log('❌ 阿里支付未配置，将使用模拟模式测试');
    console.log('请在.env文件中配置以下变量：');
    console.log('- ALIPAY_APP_ID');
    console.log('- ALIPAY_PRIVATE_KEY');
    console.log('- ALIPAY_PUBLIC_KEY');
    console.log('- ALIPAY_SANDBOX=true (沙箱环境)\n');
  } else {
    console.log('✅ 阿里支付配置正常\n');
  }

  // 测试转账功能
  console.log('2. 测试转账功能...');
  try {
    const testTransfer = {
      outBizNo: `test_${Date.now()}`,
      payeeAccount: 'test@example.com', // 测试账号
      payeeRealName: '测试用户',
      amount: 0.01, // 测试金额1分
      remark: '集成测试转账'
    };

    console.log('转账参数:', testTransfer);

    const result = await alipayService.transferToAccount(testTransfer);

    if (result.success) {
      console.log('✅ 转账成功!');
      console.log('支付宝订单号:', result.orderId);
      console.log('支付时间:', result.payDate);
      console.log('状态:', result.status);
    } else {
      console.log('❌ 转账失败!');
      console.log('错误信息:', result.errorMessage);
      console.log('错误码:', result.errorCode);
      if (result.subMessage) {
        console.log('子错误信息:', result.subMessage);
      }
    }

  } catch (error) {
    console.error('❌ 转账测试异常:', error.message);
  }

  console.log('\n3. 测试查询功能...');
  try {
    // 如果有订单号，可以测试查询
    const mockOrderId = 'mock_order_123';
    const result = await alipayService.queryTransfer(mockOrderId, 'test_biz_no');

    if (result.success) {
      console.log('✅ 查询成功!');
      console.log('订单状态:', result.status);
      console.log('支付时间:', result.payDate);
    } else {
      console.log('❌ 查询失败!');
      console.log('错误信息:', result.errorMessage);
    }

  } catch (error) {
    console.error('❌ 查询测试异常:', error.message);
  }

  console.log('\n🎉 测试完成!');
  console.log('\n注意事项:');
  console.log('- 生产环境请确保配置正确的阿里支付参数');
  console.log('- 测试金额建议使用0.01元');
  console.log('- 沙箱环境不支持真实转账');
  console.log('- 生产环境转账有单笔限额和日限额限制');

  process.exit(0);
}

// 运行测试
if (require.main === module) {
  testAlipayIntegration().catch(console.error);
}

module.exports = { testAlipayIntegration };