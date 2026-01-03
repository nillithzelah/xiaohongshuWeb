# 服务器数据库访问指南

## 📍 数据库位置

服务器数据库位于：`wubug`（服务器别名，对应112.74.163.102）

## 🗃️ 数据库信息

- **数据库类型**：MongoDB
- **数据库名称**：`xiaohongshu_audit`
- **连接URI**：`mongodb://127.0.0.1:27017/xiaohongshu_audit`
- **端口**：27017（默认MongoDB端口）

## 🔑 访问方法

### 1. 通过MCP服务器访问（推荐用于AI助手）

MCP（Model Context Protocol）允许AI助手直接访问数据库，无需手动查询。

#### 配置步骤：

1. **安装MCP服务器**：
   ```bash
   npm install -g @modelcontextprotocol/server-mongodb
   ```

2. **配置MCP设置**：
   编辑 Windsurf 编辑器的MCP配置文件：
   ```
   c:/Users/Administer/AppData/Roaming/Windsurf/User/globalStorage/kilocode.kilo-code/settings/mcp_settings.json
   ```

   添加以下配置：
   ```json
   {
     "mcpServers": {
       "mongodb-xiaohongshu": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-mongodb",
           "mongodb://127.0.0.1:27017/xiaohongshu_audit"
         ]
       }
     }
   }
   ```

3. **使用方法**：
   - 在Windsurf编辑器中，AI助手可以直接查询数据库
   - 支持自然语言查询，如"查看所有用户"、"统计审核状态"等
   - 无需手动编写MongoDB查询语句

#### 注意事项：
- 确保SSH隧道已建立（见方法2）
- MCP配置需要重启Windsurf编辑器才能生效
- 仅在开发环境使用，避免生产环境数据泄露

### 2. 通过SSH隧道访问

```bash
# 在本地终端执行以下命令创建SSH隧道
ssh -i ~/.ssh/id_rsa_new_server -L 27017:127.0.0.1:27017 wubug

# 然后在本地使用MongoDB客户端连接
mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit
```

### 3. 直接在服务器上访问

```bash
# SSH登录到服务器
ssh -i ~/.ssh/id_rsa_new_server wubug

# 进入项目目录
cd /var/www/xiaohongshu-web/server

# 使用mongosh连接数据库
mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit
```

### 4. 使用MongoDB Compass（图形界面）

1. 创建SSH隧道（如方法2所述）
2. 在MongoDB Compass中连接到：`mongodb://127.0.0.1:27017`
3. 选择数据库：`xiaohongshu_audit`

## 📊 主要集合

- **users**：用户信息（兼职用户、带教老师、HR等）
- **imagereviews**：图片审核记录（包含OSS图片URL）
- **devices**：设备信息
- **transactions**：交易记录

## 🔧 常用操作

### 查看所有图片审核记录

```javascript
// 在mongosh中执行
db.imagereviews.find().pretty()
```

### 查看特定用户的图片

```javascript
db.imagereviews.find({ userId: ObjectId("用户ID") }).pretty()
```

### 统计不同状态的图片数量

```javascript
db.imagereviews.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])
```

## 📝 注意事项

1. **数据安全**：请勿直接删除生产数据，如需修改请先备份
2. **连接稳定性**：SSH隧道可能会断开，建议使用持久连接工具
3. **性能考虑**：复杂查询请添加适当的索引
4. **权限管理**：当前数据库无密码保护，仅允许本地连接

## 🔍 查看实时数据

可以通过管理后台查看数据：
- 管理后台地址：`http://wubug/xiaohongshu`
- 使用管理员账号登录后查看审核记录

## 📚 相关文档

- [REFACTOR_COMPLETION_REPORT.md](REFACTOR_COMPLETION_REPORT.md) - 系统重构详细信息
- [architecture.md](architecture.md) - 系统架构文档
- [USER_ACCOUNTS_GUIDE.md](USER_ACCOUNTS_GUIDE.md) - 用户账号管理指南

如有任何问题，请随时联系技术支持！