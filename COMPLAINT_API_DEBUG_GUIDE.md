# 投诉接口500错误调试指南

## 1. 可能的错误原因

根据代码分析，投诉接口500错误可能由以下原因造成：

### 1.1 数据库连接问题
- MongoDB服务未运行
- 连接字符串配置错误
- 数据库权限不足

### 1.2 字段验证失败
- Complaint模型要求`userId`字段，但可能有其他验证规则
- 前端发送的数据格式不正确

### 1.3 用户认证失败
- Token无效或过期
- 用户不存在
- 权限不足

### 1.4 服务器内部错误
- 文件权限问题
- 依赖包缺失
- 内存不足

## 2. 具体调试步骤

### 2.1 检查服务器日志

```bash
# 登录服务器
ssh -i /path/to/your/private_key.pem root@www.wubug.cc

# 检查Nginx错误日志
cat /var/log/nginx/error.log | grep "POST /xiaohongshu/api/complaints"

# 检查应用日志
cat /var/log/xiaohongshu/app.log | grep "提交投诉错误"

# 实时监控日志
journalctl -u xiaohongshu-api -f
```

### 2.2 测试数据库连接

```bash
# 连接到MongoDB
mongo --host localhost --port 27017

# 检查数据库状态
use xiaohongshu_audit
db.complaints.find().limit(5)

# 检查用户集合
use xiaohongshu_audit
db.users.findOne({username: "testuser"})
```

### 2.3 手动测试API

```bash
# 获取有效的token（需要先登录）
TOKEN="YOUR_VALID_TOKEN"

# 测试投诉接口
curl -X POST https://www.wubug.cc/xiaohongshu/api/complaints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content": "测试投诉内容，测试接口是否正常工作。"}' \
  -v
```

### 2.4 检查代码一致性

```bash
# 检查Complaint模型定义
cat /var/www/xiaohongshu/api/server/models/Complaint.js

# 检查投诉路由代码
cat /var/www/xiaohongshu/api/server/routes/complaints.js

# 检查是否有字段不一致
grep -n "userId\|user_id" /var/www/xiaohongshu/api/server/routes/complaints.js
```

## 3. 可能的解决方案

### 3.1 修复字段不一致问题

如果发现模型和路由代码中字段不一致，可以修改路由代码：

```javascript
// 在server/routes/complaints.js中
const complaint = new Complaint({
  userId: req.user._id,  // 确保与模型一致
  content: content.trim()
});
```

### 3.2 添加错误处理

增强错误处理以获取更详细的错误信息：

```javascript
// 在server/routes/complaints.js中
try {
  const complaint = new Complaint({
    userId: req.user._id,
    content: content.trim()
  });

  await complaint.save();

  res.json({
    success: true,
    message: '投诉提交成功',
    complaint: {
      id: complaint._id,
      content: complaint.content,
      status: complaint.status,
      createdAt: complaint.createdAt
    }
  });

} catch (error) {
  console.error('提交投诉错误:', error);
  console.error('错误堆栈:', error.stack);
  
  let errorMessage = '提交投诉失败';
  
  if (error.name === 'ValidationError') {
    errorMessage = '数据验证失败: ' + Object.values(error.errors).map(e => e.message).join(', ');
  } else if (error.code === 11000) {
    errorMessage = '重复的投诉';
  } else if (error.message.includes('ECONNREFUSED')) {
    errorMessage = '数据库连接失败';
  }
  
  res.status(500).json({ 
    success: false, 
    message: errorMessage,
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}
```

### 3.3 检查数据库连接

确保数据库连接正常：

```javascript
// 在server.js中检查数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/xiaohongshu_audit', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ MongoDB连接成功'))
.catch(err => {
  console.error('❌ MongoDB连接失败:', err);
  process.exit(1);
});
```

## 4. 部署修复

### 4.1 上传修复后的代码

```bash
# 上传修复后的文件
scp -i /path/to/your/private_key.pem ./server/routes/complaints.js root@www.wubug.cc:/var/www/xiaohongshu/api/server/routes/

# 上传模型文件（如果有修改）
scp -i /path/to/your/private_key.pem ./server/models/Complaint.js root@www.wubug.cc:/var/www/xiaohongshu/api/server/models/
```

### 4.2 重启服务

```bash
# 如果使用PM2
pm2 restart xiaohongshu-api

# 检查重启日志
pm2 logs xiaohongshu-api --lines 50
```

## 5. 验证修复

```bash
# 测试投诉接口是否正常
curl -X POST https://www.wubug.cc/xiaohongshu/api/complaints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content": "测试投诉内容，验证修复是否成功。"}' \
  -v

# 检查数据库是否有新的投诉记录
mongo --host localhost --port 27017 --eval "use xiaohongshu_audit; db.complaints.find().sort({createdAt: -1}).limit(1).pretty()"
```

## 6. 常见问题解答

### 6.1 如何获取有效的token？

```bash
# 使用现有的测试用户登录
curl -X POST https://www.wubug.cc/xiaohongshu/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpassword"}' \
  -v
```

### 6.2 如何检查服务是否运行？

```bash
# 检查PM2进程
pm2 list

# 检查端口占用
netstat -tuln | grep 3000

# 检查Nginx配置
nginx -t
sudo systemctl status nginx
```

### 6.3 如何备份数据库？

```bash
# 备份数据库
mongodump --host localhost --port 27017 --db xiaohongshu_audit --out /backup/xiaohongshu_$(date +%Y%m%d)

# 恢复数据库
mongorestore --host localhost --port 27017 /backup/xiaohongshu_20231227/xiaohongshu_audit
```

## 7. 联系支持

如果经过上述步骤仍无法解决问题，请联系开发团队并提供以下信息：

1. 具体的错误信息
2. 服务器日志相关部分
3. 重现步骤
4. 环境信息（Node.js版本、MongoDB版本、操作系统等）