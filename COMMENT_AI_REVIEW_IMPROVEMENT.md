# 评论AI审核逻辑改进建议

## 当前问题分析

### 现有评论审核逻辑过于宽松：
1. **缺乏作者匹配验证** - 不验证用户填写的作者昵称与页面实际作者是否一致
2. **评论内容质量检查不足** - 仅检查长度和简单关键词，缺乏深度分析
3. **风险评估标准不一致** - 与笔记审核标准差异过大

## 改进后的评论AI审核逻辑

### 1. 链接验证（保持原有）
```javascript
// 首先验证链接有效性
const linkValidation = await xiaohongshuService.validateNoteUrl(noteUrl);
if (!linkValidation.valid) {
  return { passed: false, reason: '链接验证失败' };
}
```

### 2. 页面内容解析（新增）
```javascript
// 解析笔记页面内容
const contentResult = await xiaohongshuService.parseNoteContent(noteUrl);

if (!contentResult.success || (!contentResult.author && !contentResult.title)) {
  return {
    passed: false,
    confidence: 0.1,
    reason: '无法解析笔记内容，疑似无效链接',
    riskLevel: 'high'
  };
}
```

### 3. 作者匹配验证（新增核心功能）
```javascript
// 验证作者昵称匹配
const authorMatch = contentResult.author ? compareStrings(noteAuthor, contentResult.author) : 0;

console.log('🔍 评论作者匹配检查:', {
  userAuthor: noteAuthor,
  pageAuthor: contentResult.author,
  authorMatch: `${authorMatch}%`
});

// 严格的作者匹配检查
if (authorMatch < 50) {
  return {
    passed: false,
    confidence: 0.2,
    reason: `作者昵称不匹配 (用户:${noteAuthor} vs 页面:${contentResult.author})`,
    riskLevel: 'high'
  };
}
```

### 4. 评论内容质量分析（增强）
```javascript
// 评论内容长度检查
if (commentContent.length < 10) {
  return {
    passed: false,
    confidence: 0.3,
    reason: '评论内容过短，疑似无效评论',
    riskLevel: 'high'
  };
}

if (commentContent.length > 300) {
  confidence += 0.1;
  reasons.push('评论内容详细，质量较高');
} else if (commentContent.length > 50) {
  confidence += 0.05;
  reasons.push('评论内容长度适中');
} else {
  confidence += 0.02;
  reasons.push('评论内容基本长度');
}
```

### 5. 评论内容智能分析（新增）
```javascript
// 检查评论是否与笔记内容相关
const contentRelevance = analyzeCommentRelevance(commentContent, contentResult.title);

if (contentRelevance < 0.3) {
  return {
    passed: false,
    confidence: 0.2,
    reason: '评论内容与笔记主题不相关，疑似刷评',
    riskLevel: 'high'
  };
}

// 正面评价词汇检查
const positiveWords = ['好', '不错', '喜欢', '支持', '棒', '赞', '优秀', '完美', '推荐'];
const negativeWords = ['差', '不好', '失望', '糟糕', '垃圾', '骗人'];

let positiveCount = 0;
let negativeCount = 0;

positiveWords.forEach(word => {
  if (commentContent.includes(word)) positiveCount++;
});

negativeWords.forEach(word => {
  if (commentContent.includes(word)) negativeCount++;
});

// 负面评价过多，降低信心度
if (negativeCount > positiveCount) {
  confidence *= 0.7;
  reasons.push('评论包含较多负面评价');
} else if (positiveCount > 0) {
  confidence += 0.1;
  reasons.push('评论包含正面评价');
}
```

### 6. 重复内容检测（增强）
```javascript
// 改进的重复检测
const wordFrequency = {};
const words = commentContent.split(/[\s，。！？；：""''（）【】]+/);

words.forEach(word => {
  if (word.length > 1) {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  }
});

const maxFreq = Math.max(...Object.values(wordFrequency));
const totalWords = Object.values(wordFrequency).reduce((a, b) => a + b, 0);
const repetitionRatio = maxFreq / totalWords;

if (repetitionRatio > 0.5) {
  return {
    passed: false,
    confidence: 0.2,
    reason: '评论内容重复度过高，疑似刷评',
    riskLevel: 'high'
  };
}
```

### 7. 综合信心度计算
```javascript
// 综合信心度计算
let finalConfidence = baseConfidence;

if (authorMatch >= 80) {
  finalConfidence += 0.2;
  reasons.push('作者匹配度很高');
} else if (authorMatch >= 60) {
  finalConfidence += 0.1;
  reasons.push('作者匹配度较好');
}

if (contentRelevance >= 0.7) {
  finalConfidence += 0.15;
  reasons.push('评论与内容高度相关');
}

if (positiveCount >= 2) {
  finalConfidence += 0.1;
  reasons.push('包含多个正面评价');
}

// 决定是否通过
const passed = finalConfidence >= 0.8;
const riskLevel = finalConfidence >= 0.9 ? 'low' : 
                 finalConfidence >= 0.7 ? 'medium' : 'high';
```

## 审核标准统一化

### 自动通过条件（信心度 ≥ 0.9）:
- 作者匹配度 ≥ 80%
- 评论内容质量良好
- 无重复或异常内容

### 人工复核条件（0.7 ≤ 信心度 < 0.9）:
- 作者匹配度 ≥ 60%
- 评论内容基本合理
- 需要进一步人工验证

### 直接拒绝条件（信心度 < 0.7）:
- 作者匹配度 < 50%
- 评论内容过短或重复
- 与笔记内容不相关

## 预期效果

1. **提高审核准确性** - 评论审核标准与笔记保持一致
2. **降低刷评风险** - 严格验证作者匹配和内容质量
3. **统一审核体验** - 减少因审核标准不同导致的争议
4. **增强系统可信度** - 建立更严格的评论质量把控