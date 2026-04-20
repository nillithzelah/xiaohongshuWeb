const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');

  const AiPrompt = require('./models/AiPrompt');
  const prompt = await AiPrompt.findOne({ type: 'note_audit' });

  console.log('当前版本:', prompt.version);

  // v23 提示词 - 更严格的拒绝标准
  const promptEnd = '笔记内容：\\${content}';

  const newUserPromptTemplate = `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷/被骗相关内容。

任务：判断笔记是否属于以下维权类别之一。

【支持的13个类别】
减肥、医美、祛斑、祛痘、丰胸、护肤、眼袋、育发、玉石、女性调理、增高、HPV、赌石、保健品

【判断流程 - 必须按顺序执行】
第一步：检查笔记内容是否明确涉及13个类别之一
- 如果内容完全没有提到减肥、医美、祛斑、祛痘、丰胸、护肤、眼袋、育发、玉石、女性调理、增高、HPV、赌石、保健品等任何类别，直接拒绝
- 不要因为"看起来像维权帖"就通过，必须先满足类别要求

第二步：确认属于13类别后，再判断是否为真实维权经历
- 真实受害经历分享 → 通过
- 维权教程/避雷指南 → 通过
- 推广/广告 → 拒绝

【拒绝标准】如有以下情况，直接拒绝：
1. 类别不符：内容与13个支持的类别无关（即使符合维权特征也要拒绝）
2. 通用诈骗/防骗：电信诈骗、网络诈骗、刷单被骗、杀猪盘、博彩、P2P理财、反诈宣传等（不在13类）
3. 防骗经验分享：分享报警经历、教育他人避雷、防骗知识科普、反诈宣传（非13类）
4. 通用消费维权：苹果退款、闲鱼、淘宝、抖音、快手等平台纠纷、培训退费、装修纠纷等（不在13类）
5. 健身房套路：健身房私教推销、健身卡退费等（减肥类仅支持减肥药/减肥机构，不支持健身房）
6. 通用维权服务：各种退费找我、专业维权帮追回、维权代理等（不针对具体类别）

【输出JSON】
{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配类别（从13类中选择，如不匹配则填null）",
  "confidence_score": 0.0-1.0,
  "reason": "分析理由（第一步必须说明是否属于13类别，不属于则直接拒绝）"
}

` + promptEnd;

  prompt.userPromptTemplate = newUserPromptTemplate;
  prompt.version = '23';
  await prompt.save();

  console.log('提示词已更新到 v23');

  // 热更新
  const aiContentAnalysisService = require('./services/aiContentAnalysisService');
  await aiContentAnalysisService.reloadPrompts();
  console.log('已热更新');

  console.log('');
  console.log('=== v23 主要变更 ===');
  console.log('1. 新增平台纠纷优先规则');
  console.log('2. 闲鱼/抖音/淘宝等平台纠纷优先拒绝');
  console.log('3. 防骗/避雷类通用内容拒绝');

  await mongoose.disconnect();
})().catch(console.error);
