// MongoDB Compass 兼容的更新脚本
// 在 MongoDB Compass 中执行以下命令来更新用户积分

// 1. 查找所有用户
db.users.find({}, { username: 1, points: 1, role: 1, phone: 1 }).limit(20);

// 2. 更新用户 '123' 的积分到 100
db.users.updateOne(
  { username: "123" },
  { $set: { points: 100 } }
);

// 或者如果用户不存在，创建新用户
db.users.insertOne({
  username: "123",
  password: "$2a$10$encryptedpassword", // 需要加密的密码
  role: "part_time",
  points: 100,
  phone: "13800138000", // 示例手机号
  createdAt: new Date()
});

// 3. 验证更新结果
db.users.findOne({ username: "123" }, { username: 1, points: 1, role: 1 });