// 测试批量上传和提交接口
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// 测试配置
const BASE_URL = 'http://localhost:3000'; // 假设服务器运行在3000端口
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjM0YmQ1ZDk2NzYxMDAwMDAwMDAwMCIsInVzZXJuYW1lIjoidGVzdF91c2VyIiwiaWF0IjoxNjgxMjM0NTY3LCJleHAiOjE2ODE4NDAxNjd9.abc123def456ghi789';

// 测试图片路径（使用现有的测试图片）
const testImagePath = path.join(__dirname, 'server', 'test-image.jpg');

async function testBatchUpload() {
  console.log('🧪 测试批量上传接口...');

  try {
    // 检查测试图片是否存在
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 测试图片不存在:', testImagePath);
      return null;
    }

    // 创建FormData，模拟多文件上传
    const form = new FormData();
    form.append('files', fs.createReadStream(testImagePath), 'test1.jpg');
    form.append('files', fs.createReadStream(testImagePath), 'test2.jpg');

    const response = await axios.post(`${BASE_URL}/xiaohongshu/api/upload/images`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      timeout: 30000
    });

    console.log('✅ 批量上传成功:', response.data);
    return response.data.data.urls;

  } catch (error) {
    console.error('❌ 批量上传失败:', error.response?.data || error.message);
    return null;
  }
}

async function testBatchSubmit(imageUrls) {
  console.log('🧪 测试批量提交接口...');

  if (!imageUrls || imageUrls.length === 0) {
    console.log('❌ 没有图片URL，跳过提交测试');
    return;
  }

  try {
    // 生成对应的MD5（简化版）
    const imageMd5s = imageUrls.map(() => 'test_md5_' + Date.now() + Math.random());

    const response = await axios.post(`${BASE_URL}/xiaohongshu/api/client/tasks/batch-submit`, {
      deviceId: 'device_001', // 使用测试设备ID
      imageType: 'note',
      imageUrls: imageUrls,
      imageMd5s: imageMd5s
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ 批量提交成功:', response.data);

  } catch (error) {
    console.error('❌ 批量提交失败:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('🚀 开始测试批量API接口...\n');

  // 测试批量上传
  const imageUrls = await testBatchUpload();

  if (imageUrls) {
    console.log('\n📤 测试批量提交...');
    await testBatchSubmit(imageUrls);
  }

  console.log('\n✨ 测试完成');
}

// 运行测试
runTests().catch(console.error);