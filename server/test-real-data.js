/**
 * 使用真实数据测试审核流程
 */

const asyncAiReviewService = require('./services/asyncAiReviewService');
const xiaohongshuService = require('./services/xiaohongshuService');

/**
 * 创建真实数据的审核记录
 */
async function createRealReviewRecord(imageType, noteUrl, userNoteInfo) {
  try {
    console.log(`📝 创建真实数据${imageType}审核记录...`);

    const mockReview = {
      _id: '507f1f77bcf86cd799439011', // 模拟ID
      imageType,
      noteUrl,
      userNoteInfo,
      status: 'pending',
      reviewAttempt: 1,
      createdAt: new Date(),
      userId: {
        _id: '507f1f77bcf86cd799439012' // 模拟用户ID
      },
      populate: function() { return this; } // 模拟populate方法
    };

    console.log('✅ 真实数据审核记录创建成功:', {
      id: mockReview._id,
      type: mockReview.imageType,
      url: mockReview.noteUrl,
      title: mockReview.userNoteInfo.title,
      author: mockReview.userNoteInfo.author
    });

    return mockReview;

  } catch (error) {
    console.error('❌ 创建真实数据审核记录失败:', error.message);
    return null;
  }
}

/**
 * 测试真实数据的审核流程
 */
async function testRealDataAudit(imageType, noteUrl, userNoteInfo) {
  console.log(`\n=== 🔍 测试真实数据${imageType}审核流程 ===`);
  console.log(`链接: ${noteUrl}`);
  console.log(`标题: ${userNoteInfo.title}`);
  console.log(`作者: ${userNoteInfo.author}`);

  try {
    // 1. 创建真实数据审核记录
    const mockReview = await createRealReviewRecord(imageType, noteUrl, userNoteInfo);
    if (!mockReview) {
      console.log('❌ 真实数据审核记录创建失败');
      return false;
    }

    // 2. 执行完整的审核逻辑（包括真实的网络请求）
    console.log('🤖 执行完整审核逻辑（包含真实网络请求）...');
    const aiReviewResult = await asyncAiReviewService.performFullAiReview(mockReview);

    console.log('📊 审核结果:', {
      valid: aiReviewResult.valid,
      passed: aiReviewResult.aiReview?.passed,
      confidence: aiReviewResult.aiReview?.confidence,
      reasons: aiReviewResult.aiReview?.reasons,
      riskLevel: aiReviewResult.aiReview?.riskLevel
    });

    // 3. 检查审核是否通过
    if (aiReviewResult.valid && aiReviewResult.aiReview?.passed && aiReviewResult.aiReview?.confidence >= 0.7) {
      console.log('✅ 审核通过！');
      return true;
    } else {
      console.log('❌ 审核失败或未通过');
      console.log('失败原因:', aiReviewResult.aiReview?.reasons);
      return false;
    }

  } catch (error) {
    console.error('❌ 真实数据审核测试失败:', error.message);
    return false;
  }
}

/**
 * 测试笔记内容解析
 */
async function testNoteParsing(noteUrl) {
  console.log(`\n=== 📄 测试笔记内容解析 ===`);
  console.log(`链接: ${noteUrl}`);

  try {
    const parseResult = await xiaohongshuService.parseNoteContent(noteUrl);
    console.log('解析结果:', {
      success: parseResult.success,
      title: parseResult.title,
      author: parseResult.author,
      hasKeywordCheck: !!parseResult.keywordCheck
    });

    if (parseResult.keywordCheck) {
      console.log('关键词检查结果:', parseResult.keywordCheck);
    }

    return parseResult;

  } catch (error) {
    console.error('❌ 笔记内容解析测试失败:', error.message);
    return null;
  }
}

/**
 * 主测试函数 - 使用真实数据
 */
async function runRealDataTest() {
  console.log('🧪 开始使用真实数据测试审核流程...\n');

  // 真实数据
  const realData = {
    noteUrl1: 'https://www.xiaohongshu.com/discovery/item/69313f83000000001e00d8a5?source=webshare&xhsshare=pc_web&xsec_token=ABHilTsrXzpb0UkHRsVwaUkKIUhhMAqpJYPy6SeZ-LWdo=&xsec_source=pc_share',
    noteUrl2: 'https://www.xiaohongshu.com/explore/6949743a000000001f00a279?xsec_token=ABhykXM8RRjP0DbgR-us92VAdPgyrWLMPnNSElFWJlu_g=&xsec_source=pc_user',
    title: '广州健康管理中心就是坑人！别买我要回来了',
    author: '阳 77'
  };

  try {
    // 1. 先测试笔记内容解析
    console.log('=== 第一步：测试笔记内容解析 ===');
    const parseResult1 = await testNoteParsing(realData.noteUrl1);
    const parseResult2 = await testNoteParsing(realData.noteUrl2);

    // 2. 测试笔记审核
    console.log('\n=== 第二步：测试笔记审核 ===');
    const noteTest1 = await testRealDataAudit('note', realData.noteUrl1, {
      author: realData.author,
      title: realData.title
    });

    const noteTest2 = await testRealDataAudit('note', realData.noteUrl2, {
      author: realData.author,
      title: realData.title
    });

    // 3. 测试评论审核（如果有评论内容）
    console.log('\n=== 第三步：测试评论审核 ===');
    const commentTest1 = await testRealDataAudit('comment', realData.noteUrl1, {
      author: realData.author,
      comment: '这个广州健康管理中心真的坑人，大家别去买了'
    });

    const commentTest2 = await testRealDataAudit('comment', realData.noteUrl2, {
      author: realData.author,
      comment: '别买我要回来了，真的太坑了'
    });

    // 4. 输出测试结果
    console.log('\n=== 📋 真实数据测试结果 ===');
    console.log(`笔记1解析: ${parseResult1?.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`笔记2解析: ${parseResult2?.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`笔记1审核: ${noteTest1 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`笔记2审核: ${noteTest2 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`评论1审核: ${commentTest1 ? '✅ 通过' : '❌ 失败'}`);
    console.log(`评论2审核: ${commentTest2 ? '✅ 通过' : '❌ 失败'}`);

    const allPassed = noteTest1 && noteTest2 && commentTest1 && commentTest2;

    if (allPassed) {
      console.log('\n🎉 所有真实数据审核测试通过！审核系统工作正常！');
    } else {
      console.log('\n⚠️ 部分测试失败，需要进一步检查审核逻辑或网络连接');
    }

    return allPassed;

  } catch (error) {
    console.error('❌ 真实数据测试过程异常:', error.message);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  runRealDataTest().catch(console.error);
}

module.exports = { runRealDataTest, testRealDataAudit, testNoteParsing };