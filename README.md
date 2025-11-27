# 小红书审核网站系统

## 项目概述

这是一个完整的多端图片审核管理系统，包含：
- 微信小程序（用户端）：用户上传图片并查看审核进度
- 管理后台（客服、老板）：审核和管理图片
- 财务系统：处理用户打款

## 技术栈

- **后端**: Node.js + Express + MongoDB
- **前端**: React.js + Ant Design
- **小程序**: 原生微信小程序
- **存储**: 阿里云OSS
- **认证**: JWT

## 项目结构

```
xiaohongshuWeb/
├── miniprogram/          # 微信小程序
├── admin/               # 管理后台
├── finance/             # 财务系统
├── server/              # 后端API
├── architecture.md      # 系统架构文档
└── README.md           # 项目说明
```

## 快速开始

### 1. 环境要求

- Node.js >= 14
- MongoDB >= 4.0
- 微信开发者工具（小程序开发）

### 2. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装管理后台依赖
cd ../admin
npm install

# 安装财务系统依赖
cd ../finance
npm install
```

### 3. 配置环境变量

复制 `server/.env` 文件并配置：

```env
MONGODB_URI=mongodb://localhost:27017/xiaohongshu
JWT_SECRET=your_jwt_secret_key_here
PORT=5000

# 阿里云OSS配置
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=your_region

# 微信小程序配置
WX_APP_ID=your_app_id
WX_APP_SECRET=your_app_secret
```

### 4. 启动服务

```bash
# 启动后端服务
cd server
npm start

# 启动管理后台（新终端）
cd admin
npm start

# 启动财务系统（新终端）
cd finance
npm start

# 启动小程序（微信开发者工具）
# 打开 miniprogram 目录
```

## 功能特性

### 用户端（微信小程序）
- ✅ 自动注册登录
- ✅ 上传三种类型图片（登录二维码、笔记、评论）
- ✅ 查看审核进度
- ✅ 个人资料管理

### 管理后台
- ✅ 用户登录认证
- ✅ 仪表板统计
- ✅ 审核管理（客服审核 → 老板确认 → 财务处理）
- ✅ 用户管理
- ✅ 角色权限控制

### 财务系统
- ✅ 打款任务管理
- ✅ 佣金分配
- ✅ 财务统计

## 业务流程

1. **用户注册**: 通过微信小程序自动注册
2. **图片上传**: 用户选择图片类型并上传
3. **客服审核**: 客服审核图片，决定通过或拒绝
4. **老板确认**: 老板对审核结果进行最终确认
5. **财务处理**: 财务人员处理打款并分配佣金
6. **上级分成**: 系统自动给上级用户分配佣金

## API 文档

### 认证相关
- `POST /api/auth/login` - 管理员登录
- `POST /api/auth/register` - 注册管理员
- `POST /api/auth/wechat-login` - 微信小程序登录

### 用户管理
- `GET /api/users/profile` - 获取用户资料
- `PUT /api/users/profile` - 更新用户资料
- `GET /api/users` - 获取用户列表

### 审核管理
- `GET /api/reviews/my-reviews` - 获取我的审核记录
- `GET /api/reviews` - 获取审核列表
- `PUT /api/reviews/:id/cs-review` - 客服审核
- `PUT /api/reviews/:id/boss-approve` - 老板确认
- `PUT /api/reviews/:id/finance-process` - 财务处理

### 文件上传
- `POST /api/upload/image` - 上传图片

## 部署说明

### 开发环境
按上述"快速开始"步骤操作即可。

### 生产环境
1. 配置生产环境的MongoDB
2. 配置阿里云OSS
3. 配置微信小程序
4. 使用PM2管理Node.js进程
5. 配置Nginx反向代理
6. 启用HTTPS

## 注意事项

1. **数据库**: 确保MongoDB正常运行
2. **OSS配置**: 正确配置阿里云OSS参数
3. **微信小程序**: 需要真实的AppID和AppSecret
4. **端口**: 确保5000端口未被占用
5. **权限**: 不同角色有不同的操作权限

## 常见问题

### MongoDB连接失败
- 检查MongoDB是否启动
- 检查连接字符串是否正确

### 微信登录失败
- 检查微信小程序配置
- 确保AppID和AppSecret正确

### 图片上传失败
- 检查阿里云OSS配置
- 确认Bucket权限设置

## 开发团队

如有问题请联系开发团队。

## 更新日志

### v1.0.0
- 初始版本发布
- 实现基础审核流程
- 支持多端访问