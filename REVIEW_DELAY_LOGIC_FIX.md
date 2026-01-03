# 审核延迟逻辑修正记录

## 📅 修改时间
2025-12-30

## 🎯 问题描述
笔记和评论的第二次延迟审核逻辑存在错误：不是从一开始就计时，而是重新等待。

**原有逻辑问题：**
- 笔记审核：没有延迟等待，直接执行
- 评论审核：固定等待90秒后执行
- 第二次审核时重新开始等待，而不是从任务提交时间累积计算

## 🔧 修改内容

### 1. 数据库模型修改
**文件：** `server/models/ImageReview.js`
**修改：** 添加 `reviewAttempt` 字段
```javascript
// 审核尝试次数（用于延迟重试机制）
reviewAttempt: {
  type: Number,
  default: 1,
  min: 1,
  max: 2,
  validate: {
    validator: function(v) {
      return Number.isInteger(v) && v >= 1 && v <= 2;
    },
    message: '审核尝试次数必须是1或2'
  },
  comment: '审核尝试次数，1表示第一次尝试，2表示第二次尝试'
}
```

### 2. 笔记审核逻辑修正
**文件：** `server/services/asyncAiReviewService.js`
**修改位置：** `performFullAiReview` 方法中的笔记审核逻辑

**新增延迟计算逻辑：**
```javascript
// 获取审核尝试次数，默认为1
const reviewAttempt = review.reviewAttempt || 1;

console.log(`🤖 笔记审核 - 尝试次数: ${reviewAttempt}`);

// 计算从任务提交开始的延迟时间
const timeSinceSubmission = Date.now() - review.createdAt.getTime();
const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
console.log(`⏱️ 当前时间距离提交: ${timeSinceSubmissionSeconds}秒`);

// 根据尝试次数设置延迟时间（从任务提交时间算起）
if (reviewAttempt === 1) {
  if (timeSinceSubmissionSeconds < 120) {
    const remainingTime = (120 - timeSinceSubmissionSeconds) * 1000;
    console.log(`⏳ 笔记第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
    await new Promise(resolve => setTimeout(resolve, remainingTime));
  } else {
    console.log(`✅ 笔记第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
  }
} else if (reviewAttempt === 2) {
  if (timeSinceSubmissionSeconds < 180) {
    const remainingTime = (180 - timeSinceSubmissionSeconds) * 1000;
    console.log(`⏳ 笔记第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
    await new Promise(resolve => setTimeout(resolve, remainingTime));
  } else {
    console.log(`✅ 笔记第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
  }
}
```

**新增关键词检查失败重试逻辑：**
```javascript
// 关键词检查失败处理
if (!contentResult.keywordCheck || !contentResult.keywordCheck.passed) {
  console.log('❌ 关键词检查失败:', contentResult.keywordCheck?.reason);

  if (reviewAttempt < 2) {
    // 第一次审核失败，标记为需要重试
    console.log(`📋 笔记第一次审核失败，准备第二次审核`);
    await ImageReview.findByIdAndUpdate(review._id, {
      reviewAttempt: 2,
      status: 'pending'
    });
    return; // 等待重试
  } else {
    // 第二次审核也失败，最终驳回
    console.log('❌ 笔记第二次审核失败，最终驳回');
    aiReviewResult.aiReview.passed = false;
    aiReviewResult.aiReview.confidence = 0.1;
    aiReviewResult.aiReview.reasons.push('帖子内容和工作要求匹配度过低');
    aiReviewResult.aiReview.riskLevel = 'high';
  }
}
```

### 3. 评论审核逻辑修正
**文件：** `server/services/asyncAiReviewService.js`
**修改位置：** `performFullAiReview` 方法中的评论审核逻辑

**新增延迟计算逻辑：**
```javascript
// 获取审核尝试次数，默认为1
const reviewAttempt = review.reviewAttempt || 1;

console.log(`🤖 评论审核 - 尝试次数: ${reviewAttempt}`);

// 计算从任务提交开始的延迟时间
const timeSinceSubmission = Date.now() - review.createdAt.getTime();
const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
console.log(`⏱️ 当前时间距离提交: ${timeSinceSubmissionSeconds}秒`);

// 根据尝试次数设置延迟时间（从任务提交时间算起）
if (reviewAttempt === 1) {
  if (timeSinceSubmissionSeconds < 90) {
    const remainingTime = (90 - timeSinceSubmissionSeconds) * 1000;
    console.log(`⏳ 评论第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
    await new Promise(resolve => setTimeout(resolve, remainingTime));
  } else {
    console.log(`✅ 评论第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
  }
} else if (reviewAttempt === 2) {
  if (timeSinceSubmissionSeconds < 150) {
    const remainingTime = (150 - timeSinceSubmissionSeconds) * 1000;
    console.log(`⏳ 评论第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
    await new Promise(resolve => setTimeout(resolve, remainingTime));
  } else {
    console.log(`✅ 评论第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
  }
}
```

**新增审核失败重试逻辑：**
```javascript
// 审核失败处理
if (commentVerification.error) {
  if (reviewAttempt < 2) {
    // 第一次审核失败，标记为需要重试
    console.log(`❌ 评论第一次审核失败，准备第二次审核`);

    await ImageReview.findByIdAndUpdate(review._id, {
      reviewAttempt: 2,
      status: 'pending' // 保持pending状态，等待重新处理
    });

    // 不设置审核结果，直接返回，等待重试
    return;
  } else {
    // 第二次审核也失败，最终驳回
    console.log('❌ 评论第二次审核失败，最终驳回');
    aiReviewResult.aiReview.passed = false;
    aiReviewResult.aiReview.confidence = 0.1;
    aiReviewResult.aiReview.reasons.push('当前帖子评论区无法检测到你的评论（请用其他号观察）');
    aiReviewResult.aiReview.riskLevel = 'high';
  }
} else if (commentVerification.passed) {
  // 审核通过逻辑保持不变
  aiReviewResult.aiReview.confidence += 0.2;
  aiReviewResult.aiReview.reasons.push('评论验证通过，确认真实存在且内容完全一致');
} else {
  if (reviewAttempt < 2) {
    // 第一次审核失败，标记为需要重试
    console.log(`❌ 评论第一次审核失败，准备第二次审核`);

    await ImageReview.findByIdAndUpdate(review._id, {
      reviewAttempt: 2,
      status: 'pending' // 保持pending状态，等待重新处理
    });

    // 不设置审核结果，直接返回，等待重试
    return;
  } else {
    // 第二次审核也失败，最终驳回
    console.log('❌ 评论第二次审核失败，最终驳回');
    aiReviewResult.aiReview.passed = false;
    aiReviewResult.aiReview.confidence = 0.1;
    aiReviewResult.aiReview.reasons.push(`当前帖子评论区无法检测到你的评论（请用其他号观察）,${commentVerification.reasons.join(', ')}`);
    aiReviewResult.aiReview.riskLevel = 'high';
  }
}
```

## 🧪 测试验证
**测试文件：** `server/test-review-delay-logic.js`

运行测试结果：
```
=== 测试笔记审核延迟逻辑 ===

📝 笔记第一次审核 - 刚提交:
✅ 需要等待: 120秒

📝 笔记第一次审核 - 已过1分钟:
✅ 需要等待: 60秒

📝 笔记第一次审核 - 已过3分钟:
✅ 已过延迟时间，直接执行审核

📝 笔记第二次审核 - 刚提交:
✅ 需要等待: 180秒

📝 笔记第二次审核 - 已过2分钟:
✅ 需要等待: 60秒

=== 测试评论审核延迟逻辑 ===

💬 评论第一次审核 - 刚提交:
✅ 需要等待: 90秒

💬 评论第一次审核 - 已过1.5分钟:
✅ 已过延迟时间，直接执行审核

💬 评论第二次审核 - 刚提交:
✅ 需要等待: 150秒

=== 测试完成 ===
✅ 延迟逻辑验证通过：所有审核都是从任务提交时间开始计时，而不是重新等待
```

## 📊 审核流程对比

### 修改前流程
```
任务提交 → 加入队列 → 立即执行审核（笔记）/等待固定时间（评论）
     ↓
审核失败 → 重新排队 → 重新等待固定时间 → 最终失败
```

### 修改后流程
```
任务提交 → 加入队列 → 计算从提交时间开始的等待时间
     ↓
审核失败 → 标记为第二次尝试 → 重新排队 → 计算累积等待时间 → 最终失败
```

## 🎯 解决的问题
1. **公平性**：所有任务都从提交时间开始累积计算等待时间
2. **一致性**：笔记和评论审核都使用相同的延迟计算逻辑
3. **准确性**：第二次审核等待更长时间，确保内容充分展示
4. **可追溯性**：通过 `reviewAttempt` 字段记录审核尝试次数

## 📝 影响范围
- **笔记审核**：现在有120秒/180秒的延迟等待
- **评论审核**：修正了90秒/150秒的延迟等待逻辑
- **数据库**：新增 `reviewAttempt` 字段
- **日志**：增加了详细的延迟计算和等待时间日志

## ✅ 验证状态
- [x] 代码修改完成
- [x] 数据库模型更新
- [x] 逻辑测试通过
- [x] 日志输出正常