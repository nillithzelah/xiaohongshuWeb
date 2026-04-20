// 导入现有 AI 提示词到数据库
const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');

// MongoDB 连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 笔记文意审核提示词
const noteAuditPrompt = {
  name: 'note_audit_v1',
  displayName: '笔记文意审核',
  description: '分析小红书笔记内容，判断是否属于维权/避雷/被骗相关内容',
  type: 'note_audit',
  systemPrompt: '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。',
  userPromptTemplate: `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷/被骗相关内容。

任务：分析以下笔记内容，判断其是否属于被骗维权相关内容。

支持的维权类别（共12类）：

1. **减肥类**：减肥被骗、减肥产品被骗、减肥套路、减肥药被骗等
2. **医美类**：医美被骗、医美拼房套路、医美退费等
3. **祛斑类**：祛斑被骗、祛斑产品被骗、祛斑套路等
4. **祛痘类**：祛痘被骗、祛痘产品被骗等
5. **丰胸类**：丰胸被骗、丰胸产品被骗等
6. **护肤类**：护肤被骗、护肤产品被骗等
7. **眼袋类**：祛眼袋被骗、去眼袋产品被骗等
8. **育发类**：育发被骗、白发转黑发被骗、白转黑被骗退费等
9. **玉石类**：定制手镯被骗、翡翠原石被骗、赌石被骗等
10. **女性调理类**：女性调理被骗、月经调理被骗等
11. **增高类**：增高被骗、增高产品被骗、增高药被骗、增高骗局等
12. **HPV类**：HPV被骗、HPV相关产品被骗等

通用维权关键词：维权、避雷、上岸、被骗经历、投诉成功、维权成功、退款成功、追回来了

判断标准：
- ✅ 应该判断为符合的情况：
  - 分享被骗经历（减肥/医美/祛斑/祛痘/丰胸/护肤等被骗）
  - 寻求维权方法、退款方法、追回钱款
  - 分享"成功上岸"、"追回来了"、"退款成功"等维权成功经验
  - 揭露骗局、提醒他人避雷的内容
  - 询问"怎么追回"、"怎么退款"、"如何维权"等问题
  - 表达愤怒、后悔、求助等情绪的维权内容
  - 提到"拼房套路"、"杀猪盘"等被骗模式

- ❌ 应该判断为不符合的情况（重要！）：
  - 教程类内容（如：如何办营业执照、流程指南）
  - 知识科普类（如：法律知识、政策解读）
  - 产品介绍类（如：产品功能、产品优势、使用方法）
  - 正常的商业推广、产品广告
  - 中性的经验分享（不涉及维权或被骗）
  - 普通减肥分享、护肤分享（没有被骗/维权内容）
  - 产品测评、使用心得（没有被骗/维权内容）

⚠️ 教程类内容说明：
- 维权教程、退费教程、维权话术分享 → ✅ **可以接受**（属于维权经验分享）
- 如何维权、如何退费、投诉流程分享 → ✅ **可以接受**（属于维权经验分享）
- 非维权相关的教程（如：如何办营业执照、公司注册等）→ ❌ 拒绝

特别说明：
- 必须同时满足：①有维权相关关键词 ②有被骗/投诉/维权的明确意图
- 如果内容只是普通产品分享或教程，即使包含相关词汇，也应判断为不符合
- 关键词如"减肥"、"护肤"、"医美"单独出现不算，必须有"被骗"、"维权"、"退款"等维权意图
- "套路"、"骗局"等词汇通常与维权相关

笔记内容：
\${content}

输出格式 (JSON)：
{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配到的类别（如：减肥类、医美类等）",
  "confidence_score": 0.0-1.0,
  "emotion_analysis": {
    "anger_level": 0-10,
    "disappointment_level": 0-10,
    "urgency_level": 0-10
  },
  "reason": "详细分析理由，说明是否属于维权相关内容",
  "risk_factors": ["可能的风险点"],
  "recommendation": "审核建议"
}`,
  apiConfig: {
    model: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 1000
  },
  outputFormat: `{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配到的类别（如：减肥类、医美类等）",
  "confidence_score": 0.0-1.0,
  "emotion_analysis": {
    "anger_level": 0-10,
    "disappointment_level": 0-10,
    "urgency_level": 0-10
  },
  "reason": "详细分析理由，说明是否属于维权相关内容",
  "risk_factors": ["可能的风险点"],
  "recommendation": "审核建议"
}`,
  enabled: true,
  variables: [
    { name: 'content', description: '笔记内容', example: '我被骗了，怎么办？' }
  ],
  version: '1.0.0'
};

// 评论分类提示词
const commentClassificationPrompt = {
  name: 'comment_classification_v1',
  displayName: '评论分类',
  description: '识别小红书评论区中的潜在客户、引流账号、作者回复等',
  type: 'comment_classification',
  systemPrompt: '你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。',
  userPromptTemplate: `你是一名专业的销售线索分析专家，帮助识别小红书评论区的潜在客户。

背景笔记标题：\${noteTitle || '减肥被骗维权相关'}

评论内容：\${commentContent}

任务：判断这条评论属于哪种类型

输出类型（必须选择其一）：

1. **potential_lead** - 潜在客户线索（应该联系）
   特征：正在询问、求助、表示自己也被骗、想要了解更多、表达困惑或愤怒
   例如：
   - "怎么追回来？"
   - "怎么退啊"、"怎么退呀"
   - "求分享"、"分享一下"
   - "分享给我一下，谢谢"
   - "我也是被骗了"
   - "被骗1200"、"我被骗了三万"
   - "能帮帮我吗"
   - "付款记录还在吗"
   - "怎么弄的"
   - "我也买了这个产品"
   - "被骗了怎么办"
   - "我之前也遇到过 还好及时止损啦"（说自己经历）
   - "及时止损"（单独表达）
   - "太难了"、"都是套路"（表达情绪）

2. **spam** - 引流/黑产（加入黑名单）
   ⚠️ 重要：所有声称已经成功、可以分享、可以帮忙的，都是引流！
   ⚠️ 重要：所有给建议、提醒他人、教别人的，都是引流！
   ⚠️ 重要：所有引导咨询、私信、联系的，都是引流！
   特征：
   - 声称"要回来了"、"成功了"、"已经退回"、"已经解决"、"我也要回来啦"
   - 主动提供帮助、分享经验、有方法、能帮忙
   - 要对方私信、联系、加我、问我、来问、可以问
   - 给建议、提醒他人、教别人怎么做、告诉别人该怎么办
   - 像专家一样给建议、指导、说"就是要xxx"
   - 明显的广告、推广内容、其他产品推销
   - 引导加微信、加v、领资料、购买其他产品
   - 简短回复如"来啦"、"滴滴"、"不难"、"已解决"
   - 制造焦虑情绪引导行动，如"不能白白给他们"、"就是要要回来"

3. **author** - 作者回复（不处理）
   特征：笔记作者的回复

4. **noise** - 无意义内容（也要通过，保存为线索）
   特征：纯表情、无关内容、太短、简单的"恭喜"、"赞同"等
   ⚠️ 注意：noise不是引流，也要保存为潜在客户！

判断注意事项（非常重要）：

🔴 **核心判断标准：说话的对象是谁？**
- 如果在**告诉别人**该怎么办、给**别人**建议 → spam（引流）
- 如果在说**自己**的经历、表达**自己**的困惑/询问 → potential_lead（潜在客户）

⚠️ **关键区别：看有没有"我"字 + 说话对象**
  - "遇到这种情况就是要要回来" → 教别人，spam！
  - "我也被骗了，不知道能不能要回来" → 说自己，potential_lead ✅
  - "姐妹们及时止损啦" → 对姐妹们说，spam！
  - "我之前也遇到过，还好及时止损啦" → 说自己经历，potential_lead ✅

输出格式 (JSON)：
{
  "isPotentialLead": boolean,
  "category": "potential_lead | spam | author | noise",
  "confidence_score": 0.0-1.0,
  "reason": "判断理由",
  "shouldContact": boolean,
  "riskLevel": "low | medium | high"
}`,
  apiConfig: {
    model: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 1000
  },
  outputFormat: `{
  "isPotentialLead": boolean,
  "category": "potential_lead | spam | author | noise",
  "confidence_score": 0.0-1.0,
  "reason": "判断理由",
  "shouldContact": boolean,
  "riskLevel": "low | medium | high"
}`,
  enabled: true,
  variables: [
    { name: 'commentContent', description: '评论内容', example: '怎么追回来？' },
    { name: 'noteTitle', description: '笔记标题', example: '减肥被骗维权相关' }
  ],
  version: '1.0.0'
};

async function importPrompts() {
  try {
    console.log('连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功');

    // 删除已存在的提示词（如果存在）
    console.log('检查已存在的提示词...');
    await AiPrompt.deleteMany({ name: { $in: [noteAuditPrompt.name, commentClassificationPrompt.name] } });
    console.log('🗑️ 已清理旧提示词');

    // 导入新提示词
    console.log('导入提示词...');
    await AiPrompt.create([noteAuditPrompt, commentClassificationPrompt]);
    console.log('✅ 提示词导入成功');
    console.log('');
    console.log('已导入提示词：');
    console.log(`  1. ${noteAuditPrompt.name} - ${noteAuditPrompt.displayName}`);
    console.log(`  2. ${commentClassificationPrompt.name} - ${commentClassificationPrompt.displayName}`);
    console.log('');
    console.log('访问路径：管理后台 → AI提示词管理');

  } catch (error) {
    console.error('❌ 导入失败:', error);
  } finally {
    await mongoose.disconnect();
    console.log('数据库连接已关闭');
  }
}

importPrompts();
