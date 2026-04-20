// 测试队列剩余时间筛选逻辑
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

// 获取采集优先级
function getHarvestPriority(record) {
  if (record.harvestPriority !== undefined && record.harvestPriority !== null && record.harvestPriority !== 0) {
    return record.harvestPriority;
  }
  return 1; // 默认最低优先级
}

// 检查是否可以采集
function checkCanHarvest(record) {
  // 如果从未采集过评论，可以采集
  if (!record.commentsHarvestedAt) {
    return true;
  }

  const lastHarvestTime = new Date(record.commentsHarvestedAt);
  const now = new Date();
  const priority = getHarvestPriority(record);

  // 根据采集优先级确定采集间隔
  let intervalMinutes = 720;
  if (priority === 10) intervalMinutes = 10;
  else if (priority === 5) intervalMinutes = 60;
  else if (priority === 2) intervalMinutes = 360;
  else if (priority === 1) intervalMinutes = 720;

  const nextHarvestTime = new Date(lastHarvestTime.getTime() + intervalMinutes * 60 * 1000);
  const timeLeft = nextHarvestTime - now;

  return timeLeft <= 0;
}

// 获取剩余时间（分钟）
function getTimeLeftMinutes(record) {
  if (!record.commentsHarvestedAt) {
    return 0;
  }

  const lastHarvestTime = new Date(record.commentsHarvestedAt);
  const now = new Date();
  const priority = getHarvestPriority(record);

  let intervalMinutes = 720;
  if (priority === 10) intervalMinutes = 10;
  else if (priority === 5) intervalMinutes = 60;
  else if (priority === 2) intervalMinutes = 360;
  else if (priority === 1) intervalMinutes = 720;

  const nextHarvestTime = new Date(lastHarvestTime.getTime() + intervalMinutes * 60 * 1000);
  const timeLeft = nextHarvestTime - now;

  return Math.max(0, timeLeft / (1000 * 60));
}

async function test() {
  await mongoose.connect(MONGODB_URI);
  const DiscoveredNote = mongoose.model('DiscoveredNote', new mongoose.Schema({
    noteId: String,
    noteUrl: String,
    harvestPriority: Number,
    commentsHarvestedAt: Date,
    noteStatus: String
  }));

  const notes = await DiscoveredNote.find({
    noteStatus: { $in: ['active', null] }
  }).limit(50).lean();

  console.log(`\n总笔记数: ${notes.length}`);
  console.log('');

  let canHarvestCount = 0;
  let inQueueCount = 0;
  let neverHarvested = 0;

  const canHarvestNotes = [];
  const inQueueNotes = [];

  notes.forEach(note => {
    const canHarvest = checkCanHarvest(note);
    const timeLeft = getTimeLeftMinutes(note);

    if (!note.commentsHarvestedAt) {
      neverHarvested++;
      canHarvestCount++;
      canHarvestNotes.push({ noteId: note.noteId, status: '待采集', priority: getHarvestPriority(note) });
    } else if (canHarvest) {
      canHarvestCount++;
      canHarvestNotes.push({ noteId: note.noteId, status: '可采集', priority: getHarvestPriority(note), timeLeft });
    } else {
      inQueueCount++;
      inQueueNotes.push({ noteId: note.noteId, status: `${Math.floor(timeLeft)}分钟`, priority: getHarvestPriority(note), timeLeft });
    }
  });

  console.log(`🟢 可采集: ${canHarvestCount} 条`);
  canHarvestNotes.slice(0, 10).forEach(n => {
    console.log(`   - ${n.noteId} [优先级:${n.priority}] ${n.status}`);
  });
  if (canHarvestNotes.length > 10) {
    console.log(`   ... 还有 ${canHarvestNotes.length - 10} 条`);
  }

  console.log('');
  console.log(`⏳ 排队中: ${inQueueCount} 条`);
  inQueueNotes.slice(0, 10).forEach(n => {
    console.log(`   - ${n.noteId} [优先级:${n.priority}] ${n.status}`);
  });
  if (inQueueNotes.length > 10) {
    console.log(`   ... 还有 ${inQueueNotes.length - 10} 条`);
  }

  console.log('');
  console.log(`📦 从未采集: ${neverHarvested} 条`);

  await mongoose.disconnect();
}

test().catch(console.error);
