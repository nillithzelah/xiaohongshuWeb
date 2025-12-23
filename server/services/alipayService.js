const AlipaySdk = require('alipay-sdk').default;

/**
 * 阿里支付服务类
 * 处理转账到支付宝账户的业务逻辑
 */
class AlipayService {
  constructor() {
    this.sdk = null;
    this.isSandbox = process.env.ALIPAY_SANDBOX === 'true';
    this.gateway = process.env.ALIPAY_GATEWAY ||
      (this.isSandbox
        ? 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'
        : 'https://openapi.alipay.com/gateway.do'
      );

    this.init();
  }

  /**
   * 初始化阿里支付SDK
   */
  init() {
    const config = {
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      signType: 'RSA2',
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY?.replace(/\\n/g, '\n'),
      gateway: this.gateway,
      timeout: 30000, // 30秒超时
      camelcase: true
    };

    // 验证配置
    if (!config.appId) {
      console.warn('⚠️ 阿里支付AppID未配置，将使用模拟模式');
      this.sdk = null;
      return;
    }

    if (!config.privateKey || !config.alipayPublicKey) {
      console.warn('⚠️ 阿里支付密钥未配置，将使用模拟模式');
      this.sdk = null;
      return;
    }

    try {
      this.sdk = new AlipaySdk(config);
      console.log(`✅ 阿里支付SDK初始化成功 (${this.isSandbox ? '沙箱' : '生产'}环境)`);
    } catch (error) {
      console.error('❌ 阿里支付SDK初始化失败:', error.message);
      this.sdk = null;
    }
  }

  /**
   * 转账到支付宝账户
   * @param {Object} params - 转账参数
   * @param {string} params.outBizNo - 商户订单号
   * @param {string} params.payeeAccount - 收款方账号
   * @param {string} params.payeeRealName - 收款方真实姓名
   * @param {number} params.amount - 转账金额
   * @param {string} params.remark - 转账备注
   * @returns {Promise<Object>} 转账结果
   */
  async transferToAccount(params) {
    if (!this.sdk) {
      // 模拟模式 - 用于测试
      console.log('🔄 阿里支付模拟模式: 执行转账', params);
      return this.mockTransfer(params);
    }

    try {
      console.log(`🔄 开始阿里支付转账: ${params.outBizNo}, 金额: ${params.amount}元`);

      const bizContent = {
        out_biz_no: params.outBizNo,
        payee_type: 'ALIPAY_LOGONID',
        payee_account: params.payeeAccount,
        amount: params.amount.toString(),
        payee_real_name: params.payeeRealName,
        remark: params.remark || '任务奖励'
      };

      const result = await this.sdk.exec('alipay.fund.trans.toaccount.transfer', {
        bizContent
      });

      console.log(`✅ 阿里支付转账请求成功: ${params.outBizNo}`);

      // 解析响应
      const response = result.alipay_fund_trans_toaccount_transfer_response;

      if (response.code === '10000') {
        return {
          success: true,
          orderId: response.order_id,
          outBizNo: response.out_biz_no,
          payDate: response.pay_date,
          status: 'SUCCESS'
        };
      } else {
        return {
          success: false,
          errorCode: response.code,
          errorMessage: response.msg,
          subCode: response.sub_code,
          subMessage: response.sub_msg
        };
      }

    } catch (error) {
      console.error('❌ 阿里支付转账失败:', error);
      return {
        success: false,
        errorMessage: error.message || '网络请求失败'
      };
    }
  }

  /**
   * 查询转账订单状态
   * @param {string} orderId - 支付宝转账单据号
   * @param {string} outBizNo - 商户订单号
   * @returns {Promise<Object>} 查询结果
   */
  async queryTransfer(orderId, outBizNo) {
    if (!this.sdk) {
      return { success: false, errorMessage: '阿里支付未配置' };
    }

    try {
      const result = await this.sdk.exec('alipay.fund.trans.order.query', {
        bizContent: {
          order_id: orderId,
          out_biz_no: outBizNo
        }
      });

      const response = result.alipay_fund_trans_order_query_response;

      if (response.code === '10000') {
        return {
          success: true,
          status: response.status,
          payDate: response.pay_date,
          failReason: response.fail_reason
        };
      } else {
        return {
          success: false,
          errorCode: response.code,
          errorMessage: response.msg
        };
      }

    } catch (error) {
      console.error('❌ 查询转账订单失败:', error);
      return {
        success: false,
        errorMessage: error.message || '查询失败'
      };
    }
  }

  /**
   * 模拟转账 - 用于测试
   */
  mockTransfer(params) {
    // 模拟成功或失败
    const isSuccess = Math.random() > 0.1; // 90%成功率

    if (isSuccess) {
      return {
        success: true,
        orderId: `mock_${Date.now()}`,
        outBizNo: params.outBizNo,
        payDate: new Date().toISOString(),
        status: 'SUCCESS'
      };
    } else {
      return {
        success: false,
        errorCode: 'MOCK_ERROR',
        errorMessage: '模拟转账失败',
        subCode: 'PAYEE_NOT_EXIST',
        subMessage: '收款方不存在'
      };
    }
  }

  /**
   * 检查配置是否完整
   */
  isConfigured() {
    return this.sdk !== null;
  }
}

// 创建单例实例
const alipayService = new AlipayService();

module.exports = alipayService;