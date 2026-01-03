const TimeUtils = require('./utils/timeUtils');

console.log('=== Node.js服务器中使用本地时间演示 ===\n');

// 1. 获取当前本地时间（北京时间）
console.log('1. 获取当前本地时间:');
const localTime = TimeUtils.getLocalTime();
console.log('   北京时间:', localTime.toLocaleString('zh-CN'));
console.log('   ISO字符串:', localTime.toISOString());
console.log('   时间戳:', localTime.getTime());
console.log();

// 2. 创建指定北京时间
console.log('2. 创建指定北京时间:');
const specificTime = TimeUtils.createBeijingTime(2025, 11, 31, 14, 30, 0); // 2025年12月31日14:30:00
console.log('   指定时间:', specificTime.toLocaleString('zh-CN'));
console.log('   ISO字符串:', specificTime.toISOString());
console.log();

// 3. 在服务器启动时设置时区
console.log('3. 服务器启动时设置时区:');
console.log('   推荐在 server.js 开头添加:');
console.log('   process.env.TZ = \'Asia/Shanghai\';');
console.log();

// 4. 在代码中使用本地时间
console.log('4. 在业务代码中使用本地时间示例:');

// 示例：记录用户登录时间
function recordUserLogin(username) {
  const loginTime = TimeUtils.getLocalTime();
  console.log(`   用户 ${username} 于 ${loginTime.toLocaleString('zh-CN')} 登录`);

  // 存储到数据库（会自动使用本地时间）
  // await User.findOneAndUpdate(
  //   { username },
  //   { lastLoginAt: loginTime }
  // );
}

recordUserLogin('张三');
console.log();

// 5. 定时任务使用本地时间
console.log('5. 定时任务使用本地时间示例:');
function scheduleDailyTask() {
  const now = TimeUtils.getLocalTime();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0); // 明天早上9点

  console.log(`   下次执行时间: ${tomorrow.toLocaleString('zh-CN')}`);
  console.log(`   距离执行还有: ${Math.floor((tomorrow - now) / 1000 / 60)} 分钟`);
}

scheduleDailyTask();
console.log();

// 6. 日志记录使用本地时间
console.log('6. 日志记录使用本地时间:');
function logWithLocalTime(message) {
  const timestamp = TimeUtils.getLocalTime().toLocaleString('zh-CN');
  console.log(`   [${timestamp}] ${message}`);
}

logWithLocalTime('系统启动');
logWithLocalTime('数据库连接成功');
logWithLocalTime('用户请求处理完成');
console.log();

// 7. 数据库查询使用本地时间
console.log('7. 数据库查询使用本地时间示例:');
console.log('   查询今天创建的用户:');

// const today = TimeUtils.getLocalTime();
// today.setHours(0, 0, 0, 0);
// const tomorrow = new Date(today);
// tomorrow.setDate(tomorrow.getDate() + 1);

// const users = await User.find({
//   createdAt: {
//     $gte: today,
//     $lt: tomorrow
//   }
// });

console.log('   今天0点:', TimeUtils.createBeijingTime(2025, 11, 31, 0, 0, 0).toISOString());
console.log('   明天0点:', TimeUtils.createBeijingTime(2026, 0, 1, 0, 0, 0).toISOString());
console.log();

// 8. 最佳实践
console.log('8. 最佳实践:');
console.log('   ✅ 在 server.js 开头设置: process.env.TZ = \'Asia/Shanghai\'');
console.log('   ✅ 使用 TimeUtils.getLocalTime() 获取当前时间');
console.log('   ✅ 使用 TimeUtils.createBeijingTime() 创建指定时间');
console.log('   ✅ 数据库存储时直接使用本地时间对象');
console.log('   ✅ 显示时使用 toLocaleString(\'zh-CN\') 格式化');
console.log('   ✅ 日志中包含本地时间戳');

console.log('\n=== 演示完成 ===');