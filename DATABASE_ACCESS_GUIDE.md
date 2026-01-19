# 服务器数据库访问指南

## 📍 数据库位置

服务器数据库位于：`wubug`（服务器别名，对应112.74.163.102）

## 🗃️ 数据库信息

- **数据库类型**：MongoDB
- **数据库名称**：`xiaohongshu_audit`
- **连接URI**：`mongodb://127.0.0.1:27017/xiaohongshu_audit`
- **端口**：27017（默认MongoDB端口）

## 🔑 访问方法

### 方法1：直接在服务器上访问（推荐）

```bash
# SSH登录到服务器
ssh wubug

# 进入项目目录
cd /var/www/xiaohongshu-web/server

# 使用mongosh连接数据库
mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit

# 或者使用mongo（旧版）
mongo mongodb://127.0.0.1:27017/xiaohongshu_audit
```

### 方法2：通过SSH隧道本地访问

```bash
# 在本地终端执行以下命令创建SSH隧道
ssh -L 27017:127.0.0.1:27017 wubug -N

# 然后在本地使用MongoDB客户端连接
mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit

# 或使用MongoDB Compass（图形界面）
# 连接字符串：mongodb://127.0.0.1:27017
```

### 方法3：编写Node.js脚本查询

```bash
# 在服务器上创建并执行查询脚本
ssh wubug "cd /var/www/xiaohongshu-web/server && node -e '
const mongoose = require(\"mongoose\");
mongoose.connect(\"mongodb://127.0.0.1:27017/xiaohongshu_audit\").then(async () => {
  const count = await mongoose.connection.db.collection(\"imagereviews\").countDocuments();
  console.log(\"总审核记录数:\", count);
  mongoose.connection.close();
}).catch(err => console.error(err));'"
```

## 📊 主要集合

- **users**：用户信息（兼职用户、带教老师、HR、经理、财务、老板）
- **imagereviews**：图片审核记录（笔记、评论、客资）
- **devices**：小红书账号设备信息
- **transactions**：交易记录（积分、提现、佣金）
- **taskconfigs**：任务配置（单价、积分等）
- **complaints**：用户投诉记录

## 🔧 常用操作示例

### 查看所有图片审核记录

```javascript
db.imagereviews.find().limit(10).pretty()
```

### 查看特定状态的审核记录

```javascript
db.imagereviews.find({ status: "pending" }).pretty()
```

### 统计不同状态的数量

```javascript
db.imagereviews.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])
```

### 查看特定用户的审核记录

```javascript
db.imagereviews.find({
  userId: ObjectId("用户ID")
}).pretty()
```

### 查看最近的审核记录

```javascript
db.imagereviews.find().sort({ createdAt: -1 }).limit(10).pretty()
```

## ⚠️ 数据安全注意事项

1. **备份优先**：执行任何写操作（update、delete等）前必须先备份数据库
   ```bash
   ssh wubug "mongodump --db=xiaohongshu_audit --out=/var/backups/mongo/$(date +%Y%m%d_%H%M%S)"
   ```

2. **禁止危险操作**：
   - ❌ 禁止执行 `dropDatabase()`
   - ❌ 禁止直接 `deleteMany()` 不带查询条件
   - ❌ 禁止修改用户积分/余额（应通过后端API）

3. **查询优化**：
   - 查询时使用 `limit()` 限制返回数量
   - 复杂查询使用 `aggregate()` 而非多次查询
   - 必要时先创建索引

## 📝 补充说明

### 本地开发环境连接

如果需要在本地开发环境连接服务器数据库：

1. 确保SSH密钥已配置（`~/.ssh/id_rsa_new_server`）
2. 在 `server/.env` 中配置数据库连接：
   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/xiaohongshu_audit
   ```
3. 启动本地后端服务会自动连接服务器数据库（通过SSH隧道）

### 数据库备份位置

服务器上的备份目录：`/var/backups/mongo/`

查看备份文件：
```bash
ssh wubug "ls -lht /var/backups/mongo/ | head -10"
```

## 📚 相关文档

- [CLAUDE.md](./CLAUDE.md) - 开发规范和运维规则
- [COOKIE_UPDATE_GUIDE.md](./COOKIE_UPDATE_GUIDE.md) - Cookie更新指南
- [UPDATE_LOG.md](./UPDATE_LOG.md) - 更新日志
