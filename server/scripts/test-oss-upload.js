// 直接加载环境变量而不使用dotenv
const OSS = require('ali-oss');

// 直接使用环境变量
const OSS_ACCESS_KEY_ID = 'REMOVED_ACCESS_KEY';
const OSS_ACCESS_KEY_SECRET = 'REMOVED_SECRET';
const OSS_BUCKET = 'zerobug-img';
const OSS_REGION = 'oss-cn-shenzhen';

console.log('🔑 使用硬编码 OSS 配置:');
console.log('OSS_ACCESS_KEY_ID:', OSS_ACCESS_KEY_ID);
console.log('OSS_ACCESS_KEY_SECRET:', '***REDACTED***');
console.log('OSS_BUCKET:', OSS_BUCKET);
console.log('OSS_REGION:', OSS_REGION);

const client = new OSS({
  region: OSS_REGION,
  accessKeyId: OSS_ACCESS_KEY_ID,
  accessKeySecret: OSS_ACCESS_KEY_SECRET,
  bucket: OSS_BUCKET,
  secure: true
});

const localFilePath = 'test-image.jpg';
const ossTargetPath = 'test/background-from-server.jpg';

async function testOSSUpload() {
  try {
    console.log('开始上传文件到 OSS...');
    const result = await client.put(ossTargetPath, localFilePath);

    console.log('✅ [SUCCESS] 上传成功！');
    console.log('返回的 URL:', result.url);

    // 验证 URL 格式 (阿里云 OSS SDK 返回的 URL 可能是 http，但我们强制转换为 https)
    const httpsUrl = result.url.replace('http://', 'https://');
    if (httpsUrl && httpsUrl.startsWith('https://zerobug-img.oss-cn-shenzhen.aliyuncs.com')) {
      console.log('✅ [VALIDATION SUCCESS] URL 格式正确！');
      console.log('最终 URL:', httpsUrl);
    } else {
      console.log('❌ [VALIDATION FAILED] URL 格式不正确！');
      console.log('原始 URL:', result.url);
    }
  } catch (error) {
    console.log('❌ [UPLOAD FAILED] 上传失败:', error.message);
    console.error('详细错误信息:', error);
  }
}

testOSSUpload();