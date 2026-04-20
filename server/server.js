const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const WebSocket = require('ws');

// 设置服务器时区为北京时间
process.env.TZ = 'Asia/Shanghai';

// 加载环境变量
dotenv.config({ path: './server/.env' });

const app = express();

// 信任反向代理（Nginx）设置的 X-Forwarded-For 头
// 这样限流功能可以正确识别真实用户IP
app.set('trust proxy', true);

// 安全的CORS配置 - 仅允许白名单域名
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,https://yourdomain.com,https://admin.yourdomain.com'
).split(',');

app.use(cors({
  origin: function(origin, callback) {
    // 允许没有origin的请求（如移动应用、Postman等）
    if (!origin) return callback(null, true);

    // 移除尾部斜杠进行统一比较
    const normalizedOrigin = origin.replace(/\/$/, '');
    const normalizedAllowed = allowedOrigins.map(o => o.trim().replace(/\/$/, ''));

    if (normalizedAllowed.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn('⚠️ CORS阻止的请求来源:', origin);
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 安全响应头 - 使用 Helmet
app.use(helmet({
  // Content-Security-Policy: 限制资源加载来源
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  // 防止点击劫持
  frameguard: { action: 'deny' },
  // XSS 保护
  xssFilter: true,
  // 禁止 MIME 类型嗅探
  noSniff: true,
  // HSTS (仅在 HTTPS 时启用)
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// 速率限制中间件 - 防止暴力攻击
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 500, // 限制每个IP 15分钟内最多500个请求（适配小程序多用户场景）
  message: { success: false, message: '请求过于频繁，请稍后重试' },
  standardHeaders: true,
  legacyHeaders: false,
  // 跳过成功请求的速率限制（可选）
  skipSuccessfulRequests: false
});

// 更严格的登录速率限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 15分钟内最多5次登录尝试
  message: { success: false, message: '登录尝试过多，请15分钟后再试' },
  skipSuccessfulRequests: false
});

// 中间件
// app.use(limiter); // 全局速率限制 - 已关闭
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// XSS 防护中间件 - 全局输入清理
const { sanitizeMiddleware } = require('./middleware/sanitize');
app.use(sanitizeMiddleware);
console.log('✅ XSS 防护中间件已挂载');

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

// 数据库连接函数（带重连机制）
async function connectToDatabase() {
  const maxRetries = 5;
  const retryDelay = 5000; // 5秒

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ MongoDB 连接成功');
      return true;
    } catch (error) {
      console.error(`❌ MongoDB 连接失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

      if (attempt < maxRetries) {
        const delay = retryDelay * attempt; // 递增延迟
        console.log(`🔄 ${delay / 1000}秒后重连...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('💡 请确保 MongoDB 服务正在运行，并且连接字符串正确');
        console.error('🔧 默认连接字符串: mongodb://127.0.0.1:27017/xiaohongshu_audit');
        console.error('💥 已达到最大重试次数，程序退出');
        process.exit(1);
      }
    }
  }
  return false;
}

// 连接数据库并启动服务
connectToDatabase().then(() => {
  // 只有在数据库连接成功后才注册路由和启动服务器
  registerRoutes();
  startServer();
});

// 监听数据库断开事件
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB 连接已断开');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB 连接错误:', error.message);
});

// 注册路由函数
function registerRoutes() {
  console.log('🔗 注册路由...');

  // 添加 xiaohongshu 前缀
  const apiRouter = express.Router();

  apiRouter.use('/auth', require('./routes/auth'));
  console.log('✅ /xiaohongshu/api/auth 路由已注册');

  apiRouter.use('/users', require('./routes/user-management'));
  apiRouter.use('/user', require('./routes/user'));
  apiRouter.use('/reviews', require('./routes/reviews'));
  console.log('✅ /xiaohongshu/api/reviews 路由已注册');
  apiRouter.use('/admin', require('./routes/admin/'));
  console.log('✅ /xiaohongshu/api/admin 路由已注册 (模块化)');

  // 客户端路由模块化拆分（原 client.js 拆分为6个模块）
  apiRouter.use('/client', require('./routes/client-tasks'));
  console.log('✅ /xiaohongshu/api/client 路由已注册 (任务模块)');
  apiRouter.use('/client', require('./routes/client-devices'));
  console.log('✅ /xiaohongshu/api/client 路由已注册 (设备模块)');
  apiRouter.use('/client', require('./routes/client-discovery'));
  console.log('✅ /xiaohongshu/api/client 路由已注册 (发现模块)');
  apiRouter.use('/client', require('./routes/client-harvest'));
  console.log('✅ /xiaohongshu/api/client 路由已注册 (采集模块)');
  apiRouter.use('/client', require('./routes/client-link-convert'));
  console.log('✅ /xiaohongshu/api/client 路由已注册 (短链接模块)');
  apiRouter.use('/client', require('./routes/client-common'));
  console.log('✅ /xiaohongshu/api/client 路由已注册 (通用模块)');

  const uploadRouter = require('./routes/upload');
  apiRouter.use('/upload', uploadRouter);
  console.log('✅ /xiaohongshu/api/upload 路由已注册');

  apiRouter.use('/hr', require('./routes/hr'));
  console.log('✅ /xiaohongshu/api/hr 路由已注册');

  apiRouter.use('/manager', require('./routes/manager'));
  console.log('✅ /xiaohongshu/api/manager 路由已注册');

  apiRouter.use('/devices', require('./routes/devices'));
  console.log('✅ /xiaohongshu/api/devices 路由已注册');

  apiRouter.use('/complaints', require('./routes/complaints'));
  console.log('✅ /xiaohongshu/api/complaints 路由已注册');

  apiRouter.use('/short-link-pool', require('./routes/shortLinkPool'));
  console.log('✅ /xiaohongshu/api/short-link-pool 路由已注册');

  apiRouter.use('/permissions', require('./routes/permissions'));
  console.log('✅ /xiaohongshu/api/permissions 路由已注册');

  // 测试设备路由是否正确加载
  const devicesRouter = require('./routes/devices');
  console.log('📋 设备路由对象:', typeof devicesRouter);
  console.log('📋 设备路由栈长度:', devicesRouter.stack ? devicesRouter.stack.length : 'N/A');

  // 健康检查端点（用于监控和负载均衡器）
  apiRouter.get('/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development'
    };
    res.json(health);
  });

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

  // 全局错误处理中间件（必须在所有路由之后）
  const { errorHandler } = require('./utils/response');
  app.use(errorHandler);

  console.log('🎉 所有路由注册完成');
}

// 启动服务器函数
function startServer() {
  const PORT = process.env.PORT || 5000;
  const WS_PORT = process.env.WS_PORT || 5001;

  // 创建 WebSocket 服务器
  const wss = new WebSocket.Server({ port: WS_PORT });

  wss.on('connection', (ws) => {
    console.log(`📡 [WebSocket] 客户端已连接，当前连接数: ${wss.clients.size}`);
    ws.on('close', () => {
      console.log(`📡 [WebSocket] 客户端断开连接，剩余连接数: ${wss.clients.size}`);
    });
    ws.on('error', (error) => {
      console.error('📡 [WebSocket] 连接错误:', error.message);
    });
  });

  // 将 wss 挂载到 app，供路由使用
  app.set('wss', wss);
  console.log(`✅ [WebSocket] 服务启动成功，监听端口 ${WS_PORT}`);

  // 显式绑定到 127.0.0.1 (IPv4) 确保与 Nginx proxy_pass 兼容
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 服务器启动成功，监听端口 ${PORT}`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log('🎯 API 基础路径: http://localhost:' + PORT + '/xiaohongshu/api');
    console.log('🔄 服务正在运行中...');

    // 启动持续检查服务
    const continuousCheckService = require('./services/continuousCheckService');
    continuousCheckService.start();
    console.log('✅ 持续检查服务启动成功');

    // 启动评论采集队列定时任务
    const harvestScheduler = require('./services/harvestScheduler');
    harvestScheduler.start();
    console.log('✅ 评论采集队列定时任务启动成功');

    // 启动客户端健康度服务
    const clientHealthService = require('./services/clientHealthService');
    clientHealthService.start();
    console.log('✅ 客户端健康度服务启动成功');

    // 启动Cookie监控服务
    const cookieMonitorService = require('./services/cookieMonitorService');
    console.log('🍪 Cookie监控服务已加载');

    // 启动自动化检查服务
    const autoCheckService = require('./services/autoCheckService');
    autoCheckService.start();
    console.log('✅ 自动化检查服务启动成功');

    // 启动异步AI审核服务
    const asyncAiReviewService = require('./services/asyncAiReviewService');
    console.log('⏰ 启动异步AI审核服务...');

    // 【修复】加载pending状态的审核记录并重新加入队列
    // 服务器重启后必须恢复pending任务，否则会导致任务永久卡住
    asyncAiReviewService.loadPendingReviews().then(() => {
      console.log('✅ 异步AI审核服务已加载（已恢复pending任务）');
    }).catch(err => {
      console.error('❌ 加载pending任务失败:', err);
    });

    // 初始化 AI 内容分析服务（从数据库加载提示词）
    const aiContentAnalysisService = require('./services/aiContentAnalysisService');
    aiContentAnalysisService.initialize().then(() => {
      console.log('✅ AI内容分析服务初始化完成');
    }).catch(err => {
      console.error('❌ AI内容分析服务初始化失败:', err);
    });
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