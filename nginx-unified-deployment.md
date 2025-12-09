# Nginx统一配置部署指南

## 📋 配置变更说明

### 之前的配置问题
- **Server Name冲突**: `merged-web` 和 `wubug-admin-ssl` 都声明处理 `www.wubug.cc`
- **端口冲突**: 两个配置都监听443端口
- **功能重复**: 多个配置文件功能重叠

### 统一后的配置
- **单一配置文件**: `unified-web` 整合所有功能
- **路径区分**: 使用URL路径区分不同应用
  - 小红书审核系统: `https://www.wubug.cc/xiaohongshu/`
  - 武霸哥应用: `https://www.wubug.cc/` (根路径)

## 🚀 部署步骤

### 1. 备份当前配置
```bash
# 在服务器上执行
sudo cp /etc/nginx/sites-enabled/merged-web /etc/nginx/sites-enabled/merged-web.backup
```

### 2. 复制新配置
```bash
# 将 unified-web 文件复制到服务器的 sites-available 目录
sudo cp unified-web /etc/nginx/sites-available/

# 创建符号链接启用配置
sudo ln -sf /etc/nginx/sites-available/unified-web /etc/nginx/sites-enabled/

# 移除旧配置
sudo rm /etc/nginx/sites-enabled/merged-web
```

### 3. 测试配置
```bash
# 检查nginx配置语法
sudo nginx -t

# 如果测试通过，重载nginx
sudo systemctl reload nginx
```

### 4. 验证功能
- 小红书审核系统: `https://www.wubug.cc/xiaohongshu/`
- 武霸哥应用: `https://www.wubug.cc/`
- API接口:
  - 小红书API: `https://www.wubug.cc/xiaohongshu/api/`
  - 武霸哥API: `https://www.wubug.cc/api/`

## 🔧 配置说明

### Location块优先级
1. `= /openid/report` - 精确匹配广告监测
2. `/xiaohongshu/api/` - 小红书API (更具体路径优先)
3. `/api/` - 武霸哥API
4. `/xiaohongshu/` - 小红书前端
5. `/` - 武霸哥前端 (根路径)

### 后端服务端口
- 小红书后端: `localhost:5000`
- 武霸哥后端: `localhost:3000`

### SSL配置
- 使用Let's Encrypt证书
- 支持HTTP/2
- 自动跳转HTTP到HTTPS

## ⚠️ 注意事项

1. **确保后端服务运行**: 部署前确认两个后端服务都在对应端口运行
2. **静态文件路径**: 确认 `/var/www/xiaohongshu-web/admin/public/` 和 `/var/www/html/` 路径正确
3. **日志位置**: 日志文件位于 `/var/log/nginx/`
4. **备份**: 部署前务必备份现有配置

## 🔄 回滚方案

如果出现问题，可以快速回滚：
```bash
# 恢复旧配置
sudo rm /etc/nginx/sites-enabled/unified-web
sudo ln -sf /etc/nginx/sites-available/merged-web /etc/nginx/sites-enabled/
sudo systemctl reload nginx