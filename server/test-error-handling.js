/**
 * 测试错误处理和异常恢复机制
 */

const asyncAiReviewService = require('./services/asyncAiReviewService');

async function testErrorHandling() {
  console.log('🧪 开始测试错误处理机制...\n');

  const service = asyncAiReviewService;

  // 测试1: 正常状态
  console.log('📊 测试1: 获取初始状态');
  const initialStatus = service.getStatus();
  console.log('初始状态:', {
    isRunning: initialStatus.isRunning,
    queueLength: initialStatus.queueLength,
    activeReviews: initialStatus.activeReviews,
    circuitBreakerActive: initialStatus.errorRecovery.circuitBreakerActive
  });

  // 测试2: 模拟网络错误
  console.log('\n📊 测试2: 模拟网络错误');
  const networkError = new Error('ECONNREFUSED: Connection refused');
  const classifiedNetworkError = service.classifyError(networkError, { service: 'test' });
  console.log('网络错误分类:', classifiedNetworkError);

  // 测试3: 模拟数据库错误
  console.log('\n📊 测试3: 模拟数据库错误');
  const dbError = new Error('MongoServerError: connection timed out');
  const classifiedDbError = service.classifyError(dbError, { service: 'database' });
  console.log('数据库错误分类:', classifiedDbError);

  // 测试4: 模拟连续错误触发熔断器
  console.log('\n📊 测试4: 模拟连续错误触发熔断器');
  for (let i = 0; i < 6; i++) {
    const shouldContinue = service.handleErrorRecovery(classifiedDbError);
    console.log(`错误 ${i + 1}: shouldContinue=${shouldContinue}, consecutiveFailures=${service.errorRecovery.consecutiveFailures}, circuitBreaker=${service.errorRecovery.circuitBreaker}`);
  }

  // 测试5: 检查熔断器状态
  console.log('\n📊 测试5: 检查熔断器状态');
  const breakerStatus = service.getStatus();
  console.log('熔断器状态:', {
    circuitBreakerActive: breakerStatus.errorRecovery.circuitBreakerActive,
    timeUntilReset: breakerStatus.errorRecovery.timeUntilReset,
    consecutiveFailures: breakerStatus.errorRecovery.consecutiveFailures
  });

  // 测试6: 模拟可重试错误
  console.log('\n📊 测试6: 模拟可重试错误');
  const parseError = new Error('Failed to parse HTML content');
  const classifiedParseError = service.classifyError(parseError, { check: 'content' });
  console.log('解析错误分类:', classifiedParseError);

  const shouldContinueParse = service.handleErrorRecovery(classifiedParseError);
  console.log(`解析错误处理: shouldContinue=${shouldContinueParse}`);

  console.log('\n✅ 错误处理机制测试完成');
}

// 运行测试
if (require.main === module) {
  testErrorHandling().catch(console.error);
}

module.exports = { testErrorHandling };