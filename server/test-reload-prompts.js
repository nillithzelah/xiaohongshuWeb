#!/usr/bin/env node
/**
 * 测试提示词加载
 */
const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');
const aiContentAnalysisService = require('./services/aiContentAnalysisService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function test() {
  console.log('🔄 连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库已连接');
  console.log('');

  console.log('1️⃣ 检查数据库中的提示词:');
  const dbPrompt = await AiPrompt.findOne({ type: 'note_audit' });
  console.log('   版本:', dbPrompt.version);
  console.log('   启用:', dbPrompt.enabled);
  console.log('   前50字符:', dbPrompt.userPromptTemplate.substring(0, 50));
  console.log('');

  console.log('2️⃣ 检查服务内存中的提示词（重新加载前）:');
  const before = aiContentAnalysisService.getNoteAuditPrompt();
  console.log('   版本:', before ? before.version : 'null');
  console.log('');

  console.log('3️⃣ 调用 reloadPrompts():');
  const result = await aiContentAnalysisService.reloadPrompts();
  console.log('   结果:', result.message);
  console.log('');

  console.log('4️⃣ 检查服务内存中的提示词（重新加载后）:');
  const after = aiContentAnalysisService.getNoteAuditPrompt();
  console.log('   版本:', after ? after.version : 'null');
  console.log('   前50字符:', after ? after.userPromptTemplate.substring(0, 50) : 'null');
  console.log('');

  await mongoose.disconnect();
  process.exit(0);
}

test().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
