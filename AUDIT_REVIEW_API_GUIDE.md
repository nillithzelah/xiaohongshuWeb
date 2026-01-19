# 审核相关接口文档

## 目录
- [提交审核接口](#提交审核接口)
- [审核操作接口](#审核操作接口)
- [查询接口](#查询接口)
- [设备审核接口](#设备审核接口)
- [数据模型](#数据模型)

---

## 提交审核接口

### 1. 上传图片

**接口地址：** `POST /xiaohongshu/api/client/upload`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| imageData | String | 是 | Base64编码的图片数据 |

**返回示例：**
```json
{
  "success": true,
  "imageUrl": "https://bucket.oss-region.aliyuncs.com/uploads/xxx.jpg",
  "md5": "abc123def456"
}
```

---

### 2. 提交单个任务（旧版）

**接口地址：** `POST /xiaohongshu/api/client/task/submit`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| deviceId | String | 是 | 设备ID |
| imageType | String | 是 | 任务类型：`customer_resource`(客资)、`note`(笔记)、`comment`(评论) |
| image_url | String | 是 | 图片URL |
| imageMd5 | String | 是 | 图片MD5值 |

**返回示例：**
```json
{
  "success": true,
  "message": "任务提交成功，等待审核",
  "review": {
    "id": "65a1b2c3d4e5f6789abcdef",
    "imageType": "note",
    "status": "pending",
    "createdAt": "2024-01-11T12:00:00.000Z"
  }
}
```

---

### 3. 批量提交任务（推荐）

**接口地址：** `POST /xiaohongshu/api/client/tasks/batch-submit`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| deviceId | String | 否 | 设备ID（可选） |
| imageType | String | 是 | 任务类型：`customer_resource`(客资)、`note`(笔记)、`comment`(评论) |
| imageUrls | Array | 否 | 图片URL数组，最多9张 |
| imageMd5s | Array | 否 | 图片MD5数组，与imageUrls数量一致 |
| noteUrl | String | 条件 | 笔记/评论类型必填 |
| noteAuthor | String/Array | 条件 | 作者昵称，笔记/评论类型必填 |
| noteTitle | String | 条件 | 笔记标题，笔记类型必填 |
| commentContent | String | 条件 | 评论内容，评论类型必填 |
| customerPhone | String | 条件 | 客户手机号，客资类型必填（与customerWechat二选一） |
| customerWechat | String | 条件 | 客户微信号，客资类型必填（与customerPhone二选一） |

**任务类型要求：**

| 类型 | 必填字段 | 可选字段 |
|------|----------|----------|
| customer_resource | customerPhone 或 customerWechat | imageUrls, imageMd5s |
| note | noteUrl, noteAuthor, noteTitle | imageUrls, imageMd5s |
| comment | noteUrl, noteAuthor, commentContent | imageUrls, imageMd5s |

**返回示例：**
```json
{
  "success": true,
  "message": "成功提交2个任务",
  "reviews": [
    {
      "id": "65a1b2c3d4e5f6789abcdef",
      "imageType": "note",
      "status": "pending"
    },
    {
      "id": "65a1b2c3d4e5f6789abcdee",
      "imageType": "note",
      "status": "pending"
    }
  ]
}
```

---

## 审核操作接口

### 1. 获取待审核列表

**接口地址：** `GET /xiaohongshu/api/reviews/pending`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `mentor`(带教老师)、`manager`(主管)、`boss`(老板)

**请求参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | Number | 否 | 1 | 页码 |
| limit | Number | 否 | 10 | 每页数量 |
| status | String | 否 | pending | 状态筛选 |

**返回示例：**
```json
{
  "success": true,
  "reviews": [
    {
      "_id": "65a1b2c3d4e5f6789abcdef",
      "userId": {
        "_id": "65a1b2c3d4e5f6789abc000",
        "username": "user001",
        "nickname": "用户001"
      },
      "imageType": "note",
      "imageUrls": ["https://xxx.jpg"],
      "noteUrl": "https://www.xiaohongshu.com/explore/xxx",
      "userNoteInfo": {
        "author": "作者昵称",
        "title": "笔记标题",
        "comment": "评论内容"
      },
      "status": "pending",
      "createdAt": "2024-01-11T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

---

### 2. 审核任务（通过/驳回）

**接口地址：** `POST /xiaohongshu/api/reviews/:id/review`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `mentor`(带教老师)、`manager`(主管)、`boss`(老板)

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 审核记录ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | String | 是 | 操作类型：`approve`(通过)、`reject`(驳回) |
| reason | String | 否 | 驳回原因（驳回时必填） |
| comment | String | 否 | 审核意见 |

**返回示例：**
```json
{
  "success": true,
  "message": "审核通过",
  "review": {
    "_id": "65a1b2c3d4e5f6789abcdef",
    "status": "manager_approved",
    "imageType": "note",
    "imageUrl": "https://xxx.jpg",
    "createdAt": "2024-01-11T12:00:00.000Z",
    "auditHistory": [...]
  }
}
```

---

### 3. 带教老师审核（可修改类型）

**接口地址：** `PUT /xiaohongshu/api/reviews/:id/mentor-review`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `mentor`(带教老师)、`manager`(主管)、`boss`(老板)

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 审核记录ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| approved | Boolean | 是 | 是否通过 |
| comment | String | 否 | 审核意见 |
| newType | String | 否 | 修正后的类型：`customer_resource`、`note`、`comment` |

**返回示例：**
```json
{
  "success": true,
  "message": "审核通过，提交给主管",
  "review": {
    "_id": "65a1b2c3d4e5f6789abcdef",
    "status": "mentor_approved",
    "mentorReview": {
      "reviewer": "65a1b2c3d4e5f6789abc000",
      "approved": true,
      "comment": "审核通过",
      "reviewedAt": "2024-01-11T12:00:00.000Z"
    }
  }
}
```

---

### 4. 主管审核（人工复审）

**接口地址：** `PUT /xiaohongshu/api/reviews/:id/manager-approve`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `manager`(主管)、`boss`(老板)

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 审核记录ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| approved | Boolean | 是 | 是否通过 |
| comment | String | 否 | 审核意见 |

**返回示例：**
```json
{
  "success": true,
  "message": "人工复审通过，提交给财务处理",
  "review": {
    "_id": "65a1b2c3d4e5f6789abcdef",
    "status": "manager_approved",
    "managerApproval": {
      "approved": true,
      "comment": "人工复审通过",
      "approvedAt": "2024-01-11T12:00:00.000Z"
    }
  }
}
```

---

### 5. 财务处理

**接口地址：** `PUT /xiaohongshu/api/reviews/:id/finance-process`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `finance`(财务)、`boss`(老板)

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 审核记录ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| amount | Number | 是 | 金额（必须与snapshotPrice一致） |
| commission | Number | 否 | 佣金 |

**验证规则：**
- 金额必须与 `snapshotPrice` 一致（允许0.01元误差）
- 单笔金额不能超过10000元
- 佣金不能超过期望最大佣金的110%

**返回示例：**
```json
{
  "success": true,
  "message": "财务处理完成",
  "review": {
    "_id": "65a1b2c3d4e5f6789abcdef",
    "status": "completed",
    "financeProcess": {
      "amount": 8,
      "commission": 0.8,
      "processedAt": "2024-01-11T12:00:00.000Z"
    }
  }
}
```

---

### 6. 批量操作

#### 6.1 一键全部通过

**接口地址：** `PUT /xiaohongshu/api/reviews/approve-all-pending`

**权限要求：** `manager`(主管)、`boss`(老板)

**返回示例：**
```json
{
  "success": true,
  "message": "成功通过 50 个待审核任务",
  "modifiedCount": 50
}
```

#### 6.2 一键全部驳回

**接口地址：** `PUT /xiaohongshu/api/reviews/reject-all-pending`

**权限要求：** `manager`(主管)、`boss`(老板)

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| comment | String | 是 | 驳回理由 |

**返回示例：**
```json
{
  "success": true,
  "message": "成功驳回 50 个待审核任务",
  "modifiedCount": 50
}
```

#### 6.3 主管批量确认

**接口地址：** `PUT /xiaohongshu/api/reviews/batch-manager-approve`

**权限要求：** `manager`(主管)、`boss`(老板)

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ids | Array | 是 | 审核记录ID数组 |
| approved | Boolean | 是 | 是否通过 |
| comment | String | 条件 | 驳回时必填 |

**返回示例：**
```json
{
  "success": true,
  "message": "成功确认 10 个任务",
  "modifiedCount": 10
}
```

#### 6.4 批量选中操作

**接口地址：** `PUT /xiaohongshu/api/reviews/batch-cs-review`

**权限要求：** `manager`(主管)、`boss`(老板)

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| ids | Array | 是 | 审核记录ID数组 |
| action | String | 是 | 操作类型：`pass`(通过)、`reject`(驳回) |
| comment | String | 条件 | 驳回时必填 |

**返回示例：**
```json
{
  "success": true,
  "message": "成功通过 5 个任务",
  "modifiedCount": 5
}
```

---

## 查询接口

### 1. 获取我的审核记录

**接口地址：** `GET /xiaohongshu/api/reviews/my-reviews`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | Number | 否 | 1 | 页码 |
| limit | Number | 否 | 10 | 每页数量 |

**返回示例：**
```json
{
  "success": true,
  "reviews": [
    {
      "_id": "65a1b2c3d4e5f6789abcdef",
      "imageType": "note",
      "status": "manager_approved",
      "createdAt": "2024-01-11T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 20,
    "pages": 2
  }
}
```

---

### 2. 获取所有审核记录（管理员）

**接口地址：** `GET /xiaohongshu/api/reviews/`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | Number | 否 | 1 | 页码 |
| limit | Number | 否 | 10 | 每页数量 |
| status | String | 否 | - | 状态筛选 |
| userId | String | 否 | - | 用户ID筛选 |
| imageType | String | 否 | - | 类型筛选 |
| keyword | String | 否 | - | 关键词搜索（用户名/昵称） |
| reviewer | String | 否 | - | 审核人筛选 |
| deviceName | String | 否 | - | 设备名筛选 |

**返回示例：**
```json
{
  "success": true,
  "data": {
    "reviews": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

---

### 3. 获取AI自动审核记录

**接口地址：** `GET /xiaohongshu/api/reviews/ai-auto-approved`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `mentor`(带教老师)、`manager`(主管)、`boss`(老板)

**请求参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | Number | 否 | 1 | 页码 |
| limit | Number | 否 | 10 | 每页数量 |
| status | String | 否 | - | 状态筛选 |
| userId | String | 否 | - | 用户ID筛选 |
| imageType | String | 否 | - | 类型筛选 |
| keyword | String | 否 | - | 关键词搜索 |

**返回示例：**
```json
{
  "success": true,
  "reviews": [
    {
      "_id": "65a1b2c3d4e5f6789abcdef",
      "survivalDays": 5,
      "totalEarnings": 50,
      "initialPrice": 8,
      "additionalEarnings": 42,
      "dailyReward": 30
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 30,
    "pages": 3
  }
}
```

---

### 4. 获取通知

**接口地址：** `GET /xiaohongshu/api/reviews/notifications`

**认证要求：** 需要 `Authorization: Bearer {token}`

**返回示例：**
```json
{
  "success": true,
  "notifications": [
    {
      "_id": "65a1b2c3d4e5f6789abc001",
      "userId": "65a1b2c3d4e5f6789abc000",
      "type": "review_approved",
      "message": "您的笔记审核已通过",
      "isRead": false,
      "createdAt": "2024-01-11T12:00:00.000Z"
    }
  ],
  "unreadCount": 5
}
```

---

### 5. 标记通知为已读

**接口地址：** `PUT /xiaohongshu/api/reviews/notifications/:id/read`

**认证要求：** 需要 `Authorization: Bearer {token}`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 通知ID |

**返回示例：**
```json
{
  "success": true,
  "message": "标记已读成功"
}
```

---

## 设备审核接口

### 1. 获取待审核设备列表

**接口地址：** `GET /xiaohongshu/api/devices/pending-review`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | Number | 否 | 1 | 页码 |
| limit | Number | 否 | 10 | 每页数量 |

**返回示例：**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6789abc000",
      "accountName": "xiaohongshu_user_001",
      "accountId": "1234567890",
      "accountUrl": "https://www.xiaohongshu.com/user/profile/1234567890",
      "reviewImage": "https://xxx.jpg",
      "reviewStatus": "pending",
      "assignedUser": {
        "username": "user001",
        "nickname": "用户001"
      },
      "createdBy": {
        "username": "creator001",
        "nickname": "创建者001"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 20,
    "pages": 2
  }
}
```

---

### 2. 审核设备

**接口地址：** `PUT /xiaohongshu/api/devices/:id/review`

**认证要求：** 需要 `Authorization: Bearer {token}`

**权限要求：** `manager`(主管)、`boss`(老板)

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 设备ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| action | String | 是 | 操作类型：`approve`(通过)、`reject`(驳回) |
| reason | String | 条件 | 驳回原因（驳回时必填） |

**返回示例：**
```json
{
  "success": true,
  "message": "设备审核通过",
  "data": {
    "_id": "65a1b2c3d4e5f6789abc000",
    "accountName": "xiaohongshu_user_001",
    "reviewStatus": "approved",
    "status": "online",
    "reviewedBy": {
      "username": "manager001",
      "nickname": "主管001"
    },
    "reviewedAt": "2024-01-11T12:00:00.000Z"
  }
}
```

---

### 3. 验证设备账号信息

**接口地址：** `POST /xiaohongshu/api/devices/verify`

**认证要求：** 需要 `Authorization: Bearer {token}`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| accountUrl | String | 是 | 小红书账号链接 |
| accountId | String | 是 | 账号ID |
| nickname | String | 是 | 账号昵称 |

**返回示例：**
```json
{
  "success": true,
  "verified": true,
  "confidence": 100,
  "message": "账号ID与昵称完全匹配",
  "data": {
    "extractedNickname": "用户昵称",
    "extractedId": "1234567890"
  },
  "reasonText": "账号ID与昵称完全匹配"
}
```

---

## 数据模型

### ImageReview（审核记录）

| 字段名 | 类型 | 说明 |
|--------|------|------|
| _id | ObjectId | 记录ID |
| userId | ObjectId | 用户ID |
| nickname | String | AI识别的真实昵称 |
| imageUrls | Array | 图片URL数组（最多9张） |
| imageType | String | 类型：`customer_resource`、`note`、`comment` |
| imageMd5s | Array | 图片MD5数组 |
| snapshotPrice | Number | 快照价格 |
| snapshotCommission1 | Number | 一级佣金 |
| snapshotCommission2 | Number | 二级佣金 |
| noteUrl | String | 小红书笔记链接 |
| userNoteInfo | Object | 用户提供的笔记信息 |
| aiParsedNoteInfo | Object | AI解析的笔记信息 |
| aiReviewResult | Object | AI审核结果 |
| status | String | 状态 |
| mentorReview | Object | 带教老师审核信息 |
| managerApproval | Object | 主管审批信息 |
| financeProcess | Object | 财务处理信息 |
| rejectionReason | String | 驳回原因 |
| deviceInfo | Object | 设备信息 |
| auditHistory | Array | 审核历史 |
| continuousCheck | Object | 持续检查信息 |
| reviewAttempt | Number | 审核尝试次数（1或2） |
| createdAt | Date | 创建时间 |

### 审核状态说明

| 状态值 | 说明 |
|--------|------|
| pending | 待审核 |
| processing | 处理中 |
| ai_approved | AI审核通过 |
| mentor_approved | 带教老师审核通过 |
| manager_rejected | 主管驳回 |
| manager_approved | 主管审核通过 |
| finance_processing | 财务处理中 |
| completed | 已完成 |
| rejected | 已驳回 |

### userNoteInfo 结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| author | String | 作者昵称 |
| title | String | 笔记标题 |
| comment | String | 评论内容（评论类型） |
| customerPhone | String | 客户手机号（客资类型） |
| customerWechat | String | 客户微信号（客资类型） |

### aiParsedNoteInfo 结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| author | String | 页面解析的作者昵称 |
| title | String | 页面解析的标题 |
| publishTime | Date | 发布时间 |
| likes | Number | 点赞数 |
| collects | Number | 收藏数 |
| comments | Number | 评论数 |

### aiReviewResult 结构

| 字段名 | 类型 | 说明 |
|--------|------|------|
| passed | Boolean | 是否通过 |
| confidence | Number | 信心度 (0-1) |
| riskLevel | String | 风险等级：`low`、`medium`、`high` |
| reasons | Array | 审核理由 |
| contentMatch | Object | 内容匹配结果 |
| commentVerification | Object | 评论验证结果（仅评论类型） |

---

## 权限说明

| 角色 | 权限 |
|------|------|
| part_time | 提交任务、查看自己的审核记录 |
| mentor | 审核任务、查看待审核列表、查看AI自动审核记录 |
| manager | 审核任务、批量操作、财务处理、设备审核 |
| boss | 所有权限 |
| finance | 财务处理 |

---

## 注意事项

1. **图片限制**：最多上传9张图片
2. **MD5去重**：已通过审核的图片不能重复提交
3. **笔记限制**：同一昵称7天内只能提交一篇笔记
4. **评论限制**：同一链接下同一昵称的评论内容有限制
5. **金额验证**：财务处理时金额必须与快照价格一致
6. **状态流转**：pending → ai_approved → mentor_approved → manager_approved → completed
7. **积分发放**：审核通过后自动发放任务积分和分销佣金
8. **持续检查**：笔记类型审核通过后启用持续检查，每天发放奖励积分

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 参数错误 |
| 401 | 未认证 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复提交） |
| 500 | 服务器错误 |
