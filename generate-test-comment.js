const fs = require('fs');

// 生成测试评论数据
const testData = {
  "deviceId": "device_003",
  "imageType": "comment",
  "imageUrls": ["https://example.com/comment-screenshot.jpg"],
  "imageMd5s": [`test_md5_hash_comment_${Date.now()}`],
  "noteUrl": "https://www.xiaohongshu.com/explore/693e5d73000000001e00aab2?note_flow_source=wechat&xsec_token=CBdC1IAKDFifZngecxguDVTAbv8ozG8Bwc1B7Fwmo9750=",
  "noteAuthor": "阳 77",
  "commentContent": "还真是这样，我就是 我的天咯怎么办",
  "commentAuthor": "也许呢jgk"
};

// 写入文件
fs.writeFileSync('test_real_comment.json', JSON.stringify(testData, null, 2));
console.log('✅ 测试数据已生成:', testData.imageMd5s[0]);