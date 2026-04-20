#!/usr/bin/env node
/**
 * 检查数据库中所有 note_audit 提示词
 */
const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function check() {
  console.log('🔄 连接数据库:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库已连接');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 所有 note_audit 提示词:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const allPrompts = await AiPrompt.find({ type: 'note_audit' }).sort({ version: 1 });

  if (allPrompts.length === 0) {
    console.log('❌ 未找到任何 note_audit 提示词');
  } else {
    console.log(`找到 ${allPrompts.length} 个 note_audit 提示词:\n`);

    for (const prompt of allPrompts) {
      console.log(`────────────────────────────────────────────────────────────────────`);
      console.log(`ID: ${prompt._id}`);
      console.log(`名称: ${prompt.displayName}`);
      console.log(`版本: v${prompt.version}`);
      console.log(`启用: ${prompt.enabled ? '✅ 是' : '❌ 否'}`);
      console.log(`创建时间: ${prompt.createdAt}`);
      console.log(`更新时间: ${prompt.updatedAt}`);
      console.log(`前50字符: ${prompt.userPromptTemplate.substring(0, 50)}...`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 当前启用的提示词 (enabled=true):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const enabledPrompts = await AiPrompt.find({ type: 'note_audit', enabled: true });

  if (enabledPrompts.length === 0) {
    console.log('❌ 没有启用的 note_audit 提示词！');
    console.log('⚠️  这会导致服务无法加载提示词');
  } else {
    console.log(`找到 ${enabledPrompts.length} 个启用的提示词:\n`);
    for (const prompt of enabledPrompts) {
      console.log(`  ✅ ${prompt.displayName} v${prompt.version}`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 检查是否有问题
  if (enabledPrompts.length > 1) {
    console.log('⚠️  警告: 有多个启用的 note_audit 提示词，后者会覆盖前者！');
    console.log('   建议: 只保留一个启用状态');
  } else if (enabledPrompts.length === 1 && enabledPrompts[0].version !== '21') {
    console.log(`⚠️  警告: 启用的提示词版本是 v${enabledPrompts[0].version}，而不是 v21`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

check().catch(err => {
  console.error('❌ 错误:', err);
  process.exit(1);
});
