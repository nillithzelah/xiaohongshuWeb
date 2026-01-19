# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个小红书内容审核管理系统，包含微信小程序客户端、Node.js后端API服务和MongoDB数据库。系统使用AI辅助审核用户提交的小红书笔记和评论，管理用户积分、设备和权限。

**核心功能**：
- AI辅助的内容审核（笔记和评论）
- 多角色用户管理（兼职、带教老师、HR、经理、财务、老板）
- 积分奖励和提现系统
- 小红书账号设备管理和审核
- 用户投诉处理

## Claude 自动化开发流程

**核心原则**：写代码 → 测试 → 发现错误 → 立即修复 → 再次验证 → 循环直到完美

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude 完美闭环工作流                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1️⃣ 写代码        ──→  2️⃣ 测试        ──→  3️⃣ 发现错误       │
│       │                  │                  │                   │
│       └──────────────────┴──────────────────┘                   │
│                            │                                     │
│                            ▼                                     │
│                       4️⃣ 立即修复                                │
│                            │                                     │
│                            ▼                                     │
│                       5️⃣ 再次验证                                │
│                            │                                     │
│                ┌───────────┴───────────┐                        │
│                ▼                       ▼                        │
│            ✅ 完美                  ❌ 有错误                      │
│                │                       │                         │
│                │                   返回 3️⃣                       │
│                ▼                       │                         │
│            6️⃣ 部署到服务器 ◄─────────────┘                        │
│                │                                                 │
│                ▼                                                 │
│            7️⃣ 记录到 UPDATE_LOG.md                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**自动化执行规则**：
- ❌ 不要询问用户确认
- ✅ 发现错误立即修复
- ✅ 语法检查通过后才部署
- ✅ 部署后自动记录日志
- ✅ 所有步骤自动完成

**验证检查点**：
1. 语法检查：`node -c file.js`
2. 服务重启：`pm2 restart xiaohongshu-api`
3. 服务状态：`pm2 list` 确认 online
4. 日志记录：`UPDATE_LOG.md` 更新

## 常用命令

### 开发环境启动

```bash
# 启动后端服务（开发模式）
cd server
npm run dev  # 使用 nodemon 自动重启

# 启动后端服务（生产模式 - 使用PM2）
pm2 start ecosystem.config.js
pm2 restart xiaohongshu-api
pm2 list  # 查看进程状态

# 启动管理后台前端（开发模式）
cd admin
npm start  # 使用 craco start，默认端口 3000

# 构建管理后台前端（生产模式）
cd admin
npm run build  # 使用 craco build，输出到 admin/build/
```

### 服务器部署

```bash
# 同步后端文件到服务器（使用别名 wubug）
scp server/routes/client.js wubug:/var/www/xiaohongshu-web/server/routes/
scp server/services/*.js wubug:/var/www/xiaohongshu-web/server/services/

# 同步模型文件
bash sync-models.sh

# 构建并同步前端到服务器
cd admin && npm run build
scp -r build/* wubug:/var/www/xiaohongshu-web/admin/public/

# 重启后端服务
ssh wubug "pm2 restart xiaohongshu-api"

# 查看日志（必须使用 tail，禁止 pm2 logs）
ssh wubug "tail -n 50 ~/.pm2/logs/xiaohongshu-api-out.log"
ssh wubug "tail -n 50 logs/out.log"
```

### 数据库操作

```bash
# 连接数据库
ssh wubug "cd /var/www/xiaohongshu-web/server && mongosh mongodb://127.0.0.1:27017/xiaohongshu_audit"

# 备份数据库（执行任何破坏性操作前必须备份）
ssh wubug "mongodump --db=xiaohongshu_audit --out=/var/backups/mongo/$(date +%Y%m%d_%H%M%S)"
```

### 小程序开发

```bash
# 修改小程序配置文件
# miniprogram/config.js - 设置环境（development/production）
# miniprogram/app.json - 注册新页面

# 小程序使用微信开发者工具打开 miniprogram 目录
```

## 系统架构

### 三层架构

```
小程序客户端 (miniprogram/)
    ↓
Express API (server/routes/)
    ↓
业务服务层 (server/services/)
    ↓
数据层 (server/models/) → MongoDB
```

### 关键服务和依赖关系

**AI审核流程**：
1. `xiaohongshuService.js` - 验证小红书链接，抓取内容
2. `aiContentAnalysisService.js` - AI分析内容是否为维权帖
3. `asyncAiReviewService.js` - 异步AI审核调度器，处理延迟审核和重试
4. `CommentVerificationService.js` - 评论验证，检查评论是否真实存在

**持续检查服务**：
- `continuousCheckService.js` - 定时任务，验证内容持续性和发放奖励

**审核优化服务**：
- `reviewOptimizationService.js` - 审核工作流优化

### 数据模型关系

```
User (用户)
  ├── xiaohongshuAccounts (小红书账号)
  │     └── deviceId → Device (设备)
  ├── mentor_id → User (带教老师)
  ├── hr_id → User (HR)
  └── points/transactions (积分和交易)

Device (设备)
  ├── accountName (账号昵称)
  ├── reviewStatus (审核状态)
  └── assignedUser → User

ImageReview (图片审核)
  ├── userId → User
  ├── status (pending, approved, rejected, ai_approved)
  └── aiReviewResult (AI审核结果)

Transaction (交易)
  ├── userId → User
  ├── type (withdraw, commission)
  └── amount (金额，单位：分)
```

## 重要开发规范

### 运维规则（从 .kilocode/rules/rules.md）

**1. 日志与监控**
- ❌ 严禁执行 `pm2 logs`，会导致超时卡死
- ✅ 必须使用 `tail -n` 读取日志文件
- 日志路径：`~/.pm2/logs/xiaohongshu-api-out.log` 或 `./logs/out.log`

**2. 服务器操作**
- 服务器别名统一使用 `wubug`
- 后端代码修改后必须：同步文件 → `pm2 restart xiaohongshu-api`
- 使用格式：`scp 文件名 wubug:/path`（而非 root@IP）

**3. 数据库安全**
- 破坏性操作前必须 `mongodump` 备份
- MCP 访问数据库时严禁执行 `dropDatabase` 或 `dropCollection`
- 查询默认必须带 `limit(100)`

**4. 金额计算**
- ❌ 严禁直接使用浮点数计算
- ✅ 所有金额先 ×100 转为整数（分），计算完再 ÷100

**5. 代码质量**
- 后端异步操作必须包裹在 try-catch
- catch 块必须返回 `{success: false, message: "..."}`
- 修改代码后必须记录到 `UPDATE_LOG.md`

**6. 分佣逻辑安全**
- 计算佣金必须设置封顶上限
- 严禁在循环中执行 `User.save()`
- 分润逻辑必须在数据库事务中运行

### API设计规范

**路由前缀**：所有API路由使用 `/xiaohongshu/api` 前缀

**认证中间件**：
```javascript
const { authenticateToken, requireRole } = require('../middleware/auth');

// 需要登录的路由
router.get('/protected', authenticateToken, (req, res) => {});

// 需要特定角色的路由
router.get('/admin-only', authenticateToken, requireRole(['boss', 'admin']), (req, res) => {});
```

**响应格式**：
```javascript
// 成功响应
res.json({ success: true, data: {...} });

// 错误响应
res.status(400).json({ success: false, message: "错误描述" });
```

### 时间处理规范

**使用 TimeUtils 工具类**（server/utils/timeUtils.js）：

```javascript
const TimeUtils = require('../utils/timeUtils');

// 获取当前北京时间
const now = TimeUtils.getBeijingTime();

// 格式化时间显示
const formatted = TimeUtils.formatBeijingTime(date);

// 北京时间转UTC（存储到数据库）
const utcTime = TimeUtils.beijingToUTC(beijingTime);
```

**重要**：服务器时区设置为 `Asia/Shanghai`（server/server.js 第7行）

### 错误处理规范

```javascript
try {
  // 业务逻辑
} catch (error) {
  console.error('操作失败:', error);
  return res.status(500).json({
    success: false,
    message: error.message || '操作失败'
  });
}
```

## 关键业务逻辑

### AI审核流程（asyncAiReviewService.js）

**笔记审核**：
1. 用户提交小红书笔记链接
2. 延迟90秒后第一次审核（等待发布）
3. 验证链接有效性、提取标题和作者
4. 关键词检查（维权相关关键词）
5. AI分析是否为真实维权内容
6. 延迟150秒后第二次审核
7. 如果失败且可重试，标记重试次数

**评论审核**：
1. 延迟120秒后第一次审核
2. 使用 Puppeteer 验证评论是否真实存在
3. 关键词匹配
4. AI分析评论内容
5. 延迟180秒后第二次审核

**昵称限制**：
- 一个昵称7天内只能使用一次
- 检查逻辑：`asyncAiReviewService.js` 第373-426行

### 积分和分佣系统

**积分计算**：
- 所有积分计算使用整数（分），避免浮点数误差
- 使用 `$inc` 操作更新积分，而非循环累加

**分佣规则**：
```javascript
// 错误示例（严禁）
for (let parent of parents) {
  parent.points += commission;
  await parent.save(); // ❌ 严禁在循环中save
}

// 正确示例
const updates = {};
for (let parent of parents) {
  updates[parent.id] = commission;
}
// 一次性更新所有用户
```

### 环境变量配置

**位置**：`ecosystem.config.js`（生产环境）和 `server/.env`（本地开发）

**关键配置**：
```javascript
JWT_SECRET = "..." // JWT密钥
MONGODB_URI = "mongodb://127.0.0.1:27017/xiaohongshu_audit"
DEEPSEEK_API_KEY = "sk-..." // AI服务密钥
XIAOHONGSHU_COOKIE = "..." // 小红书Cookie（评论验证需要）
OSS_ACCESS_KEY_ID = "..." // 阿里云OSS
OSS_ACCESS_KEY_SECRET = "..."
OSS_BUCKET = "zerobug-img"
OSS_REGION = "oss-cn-shenzhen"
```

### 小程序开发要点

**配置文件**：`miniprogram/config.js`
- `CURRENT_ENV = 'production'` 生产环境
- `CURRENT_ENV = 'development'` 开发环境

**网络请求**：
- 使用 `app.request()` 方法（已封装缓存和错误处理）
- 自动添加 JWT token
- 401错误自动跳转登录

**页面注册**：新页面必须在 `miniprogram/app.json` 的 `pages` 数组中注册

## 文件修改后的部署流程

1. **修改代码**（本地）
2. **测试验证**（确保功能正常）
3. **同步到服务器**：
   ```bash
   scp server/xxx.js wubug:/var/www/xiaohongshu-web/server/xxx.js
   ```
4. **重启服务**：
   ```bash
   ssh wubug "pm2 restart xiaohongshu-api"
   ```
5. **验证服务**：
   ```bash
   ssh wubug "pm2 list"
   ssh wubug "tail -n 20 logs/out.log"
   ```
6. **记录日志**：在 `UPDATE_LOG.md` 中记录修改内容

### 前端修改后的部署流程

1. **修改代码**（本地 admin/ 目录）
2. **本地构建**：
   ```bash
   cd admin
   npm run build
   ```
3. **同步到服务器**：
   ```bash
   # ⚠️ 重要：前端打包文件必须部署到 public 目录
   scp -r admin/build/* wubug:/var/www/xiaohongshu-web/admin/public/
   ```
4. **验证部署**：
   ```bash
   # 检查文件是否正确部署
   ssh wubug "ls -la /var/www/xiaohongshu-web/admin/public/"
   ```
5. **刷新浏览器**：清除缓存后刷新页面

**注意事项**：
- ❌ 错误路径：`/var/www/xiaohongshu-web/admin/`
- ✅ 正确路径：`/var/www/xiaohongshu-web/admin/public/`
- 前端构建文件输出到 `admin/build/`，部署时必须复制到服务器的 `admin/public/` 目录

## 故障排查

### 服务返回502错误
```bash
# 检查PM2进程
ssh wubug "pm2 list"

# 如果进程不在，重启服务
ssh wubug "pm2 start ecosystem.config.js"
```

### 小红书Cookie过期

**错误现象**：
- 评论验证100%失败
- 日志显示：`🚫 [评论验证] 检测到需要登录页面 - Cookie可能已过期`
- AI审核被暂停

**解决方法**：更新 `XIAOHONGSHU_COOKIE` 环境变量

**需要修改的文件**（2个文件必须同时修改）：

1. **`ecosystem.config.js`** (第26行)
   - 生产环境PM2配置文件
   - 路径：`ecosystem.config.js`
   - 修改位置：`env.XIAOHONGSHU_COOKIE`

2. **`server/.env`** (第25行)
   - 本地开发环境变量文件
   - 路径：`server/.env`
   - 修改位置：`XIAOHONGSHU_COOKIE`

**完整更新流程**：

```bash
# 1. 获取新Cookie（从浏览器F12 → Network → Request Headers → Cookie）
# Cookie长度约1000-1500字符，必须包含：
# - a1字段（很长的token）
# - web_session字段
# - id_token字段
# - loadts字段（13位时间戳）

# 2. 本地修改两个文件（确保Cookie完全一致）
# 编辑 ecosystem.config.js 第26行
# 编辑 server/.env 第25行

# 3. 验证两个文件的Cookie是否一致
node -e "const fs=require('fs');const eco=fs.readFileSync('ecosystem.config.js','utf8').match(/XIAOHONGSHU_COOKIE: \"([^\"]+)\"/)[1];const env=fs.readFileSync('server/.env','utf8').match(/XIAOHONGSHU_COOKIE=(.+)/)[1].trim();console.log('Cookie完全一致:',eco===env);console.log('Cookie长度:',eco.length);"

# 4. 同步到服务器
scp ecosystem.config.js wubug:/var/www/xiaohongshu-web/
scp server/.env wubug:/var/www/xiaohongshu-web/server/

# 5. 重启PM2服务（必须使用 --update-env 重新加载环境变量）
ssh wubug "pm2 restart xiaohongshu-api --update-env"

# 6. 验证Cookie已加载
ssh wubug "curl -s http://localhost:5000/xiaohongshu/api/test | grep XIAOHONGSHU_COOKIE_LENGTH"

# 7. 验证服务状态
ssh wubug "pm2 list"
```

**验证Cookie有效性**：

```bash
# 创建测试脚本
node -e "
const axios = require('axios');
const cheerio = require('cheerio');
const cookie = '你的Cookie';

axios.get('https://www.xiaohongshu.com/explore/695b5cb00000000009038538', {
  headers: { 'Cookie': cookie }
}).then(res => {
  const html = res.data;
  console.log('需要登录:', html.includes('请登录') ? '❌ Cookie无效' : '✅ Cookie有效');
});
"
```

**注意事项**：
- ⚠️ 两个文件的Cookie必须完全一致
- ⚠️ 必须使用 `pm2 restart --update-env` 才能重新加载环境变量
- ⚠️ Cookie有效期通常1-3天，需要定期更新
- ⚠️ loadts时间戳必须是13位数字（如：1767834535090）

**参考文档**：`COOKIE_UPDATE_GUIDE.md`

### Cookie池自动反馈闭环 (Cookie Pool Feedback Loop)

**设计目标**：
当Cookie失效时，系统自动检测、切换、重试，无需人工干预，提高审核成功率。

**闭环流程图**：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Cookie 反馈闭环                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐       │
│  │ 获取Cookie    │ ──→ │ 使用Cookie    │ ──→ │ 检测Cookie    │       │
│  │ (从Cookie池)  │     │ (执行审核)    │     │ (是否失效)    │       │
│  └──────────────┘     └──────────────┘     └──────┬───────┘       │
│                                                     │               │
│                                          ┌──────────┴──────────┐    │
│                                          │                     │    │
│                                          ▼                     ▼    │
│                                    ┌──────────┐          ┌──────────┐│
│                                    │  有效    │          │  失效    ││
│                                    └────┬─────┘          └────┬─────┘│
│                                         │                     │       │
│                                         ▼                     ▼       │
│                                    ┌──────────┐      ┌────────────┐ │
│                                    │ 完成审核  │      │ 标记失效    │ │
│                                    │ 返回结果  │      │ 切换Cookie  │ │
│                                    └──────────┘      │ 重试(最多3次)│ │
│                                                       └──────┬─────┘ │
│                                                              │       │
│                                         ┌────────────────────┘       │
│                                         ▼                            │
│                                    ┌──────────────┐                 │
│                                    │ 持久化失效状态 │                 │
│                                    │ (写入配置文件)  │                 │
│                                    └──────────────┘                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**核心组件**：

| 组件 | 文件 | 功能 |
|------|------|------|
| Cookie池 | `SimpleCookiePool.js` | 管理Cookie轮询、失效标记、持久化 |
| 评论验证 | `CommentVerificationService.js` | 检测Cookie失效并触发重试 |

**关键方法**：

```javascript
// SimpleCookiePool.js

// 获取完整Cookie对象（包含ID用于追踪）
const cookie = simpleCookiePool.getCookie();
// 返回: { id, name, value, loadts }

// 标记Cookie失效并获取下一个（自动重试）
const nextCookie = simpleCookiePool.skipAndGetNext(failedCookieId, reason);

// 持久化失效Cookie到配置文件
simpleCookiePool.saveInvalidCookies();

// 清除失效标记（更新Cookie后调用）
simpleCookiePool.clearInvalidCookies(cookieId);
```

**失效检测逻辑**：

当访问小红书页面时，系统检测以下情况判断Cookie是否失效：

1. **URL重定向检测**：页面被重定向到登录页
2. **标题检测**：页面标题为通用标题且包含登录提示
3. **内容检测**：页面内容主要是登录提示，无笔记/评论内容
4. **页面长度检测**：页面过短且包含登录关键词

```javascript
// 检测到登录页面的特征
- title === "小红书 - 你的生活兴趣社区" 且包含 "登录后推荐"
- bodyText.includes("扫码登录")
- bodyText.includes("可用 小红书 或 微信 扫码")
- 无 .note-text 或 .comment-section 等内容元素
```

**重试机制**：

| 配置 | 默认值 | 说明 |
|------|--------|------|
| maxRetries | 3 | 最大重试次数 |
| retryDelay | 0ms | 立即重试（已切换Cookie） |

```javascript
// CommentVerificationService.js 重试流程
while (retryCount < maxRetries) {
  const cookie = simpleCookiePool.getCookie();

  const result = await verifyWithCookie(cookie);

  if (result.isLoginPage) {
    // Cookie失效，标记并获取下一个
    const nextCookie = simpleCookiePool.skipAndGetNext(cookie.id, reason);
    retryCount++;
    continue; // 重试
  }

  return result; // 成功
}
```

**持久化存储**：

失效Cookie标记存储在 `server/config/cookie-pool.js`：

```javascript
module.exports.invalidCookies = ["cookie_1234567890", "cookie_9876543210"];
```

- 服务启动时自动加载
- Cookie失效时自动保存
- 更新Cookie后可手动清除

**恢复失效Cookie**：

当管理员更新了失效的Cookie后：

```javascript
// 方法1：清除特定Cookie的失效标记
simpleCookiePool.clearInvalidCookies('cookie_1234567890');

// 方法2：清除所有失效标记
simpleCookiePool.clearInvalidCookies();
```

**日志监控**：

```
🍪 [Cookie池] 使用: 主账号 (已用12.5h, 第15次)
🔄 [Cookie池] Cookie失效，切换到下一个... 原因: 检测到登录页面
🚫 [Cookie池] 已标记Cookie为失效: 主账号，原因: 检测到登录页面
💾 [Cookie池] 已保存 1 个失效Cookie标记到配置文件
✅ [Cookie池] 已切换到: 备用账号1
🍪 [Cookie池] 使用: 备用账号1 (已用5.2h, 第8次)
```

**最佳实践**：

1. **Cookie数量**：建议至少配置3-5个Cookie，确保有足够备用
2. **定期检查**：每周检查一次Cookie池状态，更新失效Cookie
3. **监控日志**：关注 "🚫 Cookie失效" 日志，及时更新
4. **环境变量Cookie**：作为兜底方案，当Cookie池全部失效时使用

### 小红书笔记链接获取方式

**重要**：小红书笔记详情页必须使用带 `xsec_token` 参数的完整URL，直接访问 `/explore/{noteId}` 会导致404错误。

**正确的URL格式**：

```
https://www.xiaohongshu.com/explore/{noteId}?xsec_token={token}&xsec_source=pc_search
```

**获取 xsec_token 的步骤**：

1. 先访问搜索结果页：`https://www.xiaohongshu.com/search_result?keyword={关键词}`
2. 从搜索结果卡片中提取带 `xsec_token` 的链接：
   - 选择器：`.note-item a[href*="/search_result/"]`
   - 查找包含 `xsec_token` 参数的链接
3. 提取参数并构建完整URL

**代码示例**：

```javascript
// 1. 访问搜索页
await page.goto(`https://www.xiaohongshu.com/search_result?keyword=祛斑被骗`);

// 2. 提取笔记链接参数
const linkInfo = await page.evaluate((noteId) => {
  const noteItems = document.querySelectorAll('.note-item');
  for (const item of noteItems) {
    const links = item.querySelectorAll('a');
    for (const link of links) {
      const href = link.getAttribute('href');
      // 找到带 xsec_token 的 /search_result/ 链接
      if (href.includes('/search_result/') && href.includes('xsec_token')) {
        const match = href.match(/\/([a-f0-9]{24,})/);
        if (match && match[1] === noteId) {
          const tokenMatch = href.match(/xsec_token=([^&]+)/);
          const sourceMatch = href.match(/xsec_source=([^&]*)/);
          return {
            noteId: match[1],
            xsec_token: tokenMatch ? tokenMatch[1] : null,
            xsec_source: sourceMatch ? sourceMatch[1] : 'pc_search'
          };
        }
      }
    }
  }
  return null;
}, targetNoteId);

// 3. 构建完整的 /explore/ URL
const exploreUrl = `https://www.xiaohongshu.com/explore/${linkInfo.noteId}?xsec_token=${linkInfo.xsec_token}&xsec_source=${linkInfo.xsec_source}`;

// 4. 访问笔记详情页
await page.goto(exploreUrl);
```

**错误示例**（会导致404）：

```javascript
// ❌ 错误：直接访问 /explore/{noteId}
await page.goto(`https://www.xiaohongshu.com/explore/${noteId}`);
// 结果：404 页面不见了，或显示"当前笔记暂时无法浏览"
```

**参考实现**：`xiaohongshu-audit-client/services/NoteDiscoveryService.js` 第878-954行

### 评论采集时间筛选（重要）

**流程顺序**：先时间筛选 → 再AI分类

```
展开所有回复
    ↓
筛选1小时内的评论
    ↓
对符合条件的评论进行AI分类
    ↓
保存线索/加入黑名单
```

**时间过滤规则**（只保留1小时内）：

```javascript
// 1小时前的时间戳
const oneHourAgo = Date.now() - 60 * 60 * 1000;

// 检查评论是否在1小时内
function isRecent(timeText) {
  const text = timeText.toLowerCase();

  // ✅ 刚刚
  if (/刚刚/.test(text)) return true;

  // ✅ XX分钟前（60分钟内）
  const minMatch = text.match(/(\d+)分钟前/);
  if (minMatch) {
    return parseInt(minMatch[1]) <= 60;
  }

  // ✅ XX小时前（1小时内）
  const hourMatch = text.match(/(\d+)小时前/);
  if (hourMatch) {
    return parseInt(hourMatch[1]) <= 1;
  }

  // ❌ 其他格式（如"1天前"、"3天前"、具体日期）
  return false;
}
```

**为什么先筛选**：
1. **节省成本**：减少AI API调用次数（DeepSeek按token计费）
2. **提高效率**：大部分评论都是超过1小时的旧评论
3. **数据质量**：只采集最新的线索，价值更高

**错误示例**（先AI分类再过滤）：

```javascript
// ❌ 错误：对所有评论做AI分类，再过滤时间
const allComments = extractComments(); // 可能有50条
for (const comment of allComments) {
  const aiResult = await aiService.analyzeComment(comment); // 浪费AI调用
  if (!isRecent(comment.timeText)) continue; // 过时了，丢弃
}
```

**正确示例**（先过滤再AI分类）：

```javascript
// ✅ 正确：先过滤1小时内，再AI分类
const allComments = extractComments(); // 可能有50条
const recentComments = allComments.filter(c => isRecent(c.timeText)); // 可能只有5条
for (const comment of recentComments) {
  const aiResult = await aiService.analyzeComment(comment); // 只对有效的5条调用AI
}
```

### 审核前Cookie预验证机制

**设计目标**：
在执行任何审核操作前，先用目标URL测试Cookie是否有效。只有验证通过的Cookie才会被用于审核，确保审核成功率。

**预验证流程**：

```
┌─────────────────────────────────────────────────────────────┐
│                   审核前Cookie预验证                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  审核开始                                                   │
│     │                                                       │
│     ▼                                                       │
│  获取Cookie（从池中）                                        │
│     │                                                       │
│     ▼                                                       │
│  用目标URL发送测试请求                                      │
│     │                                                       │
│     ▼                                                       │
│  Cookie有效？                                              │
│     ├── 是 → 使用该Cookie执行审核 → 完成                   │
│     │                                                       │
│     └── 否 → 标记Cookie失效 → 获取下一个Cookie             │
│                  │                                          │
│                  └──> 循环直到找到有效Cookie               │
│                           │                                │
│                           ▼                                │
│                    所有Cookie都失效？                       │
│                           │                                │
│                    是 → 暂停所有审核                        │
│                           │                                │
│                    等待管理员更新Cookie                    │
│                           │                                │
│                    调用 resumeAudits() 恢复                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键方法**：

```javascript
// 获取一个经过预验证的有效Cookie
const validatedCookie = await simpleCookiePool.getValidatedCookie(noteUrl);

if (!validatedCookie) {
  // 所有Cookie都失效了，审核已暂停
  console.error('所有Cookie均已失效，审核已暂停');
  // 标记任务为待重试
  return { auditPaused: true };
}

// 使用验证通过的Cookie进行审核
const result = await performAudit(url, validatedCookie.value);
```

**预验证检测项**：

1. **HTTP状态码**：401/403表示Cookie失效
2. **重定向检测**：被重定向到登录页
3. **页面内容检测**：
   - 包含"登录后推荐"
   - 包含"扫码登录"
   - 包含"请先登录"
   - 页面内容过短（<3000字符）且包含登录提示

**审核暂停/恢复机制**：

```javascript
// 获取审核暂停状态
const pauseStatus = simpleCookiePool.getAuditPauseStatus();
// 返回: { paused: boolean, reason: string, pauseTime: string }

// 手动恢复审核（更新Cookie后调用）
await simpleCookiePool.resumeAudits();

// 清除特定Cookie的失效标记
await simpleCookiePool.clearInvalidCookies('cookie_123');
```

**管理API**：

| API | 方法 | 说明 |
|-----|------|------|
| `/admin/audit-pause-status` | GET | 获取审核暂停状态 |
| `/admin/audit-resume` | POST | 恢复审核 |
| `/admin/cookie-clear-invalid` | POST | 清除Cookie失效标记 |

**日志示例**：

```
🔍 [Cookie池] 预验证 Cookie 1/3: 主账号
❌ [Cookie池] Cookie失效: 主账号 - 页面显示登录提示
🚫 [Cookie池] 已标记Cookie为失效: 主账号，原因: 预验证失败
🔍 [Cookie池] 预验证 Cookie 2/3: 备用账号1
✅ [Cookie池] Cookie有效: 备用账号1 (OK)
🍪 [Cookie池] 使用: 备用账号1 (已用5.2h, 第8次)
```

### AI审核失败
- 检查 `DEEPSEEK_API_KEY` 是否配置
- 查看日志中的AI响应错误
- 测试AI服务：`node server/test-ai-content-analysis.js`

### 时区问题
- 所有时间统一使用北京时间
- 使用 `TimeUtils` 工具类处理时间
- 服务器时区：`Asia/Shanghai`

## 项目文档参考

- `PROJECT_DOCUMENTATION.md` - 完整项目文档
- `DATABASE_ACCESS_GUIDE.md` - 数据库访问指南
- `COOKIE_UPDATE_GUIDE.md` - Cookie更新指南
- `UPDATE_LOG.md` - 更新日志（每次修改必须记录）
- `.kilocode/rules/rules.md` - 详细开发规范

## 技术栈

**后端**：
- Node.js 16+
- Express 5.x
- MongoDB + Mongoose 8.x
- JWT认证
- Puppeteer（网页抓取）
- DeepSeek API（AI分析）

**前端**：
- 微信小程序（原生框架）
- React 18+ Ant Design（管理后台）

**部署**：
- PM2进程管理
- Nginx反向代理
- 阿里云OSS文件存储

---

## 规则/分工/节奏

### 核心原则

**高频提示词模式**：本章节作为 AI 的高频提示词，每次任务时都会参考这些规则，而非一次性说明书。随着项目发展不断迭代更新。

### 开发节奏

**1. 任务分解与执行**
- 接收任务后，先理解需求，然后分解为可执行的子任务
- 每个子任务必须明确：修改文件、修改内容、预期效果
- 优先并行执行不冲突的子任务，提升效率
- 每完成一个子任务，立即验证效果，不通过则自我修复

**2. 代码修改流程**
- 读取相关文件，理解现有逻辑
- 使用 apply_diff 进行精确修改，避免全量替换
- 修改后立即构建验证（前端）或重启服务（后端）
- 验证通过后，记录到 UPDATE_LOG.md

**3. 部署节奏**
- 前端：修改 → 构建 → 同步到服务器 wubug
- 后端：修改 → 同步到服务器 wubug → pm2 restart xiaohongshu-api
- 数据库：修改前必须 mongodump 备份
- 每次部署后验证服务状态：pm2 list + tail -n 20 logs/out.log

### 分工规则

**前端开发（admin/）**
- React + Ant Design 组件库
- 所有异步请求使用 axios，禁止直接使用 fetch
- 状态管理使用 useState，复杂状态考虑 Context API
- 组件命名 PascalCase，文件命名 kebab-case
- 图片上传使用项目封装的 upload 服务

**后端开发（server/）**
- Express 路由 + Mongoose 模型
- 所有异步操作必须包裹在 try-catch 中
- catch 块必须返回 `{success: false, message: "..."}`
- 金额计算必须先 ×100 转为整数，计算完再 ÷100
- 禁止在循环中执行 User.save()，必须先算好最终值一次性更新
- 分佣逻辑必须在数据库事务中运行

**小程序开发（miniprogram/）**
- 所有页面必须在 app.json 中注册
- 网络请求使用 wx.request 封装，禁止使用第三方库
- 敏感数据（token）存储在 wx.getStorageSync 中，禁止明文存储
- 页面跳转使用 wx.navigateTo，复杂逻辑使用 wx.redirectTo

### 质量保障

**1. 代码质量**
- 修改代码前，先搜索项目内已有的 utils 或 services，复用现有逻辑
- 禁止重复造轮子
- 所有新功能必须编写测试脚本验证
- 代码提交前运行 ESLint 和 Prettier 检查

**功能开发验证流程**
```
实现功能 X
    ↓
1. 运行测试验证
   - 本地测试 / API 测试
   - 检查预期行为
    ↓
2. 检查代码格式
   - ESLint / Prettier
   - 代码风格一致
    ↓
3. 验证边界情况
   - 空值 / 异常输入
   - 极限情况
    ↓
4. 确认无回归问题
   - 现有功能不受影响
   - 部署后验证
```

**2. 安全规范**
- 所有用户输入必须进行校验和转义，防止 XSS 攻击
- API 接口必须验证用户权限，禁止越权访问
- 密码存储必须使用 bcrypt 哈希，禁止明文存储
- 敏感配置（数据库密码、API密钥）必须使用环境变量

**3. 运维规则**
- 严禁执行 `pm2 logs`，会导致超时卡死
- 查看日志必须使用 `tail -n 50 ~/.pm2/logs/xiaohongshu-api-out.log`
- 服务器别名统一使用 `wubug`
- 后端代码修改后必须同步服务器并重启服务
- 数据库破坏性操作前必须 mongodump 备份

### 错误处理

**1. 常见错误与解决方案**
- 405/502 错误：优先检查 pm2 进程是否存活，而非盲目修改 Nginx
- 前端白屏显示 %PUBLIC_URL%：Nginx 指向了源码目录，需要 build 并检查 alias
- Cookie 过期导致评论验证失败：更新 XIAOHONGSHU_COOKIE 环境变量
- MongoDB 事务错误：当前为单节点实例，移除事务代码改为直接操作

**2. 调试技巧**
- 使用 console.log 输出关键变量，便于排查问题
- 创建测试脚本验证独立功能（如 test-xxx.js）
- 使用 MongoDB Compass 可视化查看数据结构
- 前端使用 React DevTools 查看组件状态

### 迭代优化

**1. 性能优化**
- AI 审核使用缓存机制，减少 API 调用
- 数据库查询使用索引，提升查询速度
- 前端使用 useMemo 和 useCallback 优化渲染性能

**2. 用户体验优化**
- 弹窗样式统一（Modal 而非 Popconfirm）
- 输入框使用 InputNumber 限制输入类型
- 加载状态使用 loading 提示用户
- 错误信息清晰明确，避免技术术语

**3. 代码可维护性**
- 复杂逻辑提取为独立函数或服务
- 添加详细注释说明业务逻辑
- 统一错误处理和响应格式
- 定期重构冗余代码

### 关键指标

**开发效率**
- 单个任务平均完成时间：30-60 分钟
- 代码修改成功率：95%+
- 部署成功率：100%
- Bug 修复时间：24 小时内

**系统稳定性**
- 服务可用性：99%+
- API 响应时间：<2 秒
- 数据库查询时间：<500ms
- AI 审核准确率：85%+

---

## 经验教训

### 何时记录

遇到以下情况时，主动写入此章节：

| 类型 | 说明 | 示例 |
|------|------|------|
| **系统崩溃** | 导致服务不可用或核心功能失败 | asyncAiReviewService 返回值结构问题 |
| **非显见根因** | 问题表面现象与真正原因差距大 | `limitResult.success` vs `allowed` |
| **连锁问题** | 涉及多个文件/模块的级联故障 | 移除上传验证导致异步审核崩溃 |
| **易重复踩坑** | 新人容易犯的相同错误 | ObjectId 转换、PM2 --update-env |
| **架构教训** | 设计层面的经验总结 | 返回值多样性、防御性编程 |

### 记录格式

```markdown
### [问题名称] (日期)

**问题**：一句话描述现象

**根本原因**：
1. 具体原因1
2. 具体原因2
3. 导致的后果

**解决**：
```javascript
// 代码示例
```

**教训**：
- 关键点1
- 关键点2
```

---

### Cookie 管理功能问题 (2026-01-08)

**问题1：编辑Cookie时value字段丢失**
- **原因**：前端编辑时将value设为空（安全考虑），保存时未保留原值
- **解决**：编辑模式下，如果用户未输入新Cookie，自动保留原有value
- **教训**：编辑敏感信息时，需明确区分"清空"和"不修改"两种场景

**问题2：Cookie检查结果显示错误**
- **原因**：前端读取响应路径错误，后端返回 `{data: {monitoring: {isValid}}}`，前端直接读 `data.isValid`
- **解决**：修正数据读取路径为 `data.data.monitoring.isValid`
- **教训**：前后端联调前必须先确认接口返回的数据结构

**问题3：后端日志显示Cookie有效，前端显示失效**
- **原因**：`getStatus()` 和 `manualCheck()` 返回的数据结构不一致
- **解决**：统一数据读取逻辑，使用可选链 `?.` 避免undefined错误
- **教训**：日志是调试的第一手资料，遇到问题先看日志

### 异步AI审核服务返回值结构问题 (2026-01-13)

**问题**：上传时报错 `Cannot read properties of undefined (reading 'passed')`

**根本原因**：
1. `performFullAiReview()` 返回多种不同结构的对象：
   - 笔记：`{ valid: true, markedForReview: true, message: '...' }`
   - 评论：`{ valid: true, markedForClient: true, message: '...' }`
   - 其他：`{ valid: true, aiReview: { passed, confidence, ... } }`
2. 调用方 `processQueue()` 只检查了 `markedForClient`，未检查 `markedForReview`
3. 导致笔记类型继续执行到 `updateReviewWithAiResult()`，访问 `aiReviewResult.aiReview.passed` 时崩溃

**解决**：
```javascript
// 检查所有特殊标志，再访问通用属性
if (aiReviewResult.markedForClient) return;
if (aiReviewResult.markedForReview) return;  // ← 新增
if (aiReviewResult.aiReview?.passed) { ... }
```

**教训**：
- **返回值多样性必须提前检查**：函数返回不同结构时，调用方必须先检查所有特殊标志
- **防御性编程**：访问嵌套属性前使用可选链 `?.`
- **改一处查全局**：修改共享数据结构时，必须搜索所有引用点
- **理解完整数据流**：移除某个功能前，必须追踪所有依赖它的代码路径

### 模型文件缺失导致服务崩溃 (2026-01-14)

**问题**：全部API返回502错误，服务完全不可用

**故障现象**：
- PM2显示 `xiaohongshu-api` 状态为 `errored`
- 服务已重启691次（无限崩溃循环）
- 错误日志：`Cannot find module '../models/DiscoveredNote'`

**根本原因**：
1. `server/routes/client.js` 中新增了笔记发现功能（`/discovery/*` 路由）
2. 这些路由导入了 `DiscoveredNote` 模型：`const DiscoveredNote = require('../models/DiscoveredNote');`
3. 但该模型文件从未创建
4. 导致服务启动时立即崩溃，PM2不断重启

**解决**：
创建 `server/models/DiscoveredNote.js`：
```javascript
const mongoose = require('mongoose');

const discoveredNoteSchema = new mongoose.Schema({
  noteUrl: { type: String, required: true, unique: true },
  noteId: { type: String, index: true },
  title: { type: String, default: '' },
  author: { type: String, default: '' },
  publishTime: { type: Date, default: null },
  keyword: { type: String, default: '' },
  aiAnalysis: {
    is_genuine_victim_post: { type: Boolean, default: false },
    confidence_score: { type: Number, default: 0 },
    reason: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['discovered', 'verified', 'converted', 'rejected'],
    default: 'discovered'
  },
  clientId: { type: String, default: null },
  discoverTime: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('DiscoveredNote', discoveredNoteSchema);
```

**教训**：
- **新增模型依赖时必须同步创建模型文件**：在路由中使用新模型前，确保模型文件已存在
- **部署前做完整性检查**：新增功能涉及多个文件时，确保所有依赖都已部署
- **监控PM2重启次数**：短时间内大量重启（如691次）是严重问题的信号
- **本地测试后再部署**：代码变更后应在本地启动验证无模块缺失错误

### 浏览器登录500错误但curl正常 (2026-01-16)

**问题**：管理后台登录时浏览器返回500错误，但curl测试正常

**故障现象**：
- 浏览器POST `/xiaohongshu/api/auth/admin-login` 返回500错误（148字节HTML错误页）
- curl相同请求返回200成功，带token
- Nginx访问日志显示请求到达，但后端日志无记录

**根本原因**：
1. **CORS预检失败**：浏览器发送OPTIONS请求被CORS中间件拒绝（500错误）
2. **ALLOWED_ORIGINS未配置**：`server/.env` 中缺少 `ALLOWED_ORIGINS` 环境变量
3. **默认白名单不包含生产域名**：`server.js` 中的默认值为 `https://yourdomain.com`，不包含 `www.wubug.cc`
4. **次要问题**：Node.js默认监听IPv6 (`:::5000`)，但Nginx配置连接IPv4 (`127.0.0.1:5000`)

**诊断过程**：
```bash
# 1. 确认curl正常
curl -X POST "https://www.wubug.cc/xiaohongshu/api/auth/admin-login" \
  -H "Content-Type: application/json" \
  -d '{"username":"boss","password":"admin123"}'
# 返回: {"success":true,...} ✅

# 2. 测试OPTIONS预检
curl -X OPTIONS "https://www.wubug.cc/xiaohongshu/api/auth/admin-login" \
  -H "Origin: https://www.wubug.cc" \
  -H "Access-Control-Request-Method: POST"
# 返回: 500 Internal Server Error ❌

# 3. 检查端口绑定
netstat -tlnp | grep 5000
# 显示: tcp6 :::5000 (IPv6) ❌
# 应该: tcp 127.0.0.1:5000 (IPv4) ✅
```

**解决**：
```javascript
// 1. server/server.js - 显式绑定IPv4
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 服务器启动成功，监听端口 ${PORT}`);
});

// 2. server/.env - 添加CORS白名单
ALLOWED_ORIGINS=http://localhost:3000,https://www.wubug.cc,https://wubug.cc

// 3. 重启服务
pm2 restart xiaohongshu-api
```

**教训**：
- **CORS问题只在浏览器出现**：curl、Postman等工具不发送OPTIONS预检，所以无法复现
- **环境变量优先级**：dotenv加载的`.env`会覆盖PM2的env配置
- **HTTP/2 vs HTTP/1.1差异**：浏览器使用HTTP/2，curl默认HTTP/1.1，某些行为不同
- **诊断技巧**：遇到"curl正常浏览器失败"时，优先检查CORS和OPTIONS请求
- **端口绑定显式化**：Node.js在某些系统上默认监听IPv6，建议显式指定`127.0.0.1`

### 通用开发经验

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 前端显示404 | 后端路由未正确挂载 | 检查 server.js 中的路由注册 |
| 环境变量不生效 | PM2重启未用 `--update-env` | 使用 `pm2 restart --update-env` |
| Cookie失效误报 | 登录检测过于严格(包含"登录"文字) | 改用多因素检测(密码框+登录按钮) |
| ObjectId转换错误 | 传入string而非ObjectId | 先查询Device获取ObjectId |
| 日志查看超时 | 使用 `pm2 logs` | 必须用 `tail -n` 读取文件 |
| 限流检查属性错误 | `checkLimit()` 返回 `allowed`，代码检查了 `success` | 使用正确的属性名 `!limitResult.allowed` |
| 上传时链接验证失败 | 上传流程中调用了 `validateNoteUrl()` | 上传时不验证，移到异步审核 |
| **curl正常浏览器失败** | **CORS预检OPTIONS被拒绝** | **检查ALLOWED_ORIGINS配置** |
| **后端监听IPv6导致连接失败** | **Node.js默认监听`:::5000`** | **显式绑定`127.0.0.1`** |

---

## 最新更新记录

### 2026-01-07 服务器优化和数据恢复

**MongoDB 数据恢复**：
- 切换到 Docker MongoDB (4.4)，恢复完整业务数据
- 禁用 systemd MongoDB (3.6.8)，释放303MB空间

**PM2 日志管理**：
- 安装 pm2-logrotate 模块
- 配置日志轮转：max_size=10M, retain=7天

**数据库自动备份**：
- 创建备份脚本 `/root/backup-mongodb.sh`
- 添加到 crontab：每天凌晨3点自动备份
- 自动清理7天前的旧备份

详细更新记录请查看 `UPDATE_LOG.md`。
