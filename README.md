# 小红书内容审核管理系统

## 📋 项目简介

这是一个完整的小红书任务审核管理系统，用于"素人分发"业务的兼职用户内容审核与积分管理。

### 核心功能
- **内容审核**：AI辅助的小红书笔记和评论审核
- **用户管理**：多角色用户体系（兼职、带教老师、HR、经理、财务、老板）
- **积分系统**：任务完成奖励积分，可兑换现金
- **设备管理**：小红书账号设备绑定与审核
- **财务管理**：用户提现、支付宝转账、佣金计算

## 🏗️ 技术架构

### 前端
- **微信小程序**：`miniprogram/` - 兼职用户端
- **管理后台**：`admin/` - React + Ant Design
- **财务系统**：`finance/` - 财务管理

### 后端
- **API服务**：`server/` - Node.js + Express
- **数据库**：MongoDB
- **AI审核**：DeepSeek API

## 🚀 快速开始

### 环境要求
- Node.js 16+
- MongoDB 4.4+
- PM2（生产环境）

### 本地开发

```bash
# 安装依赖
cd server && npm install
cd ../admin && npm install
cd ../miniprogram && npm install

# 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env 填入必要配置

# 启动后端
cd server && npm run dev

# 启动前端（开发模式）
cd admin && npm start

# 启动小程序
# 使用微信开发者工具打开 miniprogram 目录
```

### 生产部署

```bash
# 构建前端
cd admin && npm run build

# 部署到服务器
scp -r admin/build/* wubug:/var/www/xiaohongshu-web/admin/public/
scp server/routes/*.js wubug:/var/www/xiaohongshu-web/server/routes/
scp server/services/*.js wubug:/var/www/xiaohongshu-web/server/services/

# 重启服务
ssh wubug "pm2 restart xiaohongshu-api"
```

## 📁 项目结构

```
xiaohongshuWeb/
├── admin/              # 管理后台前端
├── finance/            # 财务系统前端
├── miniprogram/        # 微信小程序
├── server/             # 后端API服务
│   ├── routes/         # API路由
│   ├── services/       # 业务服务
│   ├── models/         # 数据模型
│   └── middleware/     # 中间件
├── CLAUDE.md           # AI助手使用指南
├── UPDATE_LOG.md       # 更新日志
└── README.md           # 项目说明
```

## 🔧 常用命令

### 后端服务
```bash
# 开发模式
cd server && npm run dev

# 生产模式（PM2）
pm2 start ecosystem.config.js
pm2 restart xiaohongshu-api
pm2 logs xiaohongshu-api --lines 50
```

### 数据库
```bash
# 连接数据库
ssh wubug "mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit"

# 备份数据库
ssh wubug "mongodump --db=xiaohongshu_audit --out=/var/backups/mongo/$(date +%Y%m%d_%H%M%S)"
```

## 📖 相关文档

- [CLAUDE.md](./CLAUDE.md) - AI助手使用指南（详细开发文档）
- [UPDATE_LOG.md](./UPDATE_LOG.md) - 更新日志
- [COOKIE_UPDATE_GUIDE.md](./COOKIE_UPDATE_GUIDE.md) - Cookie更新指南
- [DATABASE_ACCESS_GUIDE.md](./DATABASE_ACCESS_GUIDE.md) - 数据库访问指南
- [DICTIONARY.md](./DICTIONARY.md) - 业务术语表

## ⚠️ 重要注意事项

### 运维规则
- ❌ 严禁执行 `pm2 logs`，会导致超时卡死
- ✅ 必须使用 `tail -n 50 ~/.pm2/logs/xiaohongshu-api-out.log` 查看日志
- 破坏性操作前必须 `mongodump` 备份数据库

### 金额计算
- ❌ 严禁直接使用浮点数计算
- ✅ 所有金额先 ×100 转为整数（分），计算完再 ÷100

### 代码规范
- 后端异步操作必须包裹在 try-catch 中
- catch 块必须返回 `{success: false, message: "..."}`
- 修改代码后必须记录到 `UPDATE_LOG.md`

## 🐛 常见问题

### 后端服务502错误
```bash
# 检查PM2进程状态
ssh wubug "pm2 list"

# 如果进程不在，重启服务
ssh wubug "pm2 start ecosystem.config.js"
```

### 小红书Cookie过期
- 错误现象：评论验证100%失败
- 解决：参考 [COOKIE_UPDATE_GUIDE.md](./COOKIE_UPDATE_GUIDE.md) 更新Cookie

## 📞 技术支持

如遇问题，请查看：
1. [CLAUDE.md](./CLAUDE.md) - 详细开发文档
2. [UPDATE_LOG.md](./UPDATE_LOG.md) - 更新日志和问题修复记录
3. 后端日志：`~/.pm2/logs/xiaohongshu-api-out.log`
