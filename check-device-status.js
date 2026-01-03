const { exec } = require('child_process');

console.log('🔍 查询服务器数据库中的设备状态分布...\n');

// 查询设备状态分布
const mongoScript = `
print("=== 设备状态(status)分布 ===");
db.devices.aggregate([
  {\$group: {_id: "\$status", count: {\$sum: 1}}},
  {\$sort: {count: -1}}
]).forEach(function(doc) {
  print(doc._id + ": " + doc.count);
});

print("\\n=== 设备审核状态(reviewStatus)分布 ===");
db.devices.aggregate([
  {\$group: {_id: "\$reviewStatus", count: {\$sum: 1}}},
  {\$sort: {count: -1}}
]).forEach(function(doc) {
  print(doc._id + ": " + doc.count);
});

print("\\n=== 总设备数 ===");
print("总计: " + db.devices.count());

print("\\n=== 各状态说明 ===");
print("status 字段（设备在线状态）:");
print("  - online: 在线");
print("  - offline: 离线");
print("  - protected: 保护中");
print("  - frozen: 冻结");
print("  - reviewing: 审核中");

print("\\nreviewStatus 字段（设备审核状态）:");
print("  - pending: 待审核");
print("  - ai_approved: AI审核通过");
print("  - approved: 人工审核通过");
print("  - rejected: 审核拒绝");

print("\\n=== 小程序显示条件 ===");
print("设备要显示在小程序中，必须满足：");
print("1. assignedUser: 当前用户ID");
print("2. is_deleted: false (未删除)");
print("3. reviewStatus: ai_approved 或 approved (审核通过)");
`;

const cmd1 = `ssh wubug "mongo xiaohongshu_audit --eval \\"${mongoScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}\\""`;

exec(cmd1, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ 执行失败:', error);
    return;
  }

  if (stderr) {
    console.error('⚠️  错误输出:', stderr);
  }

  console.log(stdout);
});