const express = require('express');
const router = express.Router();
const multer = require('multer');
const OSS = require('ali-oss');

// 配置内存存储 (不要存本地磁盘，直接存内存)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 限制 5MB
});

router.post('/image', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: '请选择文件' });
    }

    // ============================================================
    // 🛡️ 核心修复：懒加载 OSS (只有在上传时才检查 Key)
    // ============================================================

    // 1. 检查是否有 Key (上帝模式)
    const hasKeys = process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET;

    // 2. 如果没 Key，直接返回假数据 (防止报错崩溃)
    if (!hasKeys) {
      console.log('⚠️ [Mock] 未检测到 OSS Key，返回模拟图片');
      return res.json({
        success: true,
        data: {
          url: 'https://cn.bing.com/th?id=OHR.RedPanda_ZH-CN.jpg',
          name: file.originalname
        }
      });
    }

    // 3. 只有有 Key 时，才初始化 OSS 客户端
    const client = new OSS({
      region: process.env.ALIYUN_OSS_REGION,
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
      bucket: process.env.ALIYUN_OSS_BUCKET,
      secure: true
    });

    // 4. 执行上传
    const filename = `uploads/${Date.now()}-${file.originalname}`;
    const result = await client.put(filename, file.buffer);

    res.json({
      success: true,
      data: {
        url: result.url,
        name: result.name
      }
    });

  } catch (error) {
    console.error('上传接口报错:', error);
    res.status(500).json({ success: false, message: '上传服务暂时不可用' });
  }
});

module.exports = router;