# 审核系统改进计划 - 超详细实施方案 (最终版)

## 📋 具体实施步骤详解

### 3.1 修改评论审核逻辑 (更新：时间从任务提交算起)
**文件**：`server/services/asyncAiReviewService.js`
**修改位置**：在评论审核逻辑中添加重试机制
**修改方法**：添加审核尝试次数判断和时间延迟（从任务提交时间算起）
**具体代码**：
```javascript
// 在评论审核逻辑开始处添加
if (imageType === 'comment' && userNoteInfo) {
  // 获取审核尝试次数，默认为1
  const reviewAttempt = review.reviewAttempt || 1;

  console.log(`🤖 评论审核 - 尝试次数: ${reviewAttempt}`);

  // 计算从任务提交开始的延迟时间
  const timeSinceSubmission = Date.now() - review.createdAt.getTime();
  const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

  console.log(`⏳ 任务提交至今: ${timeSinceSubmissionSeconds}秒`);

  // 根据尝试次数设置延迟时间（从任务提交时间算起）
  if (reviewAttempt === 1) {
    if (timeSinceSubmissionSeconds < 90) {
      const remainingTime = (90 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 评论第一次审核，等待剩余${Math.ceil(remainingTime/1000)}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    // 如果已经超过90秒，直接执行审核
  } else if (reviewAttempt === 2) {
    if (timeSinceSubmissionSeconds < 150) {
      const remainingTime = (150 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 评论第二次审核，等待剩余${Math.ceil(remainingTime/1000)}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    // 如果已经超过150秒，直接执行审核
  }

  // 执行评论审核逻辑...
}
```
**参数说明**：
- `timeSinceSubmission`: 从任务提交到当前时间的毫秒数
- `timeSinceSubmissionSeconds`: 转换为秒数
- 第一次审核等待到90秒，第二次审核等待到150秒（都是从任务提交时间算起）

### 4.2 在 asyncAiReviewService.js 中添加笔记审核支持 (更新：时间从任务提交算起)
**文件**：`server/services/asyncAiReviewService.js`
**修改位置**：在笔记审核逻辑中添加重试机制
**修改方法**：添加审核尝试次数判断和时间延迟（从任务提交时间算起）
**具体代码**：
```javascript
// 在笔记审核逻辑开始处添加
if (imageType === 'note' && userNoteInfo) {
  // 获取审核尝试次数，默认为1
  const reviewAttempt = review.reviewAttempt || 1;

  console.log(`🤖 笔记审核 - 尝试次数: ${reviewAttempt}`);

  // 计算从任务提交开始的延迟时间
  const timeSinceSubmission = Date.now() - review.createdAt.getTime();
  const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

  console.log(`⏳ 任务提交至今: ${timeSinceSubmissionSeconds}秒`);

  // 根据尝试次数设置延迟时间（从任务提交时间算起）
  if (reviewAttempt === 1) {
    if (timeSinceSubmissionSeconds < 120) {
      const remainingTime = (120 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 笔记第一次审核，等待剩余${Math.ceil(remainingTime/1000)}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    // 如果已经超过120秒，直接执行审核
  } else if (reviewAttempt === 2) {
    if (timeSinceSubmissionSeconds < 180) {
      const remainingTime = (180 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 笔记第二次审核，等待剩余${Math.ceil(remainingTime/1000)}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    }
    // 如果已经超过180秒，直接执行审核
  }

  // 执行笔记审核逻辑...
}
```
**参数说明**：
- `timeSinceSubmission`: 从任务提交到当前时间的毫秒数
- `timeSinceSubmissionSeconds`: 转换为秒数
- 第一次审核等待到120秒，第二次审核等待到180秒（都是从任务提交时间算起）

---

## 📋 时间计算逻辑说明

### 评论审核时间线：
- **任务提交**: T0 = 0秒
- **第一次审核**: T0 + 90秒
- **第二次审核**: T0 + 150秒（如果第一次失败）

### 笔记审核时间线：
- **任务提交**: T0 = 0秒
- **第一次审核**: T0 + 120秒
- **第二次审核**: T0 + 180秒（如果第一次失败）

### 实现要点：
1. 每次从队列取出任务时，计算 `Date.now() - review.createdAt.getTime()`
2. 根据审核尝试次数确定目标时间点
3. 如果还没到达目标时间，等待剩余的时间
4. 如果已经超过目标时间，直接执行审核

这样确保了无论何时处理任务，时间都是从任务提交的原始时间点开始计算。

---

## 📋 完整实施方案总结

### 🎯 改进项目总览

1. **内容关键词审核机制** - 确保帖子内容与工作要求匹配
2. **新增设备账号人工审核机制** - 双重审核保障设备安全
3. **评论二次审核机制** - 提高审核成功率（时间从任务提交算起）
4. **笔记异步审核机制** - 优化性能，支持重试（时间从任务提交算起）
5. **时间记录北京时间标准化** - 数据一致性保障
6. **小程序首页设备审核状态显示** - 用户体验优化

### 📁 涉及文件清单

**后端服务文件：**
- `server/services/xiaohongshuService.js`
- `server/services/asyncAiReviewService.js`
- `server/models/Device.js`
- `server/models/ImageReview.js`
- `server/routes/devices.js`
- `server/routes/client.js`
- `server/utils/timeUtils.js` (新建)

**前端管理后台：**
- `admin/src/pages/DeviceReview.js` (新建)

**小程序端：**
- `miniprogram/pages/device-list/device-list.js`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`

### ✅ 验收标准

1. 包含指定关键词的帖子能够通过审核
2. 不包含关键词的帖子被驳回，原因明确显示
3. 新增设备账号需要上传截图并经过双重审核
4. 评论审核在失败时会自动重试两次（时间从任务提交算起）
5. 笔记审核改为异步处理，支持失败重试（时间从任务提交算起）
6. 所有时间显示为北京时间格式
7. 小程序首页显示设备审核状态，支持重新提交

这个实施方案现在已经完整且准确，可以直接用于指导开发实施。