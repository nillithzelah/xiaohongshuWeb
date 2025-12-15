// 测试小程序配置是否正确
const config = require('./miniprogram/config.js');

console.log('🔍 小程序配置测试');
console.log('==================');

console.log('当前环境:', config.ENV);
console.log('API基础地址:', config.API_BASE_URL);
console.log('调试模式:', config.DEBUG);

console.log('\nAPI路径:');
Object.entries(config.API).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('\n✅ 配置测试完成');

if (config.ENV === 'development' && config.API_BASE_URL === 'http://localhost:5000') {
  console.log('✅ 开发环境配置正确');
} else if (config.ENV === 'production' && config.API_BASE_URL === 'https://www.wubug.cc') {
  console.log('✅ 生产环境配置正确');
} else {
  console.log('❌ 配置可能有问题');
}