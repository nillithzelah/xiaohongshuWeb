# Cookie更新修复指南

## 🔍 问题确认

评论审核失败的根本原因是：**小红书Cookie过期**

### 现象
- 系统能正常注入Cookie，但抓取到的内容是登录提示和协议文本
- 评论验证100%失败
- 日志显示：`"当前帖子评论区无法检测到你的评论（请用其他号观察）"`

### 原因
1. `ecosystem.config.js` 中缺少 `XIAOHONGSHU_COOKIE` 环境变量配置
2. 本地 `.env` 中的Cookie已过期
3. 未登录状态下小红书不显示评论内容

## 🛠️ 修复步骤

### 步骤1：获取新的小红书Cookie

1. **打开浏览器**，访问 https://www.xiaohongshu.com
2. **登录账号**（使用有评论权限的账号）
3. **打开开发者工具**（F12）
4. **访问任意笔记页面**，确认能看到评论
5. **在开发者工具的Application/Storage → Cookies中找到**
6. **复制所有 `xiaohongshu.com` 域下的Cookie**

### 步骤2：更新本地配置

更新 `server/.env` 文件：
```bash
# 小红书Cookie配置（用于评论验证）
XIAOHONGSHU_COOKIE=你的新Cookie字符串
```

### 步骤3：更新服务器配置

修改 `ecosystem.config.js`，添加Cookie配置：

```javascript
env: {
  // ... 其他配置
  // 小红书Cookie配置
  XIAOHONGSHU_COOKIE: "你的新Cookie字符串"
}
```

### 步骤4：重启服务

```bash
# 同步代码到服务器
scp ecosystem.config.js wubug:/var/www/xiaohongshu-web/ecosystem.config.js

# 重启服务
ssh wubug "pm2 restart xiaohongshu-api"
```

## 🔍 Cookie验证方法

### 方法1：检查Cookie是否有效
```bash
# 在服务器上测试
ssh wubug "curl -H 'Cookie: 你的Cookie字符串' https://www.xiaohongshu.com/explore/任意笔记ID"
```

### 方法2：检查评论是否可见
访问任意有评论的笔记页面，确认能看到评论内容而不是登录提示。

## 📊 验证修复效果

修复后应该看到：
1. 评论验证成功率恢复到90%+
2. 日志显示抓取到真实的评论内容
3. 审核任务正常通过

## ⚠️ 注意事项

1. **Cookie时效性**：小红书Cookie通常有效期为30天，需要定期更新
2. **账号权限**：确保使用的账号有查看评论的权限
3. **多账号策略**：考虑配置多个Cookie以提高成功率
4. **安全存储**：Cookie包含敏感信息，不要在代码中明文存储

## 🔄 定期维护

建议设置定时任务，每月检查和更新Cookie：

```bash
# crontab 示例（每月1号检查）
0 0 1 * * /path/to/check_cookie.sh
```

## 🚨 紧急处理

如果Cookie频繁过期，考虑以下备用方案：
1. 使用无头浏览器自动登录获取Cookie
2. 配置多个备用Cookie
3. 添加Cookie自动刷新机制