const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer错误处理中间件
app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: '文件过大，请选择小于10MB的图片'
    });
  }
  next(error);
});

// 调试中间件
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`);
  next();
});

// MongoDB 连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

console.log('🔍 正在连接数据库:', MONGODB_URI);

// 强制连接数据库 - 如果连接失败，程序直接退出
mongoose.connect(MONGODB_URI)
.then(() => {
  console.log('✅ MongoDB 连接成功');

  // 只有在数据库连接成功后才注册路由和启动服务器
  registerRoutes();
  startServer();
})
.catch((error) => {
  console.error('❌ MongoDB 连接失败:', error.message);
  console.error('💡 请确保 MongoDB 服务正在运行，并且连接字符串正确');
  console.error('🔧 默认连接字符串: mongodb://127.0.0.1:27017/xiaohongshu_audit');
  process.exit(1); // 强制退出程序
});

// 注册路由函数
function registerRoutes() {
  console.log('🔗 注册路由...');

  // 添加 xiaohongshu 前缀
  const apiRouter = express.Router();

  apiRouter.use('/auth', require('./routes/auth'));
  console.log('✅ /xiaohongshu/api/auth 路由已注册');

  apiRouter.use('/users', require('./routes/user-management'));
  apiRouter.use('/reviews', require('./routes/reviews'));
  apiRouter.use('/admin', require('./routes/admin'));
  apiRouter.use('/client', require('./routes/client'));
  apiRouter.use('/upload', require('./routes/upload'));

  apiRouter.use('/hr', require('./routes/hr'));
  console.log('✅ /xiaohongshu/api/hr 路由已注册');

  apiRouter.use('/manager', require('./routes/manager'));
  console.log('✅ /xiaohongshu/api/manager 路由已注册');

  apiRouter.use('/devices', require('./routes/devices'));
  console.log('✅ /xiaohongshu/api/devices 路由已注册');

  // 测试设备路由是否正确加载
  const devicesRouter = require('./routes/devices');
  console.log('📋 设备路由对象:', typeof devicesRouter);
  console.log('📋 设备路由栈长度:', devicesRouter.stack ? devicesRouter.stack.length : 'N/A');

  // 测试路由
  apiRouter.get('/test', (req, res) => {
    console.log('🧪 测试路由被调用!');
    res.json({
      success: true,
      message: '测试路由工作正常',
      env: {
        XIAOHONGSHU_COOKIE_EXISTS: !!process.env.XIAOHONGSHU_COOKIE,
        XIAOHONGSHU_COOKIE_LENGTH: process.env.XIAOHONGSHU_COOKIE ? process.env.XIAOHONGSHU_COOKIE.length : 0
      }
    });
  });

  // 挂载到 /xiaohongshu 前缀
  app.use('/xiaohongshu/api', apiRouter);

  console.log('🎉 所有路由注册完成');
}

// 启动服务器函数
function startServer() {
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`🚀 服务器启动成功，监听端口 ${PORT}`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log('🎯 API 基础路径: http://localhost:' + PORT + '/xiaohongshu/api');
    console.log('🔄 服务正在运行中...');

    // 启动持续检查服务
    const continuousCheckService = require('./services/continuousCheckService');
    continuousCheckService.start();
  });

  // 处理服务器错误
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${PORT} 已被占用`);
      console.error('💡 请尝试更换端口或停止占用该端口的进程');
    } else {
      console.error('❌ 服务器启动失败:', error.message);
    }
    process.exit(1);
  });

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error);
    process.exit(1);
  });

  // 处理未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的Promise拒绝:', reason);
    process.exit(1);
  });

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n🛑 收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
      console.log('✅ 服务器已关闭');
      mongoose.connection.close()
        .then(() => {
          console.log('✅ 数据库连接已关闭');
          process.exit(0);
        })
        .catch((err) => {
          console.error('❌ 关闭数据库连接时出错:', err);
          process.exit(1);
        });
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
      console.log('✅ 服务器已关闭');
      mongoose.connection.close()
        .then(() => {
          console.log('✅ 数据库连接已关闭');
          process.exit(0);
        })
        .catch((err) => {
          console.error('❌ 关闭数据库连接时出错:', err);
          process.exit(1);
        });
    });
  });
}