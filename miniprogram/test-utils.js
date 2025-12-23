// 简单的工具方法测试（小程序环境下的基本验证）
// 这个文件仅用于开发阶段验证，不会在生产环境加载

const testUtils = () => {
  console.log('🧪 开始验证工具方法...');

  const app = getApp();
  const utils = app.utils;

  // 测试用户信息变化检测
  const testUserInfoChange = () => {
    const oldInfo = { id: '1', phone: '123', username: 'user1' };
    const newInfo = { id: '1', phone: '123', username: 'user1' };
    const changedInfo = { id: '2', phone: '456', username: 'user2' };

    console.log('✅ 用户信息变化检测测试:');
    console.log('  相同信息:', utils.hasUserInfoChanged(oldInfo, newInfo)); // false
    console.log('  不同信息:', utils.hasUserInfoChanged(oldInfo, changedInfo)); // true
  };

  // 测试安全对象访问
  const testSafeGet = () => {
    const obj = { a: { b: { c: 'value' } } };

    console.log('✅ 安全对象访问测试:');
    console.log('  正常访问:', utils.safeGet(obj, 'a.b.c')); // 'value'
    console.log('  路径不存在:', utils.safeGet(obj, 'a.b.d', 'default')); // 'default'
    console.log('  对象为空:', utils.safeGet(null, 'a.b.c')); // null
  };

  // 测试类型转换
  const testTypeConversion = () => {
    console.log('✅ 类型转换测试:');
    console.log('  数组:', utils.ensureArray([1,2,3])); // [1,2,3]
    console.log('  非数组:', utils.ensureArray('string')); // []
    console.log('  数字:', utils.ensureNumber('123')); // 123
    console.log('  非数字:', utils.ensureNumber('abc', 0)); // 0
  };

  // 运行所有测试
  testUserInfoChange();
  testSafeGet();
  testTypeConversion();

  console.log('🎉 工具方法验证完成！');
};

// 开发环境下自动运行测试
if (getApp().config.ENV === 'development') {
  // 延迟执行，确保app完全加载
  setTimeout(testUtils, 1000);
}

module.exports = { testUtils };