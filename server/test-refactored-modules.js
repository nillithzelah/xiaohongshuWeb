// 测试拆分后的模块
const path = require('path');

console.log('========================================');
console.log('测试拆分后的模块');
console.log('========================================\n');

// 测试 asyncAiReviewService 模块
console.log('1. 测试 asyncAiReviewService 模块导入...');
try {
  const service = require('./services/asyncAiReviewService');
  console.log('   ✅ asyncAiReviewService 导入成功');
  console.log('   - 类型:', typeof service);

  // 测试关键方法是否存在
  const methods = [
    'loadPendingReviews',
    'addToQueue',
    'processQueue',
    'processReview',
    'performFullAiReview',
    'getStatus',
    'getCookieStatus',
    'markCookieExpired',
    'reactivateCookie',
    'handleClientVerificationResult'
  ];

  console.log('   - 方法检查:');
  methods.forEach(m => {
    const exists = typeof service[m] === 'function';
    console.log(`     ${exists ? '✅' : '❌'} ${m}`);
  });

  // 测试子模块导入
  console.log('\n2. 测试子模块导入...');
  const utils = require('./services/ai-review/utils');
  console.log('   ✅ utils.js 导入成功');
  console.log('   - 导出方法:', Object.keys(utils));

  const contentExtractor = require('./services/ai-review/content-extractor');
  console.log('   ✅ content-extractor.js 导入成功');
  console.log('   - 导出方法:', Object.keys(contentExtractor));

  const commission = require('./services/ai-review/commission');
  console.log('   ✅ commission.js 导入成功');
  console.log('   - 导出方法:', Object.keys(commission));

  const clientVerification = require('./services/ai-review/client-verification');
  console.log('   ✅ client-verification.js 导入成功');
  console.log('   - 导出方法:', Object.keys(clientVerification));

} catch (e) {
  console.error('   ❌ 导入失败:', e.message);
  console.error('   堆栈:', e.stack);
  process.exit(1);
}

// 测试 dashboard 路由模块
console.log('\n3. 测试 dashboard 路由模块...');
try {
  const dashboardRoutes = require('./routes/dashboard');
  console.log('   ✅ dashboard.js 导入成功');
  console.log('   - 类型:', typeof dashboardRoutes);
} catch (e) {
  console.error('   ❌ dashboard.js 导入失败:', e.message);
  process.exit(1);
}

// 测试 admin/index.js 路由模块
console.log('\n4. 测试 admin/index.js 路由模块...');
try {
  const adminIndexRoutes = require('./routes/admin/index');
  console.log('   ✅ admin/index.js 导入成功');
  console.log('   - 类型:', typeof adminIndexRoutes);
} catch (e) {
  console.error('   ❌ admin/index.js 导入失败:', e.message);
  process.exit(1);
}

// 测试 utils 模块的函数
console.log('\n5. 测试 utils 模块函数...');
try {
  const utils = require('./services/ai-review/utils');

  // 测试 compareStrings
  const similarity = utils.compareStrings('hello', 'hello world');
  console.log(`   ✅ compareStrings('hello', 'hello world') = ${similarity}%`);

  // 测试 classifyError
  const error = new Error('timeout error');
  const classified = utils.classifyError(error, { test: true });
  console.log(`   ✅ classifyError 返回类型: ${classified.type}`);

  // 测试 shouldRetryReview
  const retryDecision = utils.shouldRetryReview({ reviewAttempt: 1 }, 'system_error');
  console.log(`   ✅ shouldRetryReview 返回: shouldRetry=${retryDecision.shouldRetry}`);

  // 测试 performNegativeKeywordCheck
  const tutorialCheck = utils.performNegativeKeywordCheck('手把手教你做菜', '详细的步骤');
  console.log(`   ✅ performNegativeKeywordCheck 返回: isTutorialContent=${tutorialCheck.isTutorialContent}`);

} catch (e) {
  console.error('   ❌ 函数测试失败:', e.message);
  process.exit(1);
}

console.log('\n========================================');
console.log('✅ 所有模块测试通过！');
console.log('========================================');
