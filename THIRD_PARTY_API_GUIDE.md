# 小红书审核系统 - 第三方集成 API 文档

**Base URL**: `https://www.wubug.cc/xiaohongshu/api`

**版本**: v1.0
**更新时间**: 2026-01-11

---

## 目录

1. [系统概述](#系统概述)
2. [认证方式](#认证方式)
3. [用户认证接口](#用户认证接口)
4. [图片上传接口](#图片上传接口)
5. [任务提交接口](#任务提交接口)
6. [任务接收接口](#任务接收接口)
7. [设备管理接口](#设备管理接口)
8. [完整工作流程](#完整工作流程)
9. [错误码说明](#错误码说明)
10. [SDK 示例代码](#sdk-示例代码)

---

## 系统概述

小红书审核系统是一个内容审核平台，支持以下功能：

- **笔记审核**: 验证小红书笔记的真实性
- **评论审核**: 验证笔记评论是否存在
- **客资审核**: 审核客户资源截图

### 系统架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  第三方应用  │ ──→ │   API服务   │ ──→ │  MongoDB    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   ▼
       │            ┌─────────────┐
       │            │ AI审核服务  │
       │            └─────────────┘
       │
       ▼
┌─────────────┐
│ 本地审核端  │ (可选)
└─────────────┘
```

---

## 认证方式

### JWT Token 认证

所有需要认证的接口都在请求头中携带 Token：

```http
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

### Token 有效期

- **有效期**: 7天
- **过期处理**: 返回 401 状态码，需要重新登录获取新 Token

---

## 用户认证接口

### 1. 微信小程序登录

**接口**: `POST /auth/wechat-login`

**说明**: 微信小程序用户登录，支持手机号绑定

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | String | 是 | wx.login 获取的登录凭证 |
| encryptedData | String | 否 | 加密的手机号数据 |
| iv | String | 否 | 加密算法的初始向量 |
| nickname | String | 否 | 用户昵称 |
| avatar | String | 否 | 用户头像 |
| mentorPhone | String | 否 | 带教老师手机号（绑定关系） |
| hrPhone | String | 否 | HR手机号（绑定关系） |
| parentPhone | String | 否 | 父级用户手机号 |

**请求示例**:

```javascript
// 微信小程序端
wx.login({
  success: async (res) => {
    const response = await fetch('https://www.wubug.cc/xiaohongshu/api/auth/wechat-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: res.code,
        encryptedData: phoneData.encryptedData,
        iv: phoneData.iv,
        nickname: '用户昵称',
        avatar: 'https://example.com/avatar.jpg',
        mentorPhone: '13800138000'  // 可选
      })
    });
    const data = await response.json();
    // 保存 token
    wx.setStorageSync('token', data.token);
  }
});
```

**响应示例**:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "wx_user_12345",
    "nickname": "用户昵称",
    "phone": "13800138000",
    "role": "part_time",
    "points": 0,
    "wallet": 0
  }
}
```

---

### 2. 管理员登录

**接口**: `POST /auth/admin-login`

**说明**: 管理员、带教老师、财务等内部人员登录

**限流**: 15分钟内最多5次尝试

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | String | 是 | 用户名 |
| password | String | 是 | 密码 |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/auth/admin-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'password123'
  })
});
```

**响应示例**:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "admin",
    "role": "boss"
  }
}
```

---

### 3. 手机号快速登录

**接口**: `POST /auth/phone-login`

**说明**: 通过手机号快速登录（自动创建或查找 part_time 用户）

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | String | 是 | 手机号 |
| nickname | String | 否 | 用户昵称（新用户时使用） |
| avatar | String | 否 | 用户头像 |
| mentorPhone | String | 否 | 带教老师手机号 |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/auth/phone-login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '13800138000',
    nickname: '新用户',
    mentorPhone: '13900139000'
  })
});
```

**响应示例**:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "isNewUser": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "user_13800138000",
    "phone": "13800138000",
    "role": "part_time",
    "mentor_id": "507f1f77bcf86cd799439012"
  }
}
```

---

### 4. 用户注册

**接口**: `POST /auth/user-register`

**说明**: 用户名密码注册方式

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | String | 是 | 用户名（唯一） |
| password | String | 是 | 密码（6位以上） |
| phone | String | 是 | 手机号（唯一） |
| nickname | String | 否 | 用户昵称 |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/auth/user-register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'newuser',
    password: 'password123',
    phone: '13800138000',
    nickname: '昵称'
  })
});
```

**响应示例**:

```json
{
  "success": true,
  "message": "注册成功",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "username": "newuser",
    "role": "part_time"
  }
}
```

---

## 图片上传接口

### 1. 单张图片上传

**接口**: `POST /upload/image`

**认证**: 需要 JWT Token

**请求头**:

```http
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 图片文件，支持 jpg/png/gif/webp |
|      |      |      | 最大10MB |

**请求示例 (JavaScript)**:

```javascript
const formData = new FormData();
formData.append('file', imageFile);

const response = await fetch('https://www.wubug.cc/xiaohongshu/api/upload/image', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});

const data = await response.json();
// data.data.url → 图片URL
```

**请求示例 (cURL)**:

```bash
curl -X POST https://www.wubug.cc/xiaohongshu/api/upload/image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"
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

**错误响应**:

```json
{
  "success": false,
  "message": "文件格式不正确，仅支持 jpg/png/gif/webp"
}
```

---

### 2. 批量图片上传

**接口**: `POST /upload/images`

**认证**: 需要 JWT Token

**说明**: 一次最多上传9张图片，支持并发上传

**请求头**:

```http
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| files | File[] | 是 | 图片文件数组，最多9张 |
|       |        |      | 单个最大10MB |

**请求示例 (JavaScript)**:

```javascript
const formData = new FormData();
files.forEach(file => {
  formData.append('files', file);
});

const response = await fetch('https://www.wubug.cc/xiaohongshu/api/upload/images', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});

const data = await response.json();
// data.data.urls → 图片URL数组
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

**部分失败响应**:

```json
{
  "success": true,
  "data": {
    "urls": ["https://.../xxx-1.jpg"],
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

**认证**: 需要 JWT Token

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | String | 是 | 设备ID（ObjectId） |
| imageType | String | 是 | 任务类型：note/comment/customer_resource |
| image_url | String | 是 | 图片URL |
| imageMd5 | String | 是 | 图片MD5值（用于去重） |

**任务类型说明**:

| imageType | 名称 | 说明 |
|-----------|------|------|
| note | 笔记审核 | 审核小红书笔记 |
| comment | 评论审核 | 审核笔记评论 |
| customer_resource | 客资审核 | 审核客户聊天截图 |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/client/task/submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    deviceId: '507f1f77bcf86cd799439011',
    imageType: 'note',
    image_url: 'https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/xxx.jpg',
    imageMd5: '5d41402abc4b2a76b9719d911017c592'
  })
});
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

### 2. 批量任务提交（新版，推荐）⭐

**接口**: `POST /client/tasks/batch-submit`

**认证**: 需要 JWT Token

**说明**: 支持多种任务类型，参数更灵活

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deviceId | String | 否 | 设备ID（可用昵称代替） |
| imageType | String | 是 | 任务类型 |
| imageUrls | String[] | 条件 | 图片URL数组 |
| imageMd5s | String[] | 条件 | 图片MD5数组（与urls对应） |
| noteUrl | String | 条件 | 笔记链接 |
| noteAuthor | String/String[] | 条件 | 作者昵称 |
| noteTitle | String | 条件 | 笔记标题 |
| commentContent | String | 条件 | 评论内容 |
| customerPhone | String | 条件 | 客户电话 |
| customerWechat | String | 条件 | 客户微信 |

**参数条件矩阵**:

| imageType | 必填字段 | 可选字段 |
|-----------|---------|---------|
| note | noteUrl, noteAuthor, noteTitle | imageUrls, imageMd5s |
| comment | noteUrl, noteAuthor, commentContent | imageUrls, imageMd5s |
| customer_resource | customerPhone 或 customerWechat | imageUrls, imageMd5s |

#### 笔记类型请求示例

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/client/tasks/batch-submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageType: 'note',
    noteUrl: 'https://www.xiaohongshu.com/explore/1234567890',
    noteAuthor: '小红书用户昵称',
    noteTitle: '笔记标题',
    imageUrls: ['https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/uploads/xxx.jpg'],
    imageMd5s: ['5d41402abc4b2a76b9719d911017c592']
  })
});
```

#### 评论类型请求示例

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/client/tasks/batch-submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageType: 'comment',
    noteUrl: 'https://www.xiaohongshu.com/explore/1234567890',
    noteAuthor: '作者昵称',
    commentContent: '这是一条评论内容',
    imageUrls: ['https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/screenshot.jpg'],
    imageMd5s: ['abc123...']
  })
});
```

#### 客资类型请求示例

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/client/tasks/batch-submit', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    imageType: 'customer_resource',
    customerPhone: '13800138000',
    customerWechat: 'wechat_id_123',
    imageUrls: ['https://zerobug-img.oss-cn-shenzhen.aliyuncs.com/chat.jpg'],
    imageMd5s: ['def456...']
  })
});
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

---

## 任务接收接口

这部分接口用于本地审核客户端获取待审核任务并上报结果。

### 1. 获取待审核任务

**接口**: `GET /client/pending-tasks`

**认证**: 需要 JWT Token（可选，用于客户端标识）

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | String | 是 | 客户端唯一标识 |
| limit | Number | 否 | 每次拉取数量，默认10 |
| imageType | String | 否 | 任务类型过滤，默认comment |

**请求示例**:

```javascript
const response = await fetch(
  'https://www.wubug.cc/xiaohongshu/api/client/pending-tasks?clientId=my-client-001&limit=5&imageType=comment',
  {
    headers: {
      'Authorization': 'Bearer ' + token  // 可选
    }
  }
);
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

**认证**: 需要 JWT Token

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | String | 是 | 任务ID |
| exists | Boolean | 是 | 评论是否存在 |
| confidence | Number | 否 | 匹配置信度 0-1 |
| foundComments | Array | 否 | 找到的评论列表 |
| pageComments | Array | 否 | 页面所有评论 |
| commentCount | Number | 否 | 评论总数 |
| verifiedAt | String | 否 | 验证时间（ISO8601） |
| clientId | String | 否 | 客户端ID |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/client/verify-result', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    taskId: '507f1f77bcf86cd799439012',
    exists: true,
    confidence: 0.95,
    foundComments: [
      {
        content: '匹配的评论内容',
        author: '作者昵称'
      }
    ],
    pageComments: [],
    commentCount: 15,
    verifiedAt: new Date().toISOString(),
    clientId: 'my-client-001'
  })
});
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

### 3. 心跳接口

**接口**: `POST /client/heartbeat`

**说明**: 延长任务锁定时间，防止任务超时释放

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clientId | String | 是 | 客户端ID |
| taskIds | String[] | 是 | 任务ID数组 |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/client/heartbeat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    clientId: 'my-client-001',
    taskIds: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013']
  })
});
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

## 设备管理接口

### 1. 获取用户设备列表

**接口**: `GET /client/device/my-list`

**认证**: 需要 JWT Token

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

### 2. 验证设备账号

**接口**: `POST /devices/verify`

**认证**: 需要 JWT Token

**说明**: 验证小红书账号昵称和ID是否匹配

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accountUrl | String | 是 | 小红书个人主页链接 |
| accountId | String | 是 | 小红书账号ID |
| nickname | String | 是 | 账号昵称 |

**请求示例**:

```javascript
const response = await fetch('https://www.wubug.cc/xiaohongshu/api/devices/verify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    accountUrl: 'https://www.xiaohongshu.com/user/profile/5c8e3f2d0000000001003389',
    accountId: '5c8e3f2d0000000001003389',
    nickname: '用户昵称'
  })
});
```

**响应示例**:

```json
{
  "success": true,
  "verified": true,
  "confidence": 100,
  "message": "验证通过",
  "data": {
    "extractedNickname": "用户昵称",
    "extractedId": "5c8e3f2d0000000001003389"
  },
  "reasonText": "账号ID与昵称完全匹配"
}
```

**验证失败响应**:

```json
{
  "success": true,
  "verified": false,
  "confidence": 30,
  "message": "验证失败",
  "data": {
    "extractedNickname": "实际昵称",
    "extractedId": "5c8e3f2d0000000001003389"
  },
  "reasonText": "昵称不匹配 (发现昵称: 实际昵称, 预期昵称: 用户昵称)"
}
```

---

### 3. 创建设备

**接口**: `POST /devices`

**认证**: 需要 JWT Token

**权限**: mentor, manager, boss

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accountName | String | 是 | 设备账号名（唯一） |
| accountId | String | 否 | 账号ID |
| accountUrl | String | 否 | 账号链接 |
| phone | String | 否 | 关联手机号 |
| assignedUser | String | 否 | 分配用户ID |
| status | String | 否 | 设备状态（默认reviewing） |
| influence | Array | 否 | 影响力标签 |
| points | Number | 否 | 初始积分（mentor强制为0） |
| remark | String | 否 | 备注 |
| reviewImage | String | 否 | 审核图片URL |

**设备状态值**:

| status | 说明 |
|--------|------|
| reviewing | 审核中 |
| online | 在线 |
| offline | 离线 |
| locked | 锁定 |

**响应示例**:

```json
{
  "success": true,
  "message": "设备创建成功",
  "data": {
    "_id": "507f1f77bcf86cd799439020",
    "accountName": "xiaohongshu_user_001",
    "status": "reviewing",
    "reviewStatus": "ai_approved",
    "assignedUser": {
      "_id": "507f1f77bcf86cd799439011",
      "username": "user001"
    }
  }
}
```

---

## 完整工作流程

### 笔记审核流程

```
┌─────────────┐
│ 1. 用户登录  │
└──────┬──────┘
       ▼
┌─────────────┐
│ 2. 上传图片  │ → 获取图片URL
└──────┬──────┘
       ▼
┌─────────────┐
│ 3. 提交任务  │ → imageType: note
└──────┬──────┘
       ▼
┌─────────────┐
│ 4. AI审核   │ → 验证链接+分析内容
└──────┬──────┘
       ▼
   ┌──┴──┐
   │     │
   ▼     ▼
┌─────┐ ┌─────┐
│通过 │ │失败 │
└──┬──┘ └──┬──┘
   ▼       ▼
┌─────┐ ┌─────┐
│积分 │ │拒绝 │
└─────┘ └─────┘
```

**完整代码示例**:

```javascript
class XiaohongshuClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  // 1. 登录
  async login(phone) {
    const response = await fetch(`${this.baseUrl}/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await response.json();
    this.token = data.token;
    return data.user;
  }

  // 2. 上传图片
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData
    });
    const data = await response.json();
    return data.data.url;
  }

  // 3. 计算MD5
  async calculateMD5(file) {
    // 使用 SparkMD5 或 crypto 库
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('MD5', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 4. 提交笔记审核
  async submitNoteReview(noteUrl, noteAuthor, noteTitle, imageFile) {
    const imageUrl = await this.uploadImage(imageFile);
    const imageMd5 = await this.calculateMD5(imageFile);

    const response = await fetch(`${this.baseUrl}/client/tasks/batch-submit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageType: 'note',
        noteUrl,
        noteAuthor,
        noteTitle,
        imageUrls: [imageUrl],
        imageMd5s: [imageMd5]
      })
    });
    return await response.json();
  }
}

// 使用示例
const client = new XiaohongshuClient('https://www.wubug.cc/xiaohongshu/api');
const user = await client.login('13800138000');
const result = await client.submitNoteReview(
  'https://www.xiaohongshu.com/explore/1234567890',
  '作者昵称',
  '笔记标题',
  imageFile
);
console.log('提交结果:', result);
```

---

### 评论审核流程（本地客户端）

```
┌──────────────────┐
│ 1. 启动本地客户端  │
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. 获取待审核任务  │ → pending-tasks
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. 打开浏览器访问  │ → Puppeteer/Playwright
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. 提取页面评论   │ → DOM解析
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 5. 匹配验证      │ → 内容+作者匹配
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 6. 上报验证结果   │ → verify-result
└──────────────────┘
```

**本地客户端代码示例**:

```javascript
class LocalAuditClient {
  constructor(baseUrl, clientId) {
    this.baseUrl = baseUrl;
    this.clientId = clientId;
    this.tasks = new Map();
  }

  // 获取待审核任务
  async fetchTasks(limit = 10) {
    const response = await fetch(
      `${this.baseUrl}/client/pending-tasks?clientId=${this.clientId}&limit=${limit}&imageType=comment`
    );
    const data = await response.json();

    data.data.tasks.forEach(task => {
      this.tasks.set(task._id, task);
    });

    return data.data.tasks;
  }

  // 上报验证结果
  async reportResult(taskId, exists, comments = []) {
    const response = await fetch(`${this.baseUrl}/client/verify-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        exists,
        confidence: exists ? 1.0 : 0.0,
        foundComments: comments,
        commentCount: comments.length,
        verifiedAt: new Date().toISOString(),
        clientId: this.clientId
      })
    });
    return await response.json();
  }

  // 发送心跳
  async heartbeat(taskIds) {
    const response = await fetch(`${this.baseUrl}/client/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: this.clientId,
        taskIds
      })
    });
    return await response.json();
  }

  // 主循环
  async start() {
    console.log(`客户端 ${this.clientId} 启动...`);

    while (true) {
      try {
        const tasks = await this.fetchTasks(5);
        console.log(`获取到 ${tasks.length} 个任务`);

        for (const task of tasks) {
          // TODO: 使用浏览器自动化验证评论
          // const result = await this.verifyComment(task);
          // await this.reportResult(task._id, result.exists, result.comments);

          // 发送心跳延长锁定
          await this.heartbeat([task._id]);
        }

      } catch (error) {
        console.error('处理任务失败:', error);
      }

      // 等待5秒后再次拉取
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// 启动客户端
const client = new LocalAuditClient('https://www.wubug.cc/xiaohongshu/api', 'client-001');
client.start();
```

---

## 错误码说明

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（Token无效或过期） |
| 403 | 禁止访问（权限不足） |
| 404 | 资源不存在 |
| 409 | 冲突（如重复提交） |
| 500 | 服务器内部错误 |
| 502 | 网关错误（服务不可用） |

### 业务错误码

| 错误信息 | 说明 | 解决方案 |
|---------|------|----------|
| OSS配置缺失，无法上传图片 | OSS未配置 | 联系管理员配置 |
| 该图片已被使用，请勿重复提交 | 图片MD5重复 | 更换图片 |
| 该昵称有一篇笔记正在审核中 | 昵称限制 | 等待审核完成 |
| 设备账号名已存在 | 设备重复 | 更换设备名 |
| Cookie已过期，请更新 | Cookie失效 | 更新系统Cookie |
| 需要登录页面 - Cookie可能已过期 | Cookie失效 | 更新系统Cookie |

---

## SDK 示例代码

### Python SDK

```python
import requests
import hashlib
from typing import List, Dict, Optional

class XiaohongshuClient:
    def __init__(self, base_url: str, token: str = None):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()

    def login(self, phone: str, nickname: str = None) -> Dict:
        """手机号登录"""
        response = self.session.post(
            f'{self.base_url}/auth/phone-login',
            json={'phone': phone, 'nickname': nickname}
        )
        data = response.json()
        if data.get('success'):
            self.token = data['token']
            self.session.headers.update({
                'Authorization': f'Bearer {self.token}'
            })
        return data

    def upload_image(self, file_path: str) -> str:
        """上传单张图片"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = self.session.post(
                f'{self.base_url}/upload/image',
                files=files
            )
        data = response.json()
        return data['data']['url']

    def calculate_md5(self, file_path: str) -> str:
        """计算文件MD5"""
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()

    def submit_note(
        self,
        note_url: str,
        note_author: str,
        note_title: str,
        image_path: str
    ) -> Dict:
        """提交笔记审核"""
        image_url = self.upload_image(image_path)
        image_md5 = self.calculate_md5(image_path)

        response = self.session.post(
            f'{self.base_url}/client/tasks/batch-submit',
            json={
                'imageType': 'note',
                'noteUrl': note_url,
                'noteAuthor': note_author,
                'noteTitle': note_title,
                'imageUrls': [image_url],
                'imageMd5s': [image_md5]
            }
        )
        return response.json()

    def submit_comment(
        self,
        note_url: str,
        note_author: str,
        comment_content: str,
        image_path: str
    ) -> Dict:
        """提交评论审核"""
        image_url = self.upload_image(image_path)
        image_md5 = self.calculate_md5(image_path)

        response = self.session.post(
            f'{self.base_url}/client/tasks/batch-submit',
            json={
                'imageType': 'comment',
                'noteUrl': note_url,
                'noteAuthor': note_author,
                'commentContent': comment_content,
                'imageUrls': [image_url],
                'imageMd5s': [image_md5]
            }
        )
        return response.json()


# 使用示例
if __name__ == '__main__':
    client = XiaohongshuClient('https://www.wubug.cc/xiaohongshu/api')

    # 登录
    user = client.login('13800138000', '测试用户')
    print(f'登录成功: {user["user"]["username"]}')

    # 提交笔记审核
    result = client.submit_note(
        note_url='https://www.xiaohongshu.com/explore/1234567890',
        note_author='作者昵称',
        note_title='笔记标题',
        image_path='note_screenshot.jpg'
    )
    print(f'提交结果: {result}')
```

---

### PHP SDK

```php
<?php

class XiaohongshuClient {
    private $baseUrl;
    private $token = null;
    private $ch = null;

    public function __construct($baseUrl) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->ch = curl_init();
        curl_setopt($this->ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($this->ch, CURLOPT_HEADER, false);
    }

    public function __destruct() {
        if ($this->ch) {
            curl_close($this->ch);
        }
    }

    private function request($method, $path, $data = null) {
        $url = $this->baseUrl . $path;

        $headers = ['Content-Type: application/json'];
        if ($this->token) {
            $headers[] = 'Authorization: Bearer ' . $this->token;
        }

        curl_setopt($this->ch, CURLOPT_URL, $url);
        curl_setopt($this->ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($this->ch, CURLOPT_HTTPHEADER, $headers);

        if ($data !== null) {
            curl_setopt($this->ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($this->ch);
        return json_decode($response, true);
    }

    public function login($phone, $nickname = null) {
        $result = $this->request('POST', '/auth/phone-login', [
            'phone' => $phone,
            'nickname' => $nickname
        ]);

        if ($result['success']) {
            $this->token = $result['token'];
        }

        return $result;
    }

    public function uploadImage($filePath) {
        $url = $this->baseUrl . '/upload/image';

        $headers = ['Content-Type: multipart/form-data'];
        if ($this->token) {
            $headers[] = 'Authorization: Bearer ' . $this->token;
        }

        $post = [
            'file' => new CURLFile($filePath)
        ];

        curl_setopt($this->ch, CURLOPT_URL, $url);
        curl_setopt($this->ch, CURLOPT_POST, true);
        curl_setopt($this->ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($this->ch, CURLOPT_POSTFIELDS, $post);
        curl_setopt($this->ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($this->ch);
        $result = json_decode($response, true);

        return $result['data']['url'];
    }

    public function submitNote($noteUrl, $noteAuthor, $noteTitle, $imagePath) {
        $imageUrl = $this->uploadImage($imagePath);
        $imageMd5 = md5_file($imagePath);

        return $this->request('POST', '/client/tasks/batch-submit', [
            'imageType' => 'note',
            'noteUrl' => $noteUrl,
            'noteAuthor' => $noteAuthor,
            'noteTitle' => $noteTitle,
            'imageUrls' => [$imageUrl],
            'imageMd5s' => [$imageMd5]
        ]);
    }

    public function submitComment($noteUrl, $noteAuthor, $commentContent, $imagePath) {
        $imageUrl = $this->uploadImage($imagePath);
        $imageMd5 = md5_file($imagePath);

        return $this->request('POST', '/client/tasks/batch-submit', [
            'imageType' => 'comment',
            'noteUrl' => $noteUrl,
            'noteAuthor' => $noteAuthor,
            'commentContent' => $commentContent,
            'imageUrls' => [$imageUrl],
            'imageMd5s' => [$imageMd5]
        ]);
    }
}

// 使用示例
$client = new XiaohongshuClient('https://www.wubug.cc/xiaohongshu/api');

// 登录
$user = $client->login('13800138000', '测试用户');
echo "登录成功: " . $user['user']['username'] . "\n";

// 提交笔记审核
$result = $client->submitNote(
    'https://www.xiaohongshu.com/explore/1234567890',
    '作者昵称',
    '笔记标题',
    'note_screenshot.jpg'
);
print_r($result);
?>
```

---

### Java SDK

```java
import okhttp3.*;
import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.File;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.TimeUnit;

public class XiaohongshuClient {
    private final String baseUrl;
    private String token;
    private final OkHttpClient httpClient;
    private final Gson gson;

    public XiaohongshuClient(String baseUrl) {
        this.baseUrl = baseUrl.replaceAll("/$", "");
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build();
        this.gson = new Gson();
    }

    // 登录
    public JsonObject login(String phone, String nickname) throws IOException {
        JsonObject body = new JsonObject();
        body.addProperty("phone", phone);
        if (nickname != null) {
            body.addProperty("nickname", nickname);
        }

        Request request = new Request.Builder()
            .url(baseUrl + "/auth/phone-login")
            .post(RequestBody.create(body.toString(), MediaType.parse("application/json")))
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            JsonObject result = gson.fromJson(response.body().string(), JsonObject.class);
            if (result.get("success").getAsBoolean()) {
                this.token = result.get("token").getAsString();
            }
            return result;
        }
    }

    // 上传图片
    public String uploadImage(String filePath) throws IOException {
        File file = new File(filePath);

        RequestBody requestBody = new MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", file.getName(),
                RequestBody.create(file, MediaType.parse("image/jpeg")))
            .build();

        Request request = new Request.Builder()
            .url(baseUrl + "/upload/image")
            .addHeader("Authorization", "Bearer " + token)
            .post(requestBody)
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            JsonObject result = gson.fromJson(response.body().string(), JsonObject.class);
            return result.getAsJsonObject("data").get("url").getAsString();
        }
    }

    // 计算MD5
    private String calculateMD5(String filePath) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] bytes = java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(filePath));
        byte[] digest = md.digest(bytes);

        StringBuilder sb = new StringBuilder();
        for (byte b : digest) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }

    // 提交笔记审核
    public JsonObject submitNote(String noteUrl, String noteAuthor, String noteTitle, String imagePath)
            throws Exception {
        String imageUrl = uploadImage(imagePath);
        String imageMd5 = calculateMD5(imagePath);

        JsonObject body = new JsonObject();
        body.addProperty("imageType", "note");
        body.addProperty("noteUrl", noteUrl);
        body.addProperty("noteAuthor", noteAuthor);
        body.addProperty("noteTitle", noteTitle);

        JsonObject urls = new JsonObject();
        urls.addProperty("0", imageUrl);
        body.add("imageUrls", urls);

        JsonObject md5s = new JsonObject();
        md5s.addProperty("0", imageMd5);
        body.add("imageMd5s", md5s);

        Request request = new Request.Builder()
            .url(baseUrl + "/client/tasks/batch-submit")
            .addHeader("Authorization", "Bearer " + token)
            .post(RequestBody.create(body.toString(), MediaType.parse("application/json")))
            .build();

        try (Response response = httpClient.newCall(request).execute()) {
            return gson.fromJson(response.body().string(), JsonObject.class);
        }
    }

    public static void main(String[] args) {
        try {
            XiaohongshuClient client = new XiaohongshuClient("https://www.wubug.cc/xiaohongshu/api");

            // 登录
            JsonObject user = client.login("13800138000", "测试用户");
            System.out.println("登录成功: " + user.getAsJsonObject("user").get("username").getAsString());

            // 提交笔记审核
            JsonObject result = client.submitNote(
                "https://www.xiaohongshu.com/explore/1234567890",
                "作者昵称",
                "笔记标题",
                "note_screenshot.jpg"
            );
            System.out.println("提交结果: " + result);

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

---

## 附录

### A. 用户角色说明

| 角色 | 说明 | 权限 |
|------|------|------|
| part_time | 兼职用户 | 提交审核任务、查看自己的数据 |
| mentor | 带教老师 | 管理名下用户、审核设备 |
| manager | 经理 | 全部设备管理、审核 |
| boss | 管理员 | 全部权限 |
| finance | 财务 | 处理提现 |
| hr | HR | 管理用户 |
| lead | 线索 | 查看权限 |

### B. 任务状态说明

| status | 说明 |
|--------|------|
| pending | 待处理 |
| processing | 处理中（已分配给客户端） |
| completed | 已完成 |
| rejected | 已拒绝 |
| ai_approved | AI审核通过 |
| ai_auto_rejected | AI自动拒绝 |

### C. 积分规则

| 任务类型 | 积分奖励 |
|---------|----------|
| 笔记审核 | 根据配置（默认30） |
| 评论审核 | 根据配置（默认15） |
| 客资审核 | 根据配置 |

### D. 技术支持

- **文档更新**: 2026-01-11
- **API版本**: v1.0
- **联系邮箱**: support@example.com

---

**文档结束**

---

# 第三部分：新增功能（规划中）

## 10. 黑名单管理

### 10.1 获取关键词列表

**接口**: `GET /admin/keywords`

**认证**: 需要 JWT Token（boss, manager, mentor）

**说明**: 返回用于内容审核的关键词列表，第三方APP可使用这些关键词进行本地内容过滤。

**响应示例**:

```json
{
  "success": true,
  "keywords": {
    "维权": 10,
    "律师": 8,
    "起诉": 9,
    "官司": 7,
    "离婚": 6,
    "财产分割": 8,
    "债务纠纷": 7,
    "劳动仲裁": 7,
    "合同纠纷": 6,
    "侵权": 5
  },
  "updatedAt": "2026-01-13T10:00:00.000Z"
}
```

### 10.2 获取评论内容黑名单

**接口**: `GET /admin/blacklist/comments`

**认证**: 需要 JWT Token

**说明**: 返回禁止出现的评论内容列表。

**响应示例**:

```json
{
  "success": true,
  "blacklist": [
    {
      "id": "65a1b2c3d4e5f6789abc001",
      "content": "加微信xxx咨询",
      "type": "ad",
      "reason": "广告内容",
      "createdAt": "2026-01-13T10:00:00.000Z"
    }
  ],
  "total": 10
}
```

### 10.3 获取用户昵称黑名单

**接口**: `GET /admin/blacklist/nicknames`

**认证**: 需要 JWT Token

**说明**:
- **黑名单规则**: 页面内容中某昵称的评论出现多次（阈值可配置）则列入黑名单
- **累积计数**: 多个链接中同个昵称出现次数累加
- **系统用户**: 系统自有用户昵称自动加入黑名单
- **作用**: 黑名单用户不加入高价值用户列表

**响应示例**:

```json
{
  "success": true,
  "blacklist": [
    {
      "id": "65a1b2c3d4e5f6789abc002",
      "nickname": "律师咨询小王",
      "count": 15,
      "threshold": 10,
      "type": "system",
      "urls": [
        "https://www.xiaohongshu.com/explore/12345678",
        "https://www.xiaohongshu.com/explore/87654321"
      ],
      "lastSeen": "2026-01-13T10:00:00.000Z"
    }
  ],
  "total": 5,
  "threshold": 10
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| type | String | system: 系统自有用户, accumulated: 累积超限 |
| count | Number | 累计出现次数 |
| threshold | Number | 黑名单阈值 |
| urls | Array | 出现的链接列表 |

### 10.4 上报昵称出现次数

**接口**: `POST /admin/blacklist/nicknames/track`

**认证**: 需要 JWT Token

**说明**: 第三方APP在抓取页面评论时，上报各昵称出现次数。系统自动维护黑名单。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | String | 是 | 笔记链接 |
| nicknames | Array | 是 | 昵称统计数组 |

**请求示例**:

```json
{
  "url": "https://www.xiaohongshu.com/explore/12345678",
  "nicknames": [
    { "nickname": "用户A", "count": 3 },
    { "nickname": "用户B", "count": 1 },
    { "nickname": "律师咨询小王", "count": 5 }
  ]
}
```

**响应示例**:

```json
{
  "success": true,
  "updated": [
    {
      "nickname": "律师咨询小王",
      "totalCount": 15,
      "inBlacklist": true,
      "exceededThreshold": true
    }
  ]
}
```

---

## 11. 高价值用户功能

### 11.1 高价值用户定义

**高价值用户**: 在评论区中出现、具有以下特征之一的用户
- 有找律师意向
- 律师可以主动联系（有潜在法律服务需求）

**判断流程**:

```
┌─────────────────┐
│ 1. 获取页面评论  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ 2. 过滤黑名单    │ ← 系统 + 累积超限用户
└────────┬────────┘
         ▼
┌─────────────────┐
│ 3. AI分析内容   │ ← 判断意向
└────────┬────────┘
         ▼
┌─────────────────┐
│ 4. 记录高价值   │ ← 保存链接位置
└─────────────────┘
```

### 11.2 上报页面评论数据

**接口**: `POST /admin/high-value/analyze`

**认证**: 需要 JWT Token

**说明**: 第三方APP抓取页面评论后上报，系统分析并识别高价值用户。

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | String | 是 | 笔记链接 |
| noteId | String | 是 | 笔记ID |
| comments | Array | 是 | 评论列表 |

**请求示例**:

```json
{
  "url": "https://www.xiaohongshu.com/explore/12345678",
  "noteId": "12345678",
  "comments": [
    {
      "nickname": "求助用户A",
      "content": "遇到离婚问题，想咨询律师，怎么收费？",
      "commentId": "comment_001",
      "timestamp": "2026-01-13T10:00:00.000Z",
      "likes": 5
    },
    {
      "nickname": "用户B",
      "content": "有人推荐靠谱的律师吗？债务纠纷",
      "commentId": "comment_002",
      "timestamp": "2026-01-13T10:05:00.000Z",
      "likes": 2
    }
  ]
}
```

**响应示例**:

```json
{
  "success": true,
  "analyzedAt": "2026-01-13T10:10:00.000Z",
  "highValueUsers": [
    {
      "nickname": "求助用户A",
      "commentId": "comment_001",
      "reason": "用户明确表达找律师意向，涉及离婚法律咨询",
      "confidence": 0.95,
      "category": "family_law",
      "commentSnippet": "遇到离婚问题，想咨询律师...",
      "jumpUrl": "https://www.xiaohongshu.com/explore/12345678?comment=comment_001"
    },
    {
      "nickname": "用户B",
      "commentId": "comment_002",
      "reason": "用户寻求律师推荐，涉及债务纠纷",
      "confidence": 0.88,
      "category": "debt",
      "commentSnippet": "有人推荐靠谱的律师吗？债务纠纷",
      "jumpUrl": "https://www.xiaohongshu.com/explore/12345678?comment=comment_002"
    }
  ],
  "blacklistFiltered": 2,
  "totalAnalyzed": 4
}
```

**类别说明**:

| category | 名称 | 说明 |
|---------|------|------|
| family_law | 婚姻家庭 | 离婚、财产分割、抚养权等 |
| debt | 债务纠纷 | 欠款、借贷、债务追讨等 |
| labor | 劳动纠纷 | 工资、工伤、辞退等 |
| contract | 合同纠纷 | 违约、合同争议等 |
| injury | 侵权赔偿 | 人身损害、财产损害等 |
| criminal | 刑事案件 | 刑事辩护等 |
| other | 其他 | 其他法律需求 |

### 11.3 获取高价值用户列表

**接口**: `GET /admin/high-value/users`

**认证**: 需要 JWT Token（boss, manager, lead）

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | Number | 否 | 页码，默认1 |
| limit | Number | 否 | 每页数量，默认20 |
| category | String | 否 | 筛选类别 |
| minConfidence | Number | 否 | 最低置信度，默认0.7 |
| status | String | 否 | 联系状态筛选 |

**响应示例**:

```json
{
  "success": true,
  "users": [
    {
      "id": "65a1b2c3d4e5f6789hvu001",
      "nickname": "求助用户A",
      "category": "family_law",
      "categoryText": "婚姻家庭",
      "confidence": 0.95,
      "reason": "用户明确表达找律师意向，涉及离婚法律咨询",
      "commentSnippet": "遇到离婚问题，想咨询律师，怎么收费？",
      "sourceUrl": "https://www.xiaohongshu.com/explore/12345678",
      "jumpUrl": "https://www.xiaohongshu.com/explore/12345678?comment=comment_001",
      "collectedAt": "2026-01-13T10:10:00.000Z",
      "contacted": false,
      "contactStatus": "pending",
      "contactStatusText": "待联系"
    }
  ],
  "pagination": {
    "current": 1,
    "pageSize": 20,
    "total": 150
  },
  "statistics": {
    "total": 150,
    "byCategory": {
      "family_law": 45,
      "debt": 38,
      "labor": 32,
      "contract": 25,
      "injury": 8,
      "criminal": 2
    },
    "contactRate": 0.25,
    "conversionRate": 0.12
  }
}
```

### 11.4 更新联系状态

**接口**: `PUT /admin/high-value/users/{userId}/contact`

**认证**: 需要 JWT Token（boss, manager, lead）

**请求参数**:

```json
{
  "status": "contacted",
  "notes": "已添加微信，等待进一步沟通"
}
```

**状态说明**:

| status | 名称 | 说明 |
|--------|------|------|
| pending | 待联系 | 新收集的高价值用户 |
| contacted | 已联系 | 已建立联系 |
| converted | 已转化 | 已成交 |
| invalid | 无效 | 无效线索 |

**响应示例**:

```json
{
  "success": true,
  "message": "状态更新成功",
  "user": {
    "id": "65a1b2c3d4e5f6789hvu001",
    "contactStatus": "contacted",
    "contactNotes": "已添加微信，等待进一步沟通",
    "contactedAt": "2026-01-13T15:00:00.000Z"
  }
}
```

### 11.5 分配用户

**接口**: `PUT /admin/high-value/users/{userId}/assign`

**认证**: 需要 JWT Token（boss, manager）

**请求参数**:

```json
{
  "assignedTo": "507f1f77bcf86cd799439011"
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "分配成功",
  "user": {
    "id": "65a1b2c3d4e5f6789hvu001",
    "assignedTo": {
      "id": "507f1f77bcf86cd799439011",
      "username": "lawyer001",
      "name": "张律师"
    }
  }
}
```

---

## 12. 数据模型

### 12.1 昵称黑名单 (NicknameBlacklist)

```javascript
{
  _id: ObjectId,
  nickname: String,           // 昵称
  count: Number,              // 累计出现次数
  threshold: Number,          // 黑名单阈值（默认10）
  type: String,               // system(自有用户) / accumulated(累积超限)
  urls: [{
    url: String,              // 出现的链接
    count: Number,            // 在该链接出现次数
    firstSeen: Date,          // 首次发现时间
    lastSeen: Date            // 最后发现时间
  }],
  lastSeen: Date,             // 最后出现时间
  createdAt: Date,
  updatedAt: Date
}
```

### 12.2 高价值用户 (HighValueUser)

```javascript
{
  _id: ObjectId,
  nickname: String,               // 用户昵称
  commentId: String,              // 评论ID
  commentContent: String,         // 评论内容
  commentSnippet: String,         // 评论摘要（前50字）
  sourceUrl: String,              // 笔记链接
  jumpUrl: String,                // 可跳转的评论链接
  category: String,               // 类别
  confidence: Number,             // AI判断置信度
  reason: String,                 // 判断理由
  noteId: String,                 // 笔记ID
  collectedAt: Date,              // 收集时间
  contactStatus: String,          // 联系状态
  contactNotes: String,           // 联系备注
  contacted: Boolean,             // 是否已联系
  assignedTo: ObjectId,           // 分配给的律师
  assignedBy: ObjectId,           // 分配操作人
  contactedAt: Date,              // 联系时间
  convertedAt: Date,              // 转化时间
  createdAt: Date,
  updatedAt: Date
}
```

---

## 13. 管理后台新增页面

### 13.1 高价值用户列表页

**路由**: `/admin/high-value-users`

**功能**:
- 展示高价值用户列表
- 筛选：类别、置信度、联系状态
- 搜索：昵称、关键词
- 操作：
  - 跳转评论：点击跳转到小红书对应评论位置
  - 更新联系状态
  - 添加联系备注
  - 分配给律师

**页面字段**:

| 字段 | 说明 |
|------|------|
| 昵称 | 用户昵称 |
| 类别 | family_law婚姻, debt债务, labor劳动等 |
| 置信度 | AI判断置信度，带颜色标识 |
| 评论摘要 | 评论内容前50字 |
| 来源 | 笔记链接 |
| 收集时间 | 收集时间 |
| 联系状态 | pending待联系, contacted已联系, converted已转化, invalid无效 |
| 操作 | 跳转评论、更新状态 |

### 13.2 黑名单管理页

**路由**: `/admin/blacklist`

**功能**:
- 展示昵称黑名单、评论黑名单
- 手动添加黑名单
- 调整阈值
- 查看出现次数趋势

---

## 14. 完整集成流程

```
第三方APK                    服务器API                      AI分析服务
    |                            |                              |
    |--1. 登录获取Token--------->|                              |
    |<--返回Token----------------|                              |
    |                            |                              |
    |--2. 获取关键词和黑名单---->|                              |
    |<--返回数据-----------------|                              |
    |                            |                              |
    |--3. 抓取小红书页面评论-----|                              |
    |                            |                              |
    |--4. 上报昵称统计---------->|                              |
    |<--更新黑名单状态-----------|                              |
    |                            |                              |
    |--5. 上报评论数据---------->|                              |
    |                            |--6. 分析高价值用户---------->|
    |                            |<--返回分析结果---------------|
    |<--返回高价值用户列表-------|                              |
    |                            |                              |
    |--7. 上传审核结果---------->|                              |
    |<--确认收到-----------------|                              |
```

---

## 15. 开发计划

| 阶段 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| P0 | 关键词列表API | 高 | 规划中 |
| P0 | 黑名单API（昵称+评论） | 高 | 规划中 |
| P0 | 昵称统计上报API | 高 | 规划中 |
| P1 | 高价值用户分析API | 中 | 规划中 |
| P1 | 高价值用户列表API | 中 | 规划中 |
| P1 | 管理后台页面 | 中 | 规划中 |
| P2 | 联系状态管理 | 低 | 规划中 |

---

*文档版本：v1.1*
*最后更新：2026-01-13*
