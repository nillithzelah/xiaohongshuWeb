// 示例：如何在实际业务代码中使用本地时间
const express = require('express');
const TimeUtils = require('./utils/timeUtils');
const router = express.Router();

// 示例1: 用户登录记录
router.post('/login', (req, res) => {
  const { username } = req.body;

  // 使用本地时间记录登录时间
  const loginTime = TimeUtils.getLocalTime();

  console.log(`[${loginTime.toLocaleString('zh-CN')}] 用户 ${username} 登录`);

  // 存储到数据库时直接使用本地时间对象
  // const user = await User.findOneAndUpdate(
  //   { username },
  //   {
  //     lastLoginAt: loginTime,
  //     $push: {
  //       loginHistory: {
  //         time: loginTime,
  //         ip: req.ip
  //       }
  //     }
  //   }
  // );

  res.json({
    success: true,
    message: '登录成功',
    loginTime: loginTime.toLocaleString('zh-CN')
  });
});

// 示例2: 创建订单使用本地时间
router.post('/orders', (req, res) => {
  const { productId, quantity } = req.body;

  // 使用本地时间作为订单创建时间
  const orderTime = TimeUtils.getLocalTime();

  // 生成订单号（使用本地时间戳）
  const orderNumber = `ORD${orderTime.getFullYear()}${(orderTime.getMonth()+1).toString().padStart(2,'0')}${orderTime.getDate().toString().padStart(2,'0')}${orderTime.getHours().toString().padStart(2,'0')}${orderTime.getMinutes().toString().padStart(2,'0')}${orderTime.getSeconds().toString().padStart(2,'0')}`;

  console.log(`[${orderTime.toLocaleString('zh-CN')}] 创建订单 ${orderNumber}`);

  // 存储订单
  // const order = await Order.create({
  //   orderNumber,
  //   productId,
  //   quantity,
  //   createdAt: orderTime, // 直接使用本地时间
  //   status: 'pending'
  // });

  res.json({
    success: true,
    orderNumber,
    createdAt: orderTime.toLocaleString('zh-CN')
  });
});

// 示例3: 查询今日数据
router.get('/today-stats', async (req, res) => {
  // 获取今天的开始和结束时间（本地时间）
  const today = TimeUtils.getLocalTime();
  today.setHours(0, 0, 0, 0); // 今天0点

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // 明天0点

  console.log(`查询时间范围: ${today.toLocaleString('zh-CN')} 到 ${tomorrow.toLocaleString('zh-CN')}`);

  // 查询今日数据
  // const todayOrders = await Order.find({
  //   createdAt: {
  //     $gte: today,
  //     $lt: tomorrow
  //   }
  // });

  // const todayUsers = await User.find({
  //   createdAt: {
  //     $gte: today,
  //     $lt: tomorrow
  //   }
  // });

  res.json({
    success: true,
    date: today.toLocaleString('zh-CN'),
    // ordersCount: todayOrders.length,
    // usersCount: todayUsers.length,
    queryRange: {
      start: today.toISOString(),
      end: tomorrow.toISOString()
    }
  });
});

// 示例4: 定时任务
function scheduleDailyReport() {
  const now = TimeUtils.getLocalTime();
  const nextReportTime = new Date(now);

  // 设置为明天早上9点
  nextReportTime.setDate(nextReportTime.getDate() + 1);
  nextReportTime.setHours(9, 0, 0, 0);

  const timeUntilReport = nextReportTime - now;

  console.log(`[${now.toLocaleString('zh-CN')}] 下次日报生成时间: ${nextReportTime.toLocaleString('zh-CN')}`);
  console.log(`距离下次执行还有: ${Math.floor(timeUntilReport / 1000 / 60)} 分钟`);

  // 设置定时器
  setTimeout(() => {
    generateDailyReport();
  }, timeUntilReport);
}

function generateDailyReport() {
  const reportTime = TimeUtils.getLocalTime();
  console.log(`[${reportTime.toLocaleString('zh-CN')}] 开始生成日报...`);

  // 生成日报逻辑
  // ...

  // 安排下次执行
  scheduleDailyReport();
}

// 启动定时任务
scheduleDailyReport();

// 示例5: API响应中包含本地时间
router.get('/server-time', (req, res) => {
  const serverTime = TimeUtils.getLocalTime();

  res.json({
    success: true,
    serverTime: {
      iso: serverTime.toISOString(),
      local: serverTime.toLocaleString('zh-CN'),
      timestamp: serverTime.getTime(),
      timezone: 'Asia/Shanghai (北京时间 UTC+8)'
    }
  });
});

module.exports = router;