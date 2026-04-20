/**
 * AI审核服务 - 工具函数模块
 * 包含字符串比较、错误分类、重试决策等通用工具函数
 */

/**
 * 字符串相似度比对
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 相似度百分比 (0-100)
 */
function compareStrings(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 100;

  if (s1.includes(s2) || s2.includes(s1)) return 90;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 100;

  const editDistance = levenshteinDistance(longer, shorter);
  return Math.round((longer.length - editDistance) / longer.length * 100);
}

/**
 * 计算编辑距离 (Levenshtein Distance)
 * @param {string} str1 - 字符串1
 * @param {string} str2 - 字符串2
 * @returns {number} 编辑距离
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * 错误分类
 * @param {Error} error - 错误对象
 * @param {Object} context - 错误上下文
 * @returns {Object} 分类后的错误信息
 */
function classifyError(error, context = {}) {
  const errorMessage = error.message || 'Unknown error';
  const errorStack = error.stack;

  // 网络相关错误
  if (errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('ENOTFOUND') || errorMessage.includes('network')) {
    return {
      type: 'network_error',
      severity: 'medium',
      retryable: true,
      message: `网络错误: ${errorMessage}`,
      context
    };
  }

  // 解析相关错误
  if (errorMessage.includes('parse') || errorMessage.includes('cheerio') ||
      errorMessage.includes('HTML') || errorMessage.includes('selector')) {
    return {
      type: 'parse_error',
      severity: 'high',
      retryable: true,
      message: `内容解析错误: ${errorMessage}`,
      context
    };
  }

  // 数据库相关错误
  if (errorMessage.includes('Mongo') || errorMessage.includes('database') ||
      errorMessage.includes('findById') || errorMessage.includes('save')) {
    return {
      type: 'database_error',
      severity: 'critical',
      retryable: false,
      message: `数据库错误: ${errorMessage}`,
      context
    };
  }

  // 小红书服务相关错误
  if (errorMessage.includes('Xiaohongshu') || errorMessage.includes('note') ||
      errorMessage.includes('comment') || context.service === 'xiaohongshu') {
    return {
      type: 'service_error',
      severity: 'high',
      retryable: true,
      message: `小红书服务错误: ${errorMessage}`,
      context
    };
  }

  // 关键词检查错误
  if (errorMessage.includes('keyword') || context.check === 'keyword') {
    return {
      type: 'keyword_error',
      severity: 'low',
      retryable: false,
      message: `关键词检查错误: ${errorMessage}`,
      context
    };
  }

  // 默认错误类型
  return {
    type: 'unknown_error',
    severity: 'medium',
    retryable: true,
    message: `未知错误: ${errorMessage}`,
    context,
    stack: errorStack
  };
}

/**
 * 智能重试决策
 * @param {Object} review - 审核记录
 * @param {string} failureReason - 失败原因类型
 * @returns {Object} 重试决策结果
 */
function shouldRetryReview(review, failureReason) {
  const currentAttempt = review.reviewAttempt || 1;
  const maxAttempts = 2; // 最大尝试次数（初始1次 + 重试1次）

  // 如果已经达到最大尝试次数，不再重试
  if (currentAttempt >= maxAttempts) {
    return {
      shouldRetry: false,
      reason: `已达到最大尝试次数(${maxAttempts})`
    };
  }

  // 根据失败原因决定是否重试
  switch (failureReason) {
    case 'system_error':
      return {
        shouldRetry: true,
        reason: '系统错误，值得重试'
      };

    case 'keyword_check_failed':
      return {
        shouldRetry: false,
        reason: '关键词检查失败，不适合重试'
      };

    case 'content_parse_failed':
      return {
        shouldRetry: true,
        reason: '内容解析失败，值得重试'
      };

    case 'comment_verification_error':
      return {
        shouldRetry: true,
        reason: '评论验证出错，值得重试'
      };

    case 'comment_not_found':
      return {
        shouldRetry: false,
        reason: '评论不存在，不适合重试'
      };

    default:
      return {
        shouldRetry: currentAttempt < 2,
        reason: `未知错误类型${currentAttempt < 2 ? '，尝试重试' : '，不再重试'}`
      };
  }
}

/**
 * 负面关键词检查 - 过滤教程类非维权内容
 * @param {string} title - 页面标题
 * @param {string} content - 页面内容
 * @returns {Object} 检查结果
 */
function performNegativeKeywordCheck(title, content) {
  // 教程类内容的特征关键词
  const tutorialKeywords = [
    // 教程类标题特征
    '保姆级流程', '手把手教你', '零基础入门', '从零开始', '新手必看',
    '一看就会', '超级详细', '超简单', '超详细', '超全', '超完整',
    '步骤详解', '操作指南', '实操教程', '实战教程', '入门教程',
    // 办事流程类
    '营业执照', '注册公司', '公司注册', '办理流程', '办理指南',
    '备案流程', '申请流程', '资质办理', '许可证办理',
    // 知识科普类
    '什么是', '如何选择', '怎么选择', '注意事项', '科普',
    '知识分享', '干货分享', '知识点', '小知识',
    // 产品介绍类（非维权）
    '产品功能', '产品优势', '产品介绍', '产品特点',
    // 正常商业推广
    '官方', '旗舰店', '正品', '官方正品', '官方旗舰店',
    // 中性经验分享（非维权）
    '经验之谈', '个人经验', '分享一下', '分享经验'
  ];

  // 教程类内容的组合特征（更强信号）
  const tutorialPatterns = [
    /流程.*指南|指南.*流程/,
    /如何.*办理|怎么.*办理/,
    /.*教程|新手.*教程|入门.*教程/,
    /.*步骤|操作.*步骤/,
    /.*备案|.*注册.*公司/,
    /保姆级|手把手|零基础|从零开始/
  ];

  const fullText = `${title || ''} ${content || ''}`.toLowerCase();

  // 检查单个关键词（需要多个才判断为教程）
  let tutorialKeywordCount = 0;
  const matchedKeywords = [];

  for (const keyword of tutorialKeywords) {
    if (fullText.includes(keyword.toLowerCase())) {
      tutorialKeywordCount++;
      matchedKeywords.push(keyword);
    }
  }

  // 检查组合模式（任一模式匹配即为教程内容）
  for (const pattern of tutorialPatterns) {
    if (pattern.test(fullText)) {
      return {
        isTutorialContent: true,
        reason: `检测到教程类内容模式: "${pattern.source}"`,
        matchedPattern: pattern.source,
        matchedKeywords: matchedKeywords
      };
    }
  }

  // 如果匹配到3个或以上教程关键词，也判断为教程内容
  if (tutorialKeywordCount >= 3) {
    return {
      isTutorialContent: true,
      reason: `检测到多个教程类关键词: ${matchedKeywords.slice(0, 3).join('、')}`,
      matchedKeywords: matchedKeywords,
      matchCount: tutorialKeywordCount
    };
  }

  return {
    isTutorialContent: false,
    matchedKeywords: matchedKeywords,
    matchCount: tutorialKeywordCount
  };
}

/**
 * 创建默认的错误恢复状态
 * @returns {Object} 错误恢复状态
 */
function createDefaultErrorRecoveryState() {
  return {
    consecutiveFailures: 0,
    lastErrorTime: null,
    circuitBreaker: false,
    circuitBreakerResetTime: null
  };
}

/**
 * 创建默认的Cookie状态
 * @returns {Object} Cookie状态
 */
function createDefaultCookieStatus() {
  return {
    isValid: true,
    expiredAt: null,
    checkCount: 0,
    lastCheckTime: null,
    recentFailures: [],
    consecutiveFailures: 0,
    lastExpireMarkTime: null,
    expireMarkCooldown: 60000 // 60秒冷却
  };
}

/**
 * 创建默认的审核统计状态
 * @returns {Object} 审核统计状态
 */
function createDefaultReviewStats() {
  return {
    totalProcessed: 0,
    totalPassed: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    lastProcessedTime: null
  };
}

module.exports = {
  compareStrings,
  levenshteinDistance,
  classifyError,
  shouldRetryReview,
  performNegativeKeywordCheck,
  createDefaultErrorRecoveryState,
  createDefaultCookieStatus,
  createDefaultReviewStats
};
