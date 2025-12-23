const mongoose = require('mongoose');

// 更新boss001的积分号W和积分号Z
async function updateBossIntegral() {
  try {
    console.log('🔍 正在连接数据库...');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    const User = mongoose.model('User', {
      username: String,
      integral_w: String,
      integral_z: String,
      wechat: String,
      wallet: {
        alipay_account: String
      }
    }, 'users');

    // 更新boss001用户的积分号
    const result = await User.findOneAndUpdate(
      { username: 'boss001' },
      {
        integral_w: 'boss001_wechat', // 微信号
        integral_z: 'boss001_alipay'  // 支付宝号
      },
      { new: true }
    );

    if (result) {
      console.log('✅ 成功更新boss001的积分号!');
      console.log('📋 更新后的信息:');
      console.log('   用户名:', result.username);
      console.log('   积分号W (微信):', result.integral_w);
      console.log('   积分号Z (支付宝):', result.integral_z);
      console.log('   微信号:', result.wechat);
      console.log('   支付宝账号:', result.wallet?.alipay_account);
    } else {
      console.log('❌ 找不到boss001用户');
    }

  } catch (error) {
    console.error('❌ 更新失败:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

updateBossIntegral();