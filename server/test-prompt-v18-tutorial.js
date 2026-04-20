#!/usr/bin/env node
/**
 * 测试 v18 提示词对教程类内容的反应
 */
const mongoose = require('mongoose');
const axios = require('axios');
const AiPrompt = require('./models/AiPrompt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 测试内容：医美退费话术教程
const testContent = `#医美退费 #退费维权
美容院退费并不难，关键是掌握正确的方法和技巧。

第一步：准备好证据材料（合同、转账记录、聊天记录）
第二步：拨打12315投诉
第三步：联系美容院协商退费

打电话照着读也没事，就这几句话的事：
1. 我做的项目没有效果
2. 销售时承诺了100%退款
3. 现在要求按合同退费

如有问题可以咨询，帮您成功退费！`;

async function main() {
  await mongoose.connect(MONGODB_URI);

  const prompt = await AiPrompt.findOne({ type: 'note_audit' });

  console.log('=== 提示词版本 ===');
  console.log(`v${prompt.version}: ${prompt.displayName}`);
  console.log('');

  // 替换变量
  const userPrompt = prompt.userPromptTemplate.replace('${content}', testContent);

  console.log('=== 测试内容 ===');
  console.log(testContent);
  console.log('');
  console.log('=== 发送到AI ===');

  const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: prompt.systemPrompt || '你是专业JSON API' },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.1
  }, {
    headers: { 'Authorization': 'Bearer sk-a404750c7b49421f947f0c86dc20de29' }
  });

  const result = JSON.parse(response.data.choices[0].message.content);
  console.log('');
  console.log('=== AI 分析结果 ===');
  console.log('is_genuine_victim_post:', result.is_genuine_victim_post);
  console.log('scam_category:', result.scam_category);
  console.log('confidence_score:', result.confidence_score);
  console.log('reason:', result.reason);

  await mongoose.disconnect();
}

main().catch(console.error);
