const express = require('express');
const router = express.Router();
const multer = require('multer');
const OSS = require('ali-oss');

// 配置内存存储 (不要存本地磁盘，直接存内存)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 限制 10MB（增加限制）
});

router.post('/image', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: '请选择文件' });
    }

    // 文件类型验证
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ success: false, message: '只允许上传图片文件' });
    }

    // 额外验证文件头（防止伪造mimetype）
    const fileHeader = file.buffer.slice(0, 8);
    let isValidImage = false;

    // JPEG: FF D8 FF
    if (fileHeader[0] === 0xFF && fileHeader[1] === 0xD8 && fileHeader[2] === 0xFF) {
      isValidImage = true;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    else if (fileHeader[0] === 0x89 && fileHeader[1] === 0x50 && fileHeader[2] === 0x4E &&
             fileHeader[3] === 0x47 && fileHeader[4] === 0x0D && fileHeader[5] === 0x0A &&
             fileHeader[6] === 0x1A && fileHeader[7] === 0x0A) {
      isValidImage = true;
    }
    // GIF: 47 49 46 38
    else if (fileHeader[0] === 0x47 && fileHeader[1] === 0x49 && fileHeader[2] === 0x46 &&
             fileHeader[3] === 0x38) {
      isValidImage = true;
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    else if (fileHeader[0] === 0x52 && fileHeader[1] === 0x49 && fileHeader[2] === 0x46 &&
             fileHeader[3] === 0x46 && fileHeader[8] === 0x57 && fileHeader[9] === 0x45 &&
             fileHeader[10] === 0x42 && fileHeader[11] === 0x50) {
      isValidImage = true;
    }

    if (!isValidImage) {
      return res.status(400).json({ success: false, message: '文件格式不正确，请上传有效的图片文件' });
    }

    // ============================================================
    // 🛡️ 核心修复：懒加载 OSS (只有在上传时才检查 Key)
    // ============================================================

    // 1. 检查是否有 Key (强制使用真实OSS上传)
    const hasKeys = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET;

    // 2. 如果没 Key，返回错误提示
    if (!hasKeys) {
      console.log('❌ [Error] 未检测到 OSS Key，无法上传');
      return res.status(500).json({
        success: false,
        message: 'OSS配置缺失，无法上传图片'
      });
    }

    // 3. 只有有 Key 时，才初始化 OSS 客户端
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true
    });

    // 4. 执行上传
    const filename = `uploads/${Date.now()}-${file.originalname}`;
    const result = await client.put(filename, file.buffer);

    // 确保返回 HTTPS URL
    const httpsUrl = result.url.replace('http://', 'https://');

    res.json({
      success: true,
      data: {
        url: httpsUrl,
        name: result.name
      }
    });

  } catch (error) {
    console.error('上传接口报错:', error);
    res.status(500).json({ success: false, message: '上传服务暂时不可用' });
  }
});

// 批量上传多张图片
router.post('/images', upload.array('files', 9), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: '请选择文件' });
    }

    // 文件类型验证
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({ success: false, message: '只允许上传图片文件' });
      }

      // 额外验证文件头
      const fileHeader = file.buffer.slice(0, 8);
      let isValidImage = false;

      // JPEG: FF D8 FF
      if (fileHeader[0] === 0xFF && fileHeader[1] === 0xD8 && fileHeader[2] === 0xFF) {
        isValidImage = true;
      }
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      else if (fileHeader[0] === 0x89 && fileHeader[1] === 0x50 && fileHeader[2] === 0x4E &&
               fileHeader[3] === 0x47 && fileHeader[4] === 0x0D && fileHeader[5] === 0x0A &&
               fileHeader[6] === 0x1A && fileHeader[7] === 0x0A) {
        isValidImage = true;
      }
      // GIF: 47 49 46 38
      else if (fileHeader[0] === 0x47 && fileHeader[1] === 0x49 && fileHeader[2] === 0x46 &&
               fileHeader[3] === 0x38) {
        isValidImage = true;
      }
      // WebP: 52 49 46 46 ... 57 45 42 50
      else if (fileHeader[0] === 0x52 && fileHeader[1] === 0x49 && fileHeader[2] === 0x46 &&
               fileHeader[3] === 0x46 && fileHeader[8] === 0x57 && fileHeader[9] === 0x45 &&
               fileHeader[10] === 0x42 && fileHeader[11] === 0x50) {
        isValidImage = true;
      }

      if (!isValidImage) {
        return res.status(400).json({ success: false, message: '文件格式不正确，请上传有效的图片文件' });
      }
    }

    // 检查OSS配置
    const hasKeys = process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET;
    if (!hasKeys) {
      console.log('❌ [Error] 未检测到 OSS Key，无法上传');
      return res.status(500).json({
        success: false,
        message: 'OSS配置缺失，无法上传图片'
      });
    }

    // 初始化OSS客户端
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
      secure: true
    });

    // 批量上传到OSS
    const results = await Promise.all(files.map(file => {
      const filename = `uploads/${Date.now()}-${file.originalname}`;
      return client.put(filename, file.buffer);
    }));

    // 返回所有图片URL
    const imageUrls = results.map(result => result.url.replace('http://', 'https://'));

    res.json({
      success: true,
      data: {
        urls: imageUrls,
        count: imageUrls.length
      }
    });

  } catch (error) {
    console.error('批量上传失败:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

module.exports = router;