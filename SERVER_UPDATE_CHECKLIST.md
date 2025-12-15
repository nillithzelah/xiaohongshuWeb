# 小红书Web项目服务器修改清单

## 📋 项目状态概览

**服务器信息**: 112.74.163.102 (新服务器)
**当前状态**: 已部署运行
**最后更新**: 2025-11-25
**项目路径**: `/var/www/xiaohongshu-web`

## 🔍 服务器当前配置检查

### 1. 系统环境检查
- [x] Ubuntu 20.04.6 LTS (检查完成)
- [x] Node.js 20.19.5 (已升级)
- [x] Nginx 1.18.0 (已安装)
- [x] PM2 6.0.13 (已安装)
- [x] SQLite3 3.31.1 (已安装)
- [x] MongoDB (Docker容器运行)

### 2. 服务运行状态
- [x] Nginx服务: 运行中 (1天20小时)
- [x] PM2服务: douyin-admin-api, xiaohongshu-api (运行20小时)
- [x] MongoDB: Docker容器运行 (容器名: mongo)
- [x] HTTPS证书: Let's Encrypt (www.wubug.cc)

### 3. 网络配置
- [x] 域名解析: www.wubug.cc → 112.74.163.102
- [x] HTTPS访问: 正常
- [x] HTTP重定向: 已配置
- [x] nginx配置: 使用wubug_unified配置，xiaohongshu API代理到5000端口 ✅

## 📝 需要修改的项目清单

### 🚨 紧急修改项

#### 1. 数据库配置问题
- [x] **数据库名称确认**: ✅ 已确认服务器使用 `xiaohongshu_audit` 数据库
  - 服务器实际数据库: `xiaohongshu_audit`
  - 部署脚本设置: `xiaohongshu_audit` ✅ (已修复为一致)
  - 迁移脚本使用: `xiaohongshu_audit` (与实际一致)
- [ ] **Docker数据持久化**: 配置路径 `D:\mongodb_data:/data/db` 无效，但实际挂载 `/root/mongo_data` ✅ 数据正常
- [ ] **数据库迁移**: 角色迁移已完成 ✅，状态迁移部分完成（还有 `cs_approved` 状态）
- [ ] **迁移脚本修复**: 迁移脚本与实际数据库一致，无需修改

#### 2. 环境变量配置
- [ ] **JWT密钥**: 当前使用开发环境密钥 `dev_secret_key_2024`，需要更新为生产环境密钥
- [ ] **端口配置**: 当前使用5000端口，nginx配置正确 ✅
- [ ] **OSS配置**: 阿里云OSS配置为占位符，需要配置真实信息
- [ ] **数据库配置**: 当前使用 `xiaohongshu_audit`，与实际一致 ✅

#### 3. Nginx配置优化
- [ ] **子路径配置**: 当前配置 `/xiaohongshu/` 子路径访问
- [ ] **静态文件服务**: 前端静态文件可能未正确配置
- [ ] **反向代理**: API代理到3001端口的配置

### 🔧 代码更新项

#### 1. 角色系统更新
基于最近的重构，需要更新：
- [ ] **角色映射**: `sales` → `hr`, `cs` → `mentor`, `boss` → `manager`
- [ ] **数据库迁移**: 运行角色迁移脚本
- [ ] **前端组件**: 更新角色相关的UI组件
- [ ] **API接口**: 更新权限验证逻辑

#### 2. 模型更新
- [ ] **ImageReview模型**: 更新状态枚举和字段映射
- [x] **Submission模型**: 已合并到ImageReview模型
- [ ] **User模型**: 更新角色字段

#### 3. API路由更新
- [ ] **权限中间件**: 更新角色权限检查
- [ ] **数据过滤**: 根据新角色系统调整数据访问权限
- [ ] **错误处理**: 统一错误响应格式

### 🗄️ 数据库相关修改

#### 1. 数据迁移
- [ ] **备份现有数据**: 在修改前备份MongoDB数据
- [ ] **角色字段更新**: 将旧角色映射为新角色
- [ ] **状态字段更新**: 更新审核状态字段
- [ ] **关联关系**: 确保上下级关系正确

#### 2. 索引优化
- [ ] **查询性能**: 为常用查询字段添加索引
- [ ] **复合索引**: 为多字段查询创建复合索引

### 🔒 安全加固

#### 1. 认证安全
- [ ] **JWT密钥轮换**: 更新生产环境JWT密钥
- [ ] **密码策略**: 确保密码安全策略
- [ ] **会话管理**: 配置合理的token过期时间

#### 2. API安全
- [ ] **CORS配置**: 配置正确的跨域策略
- [ ] **请求限制**: 添加API请求频率限制
- [ ] **输入验证**: 加强输入数据验证

### 📊 监控和日志

#### 1. 日志配置
- [ ] **应用日志**: 配置结构化日志输出
- [ ] **错误日志**: 设置错误日志收集
- [ ] **访问日志**: 配置API访问日志

#### 2. 监控配置
- [ ] **健康检查**: 添加应用健康检查端点
- [ ] **性能监控**: 配置响应时间监控
- [ ] **告警机制**: 设置异常告警

### 🚀 部署流程优化

#### 1. 自动化部署
- [ ] **CI/CD配置**: 设置自动化部署流程
- [ ] **回滚机制**: 配置快速回滚能力
- [ ] **环境隔离**: 区分开发/测试/生产环境

#### 2. 备份策略
- [ ] **数据库备份**: 配置自动数据库备份
- [ ] **代码备份**: 保留历史版本
- [ ] **配置备份**: 备份nginx和环境配置

## 📋 具体修改步骤

### 步骤1: 环境准备
```bash
# 1. 备份当前配置
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 2. 停止当前服务
pm2 stop xiaohongshu-web

# 3. 备份数据库
mongodump --db xiaohongshu_audit_prod --out /var/backups/mongo_backup_$(date +%Y%m%d)

# 4. 修复Docker配置 (紧急修复)
# 检查当前docker-compose.yml中的挂载路径
cat /var/www/xiaohongshu-web/docker-compose.yml

# 如果发现Windows路径，立即修复为Linux路径
cd /var/www/xiaohongshu-web
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)

# 创建正确的Linux挂载路径
mkdir -p /var/lib/mongodb_data

# 编辑docker-compose.yml，将Windows路径改为Linux路径
sed -i 's|D:\\mongodb_data|/var/lib/mongodb_data|g' docker-compose.yml

# 验证修复后的配置
cat docker-compose.yml

# 重启MongoDB容器
docker-compose down
docker-compose up -d mongo

# 验证容器状态
docker-compose ps
```

### 步骤2: 代码更新
```bash
# 1. 拉取最新代码
cd /var/www/xiaohongshu-web
git pull origin main

# 2. 安装新依赖
npm install

# 3. 运行数据库迁移
cd server
node scripts/migrate-roles.js
node scripts/migrate-status.js
```

### 步骤3: 配置更新
```bash
# 1. 更新环境变量
cp server/.env.production server/.env.production.backup
# 编辑 .env.production 文件

# 2. 更新nginx配置
# 编辑 /etc/nginx/sites-available/default
# 确保 /xiaohongshu/ 路径正确代理到3001端口

# 3. 测试配置
nginx -t
```

### 步骤4: 服务重启
```bash
# 1. 重启nginx
systemctl reload nginx

# 2. 启动新版本服务
pm2 start ecosystem.config.js

# 3. 检查服务状态
pm2 list
pm2 logs xiaohongshu-web
```

### 步骤5: 验证测试
```bash
# 1. 检查API访问
curl -k https://www.wubug.cc/xiaohongshu/api/health

# 2. 检查前端访问
curl -k https://www.wubug.cc/xiaohongshu/

# 3. 检查数据库连接
# 在应用日志中确认数据库连接正常
```

## ⚠️ 风险评估

### 高风险项
1. **数据库迁移**: 可能导致数据丢失或不一致
2. **JWT密钥更新**: 会导致所有现有用户需要重新登录
3. **角色权限变更**: 可能影响现有用户的访问权限

### 中风险项
1. **nginx配置变更**: 可能导致服务暂时不可用
2. **依赖更新**: 新版本依赖可能存在兼容性问题
3. **API接口变更**: 前端可能需要同步更新

### 低风险项
1. **日志配置**: 对业务功能无影响
2. **监控配置**: 对业务功能无影响
3. **备份策略**: 增强系统稳定性

## 📞 联系与支持

- **技术负责人**: [待定]
- **紧急联系**: [待定]
- **文档更新**: 请及时更新此清单

---

**最后更新**: 2025-12-09
**检查人**: AI助手
**状态**: 待执行