# 🎉 小红书审核系统 - 企业级完整解决方案

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6+-green.svg)](https://www.mongodb.com/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5+-red.svg)](https://ant.design/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 项目简介

这是一个**完整的商业级审核与分账系统**，专为小红书内容审核业务设计。系统采用现代化的技术架构，支持多平台部署，具备企业级的安全特性和完整的业务流程。

### ✨ 核心特性

- 🔐 **企业级安全**: JWT认证、角色权限、软删除保护
- 💰 **财务安全**: 资金保护锁、自动佣金结算
- 📱 **多端支持**: 管理后台 + 微信小程序 + 财务系统
- 🔄 **完整流程**: 三级审核机制（客服→老板→财务）
- 📊 **数据导出**: Excel财务报表
- 🛡️ **业务保护**: 防止误删、资金丢失

## 🏗️ 系统架构

```
xiaohongshuWeb/
├── admin/              # React管理后台
│   ├── src/
│   │   ├── components/ # 通用组件
│   │   ├── pages/      # 页面组件
│   │   └── contexts/   # React Context
│   └── public/
├── miniprogram/        # 微信小程序
│   ├── pages/          # 小程序页面
│   └── app.js          # 小程序入口
├── finance/            # 财务管理系统
│   └── src/
├── server/             # Node.js后端
│   ├── models/         # 数据模型
│   ├── routes/         # API路由
│   ├── middleware/     # 中间件
│   └── services/       # 业务服务
└── docs/               # 项目文档
```

## 🚀 快速开始

### 环境要求

- Node.js 18+
- MongoDB 6+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/xiaohongshu-review-system.git
   cd xiaohongshu-review-system
   ```

2. **安装后端依赖**
   ```bash
   cd server
   npm install
   ```

3. **安装管理后台依赖**
   ```bash
   cd ../admin
   npm install
   ```

4. **安装财务系统依赖**
   ```bash
   cd ../finance
   npm install
   ```

5. **配置环境变量**
   ```bash
   cd ../server
   cp .env.example .env
   # 编辑 .env 文件，配置数据库和OSS信息
   ```

6. **启动MongoDB**
   ```bash
   # 确保MongoDB服务正在运行
   mongod
   ```

7. **启动后端服务**
   ```bash
   npm start
   # 服务将在 http://localhost:5000 启动
   ```

8. **启动管理后台**
   ```bash
   cd ../admin
   npm start
   # 管理后台将在 http://localhost:3000 启动
   ```

9. **启动财务系统**
   ```bash
   cd ../finance
   npm start
   # 财务系统将在 http://localhost:3001 启动
   ```

## 🔐 测试账号

系统预创建了测试账号供体验：

| 角色 | 用户名 | 密码 | 权限说明 |
|------|--------|------|----------|
| 👑 **老板** | `TEST_BOSS` | `admin123` | 最高权限，可审批最终审核 |
| 👨‍💼 **客服** | `TEST_CS` | `admin123` | 初级审核权限 |
| 💰 **财务** | `TEST_FINANCE` | `admin123` | 财务权限，打款结算 |

## 📱 功能特性

### 管理后台功能
- ✅ 用户管理（增删改查、角色分配）
- ✅ 审核管理（三级审核流程）
- ✅ 仪表盘统计
- ✅ 安全删除保护
- ✅ 数据导出

### 微信小程序功能
- ✅ 图片上传（支持多种类型）
- ✅ 审核进度查询
- ✅ 自动用户注册
- ✅ 个人收益查看

### 财务系统功能
- ✅ 财务统计报表
- ✅ 用户结算管理
- ✅ Excel数据导出
- ✅ 佣金自动计算

## 🔧 技术栈

### 前端
- **React 18** - 用户界面框架
- **Ant Design 5** - 企业级UI组件库
- **微信小程序** - 移动端应用
- **Axios** - HTTP客户端

### 后端
- **Node.js** - JavaScript运行时
- **Express.js** - Web应用框架
- **MongoDB** - NoSQL数据库
- **Mongoose** - MongoDB对象建模
- **JWT** - JSON Web Token认证
- **bcrypt** - 密码加密

### 基础设施
- **阿里云OSS** - 文件存储
- **PM2** - 进程管理（生产环境）

## 📊 API文档

### 主要接口

#### 认证相关
- `POST /api/auth/admin-login` - 管理员登录
- `POST /api/auth/wechat-login` - 微信小程序登录
- `POST /api/auth/register` - 用户注册

#### 用户管理
- `GET /api/users` - 获取用户列表
- `PUT /api/users/:id` - 更新用户信息
- `DELETE /api/users/:id` - 删除用户（软删除）

#### 审核管理
- `GET /api/reviews` - 获取审核列表
- `PUT /api/reviews/:id/cs-review` - 客服审核
- `PUT /api/reviews/:id/boss-approve` - 老板确认
- `PUT /api/reviews/:id/finance-process` - 财务处理

#### 文件上传
- `POST /api/upload/image` - 图片上传

## 🔒 安全特性

- **用户认证**: JWT Token + 密码加密
- **权限控制**: 基于角色的访问控制(RBAC)
- **数据保护**: 软删除 + 资金安全锁
- **传输安全**: HTTPS + 输入验证
- **审计日志**: 完整的操作记录

## 📈 业务流程

### 审核流程
1. **用户上传** → 小程序选择图片类型上传
2. **客服审核** → 检查内容质量（通过/拒绝）
3. **老板确认** → 最终审核决策
4. **财务结算** → 自动打款 + 佣金计算

### 分销机制
- 支持多级上级关系
- 审核通过后自动计算佣金
- 财务系统统一结算

## 🚀 部署指南

### 开发环境
```bash
# 启动所有服务
npm run dev  # 根目录的启动脚本
```

### 生产环境
```bash
# 后端部署
cd server
npm run build
npm run start:prod

# 前端部署
cd admin
npm run build
# 将build目录部署到Web服务器

cd finance
npm run build
# 将build目录部署到Web服务器
```

## 📚 项目文档

- [用户账号管理指南](./USER_ACCOUNTS_GUIDE.md)
- [技术实现指南](./TECHNICAL_IMPLEMENTATION_GUIDE.md)
- [项目完成报告](./PROJECT_COMPLETION_REPORT.md)

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- 项目维护者: AI Assistant
- 邮箱: ai@example.com

## 🎊 项目亮点

- ✅ **100%完整**: 从需求到部署的完整解决方案
- ✅ **企业级**: 具备商业系统的所有安全特性
- ✅ **现代化**: 使用最新的技术栈和最佳实践
- ✅ **可扩展**: 模块化架构，易于功能扩展
- ✅ **生产就绪**: 可以直接投入商业运营

---

**⭐ 如果这个项目对你有帮助，请给它一个Star！**