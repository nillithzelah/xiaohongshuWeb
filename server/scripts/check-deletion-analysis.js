// 查询删除分析遗留数据
print("=== 删除分析数据统计 ===\n");

// 1. 有 deletionRecheckAnalysis 的笔记总数
let recheckCount = db.discoverednotes.countDocuments({
  "deletionRecheckAnalysis.checkedAt": { $exists: true }
});
print("有 deletionRecheckAnalysis 的笔记总数: " + recheckCount);

// 2. 按 noteStatus 分组
let byNoteStatus = db.discoverednotes.aggregate([
  { $match: { "deletionRecheckAnalysis.checkedAt": { $exists: true } } },
  { $group: { _id: "$noteStatus", count: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]).toArray();
print("\n按 noteStatus 分组:");
byNoteStatus.forEach(x => print("  " + x._id + ": " + x.count));

// 3. 按 AI 分析结果分组
let byAiResult = db.discoverednotes.aggregate([
  { $match: { "deletionRecheckAnalysis.checkedAt": { $exists: true } } },
  { $group: { _id: "$deletionRecheckAnalysis.is_genuine_victim_post", count: { $sum: 1 } } },
  { $sort: { _id: -1 } }
]).toArray();
print("\n按 AI 分析结果分组:");
byAiResult.forEach(x => print("  " + (x._id ? "✅ 通过(真实维权)" : "❌ 拒绝(非真实维权)") + ": " + x.count));

// 4. 按 scam_category 分组
let byScamCategory = db.discoverednotes.aggregate([
  { $match: { "deletionRecheckAnalysis.checkedAt": { $exists: true }, "deletionRecheckAnalysis.scam_category": { $exists: true, $ne: "" } } },
  { $group: { _id: "$deletionRecheckAnalysis.scam_category", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]).toArray();
print("\n按诈骗类别分组 (scam_category):");
byScamCategory.forEach(x => print("  " + x._id + ": " + x.count));

// 5. 最近5条复审记录
let recent = db.discoverednotes.find({
  "deletionRecheckAnalysis.checkedAt": { $exists: true }
}).sort({ "deletionRecheckAnalysis.checkedAt": -1 }).limit(5).toArray();
print("\n最近5条复审记录:");
recent.forEach(x => {
  let id = x.noteId || "N/A";
  let status = x.noteStatus || "N/A";
  let aiPass = x.deletionRecheckAnalysis.is_genuine_victim_post ? "✅通过" : "❌拒绝";
  let checkedAt = x.deletionRecheckAnalysis.checkedAt ? new Date(x.deletionRecheckAnalysis.checkedAt).toLocaleString("zh-CN") : "N/A";
  let reason = x.deletionRecheckAnalysis.reason || "";
  if (reason.length > 30) reason = reason.substring(0, 30) + "...";
  print("  " + id + " | " + status + " | " + aiPass + " | " + checkedAt);
  if (reason) print("    理由: " + reason);
});
