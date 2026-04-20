#!/usr/bin/env node
/**
 * 更新 note_audit 提示词 - 严格类别版本 v21
 * 必须匹配13个类别之一，防骗经验分享（非13类）必须拒绝
 */

const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 新的提示词模板（严格类别版本 v21）
const newUserPromptTemplate = `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷/被骗相关内容。

⚠️ 核心规则：只有以下13个特定类别的维权内容才能通过审核，其他任何类型的维权/诈骗内容都应拒绝！

【支持的13个类别】
减肥、医美、祛斑、祛痘、丰胸、护肤、眼袋、育发、玉石、女性调理、增高、HPV、赌石、保健品

【通过标准】
✅ 内容必须明确涉及上述13个类别之一
✅ 正在寻求帮助、想要追回损失、还没解决的受害者
✅ 语气包含：求助、焦虑、不确定、想要知道怎么办

【拒绝标准】
❌ 通用诈骗/防骗：电信诈骗、网络诈骗、刷单被骗、杀猪盘、博彩、P2P理财、反诈宣传等（不在13类）
❌ 防骗经验分享：分享报警经历、教育他人避雷、防骗知识科普、反诈宣传（非13类）
❌ 通用消费维权：苹果退款、淘宝退货、闲鱼被骗、电商纠纷、培训退费、装修纠纷等（不在上述13类）
❌ 通用维权服务：各种退费找我、专业维权帮追回、维权代理等（不针对具体类别）
❌ 与上述13类无关的其他诈骗和纠纷

【判断方法】
步骤1：检查内容是否涉及13个类别之一（减肥/医美/祛斑/祛痘/丰胸/护肤/眼袋/育发/玉石/女性调理/增高/HPV/赌石/保健品）
步骤2：如果内容讲的是"网络诈骗"、"电信诈骗"、"防骗"、"反诈"、"杀猪盘"、"刷单"等通用诈骗类型 → 直接拒绝
步骤3：如果内容是"分享防骗经验"、"教育他人避雷"、"宣传反诈知识" → 直接拒绝
步骤4：只有当内容同时满足"属于13类之一"且"正在寻求维权帮助"时才通过

【输出JSON】
{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配类别（必须从13类中选择，不匹配返回'无匹配类别'）",
  "confidence_score": 0.0-1.0,
  "reason": "分析理由（必须说明属于哪一类或不属于的原因）"
}

笔记内容：\${content}`;

async function main() {
  console.log('🔄 开始连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 更新 note_audit 提示词（严格类别版本 v21）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 查找现有的 note_audit 提示词
  const prompt = await AiPrompt.findOne({ type: 'note_audit' });

  if (!prompt) {
    console.error('❌ 未找到 note_audit 类型的提示词');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`当前版本: v${prompt.version}`);
  console.log(`当前名称: ${prompt.displayName}`);

  // 更新提示词
  const oldVersion = prompt.version;
  prompt.userPromptTemplate = newUserPromptTemplate;
  prompt.version = '21'; // 新版本
  prompt.updatedAt = new Date();

  await prompt.save();

  console.log(`✅ 已更新: v${oldVersion} → v${prompt.version}`);
  console.log('');
  console.log('📋 主要变更:');
  console.log('  1. 添加"通用诈骗/防骗"明确拒绝项');
  console.log('  2. 添加"防骗经验分享"明确拒绝项');
  console.log('  3. 添加"判断方法"步骤指导');
  console.log('');
  console.log('⚠️  维权服务提供必须与13类具体类别相关');
  console.log('⚠️  防骗教育/反诈宣传/经验分享（非13类）将被拒绝');

  // 重新加载提示词到内存
  console.log('');
  console.log('🔄 重新加载提示词到内存...');
  const aiContentAnalysisService = require('./services/aiContentAnalysisService');
  await aiContentAnalysisService.reloadPrompts();
  console.log('✅ 提示词已重新加载到内存');

  await mongoose.disconnect();
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ 错误:', error);
  process.exit(1);
});
