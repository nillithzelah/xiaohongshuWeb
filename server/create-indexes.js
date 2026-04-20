#!/usr/bin/env node
/**
 * 创建数据库索引（安全方式）
 * 索引创建是后台操作，不会阻塞服务
 */
const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');
const ImageReview = require('./models/ImageReview');
const CommentLead = require('./models/CommentLead');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function createIndexes() {
  console.log('🔄 连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库已连接');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 创建数据库索引');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    // DiscoveredNote 索引
    console.log('');
    console.log('📦 DiscoveredNote 索引:');
    const noteIndexes = await DiscoveredNote.collection.getIndexes();
    console.log('   现有索引:', Object.keys(noteIndexes).join(', '));

    await DiscoveredNote.createIndexes();
    console.log('   ✅ 索引创建完成');

    // ImageReview 索引
    console.log('');
    console.log('📦 ImageReview 索引:');
    const reviewIndexes = await ImageReview.collection.getIndexes();
    console.log('   现有索引:', Object.keys(reviewIndexes).join(', '));

    await ImageReview.createIndexes();
    console.log('   ✅ 索引创建完成');

    // CommentLead 索引
    console.log('');
    console.log('📦 CommentLead 索引:');
    const leadIndexes = await CommentLead.collection.getIndexes();
    console.log('   现有索引:', Object.keys(leadIndexes).join(', '));

    await CommentLead.createIndexes();
    console.log('   ✅ 索引创建完成');

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 所有索引创建完成');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ 索引创建失败:', error.message);
  }

  await mongoose.disconnect();
  process.exit(0);
}

createIndexes().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
