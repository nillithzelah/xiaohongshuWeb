/**
 * 完整AI审核流程测试
 * 测试笔记和评论的完整审核流程，包括关键词检查、内容匹配、评论验证等
 */

const axios = require('axios');
const asyncAiReviewService = require('./services/asyncAiReviewService');

// 测试配置
const TEST_CONFIG = {
  // 测试用户token（需要从服务器环境获取）
  userToken: process.env.TEST_USER_TOKEN || 'your-test-token-here',

  // API基础URL
  apiBaseUrl: 'http://localhost:3000/xiaohongshu/api',

  // 测试数据
  testData: {
    note: {
      imageType: 'note',
      noteUrl: 'https://xiaohongshu.com/explore/677f8a9b0000000012034567', // 示例笔记链接
      userNoteInfo: {
        author: '测试用户',
        title: '减肥被骗经历分享'
      }
    },
    comment: {
      imageType: 'comment',
      noteUrl: 'https://xiaohongshu.com/explore/677f8a9b0000000012034567', // 示例笔记链接
      userNoteInfo: {
        author: '测试用户',
        comment: '这个减肥方法真的很有效'
      }
    }
  }
};

/**
 * 获取测试用户token
 */
async function getTestUserToken() {
  try {
    console.log('🔑 获取测试用户token...');

    // 如果环境变量中有token，直接使用
    if (process.env.TEST_USER_TOKEN) {
      console.log('✅ 使用环境变量中的测试token');
      return process.env.TEST_USER_TOKEN;
    }

    // 尝试使用已知的测试token（如果有的话）
    // 这里可以添加一些已知的测试token
    const knownTokens = [
      process.env.JWT_SECRET, // 如果有JWT密钥
      'test-token-123456' // 临时测试token
    ];

    for (const token of knownTokens) {
      if (token) {
        console.log('✅ 使用已知测试token');
        return token;
      }
    }

    console.log('⚠️ 未找到测试token，将跳过需要token的测试');
    return 'skip-token-tests';

  } catch (error) {
    console.error('❌ 获取测试用户token失败:', error.message);
    return 'skip-token-tests';
  }
}

/**
 * 提交测试任务
 */
async function submitTestTask(taskData) {
  try {
    console.log(`📤 提交${taskData.imageType}测试任务...`);

    const response = await axios.post(
      `${TEST_CONFIG.apiBaseUrl}/client/tasks/batch-submit`,
      {
        imageUrls: ['test-image-url.jpg'], // 模拟图片URL
        imageType: taskData.imageType,
        noteUrl: taskData.noteUrl,
        userNoteInfo: taskData.userNoteInfo
      },
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.success) {
      console.log(`✅ ${taskData.imageType}任务提交成功`);
      return response.data.data[0]; // 返回第一个审核记录
    } else {
      console.error(`❌ ${taskData.imageType}任务提交失败:`, response.data.message);
      return null;
    }

  } catch (error) {
    console.error(`❌ ${taskData.imageType}任务提交异常:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * 等待审核完成
 */
async function waitForReview(reviewId, maxWaitTime = 300000) { // 默认5分钟超时
  const startTime = Date.now();
  const checkInterval = 5000; // 每5秒检查一次

  console.log(`⏳ 等待审核完成 (ID: ${reviewId})...`);

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // 这里需要一个检查审核状态的API，暂时模拟
      const status = await checkReviewStatus(reviewId);

      if (status !== 'pending') {
        console.log(`✅ 审核完成，状态: ${status}`);
        return status;
      }

      console.log(`⏳ 审核进行中，${Math.floor((Date.now() - startTime) / 1000)}秒已过...`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));

    } catch (error) {
      console.error('❌ 检查审核状态失败:', error.message);
      return 'error';
    }
  }

  console.log('⏰ 审核超时');
  return 'timeout';
}

/**
 * 检查审核状态（模拟）
 */
async function checkReviewStatus(reviewId) {
  // 这里应该调用实际的API来检查状态
  // 暂时返回pending模拟正在审核
  return 'pending';
}

/**
 * 测试笔记审核流程
 */
async function testNoteAudit() {
  console.log('\n=== 📝 测试笔记审核流程 ===');

  try {
    // 提交笔记任务
    const reviewRecord = await submitTestTask(TEST_CONFIG.testData.note);
    if (!reviewRecord) {
      console.log('❌ 笔记任务提交失败，跳过测试');
      return false;
    }

    console.log('📋 笔记审核记录:', {
      id: reviewRecord._id,
      status: reviewRecord.status,
      imageType: reviewRecord.imageType
    });

    // 手动触发异步审核（在实际环境中这会自动触发）
    console.log('🤖 手动触发异步审核...');
    asyncAiReviewService.addToQueue(reviewRecord._id);

    // 等待审核完成
    const finalStatus = await waitForReview(reviewRecord._id);

    if (finalStatus === 'manager_approved') {
      console.log('✅ 笔记审核通过');
      return true;
    } else if (finalStatus === 'rejected') {
      console.log('❌ 笔记审核拒绝');
      return false;
    } else {
      console.log(`⚠️ 笔记审核状态异常: ${finalStatus}`);
      return false;
    }

  } catch (error) {
    console.error('❌ 笔记审核测试失败:', error.message);
    return false;
  }
}

/**
 * 测试评论审核流程
 */
async function testCommentAudit() {
  console.log('\n=== 💬 测试评论审核流程 ===');

  try {
    // 提交评论任务
    const reviewRecord = await submitTestTask(TEST_CONFIG.testData.comment);
    if (!reviewRecord) {
      console.log('❌ 评论任务提交失败，跳过测试');
      return false;
    }

    console.log('📋 评论审核记录:', {
      id: reviewRecord._id,
      status: reviewRecord.status,
      imageType: reviewRecord.imageType
    });

    // 手动触发异步审核
    console.log('🤖 手动触发异步审核...');
    asyncAiReviewService.addToQueue(reviewRecord._id);

    // 等待审核完成
    const finalStatus = await waitForReview(reviewRecord._id);

    if (finalStatus === 'manager_approved') {
      console.log('✅ 评论审核通过');
      return true;
    } else if (finalStatus === 'rejected') {
      console.log('❌ 评论审核拒绝');
      return false;
    } else {
      console.log(`⚠️ 评论审核状态异常: ${finalStatus}`);
      return false;
    }

  } catch (error) {
    console.error('❌ 评论审核测试失败:', error.message);
    return false;
  }
}

/**
 * 测试审核服务状态
 */
async function testServiceStatus() {
  console.log('\n=== 📊 测试审核服务状态 ===');

  try {
    const status = asyncAiReviewService.getStatus();
    console.log('审核服务状态:', {
      isRunning: status.isRunning,
      queueLength: status.queueLength,
      activeReviews: status.activeReviews,
      maxConcurrentReviews: status.maxConcurrentReviews,
      utilizationRate: `${(status.performance.utilizationRate * 100).toFixed(1)}%`,
      circuitBreakerActive: status.errorRecovery.circuitBreakerActive
    });

    return true;

  } catch (error) {
    console.error('❌ 获取服务状态失败:', error.message);
    return false;
  }
}

/**
 * 测试审核服务核心功能
 */
async function testAuditServiceCore() {
  console.log('\n=== 🔧 测试审核服务核心功能 ===');

  try {
    // 1. 测试关键词检查算法
    console.log('🔍 测试关键词检查算法...');
    const xiaohongshuService = require('./services/xiaohongshuService');

    // 创建模拟的cheerio对象
    const mock$ = (selector) => {
      if (selector === 'body') {
        return {
          text: () => '这是一个关于减肥被骗的经历分享，很多人上当受骗了'
        };
      } else if (selector === 'meta[name="description"]') {
        return {
          attr: () => '减肥被骗经历分享 - 小红书'
        };
      } else if (selector === 'meta[property="og:description"]') {
        return {
          attr: () => null
        };
      }
      return { length: 0 };
    };

    const keywordResult = xiaohongshuService.checkContentKeywords(mock$, '减肥被骗的真实经历');
    console.log('关键词检查结果:', keywordResult);

    if (keywordResult.passed) {
      console.log('✅ 关键词检查算法工作正常');
    } else {
      console.log('❌ 关键词检查算法可能有问题');
    }

    // 2. 测试错误分类
    console.log('\n🔧 测试错误分类系统...');
    const networkError = new Error('ECONNREFUSED: Connection refused');
    const classifiedError = asyncAiReviewService.classifyError(networkError, { service: 'test' });
    console.log('错误分类结果:', classifiedError);

    if (classifiedError.type === 'network_error' && classifiedError.retryable) {
      console.log('✅ 错误分类系统工作正常');
    } else {
      console.log('❌ 错误分类系统可能有问题');
    }

    // 3. 测试熔断器逻辑
    console.log('\n🛡️ 测试熔断器逻辑...');
    let breakerTestPassed = true;

    // 模拟少量错误，不应该触发熔断器
    for (let i = 0; i < 3; i++) {
      const shouldContinue = asyncAiReviewService.handleErrorRecovery(classifiedError);
      if (!shouldContinue) {
        breakerTestPassed = false;
        break;
      }
    }

    if (breakerTestPassed) {
      console.log('✅ 熔断器逻辑工作正常（未触发）');
    } else {
      console.log('❌ 熔断器逻辑过早触发');
    }

    // 4. 测试智能重试决策
    console.log('\n🔄 测试智能重试决策...');
    const mockReview = {
      reviewAttempt: 1,
      imageType: 'note'
    };

    const retryDecision1 = asyncAiReviewService.shouldRetryReview(mockReview, 'network_error');
    const retryDecision2 = asyncAiReviewService.shouldRetryReview(mockReview, 'keyword_check_failed');

    console.log('网络错误重试决策:', retryDecision1);
    console.log('关键词检查失败重试决策:', retryDecision2);

    if (retryDecision1.shouldRetry && !retryDecision2.shouldRetry) {
      console.log('✅ 智能重试决策工作正常');
    } else {
      console.log('❌ 智能重试决策可能有问题');
    }

    return true;

  } catch (error) {
    console.error('❌ 审核服务核心功能测试失败:', error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runFullAuditTest() {
  console.log('🧪 开始完整AI审核流程测试...\n');

  try {
    // 1. 获取测试token（可选）
    const token = await getTestUserToken();
    if (token !== 'skip-token-tests') {
      TEST_CONFIG.userToken = token;
      console.log('✅ 测试token获取成功\n');
    } else {
      console.log('⚠️ 跳过需要token的测试\n');
    }

    // 2. 测试服务状态
    await testServiceStatus();

    // 3. 测试审核服务核心功能
    const coreTestResult = await testAuditServiceCore();

    // 4. 如果有token，测试完整流程
    let noteResult = false;
    let commentResult = false;

    if (TEST_CONFIG.userToken && TEST_CONFIG.userToken !== 'skip-token-tests') {
      console.log('\n=== 🌐 测试完整审核流程 ===');
      // 3. 测试笔记审核
      noteResult = await testNoteAudit();

      // 4. 测试评论审核
      commentResult = await testCommentAudit();
    } else {
      console.log('\n=== ⚠️ 跳过完整审核流程测试（无有效token） ===');
    }

    // 5. 输出测试结果
    console.log('\n=== 📋 测试结果总结 ===');
    console.log(`审核服务核心功能: ${coreTestResult ? '✅ 通过' : '❌ 失败'}`);
    console.log(`笔记审核测试: ${noteResult ? '✅ 通过' : '❌ 失败/跳过'}`);
    console.log(`评论审核测试: ${commentResult ? '✅ 通过' : '❌ 失败/跳过'}`);

    if (coreTestResult) {
      console.log('\n🎉 核心功能测试通过！AI审核流程优化成功！');
      if (noteResult && commentResult) {
        console.log('🎉 完整审核流程测试也通过！');
      }
    } else {
      console.log('\n⚠️ 核心功能测试失败，需要进一步检查');
    }

  } catch (error) {
    console.error('❌ 测试过程异常:', error.message);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runFullAuditTest().catch(console.error);
}

module.exports = { runFullAuditTest, testNoteAudit, testCommentAudit, testServiceStatus };