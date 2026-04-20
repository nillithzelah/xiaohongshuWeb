const mongoose = require('mongoose');

(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit');
  const DiscoveredNote = require('./models/DiscoveredNote');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const notes = await DiscoveredNote.find({
    createdAt: { $gte: today }
  }).sort({ createdAt: -1 });

  // 13类别关键词
  const category13 = ['减肥', '医美', '祛斑', '祛痘', '丰胸', '护肤', '眼袋', '育发', '玉石', '女性调理', '增高', 'HPV', '赌石', '保健品', '美容院', '整容', '整形', '植发', '生发', '减肥药', '减肥机构', '白发', '乌发'];

  // 通用维权关键词（不涉及13类）
  const generalKeywords = ['退费维权', '维权教程', '退费流程', '支付宝', '网购', '闲鱼', '淘宝', '拼多多', '反诈', '防骗', '刷单', '杀猪盘', 'P2P', '博彩', '网络诈骗', '电信诈骗', '教育机构', '培训机构', '课程', '学费', '录播视频', '直播间'];

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 可能的误判笔记（不涉及13类别的通用维权）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let suspiciousCount = 0;
  const suspiciousNotes = [];

  for (const note of notes) {
    if (!note.aiAnalysis?.is_genuine_victim_post) continue;

    const noteId = note.noteId || '???';
    const reason = note.aiAnalysis?.reason || '';
    const title = note.title || '';
    const content = title + ' ' + reason;

    // 检查是否涉及13类别
    const has13Category = category13.some(kw => content.includes(kw));

    // 检查是否包含通用维权关键词
    const hasGeneralKeyword = generalKeywords.some(kw => content.includes(kw));

    // 检查reason中是否明确说"不涉及13类"
    const saysNot13Category = reason.includes('不涉及13类') || reason.includes('虽未涉及13类') || reason.includes('非13类');

    // 判断：不涉及13类 且 包含通用维权关键词 或 AI明确说不涉及13类
    if ((!has13Category && hasGeneralKeyword) || saysNot13Category) {
      suspiciousCount++;
      console.log('[' + suspiciousCount + '] ' + noteId.slice(0, 14) + '...');
      console.log('   标题: ' + title.substring(0, 60));
      console.log('   理由: ' + reason.substring(0, 100) + '...');
      console.log('');
      suspiciousNotes.push(noteId);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 共发现 ' + suspiciousCount + ' 条可能的误判');

  await mongoose.disconnect();
})().catch(console.error);
