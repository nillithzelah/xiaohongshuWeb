const mongoose = require('mongoose');
const ImageReview = require('../models/ImageReview');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const OSS = require('ali-oss');

// 创建temp目录用于存储下载的图片
const tempDir = path.join(__dirname, 'temp_images');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

async function downloadImage(url, filename) {
  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream'
    });

    const filePath = path.join(tempDir, filename);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filePath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`❌ 下载图片失败 ${url}:`, error.message);
    return null;
  }
}

async function uploadToOSS(filePath, originalUrl) {
  try {
    // 从环境变量获取OSS配置
    const ossConfig = {
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET
    };

    // 检查OSS配置是否完整
    if (!ossConfig.region || !ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
      throw new Error('OSS配置不完整，无法上传');
    }

    const client = new OSS(ossConfig);

    // 生成OSS文件名
    const fileName = `images/${Date.now()}_${path.basename(filePath)}`;
    const result = await client.put(fileName, filePath);

    if (result.res.status === 200) {
      return result.url;
    } else {
      throw new Error(`OSS上传失败: ${result.res.status}`);
    }
  } catch (error) {
    console.error(`❌ 上传图片到OSS失败 ${filePath}:`, error.message);
    return null;
  }
}

async function migrateImagesToOSS() {
  try {
    console.log('🚀 开始迁移图片到OSS...');
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 连接到数据库');

    // 获取所有图片评论
    const imageReviews = await ImageReview.find({});
    console.log(`📊 找到 ${imageReviews.length} 张图片需要迁移`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < imageReviews.length; i++) {
      const review = imageReviews[i];
      const originalUrl = review.imageUrl;

      // 只处理picsum.photos的图片
      if (!originalUrl.includes('picsum.photos')) {
        console.log(`⏭️ 跳过非picsum图片: ${originalUrl}`);
        continue;
      }

      console.log(`\n🔄 处理图片 ${i+1}/${imageReviews.length}: ${originalUrl}`);

      try {
        // 下载图片
        const filename = `image_${i}_${Date.now()}.jpg`;
        const localPath = await downloadImage(originalUrl, filename);

        if (!localPath) {
          throw new Error('下载图片失败');
        }

        console.log(`✅ 下载成功: ${localPath}`);

        // 上传到OSS
        const ossUrl = await uploadToOSS(localPath, originalUrl);

        if (!ossUrl) {
          throw new Error('上传到OSS失败');
        }

        console.log(`✅ 上传到OSS成功: ${ossUrl}`);

        // 更新数据库
        review.imageUrl = ossUrl;
        await review.save();

        console.log(`✅ 数据库更新成功`);
        successCount++;

        // 删除临时文件
        fs.unlinkSync(localPath);
      } catch (error) {
        console.error(`❌ 处理图片失败: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n📈 迁移完成: 成功 ${successCount} 张, 失败 ${failCount} 张`);
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error.message);
    await mongoose.disconnect();
  }
}

migrateImagesToOSS();