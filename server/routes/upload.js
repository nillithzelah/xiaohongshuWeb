const express = require('express');
const multer = require('multer');
const OSS = require('ali-oss');
const ImageReview = require('../models/ImageReview');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// 配置multer内存存储
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'));
    }
  }
});

// 初始化阿里云OSS客户端
const ossClient = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET
});

// 上传图片到OSS
const uploadToOSS = async (fileBuffer, fileName) => {
  try {
    const result = await ossClient.put(fileName, fileBuffer);
    return result.url;
  } catch (error) {
    console.error('上传到OSS失败:', error);
    throw error;
  }
};

// 上传图片
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '没有上传文件' });
    }

    const { imageType } = req.body;

    if (!imageType || !['login_qr', 'note', 'comment'].includes(imageType)) {
      return res.status(400).json({ success: false, message: '无效的图片类型' });
    }

    // 生成唯一文件名
    const fileName = `images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${req.file.mimetype.split('/')[1]}`;

    // 上传到OSS
    const imageUrl = await uploadToOSS(req.file.buffer, fileName);

    // 创建审核记录
    const imageReview = new ImageReview({
      userId: req.user._id,
      imageUrl,
      imageType
    });

    await imageReview.save();

    res.json({
      success: true,
      message: '图片上传成功，等待审核',
      imageReview: {
        id: imageReview._id,
        imageUrl,
        imageType,
        status: imageReview.status,
        createdAt: imageReview.createdAt
      }
    });

  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({ success: false, message: '上传失败' });
  }
});

module.exports = router;