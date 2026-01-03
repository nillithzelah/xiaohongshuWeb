const axios = require('axios');

const API_BASE = 'http://localhost:5000/xiaohongshu/api/client';

// 测试用的用户token
const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTUyNTE4NzE3Y2QwZTQzMjJmZWQ0MzciLCJ1c2VybmFtZSI6ImZlbmciLCJyb2xlIjoicGFydF90aW1lIiwiaWF0IjoxNzY3MzE4OTA5LCJleHAiOjE3Njc0MDUzMDl9.FrspwHfkKvuER6aP6NGSoGClu30yDD7bhcbV3p1tebY';

async function testAiReview() {
  console.log('🤖 开始测试AI审核流程...\n');

  try {
    // 1. 提交笔记审核任务
    console.log('📝 1. 提交笔记审核任务...');
    const noteData = {
      imageType: 'note',
      noteUrl: 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=',
      userNoteInfo: {
        title: '减肥被骗要回来了姐妹们别买了，亲测没用',
        author: '阳 77'
      },
      deviceInfo: {
        accountName: 'test_device'
      }
    };

    const submitResponse = await axios.post(`${API_BASE}/task/submit`, noteData, {
      headers: {
        'Authorization': `Bearer ${USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (submitResponse.data.success) {
      const reviewId = submitResponse.data.review._id;
      console.log(`✅ 笔记提交成功，审核ID: ${reviewId}`);
      console.log(`📊 初始状态: ${submitResponse.data.review.status}`);

      // 2. 等待AI审核完成
      console.log('\n⏳ 2. 等待AI审核处理...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒

      // 3. 检查审核结果
      console.log('\n📊 3. 检查审核结果...');
      const checkResponse = await axios.get(`${API_BASE}/user/tasks`, {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`
        },
        params: { page: 1, limit: 10 }
      });

      // 找到对应的任务
      const currentReview = checkResponse.data.reviews.find(r => r._id === reviewId);

      console.log(`📋 审核状态: ${currentReview.status}`);
      console.log(`📋 审核尝试次数: ${currentReview.reviewAttempt || 1}`);

      if (currentReview.aiReviewResult) {
        console.log(`🤖 AI审核结果: ${currentReview.aiReviewResult.passed ? '通过' : '失败'}`);
        console.log(`📊 置信度: ${currentReview.aiReviewResult.confidence}`);
        console.log(`💬 原因: ${currentReview.aiReviewResult.reasons?.join(', ')}`);
      }

      if (currentReview.rejectionReason) {
        console.log(`❌ 拒绝原因: ${currentReview.rejectionReason}`);
      }

      // 4. 提交评论审核任务
      console.log('\n💬 4. 提交评论审核任务...');
      const commentData = {
        imageType: 'comment',
        noteUrl: 'https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=',
        userNoteInfo: {
          comment: '这个减肥方法真的有效，我试了之后瘦了5斤',
          author: ['test_user']
        },
        deviceInfo: {
          accountName: 'test_device'
        }
      };

      const commentSubmitResponse = await axios.post(`${API_BASE}/reviews/submit`, commentData, {
        headers: {
          'Authorization': `Bearer ${USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (commentSubmitResponse.data.success) {
        const commentReviewId = commentSubmitResponse.data.review._id;
        console.log(`✅ 评论提交成功，审核ID: ${commentReviewId}`);

        // 等待评论审核
        console.log('\n⏳ 等待评论审核处理...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // 等待15秒

        // 检查评论审核结果
        console.log('\n📊 检查评论审核结果...');
        const commentCheckResponse = await axios.get(`${API_BASE}/user/tasks`, {
          headers: {
            'Authorization': `Bearer ${USER_TOKEN}`
          },
          params: { page: 1, limit: 10 }
        });

        const commentReview = commentCheckResponse.data.reviews.find(r => r._id === commentReviewId);
        console.log(`📋 评论审核状态: ${commentReview.status}`);
        console.log(`📋 评论审核尝试次数: ${commentReview.reviewAttempt || 1}`);

        if (commentReview.aiReviewResult) {
          console.log(`🤖 评论AI审核结果: ${commentReview.aiReviewResult.passed ? '通过' : '失败'}`);
          console.log(`📊 置信度: ${commentReview.aiReviewResult.confidence}`);
          console.log(`💬 原因: ${commentReview.aiReviewResult.reasons?.join(', ')}`);
        }

        if (commentReview.rejectionReason) {
          console.log(`❌ 评论拒绝原因: ${commentReview.rejectionReason}`);
        }
      }

    } else {
      console.log('❌ 提交失败:', submitResponse.data.message);
    }

  } catch (error) {
    console.error('❌ 测试失败:');
    console.error('状态码:', error.response?.status);
    console.error('错误信息:', error.response?.data);
    console.error('完整错误:', error.message);
  }
}

testAiReview();