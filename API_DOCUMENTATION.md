# 小红书审核系统 API 接口文档

**Base URL**: `https://www.wubug.cc/xiaohongshu/api`

---

## 目录

1. [认证方式](#认证方式)
2. [图片上传接口](#图片上传接口)
3. [任务提交接口](#任务提交接口)
4. [数据接收接口](#数据接收接口)
5. [辅助接口](#辅助接口)

---

## 认证方式

### JWT Token 认证

需要在请求头中携带 Token：

```
Authorization: Bearer <your_jwt_token>
```

**获取 Token**: 通过登录接口获取（见用户认证相关文档）

---

## 图片上传接口

### 1. 单张图片上传

**接口**: `POST /upload/image`

**请求头**:
```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 图片文件，支持 jpg/png/gif/webp |

**请求示例 (FormData)**:
```javascript
const formData = new FormData();
formData.append('file', imageFile);

fetch('https://www.wubug.cc/xiaohongshu/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
})
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "url": "https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/1234567890-image.jpg",
    "name": "uploads/1234567890-image.jpg"
  }
}
```

---

### 2. 批量图片上传（最多9张）

**接口**: `POST /upload/images`

**请求头**:
```
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| files | File[] | 是 | 图片文件数组，最多9张 |

**请求示例**:
```javascript
const formData = new FormData();
// 添加多个文件
files.forEach(file => {
  formData.append('files', file);
});

fetch('https://www.wubug.cc/xiaohongshu/api/upload/images', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
})
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "urls": [
      "https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/xxx-1.jpg",
      "https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/xxx-2.jpg"
    ],
    "count": 2,
    "totalRequested": 2
  }
}
```

**错误响应**（部分失败）:
```json
{
  "success": true,
  "data": {
    "urls": [...],
    "count": 1,
    "totalRequested": 2,
    "errors": [
      {
        "index": 1,
        "filename": "error.jpg",
        "error": "文件格式不正确"
      }
    ],
    "failedCount": 1,
    "message": "上传完成：成功1张，失败1张"
  }
}
```

---

## 任务提交接口

### 1. 单图任务提交（旧版）

**接口**: `POST /client/task/submit`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | String | 是 | 设备ID |
| imageType | String | 是 | 任务类型：note/comment/customer_resource |
| image_url | String | 是 | 图片URL（先调用上传接口获取） |
| imageMd5 | String | 是 | 图片MD5值 |

**请求示例**:
```json
{
  "deviceId": "507f1f77bcf86cd799439011",
  "imageType": "note",
  "image_url": "https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/xxx.jpg",
  "imageMd5": "5d41402abc4b2a76b9719d911017c592"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "任务提交成功，等待审核",
  "review": {
    "id": "507f1f77bcf86cd799439012",
    "imageType": "note",
    "status": "pending",
    "createdAt": "2024-01-11T12:00:00.000Z"
  }
}
```

---

### 2. 批量任务提交（新版，推荐）

**接口**: `POST /client/tasks/batch-submit`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | String | 否 | 设备ID（可选，批量提交可用昵称） |
| imageType | String | 是 | 任务类型 |
| imageUrls | String[] | 条件 | 图片URL数组（客资必填，笔记/评论可选） |
| imageMd5s | String[] | 条件 | 图片MD5数组（与urls对应） |
| noteUrl | String | 条件 | 笔记链接（笔记/评论类型必填） |
| noteAuthor | String/String[] | 条件 | 作者昵称（笔记/评论类型必填） |
| noteTitle | String | 条件 | 笔记标题（笔记类型必填） |
| commentContent | String | 条件 | 评论内容（评论类型必填） |
| customerPhone | String | 条件 | 客户电话（客资类型必填） |
| customerWechat | String | 条件 | 客户微信（客资类型必填） |

**任务类型说明**:

| imageType | 必填字段 | 可选字段 | 说明 |
|-----------|---------|---------|------|
| note | noteUrl, noteAuthor, noteTitle | imageUrls, imageMd5s | 笔记审核 |
| comment | noteUrl, noteAuthor, commentContent | imageUrls, imageMd5s | 评论审核 |
| customer_resource | customerPhone 或 customerWechat | imageUrls, imageMd5s | 客资审核 |

**笔记类型请求示例**:
```json
{
  "imageType": "note",
  "noteUrl": "https://www.xiaohongshu.com/explore/1234567890",
  "noteAuthor": "小红书用户昵称",
  "noteTitle": "笔记标题",
  "imageUrls": ["https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/xxx.jpg"],
  "imageMd5s": ["5d41402abc4b2a76b9719d911017c592"]
}
```

**评论类型请求示例**:
```json
{
  "imageType": "comment",
  "noteUrl": "https://www.xiaohongshu.com/explore/1234567890",
  "noteAuthor": "作者昵称",
  "commentContent": "这是一条评论内容",
  "imageUrls": ["https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/screenshot.jpg"],
  "imageMd5s": ["abc123..."]
}
```

**客资类型请求示例**:
```json
{
  "imageType": "customer_resource",
  "customerPhone": "13800138000",
  "customerWechat": "wechat_id_123",
  "imageUrls": ["https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/chat.jpg"],
  "imageMd5s": ["def456..."]
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "成功提交1个任务",
  "reviews": [
    {
      "id": "507f1f77bcf86cd799439012",
      "imageType": "note",
      "status": "pending"
    }
  ]
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "参数不完整：缺少任务类型"
}
```

---

## 数据接收接口

### 1. 获取待审核任务

**接口**: `GET /client/pending-tasks`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | String | 是 | 客户端唯一标识 |
| limit | Number | 否 | 每次拉取数量，默认10 |
| imageType | String | 否 | 任务类型过滤，默认comment |

**请求示例**:
```
GET /xiaohongshu/api/client/pending-tasks?clientId=my-client-001&limit=5&imageType=comment
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "507f1f77bcf86cd799439012",
        "id": "507f1f77bcf86cd799439012",
        "userId": "507f1f77bcf86cd799439011",
        "imageType": "comment",
        "status": "processing",
        "noteUrl": "https://www.xiaohongshu.com/explore/1234567890",
        "userNoteInfo": {
          "author": "作者昵称",
          "comment": "评论内容"
        },
        "createdAt": "2024-01-11T12:00:00.000Z"
      }
    ],
    "count": 1,
    "clientId": "my-client-001",
    "lockTimeoutMinutes": 10,
    "heartbeatIntervalMinutes": 5
  }
}
```

---

### 2. 上报验证结果

**接口**: `POST /client/verify-result`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | String | 是 | 任务ID |
| exists | Boolean | 是 | 评论是否存在（true=找到，false=未找到） |
| confidence | Number | 否 | 匹配置信度 0-1 |
| foundComments | Array | 否 | 找到的评论列表 |
| pageComments | Array | 否 | 页面所有评论 |
| commentCount | Number | 否 | 评论总数 |
| verifiedAt | String | 否 | 验证时间（ISO8601） |
| clientId | String | 否 | 客户端ID |

**请求示例**:
```json
{
  "taskId": "507f1f77bcf86cd799439012",
  "exists": true,
  "confidence": 0.95,
  "foundComments": [
    {
      "content": "匹配的评论内容",
      "author": "作者昵称"
    }
  ],
  "pageComments": [...],
  "commentCount": 15,
  "verifiedAt": "2024-01-11T12:05:00.000Z",
  "clientId": "my-client-001"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "评论验证通过，任务已完成",
  "data": {
    "taskId": "507f1f77bcf86cd799439012",
    "result": "passed",
    "status": "completed",
    "pointsAwarded": true,
    "commissionAwarded": true,
    "awardDetails": {
      "userPoints": 30,
      "commission1": 3,
      "commission2": 1
    }
  }
}
```

---

### 3. 心跳接口（延长任务锁定）

**接口**: `POST /client/heartbeat`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | String | 是 | 客户端ID |
| taskIds | String[] | 是 | 任务ID数组 |

**请求示例**:
```json
{
  "clientId": "my-client-001",
  "taskIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "clientId": "my-client-001",
    "lockTimeoutMinutes": 30,
    "timestamp": "2024-01-11T12:10:00.000Z"
  }
}
```

---

## 辅助接口

### 1. 获取任务配置

**接口**: `GET /client/task-configs`

**说明**: 获取当前激活的任务类型和价格配置

**响应示例**:
```json
{
  "success": true,
  "configs": [
    {
      "_id": "507f1f77bcf86cd799439001",
      "type_key": "note",
      "name": "笔记审核",
      "price": 50,
      "commission_1": 5,
      "commission_2": 2,
      "daily_reward_points": 10,
      "continuous_check_days": 7
    },
    {
      "_id": "507f1f77bcf86cd799439002",
      "type_key": "comment",
      "name": "评论审核",
      "price": 30,
      "commission_1": 3,
      "commission_2": 1,
      "daily_reward_points": 5,
      "continuous_check_days": 3
    }
  ]
}
```

---

### 2. 获取用户任务列表

**接口**: `GET /client/user/tasks`

**请求头**: `Authorization: Bearer <token>`

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认10 |
| imageType | String | 否 | 任务类型过滤 |

**响应示例**:
```json
{
  "success": true,
  "reviews": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

---

### 3. 获取用户设备列表

**接口**: `GET /client/device/my-list`

**请求头**: `Authorization: Bearer <token>`

**响应示例**:
```json
{
  "success": true,
  "devices": [
    {
      "_id": "507f1f77bcf86cd799439020",
      "accountName": "xiaohongshu_user_001",
      "status": "online",
      "influence": ["new"],
      "nicknameLimitStatus": {
        "canUse": true,
        "reason": "可正常使用"
      }
    }
  ]
}
```

---

## 状态码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（Token无效或过期） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 409 | 冲突（任务已被处理） |
| 500 | 服务器内部错误 |

---

## 错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息（开发调试用）"
}
```

---

## 常见错误

### 1. 图片上传失败

```
"OSS配置缺失，无法上传图片"
```
**原因**: 服务器OSS配置未设置

### 2. 任务提交失败

```
"该图片已被使用，请勿重复提交"
```
**原因**: 图片MD5已存在于审核通过的记录中

### 3. 笔记限制

```
"该昵称有一篇笔记正在审核中，请等待审核完成后再提交新笔记"
```
**原因**: 7天内同一昵称只能提交一篇笔记

---

## 完整工作流程示例

### 笔记提交流程

```javascript
// 1. 上传图片
const formData = new FormData();
formData.append('file', imageFile);
const uploadRes = await fetch('/xiaohongshu/api/upload/images', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },
  body: formData
});
const { data: { urls } } = await uploadRes.json();

// 2. 计算MD5
const imageMd5 = await calculateMD5(imageFile);

// 3. 提交任务
const submitRes = await fetch('/xiaohongshu/api/client/tasks/batch-submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageType: 'note',
    noteUrl: 'https://www.xiaohongshu.com/explore/1234567890',
    noteAuthor: '作者昵称',
    noteTitle: '笔记标题',
    imageUrls: urls,
    imageMd5s: [imageMd5]
  })
});
```

---

**更新时间**: 2026-01-11
**版本**: v1.0
