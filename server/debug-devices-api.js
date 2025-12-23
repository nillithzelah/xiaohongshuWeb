// 调试设备 API 返回数据
const express = require('express');
const mongoose = require('mongoose');
const Device = require('./models/Device');
const User = require('./models/User');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/xiaohongshu_audit';

async function debugDevicesAPI() {
  await mongoose.connect(MONGODB_URI);
  console.log('数据库连接成功\n');

  try {
    const skip = 0;
    const limit = 10;

    const query = { isLocked: { $ne: true } };

    const devices = await Device.find(query)
      .populate('assignedUser', 'username nickname mentor_id')
      .populate('createdBy', 'username nickname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 手动populate mentor信息
    for (const device of devices) {
      if (device.assignedUser && device.assignedUser.mentor_id) {
        const mentor = await User.findById(device.assignedUser.mentor_id).select('username nickname');
        device.assignedUser.mentor_id = mentor;
      }
    }

    console.log('=== API 返回数据预览 ===');
    console.log('设备数量:', devices.length);
    console.log('');

    devices.forEach((device, index) => {
      console.log(`设备 ${index + 1}:`);
      console.log(`  _id: ${device._id}`);
      console.log(`  accountName: "${device.accountName}"`);
      console.log(`  accountName 类型: ${typeof device.accountName}`);
      console.log(`  accountName 长度: ${device.accountName ? device.accountName.length : 'N/A'}`);
      console.log(`  accountName JSON: ${JSON.stringify(device.accountName)}`);
      // 检查是否有不可见字符
      if (device.accountName) {
        const chars = [];
        for (let i = 0; i < device.accountName.length; i++) {
          const char = device.accountName[i];
          const code = device.accountName.charCodeAt(i);
          chars.push(`U+${code.toString(16).toUpperCase().padStart(4, '0')}:${char}`);
        }
        console.log(`  字符分析: ${chars.join(' ')}`);
      }
      console.log('');
    });

    console.log('=== 返回给前端的完整 JSON ===');
    const responseData = {
      success: true,
      data: devices,
      pagination: {
        page: 1,
        limit: 10,
        total: devices.length,
        pages: 1
      }
    };
    console.log(JSON.stringify(responseData, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

debugDevicesAPI();
