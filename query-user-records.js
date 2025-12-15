// 查询用户记录
const mongoose = require('mongoose');
const ImageReview = require('./server/models/ImageReview');

async function queryUserRecords() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
    console.log('✅ 数据库连接成功');

    // 查询user001的记录
    const user001Records = await ImageReview.find({userId: '693d1993b99190589106436b'});
    console.log(`👤 user001的记录数量: ${user001Records.length}`);
    user001Records.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.imageType} - ${r.status} - ${r.createdAt}`);
    });

    // 查询test_user的记录
    const testUserRecords = await ImageReview.find({userId: '69369fe48c8decf4cd0b92af'});
    console.log(`\n👤 test_user的记录数量: ${testUserRecords.length}`);
    testUserRecords.forEach((r, i) => {
      console.log(`  ${i+1}. ${r.imageType} - ${r.status} - ${r.createdAt}`);
    });

    // 总记录数
    const totalRecords = await ImageReview.countDocuments({});
    console.log(`\n📊 数据库总记录数: ${totalRecords}`);

    await mongoose.disconnect();

  } catch (error) {
    console.error('❌ 查询失败:', error);
  }
}

queryUserRecords();