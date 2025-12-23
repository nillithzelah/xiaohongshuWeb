// 测试服务器上传功能
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

async function testUpload() {
  try {
    console.log('🔍 测试服务器上传功能...');

    // 检查是否有测试图片
    const testImagePath = './server/test-image.jpg';
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 没有找到测试图片文件');
      return;
    }

    // 创建 FormData
    const form = new FormData();
    form.append('file', fs.createReadStream(testImagePath), {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg'
    });

    // 发送请求到服务器
    const response = await axios.post('http://112.74.163.102:5000/xiaohongshu/api/upload/image', form, {
      headers: {
        ...form.getHeaders(),
        // 这里需要一个有效的 token
        'Authorization': 'Bearer YOUR_TEST_TOKEN'
      },
      timeout: 30000
    });

    console.log('✅ 上传响应:', response.data);

  } catch (error) {
    console.error('❌ 上传测试失败:', error.response?.data || error.message);
  }
}

testUpload();
