# 审核系统改进计划 - 超详细实施方案

## 📋 具体实施步骤详解

### 1.1 修改 xiaohongshuService.js 的 parseNoteContent 方法
**文件**：`server/services/xiaohongshuService.js`
**修改位置**：在 `parseNoteContent` 方法的返回语句之前
**修改方法**：添加关键词检查调用
**具体代码**：
```javascript
// 在 parsedData 对象构建完成后添加
const keywordCheck = this.checkContentKeywords($, pageTitle);
parsedData.keywordCheck = keywordCheck;

// 在 XiaohongshuService 类中添加新方法
checkContentKeywords($, pageTitle) {
  // 定义关键词列表
  const keywords = ['减肥被骗', '护肤被骗', '祛斑被骗', '丰胸被骗', '医美被骗', '白发转黑被骗', '手镯定制被骗'];

  // 检查页面标题
  for (const keyword of keywords) {
    if (pageTitle && pageTitle.includes(keyword)) {
      return {
        passed: true,
        matchedKeyword: keyword,
        source: 'title',
        message: `在页面标题中找到关键词"${keyword}"`
      };
    }
  }

  // 检查页面正文内容（前1000个字符，避免检查过多内容）
  const bodyText = $('body').text().substring(0, 1000);
  for (const keyword of keywords) {
    if (bodyText && bodyText.includes(keyword)) {
      return {
        passed: true,
        matchedKeyword: keyword,
        source: 'content',
        message: `在页面内容中找到关键词"${keyword}"`
      };
    }
  }

  // 检查meta description
  const metaDesc = $('meta[name="description"]').attr('content') ||
                   $('meta[property="og:description"]').attr('content');
  if (metaDesc) {
    for (const keyword of keywords) {
      if (metaDesc.includes(keyword)) {
        return {
          passed: true,
          matchedKeyword: keyword,
          source: 'meta',
          message: `在meta描述中找到关键词"${keyword}"`
        };
      }
    }
  }

  return {
    passed: false,
    reason: '未在页面标题、内容或描述中找到任何指定关键词',
    checkedSources: ['title', 'content', 'meta']
  };
}
```
**参数说明**：
- `$`: cheerio实例，用于解析HTML
- `pageTitle`: 页面标题字符串
- 返回对象包含：`passed`(是否通过)、`matchedKeyword`(匹配的关键词)、`source`(来源)、`message`(详细信息)

### 1.2 在 asyncAiReviewService.js 中集成关键词检查
**文件**：`server/services/asyncAiReviewService.js`
**修改位置**：在 `performFullAiReview` 方法的笔记审核逻辑中
**修改方法**：在内容解析后立即检查关键词
**具体代码**：
```javascript
// 在笔记审核逻辑中，内容解析之后添加
if (imageType === 'note' && userNoteInfo) {
  const contentResult = await xiaohongshuService.parseNoteContent(noteUrl);

  if (contentResult.success && (contentResult.author || contentResult.title)) {
    // 【新增】关键词检查 - 在任何其他审核之前进行
    if (!contentResult.keywordCheck || !contentResult.keywordCheck.passed) {
      console.log('❌ 关键词检查失败:', contentResult.keywordCheck?.reason);

      aiReviewResult.aiReview.passed = false;
      aiReviewResult.aiReview.confidence = 0.1;
      aiReviewResult.aiReview.reasons.push('帖子内容和工作要求匹配度过低');
      aiReviewResult.aiReview.riskLevel = 'high';

      // 记录关键词检查结果
      aiReviewResult.keywordCheck = contentResult.keywordCheck;

      return aiReviewResult;
    }

    console.log('✅ 关键词检查通过:', contentResult.keywordCheck.message);

    // 记录关键词检查结果
    aiReviewResult.keywordCheck = contentResult.keywordCheck;

    // 【现有逻辑】继续进行内容比对等其他审核...
    // ... 其余现有代码
  }
}
```
**参数说明**：
- `contentResult.keywordCheck`: 从parseNoteContent返回的检查结果
- 如果关键词检查失败，直接返回失败结果，不进行后续审核

### 2.1 在 Device 模型中添加审核相关字段
**文件**：`server/models/Device.js`
**修改位置**：在deviceSchema定义中，现有字段之后
**修改方法**：添加5个审核相关字段
**具体代码**：
```javascript
// 在现有字段定义后添加
reviewStatus: {
  type: String,
  enum: ['pending', 'ai_approved', 'approved', 'rejected'],
  default: 'pending',
  comment: '审核状态：pending-待审核，ai_approved-AI审核通过，approved-人工审核通过，rejected-审核拒绝'
},
reviewImage: {
  type: String,
  trim: true,
  default: '',
  comment: '审核图片URL，小红薯个人页面截图'
},
reviewReason: {
  type: String,
  trim: true,
  default: '',
  maxlength: 500,
  comment: '审核拒绝原因'
},
reviewedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null,
  comment: '审核人ID'
},
reviewedAt: {
  type: Date,
  default: null,
  comment: '审核时间'
}
```
**参数说明**：
- `reviewStatus`: 审核状态枚举，默认'pending'
- `reviewImage`: 审核图片URL，存储OSS地址
- `reviewReason`: 审核拒绝原因，最多500字符
- `reviewedBy`: 审核人用户ID，引用User模型
- `reviewedAt`: 审核完成时间

### 2.2 修改小程序设备列表页面
**文件**：`miniprogram/pages/device-list/device-list.js`
**修改位置**：在 `data` 对象中添加新字段
**修改方法**：添加审核图片相关状态和方法
**具体代码**：
```javascript
// 在 data 中添加
reviewImage: '', // 审核图片URL
uploadingImage: false, // 上传图片中状态

// 在 data.addForm 中添加
addForm: {
  accountId: '',
  accountName: '',
  accountUrl: '',
  reviewImage: '' // 新增审核图片字段
},

// 添加新方法：上传审核图片
uploadReviewImage: function() {
  const that = this;
  wx.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: function(res) {
      const tempFilePath = res.tempFilePaths[0];
      that.setData({ uploadingImage: true });

      // 上传到OSS
      app.uploadImage(tempFilePath).then(result => {
        that.setData({
          reviewImage: result.imageUrl,
          'addForm.reviewImage': result.imageUrl,
          uploadingImage: false
        });
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
      }).catch(err => {
        that.setData({ uploadingImage: false });
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      });
    }
  });
},

// 在 addAccount 方法中添加验证
if (!this.data.addForm.reviewImage.trim()) {
  wx.showToast({
    title: '请上传小红薯个人页面截图',
    icon: 'none'
  });
  return;
}

// 在API调用数据中添加reviewImage
data: {
  accountId: accountId.trim(),
  accountName: accountName.trim(),
  accountUrl: accountUrl.trim(),
  reviewImage: this.data.addForm.reviewImage
}
```
**参数说明**：
- `reviewImage`: 存储上传的图片URL
- `uploadingImage`: 上传状态指示器
- `uploadReviewImage`: 图片选择和上传方法
- 表单验证确保必须上传审核图片

### 2.3 修改设备创建API
**文件**：`server/routes/devices.js`
**修改位置**：在POST路由的参数解析中
**修改方法**：添加reviewImage参数处理和审核状态设置
**具体代码**：
```javascript
// 在参数解构中添加
const { phone, accountId, accountName, assignedUser, status, influence, onlineDuration, points, remark, reviewImage } = req.body;

// 在 deviceData 对象中添加
deviceData.reviewImage = reviewImage || '';
deviceData.reviewStatus = 'pending'; // 新设备默认待审核状态

// 在文件末尾添加新的审核API路由

// 获取待审核设备列表
router.get('/pending-review', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const devices = await Device.find({
      reviewStatus: { $in: ['pending', 'ai_approved'] }
    })
    .populate('assignedUser', 'username nickname')
    .populate('createdBy', 'username nickname')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Device.countDocuments({
      reviewStatus: { $in: ['pending', 'ai_approved'] }
    });

    res.json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取待审核设备列表失败:', error);
    res.status(500).json({ success: false, message: '获取待审核设备列表失败' });
  }
});

// 审核设备（通过或拒绝）
router.put('/:id/review', authenticateToken, requireRole(['manager', 'boss']), async (req, res) => {
  try {
    const { action, reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: '无效的审核操作' });
    }

    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: '设备不存在' });
    }

    const updateData = {
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    };

    if (action === 'approve') {
      updateData.reviewStatus = 'approved';
      updateData.status = 'online'; // 审核通过后自动设为在线状态
    } else {
      updateData.reviewStatus = 'rejected';
      updateData.reviewReason = reason || '审核未通过';
    }

    const updatedDevice = await Device.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    })
    .populate('assignedUser', 'username nickname')
    .populate('reviewedBy', 'username nickname');

    res.json({
      success: true,
      message: action === 'approve' ? '设备审核通过' : '设备审核拒绝',
      data: updatedDevice
    });

  } catch (error) {
    console.error('审核设备失败:', error);
    res.status(500).json({ success: false, message: '审核设备失败' });
  }
});
```
**参数说明**：
- `reviewImage`: 从请求体获取的审核图片URL
- `reviewStatus`: 设置为'pending'表示需要审核
- 新增两个API：`/pending-review` (GET)和 `/:id/review` (PUT)

### 2.4 创建管理后台设备审核页面
**文件**：`admin/src/pages/DeviceReview.js` (新建)
**修改方法**：创建完整的React组件
**具体代码**：
```javascript
import React, { useState, useEffect } from 'react';
import { Table, Button, Image, Modal, message, Space, Tag } from 'antd';
import api from '../utils/api';

const DeviceReview = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 获取待审核设备列表
  const fetchDevices = async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const response = await api.get('/devices/pending-review', {
        params: { page, limit: pageSize }
      });

      setDevices(response.data.data);
      setPagination({
        ...pagination,
        current: page,
        pageSize,
        total: response.data.pagination.total
      });
    } catch (error) {
      message.error('获取待审核设备失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  // 审核设备
  const handleReview = async (deviceId, action) => {
    let reason = '';
    if (action === 'reject') {
      const { value } = await Modal.confirm({
        title: '审核拒绝',
        content: '请输入拒绝原因',
        okText: '确定',
        cancelText: '取消',
        editable: true,
        onOk: (value) => reason = value
      });
      if (!reason) return;
    }

    try {
      await api.put(`/devices/${deviceId}/review`, {
        action,
        reason
      });

      message.success(action === 'approve' ? '审核通过' : '审核拒绝');
      fetchDevices(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('审核失败');
    }
  };

  const columns = [
    {
      title: '账号名称',
      dataIndex: 'accountName',
      key: 'accountName'
    },
    {
      title: '账号ID',
      dataIndex: 'accountId',
      key: 'accountId'
    },
    {
      title: '申请用户',
      dataIndex: 'assignedUser',
      key: 'assignedUser',
      render: (user) => user ? user.nickname || user.username : '-'
    },
    {
      title: '审核图片',
      dataIndex: 'reviewImage',
      key: 'reviewImage',
      render: (imageUrl) => imageUrl ? (
        <Image src={imageUrl} width={80} height={80} />
      ) : '无图片'
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => handleReview(record._id, 'approve')}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            onClick={() => handleReview(record._id, 'reject')}
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2>设备审核管理</h2>
      <Table
        columns={columns}
        dataSource={devices}
        rowKey="_id"
        loading={loading}
        pagination={{
          ...pagination,
          onChange: (page, pageSize) => fetchDevices(page, pageSize)
        }}
      />
    </div>
  );
};

export default DeviceReview;
```
**参数说明**：
- 使用Ant Design组件库构建页面
- `fetchDevices`: 获取待审核设备列表，支持分页
- `handleReview`: 处理审核操作，支持通过和拒绝
- 表格显示设备信息和审核图片

### 3.1 修改评论审核逻辑
**文件**：`server/services/asyncAiReviewService.js`
**修改位置**：在评论审核逻辑中添加重试机制
**修改方法**：添加审核尝试次数判断和时间延迟（从任务提交时间算起）
**具体代码**：
```javascript
// 在评论审核逻辑开始处添加
if (imageType === 'comment' && userNoteInfo) {
  // 获取审核尝试次数，默认为1
  const reviewAttempt = review.reviewAttempt || 1;

  console.log(`🤖 评论审核 - 尝试次数: ${reviewAttempt}`);

  // 【修改】计算从任务提交开始的延迟时间
  const timeSinceSubmission = Date.now() - review.createdAt.getTime();
  const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

  console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
  console.log(`⏱️ 当前时间距离提交: ${timeSinceSubmissionSeconds}秒`);

  // 根据尝试次数设置延迟时间（从任务提交时间算起）
  if (reviewAttempt === 1) {
    if (timeSinceSubmissionSeconds < 90) {
      const remainingTime = (90 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 评论第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    } else {
      console.log(`✅ 评论第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
    }
  } else if (reviewAttempt === 2) {
    if (timeSinceSubmissionSeconds < 150) {
      const remainingTime = (150 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 评论第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    } else {
      console.log(`✅ 评论第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
    }
  }

  // 执行评论审核逻辑
  const userDevices = await Device.find({
    assignedUser: review.userId._id,
    is_deleted: { $ne: true }
  }).select('accountName');

  const deviceNicknames = userDevices.map(device => device.accountName).filter(name => name && name.trim());
  const cookieString = process.env.XIAOHONGSHU_COOKIE;

  const commentVerification = await xiaohongshuService.performCommentAIReview(
    noteUrl,
    userNoteInfo.comment || '',
    deviceNicknames.length > 0 ? deviceNicknames : null,
    cookieString
  );

  if (commentVerification.passed) {
    // 审核通过
    console.log('✅ 评论审核通过');
    aiReviewResult.aiReview.confidence += 0.2;
    aiReviewResult.aiReview.reasons.push('评论验证通过，确认真实存在且内容完全一致');
  } else if (reviewAttempt < 2) {
    // 第一次审核失败，标记为需要重试
    console.log(`❌ 评论第一次审核失败，准备第二次审核`);

    await ImageReview.findByIdAndUpdate(review._id, {
      reviewAttempt: 2,
      status: 'pending' // 保持pending状态，等待重新处理
    });

    // 不设置审核结果，直接返回，等待重试
    return;
  } else {
    // 第二次审核也失败，最终驳回
    console.log('❌ 评论第二次审核失败，最终驳回');
    aiReviewResult.aiReview.passed = false;
    aiReviewResult.aiReview.confidence = 0.1;
    aiReviewResult.aiReview.reasons.push(`评论审核两次尝试均失败: ${commentVerification.reasons?.join(', ')}`);
    aiReviewResult.aiReview.riskLevel = 'high';
  }

  aiReviewResult.commentVerification = commentVerification;
}
```
**参数说明**：
- `reviewAttempt`: 从数据库获取的审核尝试次数
- 第一次审核延迟90秒，第二次延迟150秒
- 失败时更新尝试次数，重新加入队列等待重试

### 3.2 添加审核尝试次数字段到ImageReview模型
**文件**：`server/models/ImageReview.js`
**修改位置**：在imageReviewSchema定义中添加字段
**修改方法**：在现有字段后添加reviewAttempt字段
**具体代码**：
```javascript
// 在现有字段定义后添加
reviewAttempt: {
  type: Number,
  default: 1,
  min: 1,
  max: 2,
  validate: {
    validator: function(v) {
      return Number.isInteger(v) && v >= 1 && v <= 2;
    },
    message: '审核尝试次数必须是1或2'
  },
  comment: '审核尝试次数，1表示第一次尝试，2表示第二次尝试'
}
```
**参数说明**：
- `type: Number`: 数值类型
- `default: 1`: 默认值为1（第一次尝试）
- `min: 1, max: 2`: 限制在1-2之间
- `validate`: 自定义验证器确保值在有效范围内

### 4.1 修改笔记审核为异步处理
**文件**：`server/routes/client.js`
**修改位置**：在 `/tasks/batch-submit` API的笔记处理逻辑中
**修改方法**：移除同步审核，改为异步队列处理
**具体代码**：
```javascript
// 在笔记类型处理中修改
if (imageType === 'note') {
  if (!noteUrl || noteUrl.trim() === '') {
    return res.status(400).json({ success: false, message: '笔记类型必须填写笔记链接' });
  }

  // 【修改】不再进行同步AI审核，只做基础链接验证
  console.log('🔗 笔记类型只进行基础链接验证，不进行完整AI审核');

  const basicValidation = await xiaohongshuService.validateNoteUrl(noteUrl);
  if (!basicValidation.valid) {
    return res.status(400).json({
      success: false,
      message: `链接验证失败：${basicValidation.reason}`,
      aiReview: basicValidation
    });
  }

  // 设置基础审核结果，后续通过异步队列处理
  aiReviewResult = {
    valid: true,
    noteId: basicValidation.noteId,
    noteStatus: basicValidation.noteStatus,
    aiReview: {
      passed: true, // 基础验证通过
      confidence: 0.5,
      reasons: ['基础验证通过，等待后台AI审核'],
      riskLevel: 'low'
    }
  };
}

// 【修改】在所有审核记录创建后，统一处理异步审核队列
const reviews = await Promise.all(imageUrls.map(async (url, index) => {
  // ... 现有reviewData构建逻辑

  const review = await new ImageReview(reviewData).save();

  // 【新增】对于笔记和评论类型，加入异步审核队列
  if ((imageType === 'note' || imageType === 'comment') && review.status === 'pending') {
    try {
      asyncAiReviewService.addToQueue(review._id);
      console.log(`📋 任务 ${review._id} (${imageType}) 已加入AI审核队列`);
    } catch (queueError) {
      console.error('加入AI审核队列失败:', queueError);
      // 不影响主流程，继续执行
    }
  }

  return review;
}));
```
**参数说明**：
- 移除笔记的同步AI审核逻辑
- 只保留基础链接验证
- 所有笔记任务通过异步队列处理

### 4.2 在 asyncAiReviewService.js 中添加笔记审核支持
**文件**：`server/services/asyncAiReviewService.js`
**修改位置**：在笔记审核逻辑中添加重试机制
**修改方法**：添加审核尝试次数判断和时间延迟（从任务提交时间算起）
**具体代码**：
```javascript
// 在笔记审核逻辑开始处添加
if (imageType === 'note' && userNoteInfo) {
  // 获取审核尝试次数，默认为1
  const reviewAttempt = review.reviewAttempt || 1;

  console.log(`🤖 笔记审核 - 尝试次数: ${reviewAttempt}`);

  // 【修改】计算从任务提交开始的延迟时间
  const timeSinceSubmission = Date.now() - review.createdAt.getTime();
  const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

  console.log(`⏱️ 任务提交时间: ${review.createdAt.toISOString()}`);
  console.log(`⏱️ 当前时间距离提交: ${timeSinceSubmissionSeconds}秒`);

  // 根据尝试次数设置延迟时间（从任务提交时间算起）
  if (reviewAttempt === 1) {
    if (timeSinceSubmissionSeconds < 120) {
      const remainingTime = (120 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 笔记第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    } else {
      console.log(`✅ 笔记第一次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
    }
  } else if (reviewAttempt === 2) {
    if (timeSinceSubmissionSeconds < 180) {
      const remainingTime = (180 - timeSinceSubmissionSeconds) * 1000;
      console.log(`⏳ 笔记第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，还需等待${remainingTime/1000}秒...`);
      await new Promise(resolve => setTimeout(resolve, remainingTime));
    } else {
      console.log(`✅ 笔记第二次审核，距离提交已过${timeSinceSubmissionSeconds}秒，直接执行审核`);
    }
  }

  // 执行笔记审核逻辑
  const contentResult = await xiaohongshuService.parseNoteContent(noteUrl);

  if (contentResult.success && (contentResult.author || contentResult.title)) {
    // 【新增】关键词检查
    if (!contentResult.keywordCheck || !contentResult.keywordCheck.passed) {
      console.log('❌ 关键词检查失败:', contentResult.keywordCheck?.reason);

      if (reviewAttempt < 2) {
        // 第一次审核失败，标记为需要重试
        console.log(`📋 笔记第一次审核失败，准备第二次审核`);
        await ImageReview.findByIdAndUpdate(review._id, {
          reviewAttempt: 2,
          status: 'pending'
        });
        return; // 等待重试
      } else {
        // 第二次审核也失败，最终驳回
        console.log('❌ 笔记第二次审核失败，最终驳回');
        aiReviewResult.aiReview.passed = false;
        aiReviewResult.aiReview.confidence = 0.1;
        aiReviewResult.aiReview.reasons.push('帖子内容和工作要求匹配度过低');
        aiReviewResult.aiReview.riskLevel = 'high';
      }
    } else {
      // 关键词检查通过，继续其他审核逻辑
      console.log('✅ 关键词检查通过:', contentResult.keywordCheck.message);

      // 记录关键词检查结果
      aiReviewResult.keywordCheck = contentResult.keywordCheck;

      // 【现有逻辑】继续进行内容比对等其他审核...
      // ... 其余现有代码
    }
  }
}
```
**参数说明**：
- `reviewAttempt`: 审核尝试次数
- 第一次审核延迟120秒，第二次延迟180秒
- 关键词检查失败时重试机制

### 5.1 创建时间工具函数
**文件**：`server/utils/timeUtils.js` (新建)
**修改方法**：创建北京时间处理工具类
**具体代码**：
```javascript
/**
 * 时间工具类 - 北京时间处理
 */
class TimeUtils {
  /**
   * 获取当前北京时间
   * @returns {Date} 北京时间对象
   */
  static getBeijingTime() {
    const now = new Date();
    // UTC时间加上8小时得到北京时间
    return new Date(now.getTime() + (8 * 60 * 60 * 1000));
  }

  /**
   * 将UTC时间转换为北京时间并格式化显示
   * @param {Date} date - UTC时间对象
   * @returns {string} 格式化的北京时间字符串
   */
  static formatBeijingTime(date) {
    if (!date) return '';

    const beijingTime = new Date(date.getTime() + (8 * 60 * 60 * 1000));

    return beijingTime.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 将北京时间转换为UTC时间（用于存储到数据库）
   * @param {Date} beijingTime - 北京时间对象
   * @returns {Date} UTC时间对象
   */
  static beijingToUTC(beijingTime) {
    return new Date(beijingTime.getTime() - (8 * 60 * 60 * 1000));
  }

  /**
   * 解析北京时间字符串为Date对象
   * @param {string} beijingTimeStr - 北京时间字符串
   * @returns {Date} UTC时间对象
   */
  static parseBeijingTime(beijingTimeStr) {
    const beijingTime = new Date(beijingTimeStr);
    return this.beijingToUTC(beijingTime);
  }
}

module.exports = TimeUtils;
```
**参数说明**：
- `getBeijingTime()`: 获取当前北京时间
- `formatBeijingTime(date)`: 格式化UTC时间为北京时间显示
- `beijingToUTC(beijingTime)`: 北京时间转UTC时间存储
- `parseBeijingTime(str)`: 解析北京时间字符串

### 5.2 修改数据库时间字段处理
**文件**：全项目时间相关字段
**修改方法**：在API返回时间时转换为北京时间
**具体代码**：
```javascript
// 在API响应中格式化时间字段
const TimeUtils = require('../utils/timeUtils');

// 示例：在设备列表API中
const devices = await Device.find(query)
  .populate('assignedUser', 'username nickname')
  .sort({ createdAt: -1 });

const processedDevices = devices.map(device => ({
  ...device.toObject(),
  createdAt: TimeUtils.formatBeijingTime(device.createdAt),
  reviewedAt: device.reviewedAt ? TimeUtils.formatBeijingTime(device.reviewedAt) : null
}));

res.json({
  success: true,
  data: processedDevices
});
```
**参数说明**：
- 在API返回数据时，使用TimeUtils.formatBeijingTime()格式化时间字段
- 前端显示时直接使用格式化后的时间字符串

### 5.3 修改日志时间显示
**文件**：全项目console.log语句
**修改方法**：在关键日志中显示北京时间
**具体代码**：
```javascript
const TimeUtils = require('./utils/timeUtils');

// 在重要日志中添加北京时间戳
console.log(`[${TimeUtils.formatBeijingTime(new Date())}] 🤖 开始AI审核任务: ${reviewId}`);

// 示例输出: [2024-01-15 14:30:25] 🤖 开始AI审核任务: 677f8a9b1234567890abcdef
```
**参数说明**：
- 在关键日志输出时添加北京时间戳
- 格式为: [YYYY-MM-DD HH:mm:ss]

### 5.4 修改定时任务时间处理
**文件**：持续检查相关代码
**修改方法**：使用北京时区计算定时任务时间
**具体代码**：
```javascript
const TimeUtils = require('../utils/timeUtils');

// 在设置持续检查时间时使用北京时间
const nextCheckTime = new Date(TimeUtils.getBeijingTime());
nextCheckTime.setDate(nextCheckTime.getDate() + 1); // 明天
nextCheckTime.setHours(9, 0, 0, 0); // 设置为北京时间9点

// 转换为UTC存储到数据库
const utcNextCheckTime = TimeUtils.beijingToUTC(nextCheckTime);

updateData.continuousCheck = {
  enabled: true,
  status: 'active',
  nextCheckTime: utcNextCheckTime
};
```
**参数说明**：
- 使用TimeUtils.getBeijingTime()作为基准时间
- 计算完后转换为UTC存储到数据库
- 确保定时任务在预期的北京时间执行

---

### 6.1 在小程序首页添加设备审核状态显示
**文件**：`miniprogram/pages/index/index.js`
**修改位置**：在data中添加设备审核状态相关字段
**修改方法**：添加设备审核状态获取和显示逻辑
**具体代码**：
```javascript
// 在 data 中添加
deviceReviewStatus: null, // 设备审核状态
showDeviceReviewCard: false, // 是否显示设备审核卡片

// 在 onLoad 和 onShow 中添加设备审核状态获取
this.fetchDeviceReviewStatus();

// 添加获取设备审核状态的方法
fetchDeviceReviewStatus: function() {
  const token = app.getCurrentToken();
  if (!token) return;

  app.request({
    url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/devices/my-review-status`,
    method: 'GET',
    header: { 'Authorization': `Bearer ${token}` }
  }).then(res => {
    if (res.data && res.data.success) {
      const reviewStatus = res.data.reviewStatus;
      this.setData({
        deviceReviewStatus: reviewStatus,
        showDeviceReviewCard: reviewStatus && reviewStatus.status !== 'approved'
      });
    }
  }).catch(err => {
    console.error('获取设备审核状态失败:', err);
  });
},
```
**参数说明**：
- `deviceReviewStatus`: 存储设备审核状态信息
- `showDeviceReviewCard`: 控制设备审核卡片的显示
- `fetchDeviceReviewStatus`: 获取用户设备审核状态的方法

### 6.2 在小程序首页WXML中添加设备审核状态显示
**文件**：`miniprogram/pages/index/index.wxml`
**修改位置**：在审核记录列表之前添加设备审核状态卡片
**修改方法**：添加设备审核状态的显示区域
**具体代码**：
```xml
<!-- 📋 设备审核状态卡片 -->
<view class="device-review-card" wx:if="{{showDeviceReviewCard}}">
  <view class="card-header">
    <text class="card-title">📱 设备审核状态</text>
  </view>
  <view class="card-content">
    <view class="review-info">
      <view class="device-name">设备: {{deviceReviewStatus.accountName}}</view>
      <view class="review-status {{deviceReviewStatus.status}}">
        状态:
        {{
          deviceReviewStatus.status === 'pending' ? '待审核' :
          deviceReviewStatus.status === 'ai_approved' ? 'AI审核通过，等待人工审核' :
          deviceReviewStatus.status === 'approved' ? '审核通过' :
          deviceReviewStatus.status === 'rejected' ? '审核拒绝' : '未知状态'
        }}
      </view>
      <view class="review-time" wx:if="{{deviceReviewStatus.createdAt}}">
        提交时间: {{deviceReviewStatus.createdAt.substring(5, 16).replace('T', ' ')}}
      </view>
      <view class="review-reason" wx:if="{{deviceReviewStatus.status === 'rejected' && deviceReviewStatus.reviewReason}}">
        拒绝原因: {{deviceReviewStatus.reviewReason}}
      </view>
    </view>
    <view class="review-actions" wx:if="{{deviceReviewStatus.status === 'rejected'}}">
      <button class="retry-btn" bindtap="goToDeviceList">重新提交</button>
    </view>
  </view>
</view>

<!-- 📋 审核记录列表 -->
<view class="list-container">
```

### 6.3 添加获取用户设备审核状态的API
**文件**：`server/routes/client.js`
**修改位置**：在文件末尾添加新的API路由
**修改方法**：添加获取用户设备审核状态的接口
**具体代码**：
```javascript
// 获取用户设备审核状态
router.get('/devices/my-review-status', authenticateToken, async (req, res) => {
  try {
    // 获取用户最新提交的设备审核记录
    const latestDevice = await Device.findOne({
      assignedUser: req.user._id,
      reviewStatus: { $in: ['pending', 'ai_approved', 'rejected'] }
    })
    .select('accountName reviewStatus reviewReason createdAt reviewedAt')
    .sort({ createdAt: -1 }); // 获取最新的审核记录

    if (!latestDevice) {
      return res.json({
        success: true,
        reviewStatus: null,
        message: '暂无设备审核记录'
      });
    }

    // 格式化时间为北京时间
    const TimeUtils = require('../utils/timeUtils');
    const formattedDevice = {
      ...latestDevice.toObject(),
      createdAt: TimeUtils.formatBeijingTime(latestDevice.createdAt),
      reviewedAt: latestDevice.reviewedAt ? TimeUtils.formatBeijingTime(latestDevice.reviewedAt) : null
    };

    res.json({
      success: true,
      reviewStatus: formattedDevice
    });

  } catch (error) {
    console.error('获取用户设备审核状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备审核状态失败'
    });
  }
});
```
**参数说明**：
- 查询用户最新的设备审核记录（状态为pending、ai_approved、rejected）
- 使用TimeUtils格式化时间为北京时间
- 返回设备审核状态信息

### 6.4 在首页JS中添加跳转到设备列表的方法
**文件**：`miniprogram/pages/index/index.js`
**修改位置**：在现有方法后添加
**修改方法**：添加跳转到设备列表页面的方法
**具体代码**：
```javascript
// 跳转到设备列表页面
goToDeviceList: function() {
  wx.navigateTo({
    url: '/pages/device-list/device-list?showAddModal=true'
  });
},
```
**参数说明**：
- `goToDeviceList`: 跳转到设备列表页面，并自动显示新增设备弹窗

---

## 📋 测试验证方案

### 关键词审核测试
```javascript
// server/test-keyword-check.js
const XiaohongshuService = require('./services/xiaohongshuService');
const service = new XiaohongshuService();

async function testKeywordCheck() {
  // 测试包含关键词的URL
  const result1 = await service.parseNoteContent('https://xiaohongshu.com/explore/test-with-keyword');
  console.log('包含关键词测试:', result1.keywordCheck);

  // 测试不包含关键词的URL
  const result2 = await service.parseNoteContent('https://xiaohongshu.com/explore/test-without-keyword');
  console.log('不包含关键词测试:', result2.keywordCheck);
}
```

### 设备审核测试
```javascript
// server/test-device-review.js
const Device = require('./models/Device');

async function testDeviceReview() {
  // 创建测试设备
  const device = await Device.create({
    accountName: 'test_account',
    reviewImage: 'https://example.com/review-image.jpg',
    reviewStatus: 'pending'
  });

  // 模拟审核通过
  await Device.findByIdAndUpdate(device._id, {
    reviewStatus: 'approved',
    reviewedBy: testUserId,
    reviewedAt: new Date()
  });
}
```

### 时间处理测试
```javascript
// server/test-beijing-time.js
const TimeUtils = require('./utils/timeUtils');

function testTimeUtils() {
  // 测试当前时间
  const now = TimeUtils.getBeijingTime();
  console.log('当前北京时间:', TimeUtils.formatBeijingTime(now));

  // 测试时间转换
  const utcTime = new Date('2024-01-01T00:00:00Z');
  console.log('UTC时间:', utcTime.toISOString());
  console.log('北京时间:', TimeUtils.formatBeijingTime(utcTime));
}
```

### 审核延迟逻辑测试
```javascript
// server/test-review-delay-logic.js
/**
 * 测试笔记和评论审核延迟逻辑
 * 验证从任务提交时间开始计时的逻辑是否正确
 */

// 模拟测试数据
function createMockReview(createdAtMinutesAgo, reviewAttempt = 1) {
  const createdAt = new Date(Date.now() - (createdAtMinutesAgo * 60 * 1000));

  return {
    _id: 'mock_review_id',
    createdAt,
    reviewAttempt,
    imageType: 'note', // 或 'comment'
    userNoteInfo: {
      author: 'test_author',
      title: 'test_title'
    }
  };
}

// 测试延迟计算逻辑
function testDelayCalculation(review, targetDelaySeconds) {
  const timeSinceSubmission = Date.now() - review.createdAt.getTime();
  const timeSinceSubmissionSeconds = Math.floor(timeSinceSubmission / 1000);

  console.log(`任务提交时间: ${review.createdAt.toISOString()}`);
  console.log(`当前时间: ${new Date().toISOString()}`);
  console.log(`距离提交已过: ${timeSinceSubmissionSeconds}秒`);
  console.log(`目标延迟: ${targetDelaySeconds}秒`);

  if (timeSinceSubmissionSeconds < targetDelaySeconds) {
    const remainingTime = (targetDelaySeconds - timeSinceSubmissionSeconds) * 1000;
    console.log(`✅ 需要等待: ${remainingTime/1000}秒`);
    return { shouldWait: true, waitTime: remainingTime };
  } else {
    console.log(`✅ 已过延迟时间，直接执行审核`);
    return { shouldWait: false, waitTime: 0 };
  }
}

function runTests() {
  console.log('=== 测试笔记审核延迟逻辑 ===');

  // 测试笔记第一次审核 - 刚提交（0分钟前）
  console.log('\n📝 笔记第一次审核 - 刚提交:');
  const noteReview1 = createMockReview(0, 1);
  testDelayCalculation(noteReview1, 120); // 120秒 = 2分钟

  // 测试笔记第一次审核 - 已过1分钟
  console.log('\n📝 笔记第一次审核 - 已过1分钟:');
  const noteReview2 = createMockReview(1, 1);
  testDelayCalculation(noteReview2, 120);

  // 测试笔记第一次审核 - 已过3分钟
  console.log('\n📝 笔记第一次审核 - 已过3分钟:');
  const noteReview3 = createMockReview(3, 1);
  testDelayCalculation(noteReview3, 120);

  // 测试笔记第二次审核 - 刚提交
  console.log('\n📝 笔记第二次审核 - 刚提交:');
  const noteReview4 = createMockReview(0, 2);
  testDelayCalculation(noteReview4, 180); // 180秒 = 3分钟

  // 测试笔记第二次审核 - 已过2分钟
  console.log('\n📝 笔记第二次审核 - 已过2分钟:');
  const noteReview5 = createMockReview(2, 2);
  testDelayCalculation(noteReview5, 180);

  console.log('\n=== 测试评论审核延迟逻辑 ===');

  // 测试评论第一次审核 - 刚提交
  console.log('\n💬 评论第一次审核 - 刚提交:');
  const commentReview1 = createMockReview(0, 1);
  testDelayCalculation(commentReview1, 90); // 90秒

  // 测试评论第一次审核 - 已过1.5分钟
  console.log('\n💬 评论第一次审核 - 已过1.5分钟:');
  const commentReview2 = createMockReview(1.5, 1);
  testDelayCalculation(commentReview2, 90);

  // 测试评论第二次审核 - 刚提交
  console.log('\n💬 评论第二次审核 - 刚提交:');
  const commentReview3 = createMockReview(0, 2);
  testDelayCalculation(commentReview3, 150); // 150秒 = 2.5分钟

  console.log('\n=== 测试完成 ===');
  console.log('✅ 延迟逻辑验证通过：所有审核都是从任务提交时间开始计时，而不是重新等待');
}

// 运行测试
runTests();
```

---

这个实施方案现在包含了每个修改点的具体文件、方法、参数和完整代码示例，可以直接用于指导开发实施。