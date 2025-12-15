// 检查数据库中的多图数据
const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');
require('dotenv').config();

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit');
  console.log('✅ 数据库连接成功');
}

async function checkMultiImageData() {
  console.log('\n🔍 检查数据库中的多图数据...\n');

  // 获取所有记录
  const allRecords = await ImageReview.find({})
    .select('imageUrls imageMd5s imageUrl image_md5 imageType status createdAt')
    .sort({ createdAt: -1 });

  console.log(`📊 总记录数: ${allRecords.length}\n`);

  // 分类统计
  let multiImageRecords = [];
  let singleImageRecords = [];
  let emptyRecords = [];

  allRecords.forEach(record => {
    const hasImageUrls = record.imageUrls && Array.isArray(record.imageUrls) && record.imageUrls.length > 0;
    const hasImageUrl = record.imageUrl && typeof record.imageUrl === 'string' && record.imageUrl.trim();

    if (hasImageUrls) {
      multiImageRecords.push(record);
    } else if (hasImageUrl) {
      singleImageRecords.push(record);
    } else {
      emptyRecords.push(record);
    }
  });

  console.log('📈 数据分类统计:');
  console.log(`  🖼️  多图记录: ${multiImageRecords.length} 条`);
  console.log(`  🖼️  单图记录: ${singleImageRecords.length} 条`);
  console.log(`  📭 空记录: ${emptyRecords.length} 条\n`);

  // 显示多图记录详情
  if (multiImageRecords.length > 0) {
    console.log('🎯 多图记录详情:');
    multiImageRecords.forEach((record, index) => {
      console.log(`\n  ${index + 1}. ID: ${record._id.toString().slice(-8)}`);
      console.log(`     类型: ${record.imageType}`);
      console.log(`     状态: ${record.status}`);
      console.log(`     图片数量: ${record.imageUrls.length}`);
      console.log(`     URLs: [${record.imageUrls.map(url => url && url.split ? url.split('/').pop() : 'null').join(', ')}]`);
      console.log(`     MD5s: [${record.imageMd5s.map(md5 => md5.slice(0, 16) + '...').join(', ')}]`);
    });
    console.log('');
  }

  // 显示单图记录样例
  if (singleImageRecords.length > 0) {
    console.log('📝 单图记录样例:');
    const sample = singleImageRecords[0];
    console.log(`  ID: ${sample._id.toString().slice(-8)}`);
    console.log(`  类型: ${sample.imageType}`);
    console.log(`  状态: ${sample.status}`);
    console.log(`  imageUrl: ${sample.imageUrl ? sample.imageUrl.split('/').pop() : 'null'}`);
    console.log(`  image_md5: ${sample.image_md5 ? sample.image_md5.slice(0, 16) + '...' : 'null'}`);
    console.log(`  (共 ${singleImageRecords.length} 条单图记录)\n`);
  }

  // 数据结构验证
  console.log('🔧 数据结构验证:');
  const validationResults = {
    hasImageUrlsField: allRecords.every(r => r.imageUrls !== undefined),
    imageUrlsAreArrays: allRecords.every(r => !r.imageUrls || Array.isArray(r.imageUrls)),
    md5sMatchUrls: allRecords.every(r => !r.imageUrls || !r.imageMd5s || r.imageUrls.length === r.imageMd5s.length),
    noOldFields: allRecords.every(r => !r.imageUrl && !r.image_md5)
  };

  Object.entries(validationResults).forEach(([check, result]) => {
    const status = result ? '✅' : '❌';
    console.log(`  ${status} ${check.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
  });

  console.log('\n📋 结论:');
  if (multiImageRecords.length > 0 && validationResults.hasImageUrlsField) {
    console.log('✅ 数据库已成功转换为多图格式！');
    console.log(`✅ 包含 ${multiImageRecords.length} 条多图记录可用于测试`);
  } else {
    console.log('❌ 数据库格式存在问题');
  }
}

async function main() {
  try {
    await connectDB();
    await checkMultiImageData();
    console.log('✅ 数据库检查完成');
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    process.exit(0);
  }
}

main();