#!/usr/bin/env node
/**
 * 更新 note_audit 提示词 - 严格版本
 * 维权服务提供必须与具体类别相关才能通过
 */

const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 新的提示词模板（严格版本 v20）
const newUserPromptTemplate = `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷/被骗相关内容。

任务：判断笔记是否属于以下维权类别之一。

【支持的13个类别】
减肥、医美、祛斑、祛痘、丰胸、护肤、眼袋、育发、玉石、女性调理、增高、HPV、赌石、保健品

【通过标准】内容必须明确涉及以下13个类别之一：
- 减肥：减肥被骗、瘦身机构退费、减肥药无效、健身私教纠纷等
- 医美：医美失败、整容退费、医美纠纷、注射无效等
- 祛斑：祛斑被骗、祛斑机构退费、祛斑产品无效等
- 祛痘：祛痘被骗、祛痘机构退费、祛痘产品无效等
- 丰胸：丰胸被骗、丰胸产品无效、丰胸机构纠纷等
- 护肤：护肤被骗、护肤品无效、护肤机构纠纷等
- 眼袋：去眼袋手术纠纷、眼袋机构退费等
- 育发：育发被骗、育发机构退费、发际线修复纠纷等
- 玉石：玉石被骗、假玉鉴定、玉石购买纠纷等
- 女性调理：女性调理机构退费、调理无效等
- 增高：增高被骗、增高机构退费、增高产品无效等
- HPV：HPV疫苗被骗、HPV治疗纠纷等
- 赌石：赌石被骗、假玉鉴定、翡翠购买纠纷等
- 保健品：保健品被骗、假保健品、退费纠纷等

【拒绝标准】
- ❌ 通用消费维权：苹果退款、淘宝退货、闲鱼被骗、电商纠纷、培训退费、装修纠纷、P2P理财等（不在上述13类）
- ❌ 通用维权服务：各种退费找我、专业维权帮追回、维权代理等（不针对具体类别）
- ❌ 与上述13类无关的其他诈骗和纠纷

【输出JSON】
{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配类别（从13类中选择）",
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
  console.log('📝 更新 note_audit 提示词（严格版本）');
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
  prompt.version = '20'; // 新版本
  prompt.updatedAt = new Date();

  await prompt.save();

  console.log('');
  console.log(`✅ 提示词已更新: v${oldVersion} → v${prompt.version}`);
  console.log('');

  // 显示关键变更
  console.log('📋 主要变更:');
  console.log('  ⚠️  维权服务提供必须与13类具体类别相关');
  console.log('  ✅ 通过：医美退费找我、减肥维权咨询等');
  console.log('  ❌ 拒绝：各种退费找我、专业维权帮追回等通用推广');
  console.log('');

  // 重新加载提示词（通知服务）
  console.log('💡 提示：需要重启后端服务以加载新提示词');
  console.log('   运行: pm2 restart xiaohongshu-api');

  await mongoose.disconnect();
  console.log('');
  console.log('✅ 完成');
}

main().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
