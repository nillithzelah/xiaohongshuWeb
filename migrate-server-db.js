const mongoose = require('mongoose');
require('dotenv').config();

async function migrateServerDB() {
  try {
    console.log('🔄 开始服务器数据库格式迁移...');

    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ 数据库连接成功');

    const ImageReview = require('./server/models/ImageReview');

    // 1. 获取所有记录（因为旧记录都没有新字段）
    const records = await ImageReview.find({});

    console.log(`📊 找到 ${records.length} 条需要迁移的记录`);

    let updatedCount = 0;

    for (const record of records) {
      const updateData = {};

      // 单图转多图（强制更新）
      updateData.imageUrls = record.imageUrl ? [record.imageUrl] : [];
      updateData.imageMd5s = record.imageMd5 ? [record.imageMd5] : [];

      // 审核字段迁移
      if (!record.mentorReview && record.csReview) {
        updateData.mentorReview = {
          reviewer: record.csReview.reviewer,
          approved: record.csReview.approved,
          comment: record.csReview.comment,
          reviewedAt: record.csReview.reviewedAt
        };
      }

      // 添加新字段默认值（总是添加，因为旧记录都没有）
      updateData.noteUrl = record.noteUrl || null;
      updateData.userNoteInfo = record.userNoteInfo || {
        author: '',
        title: '',
        comment: ''
      };
      updateData.aiParsedNoteInfo = record.aiParsedNoteInfo || {
        author: '',
        title: '',
        publishTime: null,
        likes: 0,
        collects: 0,
        comments: 0
      };
      updateData.aiReviewResult = record.aiReviewResult || {
        passed: null,
        confidence: 0,
        riskLevel: 'low',
        reasons: [],
        contentMatch: {
          authorMatch: 0,
          titleMatch: 0,
          pageAuthor: '',
          pageTitle: ''
        },
        commentVerification: {
          exists: false,
          confidence: 0,
          reason: '',
          pageCommentCount: 0,
          scannedComments: 0,
          foundComments: [],
          pageComments: []
        }
      };
      updateData.continuousCheck = record.continuousCheck || {
        enabled: false,
        status: 'inactive',
        lastCheckTime: null,
        nextCheckTime: null,
        checkHistory: []
      };

      // 执行更新
      await ImageReview.updateOne({ _id: record._id }, { $set: updateData });
      updatedCount++;
    }

    console.log(`📊 更新了 ${updatedCount} 条记录`);

    // 2. 验证迁移结果
    const totalCount = await ImageReview.countDocuments();
    const migratedCount = await ImageReview.countDocuments({
      imageUrls: { $exists: true },
      noteUrl: { $exists: true }
    });

    console.log(`📈 迁移统计:`);
    console.log(`  总记录数: ${totalCount}`);
    console.log(`  已迁移记录: ${migratedCount}`);

    // 3. 显示一个示例
    const sample = await ImageReview.findOne().lean();
    if (sample) {
      console.log('\n📋 示例记录结构:');
      console.log(`  ID: ${sample._id}`);
      console.log(`  图片数量: ${sample.imageUrls?.length || 0}`);
      console.log(`  审核状态: ${sample.status}`);
      console.log(`  有mentorReview: ${!!sample.mentorReview}`);
      console.log(`  有noteUrl: ${sample.noteUrl !== undefined}`);
      console.log(`  有userNoteInfo: ${!!sample.userNoteInfo}`);
      console.log(`  有aiReviewResult: ${!!sample.aiReviewResult}`);
      console.log(`  有continuousCheck: ${!!sample.continuousCheck}`);
    }

    console.log('🎉 服务器数据库格式迁移完成');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateServerDB();