# 审核系统改进计划 - 超详细实施方案 (更新版)

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
3. 如果还没到目标时间，等待剩余时间
4. 如果已经超过目标时间，直接执行审核

这样确保了无论何时处理任务，时间都是从任务提交的原始时间点开始计算。