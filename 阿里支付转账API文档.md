# 阿里支付转账到支付宝账户API文档

## 接口名称
`alipay.fund.trans.toaccount.transfer`

## 接口描述
单笔转账到支付宝账户接口。支持企业向个人或企业支付宝账户转账。

## 请求地址
- 生产环境：https://openapi.alipay.com/gateway.do
- 沙箱环境：https://openapi-sandbox.dl.alipaydev.com/gateway.do

## 请求参数

### 公共请求参数
| 参数名 | 类型 | 是否必填 | 描述 |
|--------|------|----------|------|
| app_id | String | 是 | 支付宝分配给开发者的应用ID |
| method | String | 是 | 接口名称：alipay.fund.trans.toaccount.transfer |
| format | String | 否 | 仅支持JSON |
| charset | String | 是 | 请求使用的编码格式，如utf-8 |
| sign_type | String | 是 | 商户生成签名字符串所使用的签名算法类型，目前支持RSA2和RSA |
| sign | String | 是 | 商户请求参数的签名串 |
| timestamp | String | 是 | 发送请求的时间，格式"yyyy-MM-dd HH:mm:ss" |
| version | String | 是 | 调用的接口版本，固定为：1.0 |
| biz_content | String | 是 | 请求参数的集合，最大长度不限，除公共参数外所有请求参数都必须放在这个参数中传递 |

### 业务请求参数 (biz_content)
| 参数名 | 类型 | 是否必填 | 最大长度 | 描述 |
|--------|------|----------|----------|------|
| out_biz_no | String | 是 | 64 | 商户转账唯一订单号 |
| payee_type | String | 是 | 10 | 收款方账户类型：<br>ALIPAY_LOGONID：支付宝登录号，支持邮箱和手机号格式<br>ALIPAY_USERID：支付宝用户ID |
| payee_account | String | 是 | 100 | 收款方账户 |
| amount | String | 是 | 16 | 转账金额，单位：元 |
| payee_real_name | String | 否 | 100 | 收款方真实姓名 |
| remark | String | 否 | 200 | 转账备注 |

## 响应参数

### 同步响应
```json
{
  "alipay_fund_trans_toaccount_transfer_response": {
    "code": "10000",
    "msg": "Success",
    "order_id": "20160627110070001502220006780837",
    "out_biz_no": "3142321423432",
    "pay_date": "2013-01-01 08:08:08"
  },
  "sign": "ERITJKEIJKJHKKKKKKKHJEREEEEEEEEEEE"
}
```

### 响应参数说明
| 参数名 | 类型 | 描述 |
|--------|------|------|
| code | String | 网关返回码 |
| msg | String | 网关返回码描述 |
| order_id | String | 支付宝转账单据号 |
| out_biz_no | String | 商户转账唯一订单号 |
| pay_date | String | 支付时间 |

## 错误码说明

### 常见错误码
| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| 10000 | 接口调用成功 | - |
| 40004 | 业务处理失败 | 检查参数是否正确 |
| 20000 | 服务不可用 | 稍后重试 |
| 40001 | 缺少必选参数 | 检查必填参数 |
| 40002 | 非法的参数 | 检查参数格式 |
| 40006 | 权限不足 | 检查AppID和密钥配置 |

### 转账相关错误码
| 错误码 | 描述 |
|--------|------|
| PAYEE_NOT_EXIST | 收款方不存在 |
| PAYMENT_AMOUNT_LIMIT_ERROR | 付款金额超限 |
| PAYER_BALANCE_NOT_ENOUGH | 付款方余额不足 |
| PAYMENT_INFO_INCONSISTENCY | 付款信息不一致 |

## 开发准备

### 1. 注册支付宝开发者账号
访问：https://open.alipay.com

### 2. 创建应用
- 应用类型：企业应用
- 能力：转账到支付宝账户

### 3. 配置密钥
- 生成RSA密钥对
- 在支付宝开放平台配置公钥
- 私钥保存在服务器

### 4. 沙箱测试
- 使用沙箱环境测试接口
- 沙箱账号：https://openhome.alipay.com/platform/appDaily.htm

## SDK集成

### Node.js SDK
```bash
npm install alipay-sdk
```

### 基本使用
```javascript
const AlipaySdk = require('alipay-sdk').default;
const alipaySdk = new AlipaySdk({
  appId: 'your_app_id',
  privateKey: 'your_private_key',
  signType: 'RSA2',
  alipayPublicKey: 'alipay_public_key',
  gateway: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do' // 沙箱环境
});

// 转账请求
const result = await alipaySdk.exec('alipay.fund.trans.toaccount.transfer', {
  bizContent: {
    out_biz_no: 'transfer_123456',
    payee_type: 'ALIPAY_LOGONID',
    payee_account: 'user@example.com',
    amount: '100.00',
    payee_real_name: '张三',
    remark: '任务奖励'
  }
});
```

## 配置说明

### 环境变量配置 (.env文件)

在项目根目录的`.env`文件中添加以下阿里支付配置：

```env
# 阿里支付配置
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n你的应用私钥内容\n-----END RSA PRIVATE KEY-----
ALIPAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n支付宝公钥内容\n-----END PUBLIC KEY-----
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_SANDBOX=true
```

### 配置项说明

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| ALIPAY_APP_ID | 支付宝分配的应用ID | 在支付宝开放平台应用详情中查看 |
| ALIPAY_PRIVATE_KEY | 应用私钥 | 使用openssl生成RSA密钥对，私钥配置在此 |
| ALIPAY_PUBLIC_KEY | 支付宝公钥 | 在支付宝开放平台应用配置中获取 |
| ALIPAY_GATEWAY | 接口地址 | 沙箱环境使用测试地址，生产环境使用正式地址 |
| ALIPAY_SANDBOX | 是否沙箱环境 | 开发测试时设为true，生产环境设为false |

### 获取配置步骤

1. **注册开发者账号**：访问 https://open.alipay.com 注册企业开发者账号
2. **创建应用**：在控制台创建应用，选择"转账到支付宝账户"能力
3. **生成密钥**：
   ```bash
   # 生成RSA密钥对
   openssl genrsa -out private_key.pem 2048
   openssl rsa -in private_key.pem -pubout -out public_key.pem

   # 查看私钥内容（用于配置）
   cat private_key.pem

   # 查看公钥内容（用于支付宝平台配置）
   cat public_key.pem
   ```
4. **配置公钥**：在支付宝开放平台应用配置中上传公钥
5. **获取AppID**：在应用详情中查看AppID
6. **获取支付宝公钥**：配置公钥后，平台会生成支付宝公钥

## 注意事项

1. **单笔限额**：单笔最高50000元
2. **日限额**：根据账户类型不同
3. **实时到账**：金额≤5000元实时到账
4. **异步通知**：支持转账结果异步通知
5. **幂等性**：相同out_biz_no重复请求会失败
6. **安全**：私钥请妥善保管，不要在代码中明文存储

## 相关文档
- [转账到支付宝账户](https://opendocs.alipay.com/open/309/106237)
- [SDK下载](https://opendocs.alipay.com/open/54/103419)
- [沙箱环境](https://opendocs.alipay.com/open/200/105311)