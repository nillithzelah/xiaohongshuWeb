# 小红书评论采集 - OpenClaw 版

基于配置驱动的批量采集方案，复用现有服务器 API。

---

## 触发指令

```
采集小红书评论
批量采集
```

---

## 配置文件

**位置：** `D:\Desktop\projects\xiaohongshuWeb\openclaw-harvest\config.json`

修改此文件即可调整所有参数，无需改代码。

---

## 执行流程

### 1. 读取配置
```
读取 config.json → 获取服务器地址、clientId、采集参数
```

### 2. 获取任务
```
GET {server.baseUrl}{server.apiPath}/harvest/pending
  ?clientId={client.clientId}
  &clientType={client.clientType}
  &limit={harvest.batchSize}
```

返回：`{ notes: [{ noteUrl, noteId, title, author, keyword, harvestPriority }] }`

### 3. 遍历采集（每个笔记）

```
for each note in notes:
  
  3.1 打开笔记页面
      browser.navigate(noteUrl)
      
      - 如果 404/已删除 → 调用 notifyNoteDeleted() → 继续下一个
      - 如果需要登录 → 调用 markHarvestFailed("login_required") → 继续
  
  3.2 提取笔记内容（如果缺失）
      - 标题、作者、关键词
      
  3.3 滚动加载评论
      browser.act(scroll)
      
  3.4 提取评论
      - 根据 harvestPriority 确定时间范围
      - 过滤作者评论
      - 去重
      
  3.5 智能过滤
      - 黑名单检查
      - AI 引流检测（调用服务端 /ai/analyze-comment）
      
  3.6 提交评论
      POST {server.apiPath}/comments/submit
      {
        noteUrl, noteId, noteTitle, noteAuthor, keyword,
        comments: [{ commentAuthor, commentAuthorId, commentContent, commentTime }],
        clientId
      }
      
  3.7 标记完成
      POST {server.apiPath}/harvest/complete
      {
        noteUrl,
        commentCount,
        totalCommentCount,
        harvestPriority,
        lastCommentTime,
        clientId
      }
      
  3.8 间隔等待
      sleep(harvest.noteInterval) // 默认 5 秒
```

### 4. 采集完成

```
- 返回首页（可选）
- 检测登录状态
- 保持浏览器打开（config.browser.keepOpen = true）
- 输出统计报告
```

---

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/harvest/pending` | GET | 获取待采集笔记 |
| `/harvest/complete` | POST | 标记采集完成 |
| `/comments/submit` | POST | 提交评论 |
| `/comments/blacklist/client` | GET | 获取黑名单 |
| `/comments/blacklist/client` | POST | 添加黑名单 |
| `/ai/analyze-comment` | POST | AI 分析评论 |
| `/heartbeat` | POST | 心跳 |
| `/discovery/note-deleted` | POST | 通知笔记删除 |

---

## 时间范围规则

根据 `harvestPriority` 动态设置评论筛选范围：

| 优先级 | 时间范围 | 说明 |
|--------|----------|------|
| 10 | 1 小时 | 最高优先级 |
| 5 | 1 小时 | 中等优先级 |
| 2 | 6 小时 | 较低优先级 |
| 1 | 24 小时 | 最低优先级 |

配置路径：`harvest.timeRangeHours`

---

## 过滤规则

### 1. 客户端过滤
- **作者评论** — 跳过笔记作者的评论
- **黑名单** — 调用 `/comments/blacklist/client` 获取
- **时间范围** — 根据 `harvestPriority` 动态设置

### 2. AI 过滤（服务端）
调用 `/ai/analyze-comment`，过滤类型：
- `spam` — 引流
- `author` — 作者回复
- `noise` — 无意义评论

---

## 错误处理

| 错误 | 处理 |
|------|------|
| 笔记 404 | `markHarvestFailed("note_not_found")` → 连续 3 次 → 标记删除 |
| 笔记已删除 | `notifyNoteDeleted()` → `markHarvestFailed("note_deleted")` |
| 需要登录 | `markHarvestFailed("login_required")` → 通知用户重新登录 |
| 限流 | 暂停采集，等待恢复 |

---

## 统计输出

每次采集完成后输出：

```
📊 采集统计:
   - 处理笔记: X 个
   - 采集评论: X 条
   - 有效线索: X 条
   - 过滤数量: X 条（黑名单/引流/超时）
   - 成功率: X%
```

---

## 使用示例

```
用户: 采集小红书评论

Cipher: 开始采集...
        读取配置 → 获取 5 个任务 → 逐个采集 → 上报结果
        
        📊 采集统计:
           - 处理笔记: 5 个
           - 采集评论: 23 条
           - 有效线索: 8 条
```
