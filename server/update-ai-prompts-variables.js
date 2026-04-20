#!/usr/bin/env node
/**
 * 更新 AI 提示词，确保 variables 字段正确配置
 */

const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function main() {
  console.log('🔄 开始连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功');
  console.log('');

  // 检查现有提示词
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 检查现有提示词');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const prompts = await AiPrompt.find({});
  console.log(`找到 ${prompts.length} 个提示词:`);
  for (const prompt of prompts) {
    console.log(`  - ${prompt.name} (${prompt.displayName})`);
    console.log(`    type: ${prompt.type}`);
    console.log(`    variables: ${prompt.variables ? prompt.variables.length : 0} 个`);
  }
  console.log('');

  // 更新 note_audit 提示词（无论是 note_audit 还是 note_audit_v1）
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 更新 note_audit 提示词');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 查找 note_audit 类型的提示词
  const noteAuditPrompt = await AiPrompt.findOne({ type: 'note_audit' });

  if (noteAuditPrompt) {
    console.log(`找到: ${noteAuditPrompt.name}`);

    // 确保 variables 字段存在且正确
    const variables = [
      { name: 'content', description: '笔记内容', example: '我被骗了，怎么办？' }
    ];

    noteAuditPrompt.variables = variables;
    noteAuditPrompt.name = 'note_audit'; // 统一名称
    noteAuditPrompt.enabled = true;

    await noteAuditPrompt.save();
    console.log(`✅ 已更新 ${noteAuditPrompt.name} 的 variables 字段`);
  } else {
    console.log('⚠️  未找到 note_audit 类型的提示词，跳过');
  }
  console.log('');

  // 更新 comment_classification 提示词
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 更新 comment_classification 提示词');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const commentPrompt = await AiPrompt.findOne({ type: 'comment_classification' });

  if (commentPrompt) {
    console.log(`找到: ${commentPrompt.name}`);

    const variables = [
      { name: 'commentContent', description: '评论内容', example: '怎么追回来？' },
      { name: 'noteTitle', description: '笔记标题', example: '减肥被骗维权相关' }
    ];

    commentPrompt.variables = variables;
    commentPrompt.name = 'comment_classification'; // 统一名称
    commentPrompt.enabled = true;

    await commentPrompt.save();
    console.log(`✅ 已更新 ${commentPrompt.name} 的 variables 字段`);
  } else {
    console.log('⚠️  未找到 comment_classification 类型的提示词，跳过');
  }
  console.log('');

  // 验证更新结果
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 验证更新结果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const updatedPrompts = await AiPrompt.find({});
  for (const prompt of updatedPrompts) {
    console.log(`  - ${prompt.name}: ${prompt.variables ? prompt.variables.length : 0} 个变量`);
    if (prompt.variables && prompt.variables.length > 0) {
      for (const v of prompt.variables) {
        console.log(`    • ${v.name} - ${v.description}`);
      }
    }
  }
  console.log('');

  console.log('✅ 完成');
  console.log('');
  console.log('💡 提示：如果前端仍然没有显示变量，请刷新页面或重新加载提示词');

  await mongoose.disconnect();
  console.log('✅ 数据库连接已关闭');
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
