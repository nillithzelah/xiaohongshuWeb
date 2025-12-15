const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

// 配置
const SERVER_URL = 'http://localhost:5000';
const TEST_IMAGE_PATH = '/var/www/html/games/images/一箱一世界.png'; // 使用服务器上的游戏图片

// 测试上传接口1：/upload/image (使用multer)
async function testUploadImage() {
  try {
    console.log('🧪 测试上传接口1：/upload/image');

    // 检查测试图片是否存在
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.log('❌ 测试图片不存在，路径:', TEST_IMAGE_PATH);
      return;
    }

    const form = new FormData();
    form.append('file', fs.createReadStream(TEST_IMAGE_PATH));

    const response = await axios.post(`${SERVER_URL}/xiaohongshu/api/upload/image`, form, {
      headers: {
        ...form.getHeaders(),
        'Content-Type': 'multipart/form-data'
      },
      timeout: 10000 // 10秒超时
    });

    console.log('✅ 上传成功，响应:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ 上传失败:', error.response?.data || error.message);
    if (error.code === 'ECONNRESET') {
      console.log('🔍 连接被重置，可能服务器未正确响应');
    }
    return null;
  }
}

// 测试上传接口2：/client/upload (使用Base64)
async function testClientUpload() {
  try {
    console.log('🧪 测试上传接口2：/client/upload');

    // 读取图片并转换为Base64
    const imageData = fs.readFileSync(TEST_IMAGE_PATH, { encoding: 'base64' });

    const response = await axios.post(`${SERVER_URL}/xiaohongshu/api/client/upload`, {
      imageData: imageData
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超时
    });

    console.log('✅ 上传成功，响应:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ 上传失败:', error.response?.data || error.message);
    return null;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始测试阿里OSS上传服务...');
  console.log('=================================');

  // 执行测试
  const result1 = await testUploadImage();
  console.log('---------------------------------');
  const result2 = await testClientUpload();

  console.log('=================================');
  console.log('📊 测试完成！');

  if (result1 || result2) {
    console.log('✅ 阿里OSS服务可用，图片上传成功！');
  } else {
    console.log('❌ 阿里OSS服务可能不可用，请检查配置和网络');
  }
}

// 运行测试
main();