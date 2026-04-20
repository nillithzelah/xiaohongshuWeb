const mongoose = require('mongoose');
const DiscoveredNote = require('./models/DiscoveredNote');
const SystemConfig = require('./models/SystemConfig');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit', { useNewUrlParser: true, useUnifiedTopology: true });

  console.log('=== 检查优先级间隔配置 ===');
  const config = await SystemConfig.getValue('harvest_priority_intervals', null);
  console.log('数据库配置:', config);

  console.log('\n=== 检查优先级1的笔记 ===');
  const notes = await DiscoveredNote.find({
    needsCommentHarvest: true,
    noteStatus: 'active',
    harvestPriority: 1,
    commentsHarvestedAt: { $ne: null }
  }).select('noteId harvestPriority commentsHarvestedAt createdAt').limit(5);

  const now = Date.now();
  for (const note of notes) {
    const harvestedAt = new Date(note.commentsHarvestedAt).getTime();
    const hoursSince = Math.floor((now - harvestedAt) / 3600000);
    console.log('\n笔记:' + note.noteId);
    console.log('  优先级:' + note.harvestPriority);
    console.log('  上次采集:' + new Date(note.commentsHarvestedAt).toLocaleString('zh-CN'));
    console.log('  距现在:' + hoursSince + '小时');
    console.log('  应该间隔:24小时');
    console.log('  可采集?' + (hoursSince >= 24 ? '是' : '否'));
  }

  await mongoose.disconnect();
}

check().catch(console.error);
