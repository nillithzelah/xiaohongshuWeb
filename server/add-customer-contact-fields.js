const mongoose = require('mongoose');
const ImageReview = require('./models/ImageReview');

// 连接数据库
async function connectDB() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/xiaohongshu_audit', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// 迁移函数
async function migrateCustomerContactFields() {
  try {
    console.log('开始迁移 customerPhone 和 customerWechat 字段...');

    // 为所有 ImageReview 记录添加 customerPhone 和 customerWechat 字段
    const result = await ImageReview.updateMany(
      {
        'userNoteInfo.customerPhone': { $exists: false },
        'userNoteInfo.customerWechat': { $exists: false }
      },
      {
        $set: {
          'userNoteInfo.customerPhone': '',
          'userNoteInfo.customerWechat': ''
        }
      }
    );

    console.log(`迁移完成，更新了 ${result.modifiedCount} 条记录`);

    // 验证迁移结果
    const sampleRecords = await ImageReview.find({
      'userNoteInfo.customerPhone': { $exists: true },
      'userNoteInfo.customerWechat': { $exists: true }
    }).limit(5);

    console.log('验证迁移结果（前5条记录）：');
    sampleRecords.forEach((record, index) => {
      console.log(`${index + 1}. ID: ${record._id}`);
      console.log(`   customerPhone: "${record.userNoteInfo.customerPhone}"`);
      console.log(`   customerWechat: "${record.userNoteInfo.customerWechat}"`);
    });

  } catch (error) {
    console.error('迁移失败:', error);
  }
}

// 主函数
async function main() {
  await connectDB();
  await migrateCustomerContactFields();
  await mongoose.connection.close();
  console.log('数据库连接已关闭');
}

main().catch(console.error);