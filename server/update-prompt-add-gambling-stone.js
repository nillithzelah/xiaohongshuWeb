#!/usr/bin/env node
/**
 * 更新 note_audit 提示词，添加赌石作为第13个支持类别
 */

const mongoose = require('mongoose');
const AiPrompt = require('./models/AiPrompt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 新的提示词模板（13个类别）
const newUserPromptTemplate = `你是一名专业的内容审核专家，专门识别小红书上的维权/避雷/被骗相关内容。

任务：分析以下笔记内容，判断其是否属于被骗维权相关内容。

⚠️ 核心规则：只有以下13个特定类别的维权内容才能通过审核，其他任何类型的维权/诈骗内容都应拒绝！

支持的维权类别（仅限这13类）：

1. **减肥类**：减肥被骗、减肥产品被骗、减肥套路、减肥药被骗等
2. **医美类**：医美被骗、医美拼房套路、医美退费等
3. **祛斑类**：祛斑被骗、祛斑产品被骗、祛斑套路等
4. **祛痘类**：祛痘被骗、祛痘产品被骗等
5. **丰胸类**：丰胸被骗、丰胸产品被骗等
6. **护肤类**：护肤被骗、护肤产品被骗等
7. **眼袋类**：祛眼袋被骗、去眼袋产品被骗等
8. **育发类**：育发被骗、白发转黑发被骗、白转黑被骗退费等
9. **玉石类**：定制手镯被骗、翡翠原石被骗、玉器被骗等
10. **女性调理类**：女性调理被骗、月经调理被骗等
11. **增高类**：增高被骗、增高产品被骗、增高药被骗、增高骗局等
12. **HPV类**：HPV被骗、HPV相关产品被骗等
13. **赌石类**：翡翠赌石被骗、直播间赌石被骗、原石赌石被骗、赌石骗局、赌石维权等（注意：包含翡翠、玉石、原石等所有赌石相关内容）

判断标准：

- ✅ 应该判断为符合的情况：
  - 内容属于上述13个类别之一，且与维权/退费/被骗相关
  - **个人被骗经历分享**（减肥/医美/祛斑/祛痘/丰胸/护肤/HPV/赌石等被骗）
  - **维权教程、退费教程、维权话术** → ✅ 可以接受
  - **维权流程建议、科普知识** → ✅ 可以接受（如医美退费流程、维权注意事项、赌石维权教程）
  - **成功经验分享**（追回来了、退款成功、维权成功等）
  - **揭露骗局、提醒避雷**的内容（如揭露翡翠赌石骗局、直播间赌石套路等）
  - **寻求维权方法**（怎么追回、怎么退款、如何维权）
  - **表达维权情绪**（愤怒、后悔、求助）
  - **维权服务提供者内容** → ✅ 可以接受
    - 代理退费、维权咨询、法律援助等服务提供者
    - 即使包含"退费秒回"、"有问题找我"、"帮忙退费"等服务推广话术
    - **判断标准**：服务是否针对13类维权领域（如医美退费代理、减肥被骗维权咨询、赌石被骗维权等）
    - 例如："医美退费找我"、"减肥被骗帮追回"、"赌石维权咨询"等应接受

- ❌ 必须拒绝的情况（重要！）：
  - 其他平台诈骗：闲鱼、淘宝、拼多多、京东等电商/二手平台交易被骗（除非与13类相关）
  - 网络诈骗：刷单被骗、杀猪盘、博彩被骗、网络赌博被骗
  - 金融诈骗：P2P被骗、理财被骗、借贷被骗、集资诈骗
  - 招聘诈骗：兼职被骗、招聘被骗、入职被骗
  - 教育诈骗：课程被骗、培训被骗、学费被骗
  - 装修诈骗：装修被骗、建材被骗
  - 其他不属于上述13类的任何维权/诈骗内容
  - **通用广告引流**：与13类维权无关的商业推广、产品广告
  - 普通产品分享（没有被骗/维权内容）

⚠️ 重要说明：
- **只要是13类相关的维权内容都可以接受**，包括教程、科普、流程、话术、服务等
- **不需要是个人真实经历**，维权知识科普、流程建议、服务提供都可以
- **维权服务提供者是允许的**，只要服务针对13类维权领域
- **赌石类**包括所有翡翠、玉石、原石的赌石被骗内容，无论是直播间赌石、原石赌石还是赌石套路
- 关键是：内容是否与13类的维权/退费/被骗相关

笔记内容：
\${content}

输出格式 (JSON)：
{
  "is_genuine_victim_post": boolean,
  "scam_category": "匹配到的类别（如：减肥类、医美类、赌石类等）",
  "confidence_score": 0.0-1.0,
  "emotion_analysis": {
    "anger_level": 0-10,
    "disappointment_level": 0-10,
    "urgency_level": 0-10
  },
  "reason": "详细分析理由，说明是否属于维权相关内容",
  "risk_factors": ["可能的风险点"],
  "recommendation": "审核建议"
}`;

async function main() {
  console.log('🔄 开始连接数据库...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ 数据库连接成功');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 更新 note_audit 提示词（添加赌石类）');
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
  prompt.version = '17'; // 新版本
  prompt.updatedAt = new Date();

  await prompt.save();

  console.log('');
  console.log(`✅ 提示词已更新: v${oldVersion} → v${prompt.version}`);
  console.log('');

  // 显示关键变更
  console.log('📋 主要变更:');
  console.log('  ✅ 支持12类 → 13类');
  console.log('  ✅ 新增类别：**赌石类**（翡翠赌石、直播间赌石、原石赌石、赌石骗局、赌石维权）');
  console.log('  ✅ 玉石类调整为：定制手镯、翡翠原石、玉器等（非赌石类）');
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
