# 服务器访问指南

## 1. 服务器信息

根据项目结构和部署脚本，服务器访问信息如下：

- **服务器地址**: `www.wubug.cc`
- **SSH端口**: 22（默认）
- **用户名**: `root` 或 `xiaohongshu`
- **密钥文件**: 需要使用私钥文件进行认证

## 2. 访问服务器

使用以下命令通过SSH访问服务器：

```bash
ssh -i /path/to/your/private_key.pem root@www.wubug.cc
# 或者
ssh -i /path/to/your/private_key.pem xiaohongshu@www.wubug.cc
```

## 3. 检查服务器日志

一旦登录到服务器，可以检查以下日志来诊断投诉接口的500错误：

### 3.1 检查Nginx日志

```bash
# 查看Nginx错误日志
cat /var/log/nginx/error.log

# 实时监控Nginx错误日志
tail -f /var/log/nginx/error.log
```

### 3.2 检查Node.js应用日志

```bash
# 查找Node.js应用进程
ps aux | grep node

# 查看应用日志（具体路径取决于部署方式）
cat /var/log/xiaohongshu/app.log

# 实时监控应用日志
tail -f /var/log/xiaohongshu/app.log
```

### 3.3 检查PM2日志（如果使用PM2管理进程）

```bash
# 列出所有PM2管理的进程
pm2 list

# 查看具体应用的日志
pm2 logs xiaohongshu-api

# 实时监控日志
pm2 logs xiaohongshu-api --lines 100
```

## 4. 上传修改后的后端代码

使用以下SCP命令上传修改后的后端代码到服务器：

```bash
# 上传整个server目录
scp -i /path/to/your/private_key.pem -r ./server root@www.wubug.cc:/var/www/xiaohongshu/api/

# 或者只上传修改过的文件
scp -i /path/to/your/private_key.pem ./server/routes/complaints.js root@www.wubug.cc:/var/www/xiaohongshu/api/server/routes/
scp -i /path/to/your/private_key.pem ./server/models/Complaint.js root@www.wubug.cc:/var/www/xiaohongshu/api/server/models/
```

## 5. 重启服务

上传代码后，需要重启服务以使更改生效：

```bash
# 如果使用PM2
pm2 restart xiaohongshu-api

# 如果使用systemd
sudo systemctl restart xiaohongshu-api

# 如果使用forever
forever restart /var/www/xiaohongshu/api/server.js
```

## 6. 测试投诉接口

重启服务后，可以使用以下curl命令测试投诉接口：

```bash
curl -X POST https://www.wubug.cc/xiaohongshu/api/complaints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -d '{"content": "测试投诉内容"}' \
  -v
```

## 7. 常见问题排查

### 7.1 500错误可能的原因

1. **数据库连接问题**: 检查MongoDB是否运行正常
   ```bash
   sudo systemctl status mongod
   ```

2. **字段验证失败**: 检查Complaint模型和路由代码是否一致

3. **用户认证失败**: 检查token是否有效

4. **权限问题**: 检查服务器文件权限
   ```bash
   chown -R xiaohongshu:xiaohongshu /var/www/xiaohongshu/api/
   chmod -R 755 /var/www/xiaohongshu/api/
   ```

### 7.2 检查数据库连接

```bash
# 连接到MongoDB
mongo --host localhost --port 27017

# 检查数据库状态
use xiaohongshu_audit
db.complaints.find().limit(5)
```

## 8. 部署脚本

项目中已经提供了部署脚本，可以直接使用：

```bash
# 上传并部署到服务器
./deploy-to-server.sh
```

## 9. 安全注意事项

1. 确保私钥文件权限正确：
   ```bash
   chmod 600 /path/to/your/private_key.pem
   ```

2. 不要在公共场合分享私钥

3. 定期更新服务器密码和密钥

4. 使用防火墙限制SSH访问

## 10. 联系信息

如果遇到任何问题，请联系系统管理员或开发团队。