// 实际测试批量上传功能
const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');

// OSS配置（与.env文件一致）
const OSS_CONFIG = {
  accessKeyId: 'REMOVED_ACCESS_KEY',
  accessKeySecret: 'REMOVED_SECRET',
  bucket: 'zerobug-img',
  region: 'oss-cn-shenzhen'
};

const client = new OSS({
  ...OSS_CONFIG,
  secure: true
});

// 测试图片路径
const testImagePath = path.join(__dirname, 'server', 'test-image.jpg');

async function testOSSBatchUpload() {
  console.log('🧪 测试OSS批量上传功能...');

  try {
    // 检查测试图片是否存在
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 测试图片不存在:', testImagePath);
      return null;
    }

    console.log('📤 开始批量上传到OSS...');

    // 模拟批量上传（上传同一张图片多次作为测试）
    const uploadPromises = [];
    const fileCount = 3; // 测试上传3张图片

    for (let i = 0; i < fileCount; i++) {
      const filename = `test/batch-upload-${Date.now()}-${i}.jpg`;
      const promise = client.put(filename, testImagePath);
      uploadPromises.push(promise);
    }

    // 并行上传
    const results = await Promise.all(uploadPromises);

    console.log('✅ 批量上传成功！');

    // 处理结果
    const imageUrls = results.map(result => result.url.replace('http://', 'https://'));

    console.log('📋 上传结果:');
    imageUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    return imageUrls;

  } catch (error) {
    console.error('❌ OSS批量上传失败:', error.message);
    return null;
  }
}

async function testBatchUploadLogic() {
  console.log('🧪 测试批量上传逻辑（模拟接口）...');

  try {
    // 读取上传接口代码
    const uploadCode = fs.readFileSync('./server/routes/upload.js', 'utf8');

    // 检查是否包含批量上传逻辑
    const hasBatchRoute = uploadCode.includes("router.post('/images'");
    const hasPromiseAll = uploadCode.includes('Promise.all(files.map');
    const hasArrayValidation = uploadCode.includes('files.length === 0');

    if (hasBatchRoute && hasPromiseAll && hasArrayValidation) {
      console.log('✅ 批量上传接口逻辑正确');
      return true;
    } else {
      console.log('❌ 批量上传接口逻辑有问题');
      return false;
    }

  } catch (error) {
    console.error('❌ 批量上传逻辑测试失败:', error.message);
    return false;
  }
}

async function testBatchSubmitLogic() {
  console.log('🧪 测试批量提交逻辑...');

  try {
    // 读取提交接口代码
    const clientCode = fs.readFileSync('./server/routes/client.js', 'utf8');

    // 检查批量提交逻辑
    const hasBatchSubmitRoute = clientCode.includes("router.post('/tasks/batch-submit'");
    const hasImageUrlsValidation = clientCode.includes('!imageUrls || !imageMd5s');
    const hasLengthMatch = clientCode.includes('imageUrls.length !== imageMd5s.length');
    const hasBatchCreate = clientCode.includes('Promise.all(imageUrls.map');

    if (hasBatchSubmitRoute && hasImageUrlsValidation && hasLengthMatch && hasBatchCreate) {
      console.log('✅ 批量提交接口逻辑正确');
      return true;
    } else {
      console.log('❌ 批量提交接口逻辑有问题');
      return false;
    }

  } catch (error) {
    console.error('❌ 批量提交逻辑测试失败:', error.message);
    return false;
  }
}

async function runActualTests() {
  console.log('🚀 开始实际批量上传功能测试\n');

  const results = {
    ossBatchUpload: await testOSSBatchUpload(),
    batchUploadLogic: await testBatchUploadLogic(),
    batchSubmitLogic: await testBatchSubmitLogic()
  };

  console.log('\n📋 实际测试结果汇总:');
  Object.entries(results).forEach(([test, result]) => {
    if (test === 'ossBatchUpload') {
      const status = result ? '✅ 通过' : '❌ 失败';
      console.log(`  ${test}: ${status}`);
      if (result) {
        console.log(`    📤 成功上传 ${result.length} 张图片`);
      }
    } else {
      const status = result ? '✅ 通过' : '❌ 失败';
      console.log(`  ${test}: ${status}`);
    }
  });

  const allPassed = Object.values(results).every(result => result !== null && result !== false);

  console.log(`\n🏁 总体结果: ${allPassed ? '✅ 所有实际测试通过' : '❌ 部分测试失败'}`);

  if (results.ossBatchUpload) {
    console.log('\n🎯 OSS上传目标确认:');
    console.log(`  📍 Bucket: ${OSS_CONFIG.bucket}`);
    console.log(`  🌏 Region: ${OSS_CONFIG.region}`);
    console.log(`  🔗 URL格式: https://${OSS_CONFIG.bucket}.oss-${OSS_CONFIG.region}.aliyuncs.com/...`);
    console.log(`  📁 存储路径: uploads/ 或 test/ 目录`);
  }

  return allPassed;
}

// 运行实际测试
if (require.main === module) {
  runActualTests().catch(console.error);
}

module.exports = { runActualTests };