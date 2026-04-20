const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const DiscoveredNote = require('./models/DiscoveredNote');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 检查今天的笔记
  const notes = await DiscoveredNote.find({
    createdAt: { $gte: today }
  }).sort({ createdAt: -1 }).limit(15);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 今日新增笔记的 prompt_version 情况');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let withVersion = 0;
  let withV23InReason = 0;

  for (const note of notes) {
    const v = note.aiAnalysis?.prompt_version || '(空)';
    if (v !== '(空)') withVersion++;
    const hasV23 = note.aiAnalysis?.reason?.includes('【v23】');
    if (hasV23) withV23InReason++;
    const status = hasV23 ? '✅' : '❌';
    const noteId = note.noteId ? note.noteId.slice(0, 12) + '...' : '(无ID)';
    console.log(`${noteId} | prompt_version: ${v} | reason含v23: ${status}`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 prompt_version字段: ${withVersion}/${notes.length}`);
  console.log(`📊 reason含v23标记: ${withV23InReason}/${notes.length}`);
  console.log('');
  console.log('⚠️  客户端代码已同步到服务器');
  console.log('    用户需要重新下载客户端才能生效');
  console.log('    下载地址: https://www.wubug.cc/downloads/xiaohongshu-audit-clients.zip');

  await mongoose.disconnect();
})().catch(console.error);
