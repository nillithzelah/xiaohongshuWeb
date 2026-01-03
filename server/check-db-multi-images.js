const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');

async function checkDatabase() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    const count = await ImageReview.countDocuments();
    console.log('📊 总记录数:', count);

    if (count > 0) {
      const sample = await ImageReview.findOne().select('imageUrls imageMd5s imageType');
      console.log('📋 示例记录:');
      console.log(JSON.stringify(sample, null, 2));

      // 检查是否所有记录都是数组格式
      const oldFormatCount = await ImageReview.countDocuments({
        $or: [
          { imageUrls: { $type: 'string' } },
          { imageMd5s: { $type: 'string' } }
        ]
      });

      if (oldFormatCount > 0) {
        console.log(`⚠️  发现 ${oldFormatCount} 条旧格式记录，需要迁移`);
      } else {
        console.log('✅ 所有记录均使用新格式（多图支持）');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库检查失败:', error);
    process.exit(1);
  }
}

checkDatabase();