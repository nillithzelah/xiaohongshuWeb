const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const DiscoveredNote = require('./models/DiscoveredNote');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notes = await DiscoveredNote.find({
    createdAt: { $gte: today }
  }).sort({ createdAt: -1 }).limit(30);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 今日新增笔记 AI 分析结果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const note of notes) {
    const noteId = note.noteId ? note.noteId.slice(0, 12) : '???';
    const isGenuine = note.aiAnalysis?.is_genuine_victim_post;
    const reason = note.aiAnalysis?.reason || '(无)';
    const status = note.noteStatus || 'active';
    const icon = isGenuine ? '✅' : '❌';
    console.log(noteId + '... ' + icon + ' [' + status + ']');
    console.log('   理由: ' + reason.substring(0, 100) + (reason.length > 100 ? '...' : ''));
    console.log('');
  }

  await mongoose.disconnect();
})().catch(console.error);
