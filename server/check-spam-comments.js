const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/xiaohongshu_audit')
  .then(async () => {
    const CommentLead = mongoose.model('CommentLead', new mongoose.Schema({}, { strict: false }));

    // 搜索用户提到的特定垃圾评论关键词
    const spamKeywords = ['互帮', '别放过', '就是要要回来', '不是我的已经追回来了'];

    for (const keyword of spamKeywords) {
      console.log('\n========== 搜索关键词: ' + keyword + ' ==========');
      const results = await CommentLead.find({
        content: { $regex: keyword, $options: 'i' }
      }).sort({ createdAt: -1 }).limit(3);

      if (results.length === 0) {
        console.log('未找到包含此关键词的评论');
      } else {
        results.forEach(r => {
          console.log('内容:', r.content?.substring(0, 100));
          console.log('AI分类:', r.aiAnalysis?.category, '| 置信度:', r.aiAnalysis?.confidence_score);
          console.log('isPotentialLead:', r.aiAnalysis?.isPotentialLead, '| shouldContact:', r.aiAnalysis?.shouldContact);
          console.log('创建时间:', r.createdAt);
          console.log('---');
        });
      }
    }

    // 再搜索一下"已经褪了"、"及时止损"等新的引流词
    console.log('\n========== 新引流词检测 ==========');
    const newKeywords = ['已经褪了', '及时止损啦', '不会的来问', '姐妹们来问'];

    for (const keyword of newKeywords) {
      console.log('\n搜索: ' + keyword);
      const results = await CommentLead.find({
        content: { $regex: keyword, $options: 'i' }
      }).sort({ createdAt: -1 }).limit(2);

      if (results.length === 0) {
        console.log('  未找到');
      } else {
        results.forEach(r => {
          console.log('  内容:', r.content?.substring(0, 80));
          console.log('  AI分类:', r.aiAnalysis?.category, '| 潜在客户:', r.aiAnalysis?.isPotentialLead);
        });
      }
    }

    await mongoose.connection.close();
  })
  .catch(err => console.error('连接失败:', err.message));
