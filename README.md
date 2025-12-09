# 素人分发系统

一个完整的素人分发审核管理系统，支持兼职用户提交内容，经过多级审核流程（带教老师→经理→HR→财务）后进行积分发放。

## 🏗️ 系统架构

### 技术栈
- **前端**: React.js (管理后台) + 微信小程序 (用户端)
- **后端**: Node.js + Express
- **数据库**: MongoDB
- **图片存储**: 阿里云OSS
- **认证**: JWT

### 系统组成
1. **微信小程序**: 用户端，用于上传图片和自动注册
2. **管理后台**: React应用，客服、老板、财务使用
3. **后端API**: Express服务器，提供RESTful API

## 🚀 快速开始

### 环境要求
- Node.js >= 14
- MongoDB >= 4.0 (可选，系统支持模拟数据模式)
- Docker & Docker Compose (推荐，用于数据库管理)

### 安装步骤

#### 方式一：使用 Docker Compose (推荐)

1. **克隆项目**
```bash
git clone <repository-url>
cd suren-distribution-system
```

2. **启动数据库**
```bash
# 使用 Docker Compose 启动 MongoDB
docker-compose up -d

# 查看启动状态
docker-compose ps
```

3. **安装依赖**
```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd server
npm install

# 安装管理后台依赖
cd ../admin
npm install
```

4. **配置环境变量**
```bash
cd server
cp .env.example .env
# 编辑 .env 文件，配置数据库和OSS信息
```

5. **启动服务**
```bash
# 启动后端服务
cd server
npm start

# 启动管理后台 (新终端)
cd admin
npm start

# 启动微信小程序 (使用微信开发者工具)
# 打开 miniprogram 目录
```

#### 方式二：传统方式

如果不使用 Docker，可以直接安装 MongoDB 并按上述步骤操作。

#### Docker 管理命令

```bash
# 启动数据库
docker-compose up -d

# 停止数据库
docker-compose down

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f mongo
```

## 📱 功能特性

### 用户端 (微信小程序)
- ✅ 自动注册登录
- ✅ 内容提交 (支持多种内容类型)
- ✅ 审核进度查看
- ✅ 个人积分查看

### 管理后台
- ✅ 多角色权限管理 (带教老师、HR、经理、财务)
- ✅ 内容审核工作流
- ✅ 兼职用户管理
- ✅ 统计数据看板
- ✅ 积分发放处理

### 审核流程
1. **兼职用户提交** → 内容提交
2. **带教老师审核** → 通过/拒绝
3. **经理确认** → 通过/拒绝
4. **财务处理** → 发放积分并分配佣金

## 🔐 用户角色

| 角色 | 权限 | 说明 |
|------|------|------|
| part_time | 提交内容、查看进度 | 兼职用户 |
| mentor | 审核内容 | 带教老师 |
| hr | 管理兼职用户 | HR (人事) |
| manager | 确认审核结果 | 经理 |
| boss | 系统管理 | 老板 |
| finance | 处理积分发放 | 财务人员 |

## 📊 API 接口

### 认证相关
- `POST /api/auth/wechat-login` - 微信小程序登录
- `POST /api/auth/login` - 管理后台登录

### 用户管理
- `GET /api/users/profile` - 获取用户资料
- `GET /api/users` - 获取用户列表 (管理员)

### 审核管理
- `GET /api/reviews` - 获取审核列表
- `PUT /api/reviews/:id/mentor-review` - 带教老师审核
- `PUT /api/reviews/:id/manager-approve` - 经理确认
- `PUT /api/reviews/:id/finance-process` - 财务处理

### 文件上传
- `POST /api/upload/image` - 上传图片

## 🧪 测试

运行完整系统测试：
```bash
node test-full-system.js
```

运行单个API测试：
```bash
node test-reviews-direct.js
```

### MCP 数据库接口 (AI 专用)

项目集成了 Model Context Protocol (MCP)，允许 AI 助手直接与数据库交互：

启动 MCP 服务器：
```bash
cd server
node mcp-server.js
```

MCP 工具功能：
- `list_collections` - 列出所有数据库集合
- `run_query` - 执行 MongoDB 查询
- `run_update` - 更新数据库记录

配置 Windsurf/Cursor 使用 MCP：
```json
{
  "mcpServers": {
    "suren-db": {
      "command": "node",
      "args": ["D:/Desktop/suren-distribution-system/server/mcp-server.js"]
    }
  }
}
```

## 📁 项目结构

```
suren-distribution-system/
├── docker-compose.yml          # Docker Compose 配置
├── mcp-config-example.json     # MCP 配置示例
├── miniprogram/                # 微信小程序
│   ├── app.js
│   ├── app.json
│   ├── pages/
│   │   ├── index/        # 首页
│   │   ├── upload/       # 上传页面
│   │   └── profile/      # 个人中心
│   └── ...
├── admin/                # 管理后台 (React)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── contexts/
│   └── ...
├── server/               # 后端服务
│   ├── models/           # 数据模型
│   ├── routes/           # API路由
│   ├── middleware/       # 中间件
│   ├── mcp-server.js     # MCP 数据库接口 (AI 专用)
│   └── server.js
├── architecture.md       # 系统架构文档
└── README.md
```

## 🔧 配置说明

### 环境变量 (.env)
```env
MONGODB_URI=mongodb://localhost:27017/xiaohongshu
JWT_SECRET=your_jwt_secret_key
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

## 🚀 部署

### 后端部署
```bash
cd server
npm run build  # 如果需要
npm start
```

### 前端部署
```bash
# 管理后台
cd admin
npm run build
# 将 build 目录部署到静态服务器

# 微信小程序
# 使用微信开发者工具构建发布
```

## 📈 性能优化

- 图片懒加载
- API响应缓存
- 数据库查询优化
- 前端代码分割

## 🔒 安全考虑

- JWT token认证
- 密码加密存储
- API限流控制
- XSS防护
- 文件上传安全检查

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

项目维护者 - your-email@example.com

项目链接: [https://github.com/your-username/suren-distribution-system](https://github.com/your-username/suren-distribution-system)