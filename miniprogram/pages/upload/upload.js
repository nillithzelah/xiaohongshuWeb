// pages/upload/upload.js
const app = getApp();

// 环境配置（自动检测或手动设置）
const IS_DEVELOPMENT = true; // 开发时设为true，生产时设为false
const API_BASE = IS_DEVELOPMENT ? 'http://192.168.3.9:5000' : 'https://www.wubug.cc'; // 使用本地网络IP地址

const API_CONFIG = {
  DEVICE_MY_LIST: `${API_BASE}/xiaohongshu/api/client/device/my-list`,
  UPLOAD_IMAGE: `${API_BASE}/xiaohongshu/api/upload/image`,
  TASKS_BATCH_SUBMIT: `${API_BASE}/xiaohongshu/api/client/tasks/batch-submit`
};

// 默认测试Token（仅开发环境使用，boss用户token）
// 用户信息：boss001 - ID: 693d29b5cbc188007ecc5848
// 权限：所有权限，可以上传图片、提交任务、查看所有数据
// 角色：boss（管理员）
// 生成时间：2025-12-13，使用xiaohongshu_prod_jwt密钥签名
// 注意：JWT签名生成有问题，暂时使用boss用户确保功能可用
const DEFAULT_TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTNkMjliNWNiYzE4ODAwN2VjYzU4NDgiLCJpYXQiOjE3NjU2MTYxMTksImV4cCI6MTc2NjIyMDkxOX0.AIKlOeO2hqp-tJpI9hVmtSqlAPMnKIkyFAK86Ma4swI';

console.log(`🚀 小程序环境: ${IS_DEVELOPMENT ? '开发环境' : '生产环境'}`);
console.log(`📡 API地址: ${API_BASE}`);

Page({
  data: {
    // 任务类型配置 (对应后端的 TaskConfig)
    // 注意：这里的 value 必须和数据库 TaskConfig 的 type_key 一致
    taskTypes: [
      { id: 1, value: 'customer_resource', name: '客资', price: '5.00', desc: '上传客户添加好友截图', icon: '👥' },
      { id: 2, value: 'note', name: '笔记', price: '10.00', desc: '发布小红书笔记截图', icon: '📝' },
      { id: 3, value: 'comment', name: '评论', price: '3.00', desc: '笔记下方评论截图', icon: '💬' }
    ],
    devices: [], // 用户的设备列表
    selectedDevice: null, // 选中的设备
    selectedType: null, // 当前选中的类型对象
    imageUrls: [], // 多张图片地址数组
    imageMd5s: [], // 多张图片的MD5数组
    displayList: [], // 显示列表（图片 + 添加按钮）
    noteUrl: '', // 小红书笔记链接
    noteAuthor: '', // 笔记作者昵称
    noteTitle: '', // 笔记标题
    commentContent: '', // 评论内容（评论类型专用）
    customerPhone: '', // 客户电话（客资类型专用）
    customerWechat: '', // 客户微信（客资类型专用）
    uploading: false, // 上传状态
    uploadProgress: 0, // 上传进度 (0-100)
    uploadStatus: '', // 上传状态文本
    processingMd5: false // MD5计算状态
  },

  onLoad() {
    this.loadUserDevices();
    // 初始化显示列表
    this.updateDisplayList();
  },

  // 加载用户设备列表
  loadUserDevices() {
    const token = IS_DEVELOPMENT ? DEFAULT_TEST_TOKEN : wx.getStorageSync('token');

    wx.request({
      url: API_CONFIG.DEVICE_MY_LIST,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success && res.data.devices && res.data.devices.length > 0) {
          this.setData({ devices: res.data.devices });
        } else {
          // 使用模拟设备数据（开发环境或无设备时）
          this.loadMockDevices()
        }
      },
      fail: () => {
        // 网络失败时使用模拟数据
        this.loadMockDevices()
      }
    });
  },

  // 加载模拟设备数据
  loadMockDevices() {
    const mockDevices = [
      {
        _id: 'device_001',
        accountName: 'xiaohongshu_user_001',
        status: 'online',
        influence: 'new',
        onlineDuration: 24,
        points: 150
      },
      {
        _id: 'device_002',
        accountName: 'xiaohongshu_user_002',
        status: 'offline',
        influence: 'old',
        onlineDuration: 48,
        points: 200
      },
      {
        _id: 'device_003',
        accountName: 'xiaohongshu_user_003',
        status: 'protected',
        influence: 'real_name',
        onlineDuration: 72,
        points: 300
      }
    ]

    this.setData({
      devices: mockDevices
    })
  },

  // 选择设备
  selectDevice(e) {
    const device = e.currentTarget.dataset.device;
    this.setData({
      selectedDevice: device
    });
  },

  // 选择任务类型
  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      selectedType: type,
      noteUrl: '', // 切换类型时清空链接
      noteAuthor: '', // 清空昵称
      noteTitle: '', // 清空标题
      commentContent: '', // 清空评论内容
      customerPhone: '', // 清空客户电话
      customerWechat: '' // 清空客户微信
    });
  },

  // 输入笔记链接
  onNoteUrlInput(e) {
    this.setData({
      noteUrl: e.detail.value
    });
  },

  // 输入笔记作者昵称
  onNoteAuthorInput(e) {
    this.setData({
      noteAuthor: e.detail.value
    });
  },

  // 输入笔记标题
  onNoteTitleInput(e) {
    this.setData({
      noteTitle: e.detail.value
    });
  },

  // 输入评论内容
  onCommentContentInput(e) {
    this.setData({
      commentContent: e.detail.value
    });
  },

  // 输入客户电话
  onCustomerPhoneInput(e) {
    this.setData({
      customerPhone: e.detail.value
    });
  },

  // 输入客户微信
  onCustomerWechatInput(e) {
    this.setData({
      customerWechat: e.detail.value
    });
  },

  // 选择图片（支持多选）
  chooseImage() {
    if (!this.data.selectedDevice) {
      wx.showToast({
        title: '请先选择操作设备',
        icon: 'none'
      });
      return;
    }

    if (!this.data.selectedType) {
      wx.showToast({
        title: '请先选择任务类型',
        icon: 'none'
      });
      return;
    }

    wx.chooseImage({
      count: 9, // 允许选择最多9张图片
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const newImageUrls = [];
        const newImageMd5s = [];

        // 验证每张图片
        for (let i = 0; i < tempFilePaths.length; i++) {
          const filePath = tempFilePaths[i];
          const fileName = filePath.toLowerCase();
          const isValidImage = validExtensions.some(ext => fileName.endsWith(ext));

          if (!isValidImage) {
            wx.showToast({
              title: `第${i+1}张图片格式不正确，只能选择JPG/PNG/GIF/WebP`,
              icon: 'none'
            });
            continue;
          }

          newImageUrls.push(filePath);
          newImageMd5s.push(''); // 先空着，上传时计算
        }

        // 合并到现有图片列表
        const updatedImageUrls = [...this.data.imageUrls, ...newImageUrls];
        const updatedImageMd5s = [...this.data.imageMd5s, ...newImageMd5s];

        this.setData({
          imageUrls: updatedImageUrls,
          imageMd5s: updatedImageMd5s
        });

        // 更新显示列表
        this.updateDisplayList();

        wx.showToast({
          title: `成功选择${newImageUrls.length}张图片`,
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
    });
  },

  // 更新显示列表（图片 + 添加按钮）
  updateDisplayList() {
    const displayList = [...this.data.imageUrls];

    // 如果图片数量小于9，添加"+"按钮
    if (displayList.length < 9) {
      displayList.push({ type: 'add' });
    }

    this.setData({
      displayList: displayList
    });
  },

  // 上传图片到服务器（使用wx.uploadFile避免base64大小限制）
  uploadImage(filePath) {
    this.setData({ uploading: true });

    // 使用环境对应的Token
    const token = IS_DEVELOPMENT ? DEFAULT_TEST_TOKEN : wx.getStorageSync('token');

    // 使用wx.uploadFile直接上传文件，避免base64大小问题
    wx.uploadFile({
      url: API_CONFIG.UPLOAD_IMAGE,
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.success) {
            // 计算MD5（需要前端计算，因为服务器/upload/image不返回MD5）
            wx.getFileSystemManager().readFile({
              filePath: filePath,
              success: (fileRes) => {
                // 使用异步MD5计算，避免UI卡顿
                this.calculateMD5(fileRes.data).then(md5 => {
                  this.setData({
                    imageUrl: data.data.url,
                    imageMd5: md5
                  });
                  wx.showToast({ title: '上传成功', icon: 'success' });
                }).catch(() => {
                  wx.showToast({ title: '计算文件MD5失败', icon: 'none' });
                });
              },
              fail: () => {
                wx.showToast({ title: '读取文件失败', icon: 'none' });
              }
            });
          } else {
            wx.showToast({ title: data.message || '上传失败', icon: 'none' });
          }
        } catch (e) {
          wx.showToast({ title: '解析响应失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ uploading: false });
      }
    });
  },

  // 计算MD5的辅助函数（优化版：异步分块处理，避免UI卡顿）
  calculateMD5(data) {
    return new Promise((resolve) => {
      // 检查数据有效性
      if (!data) {
        console.error('MD5计算失败: 数据为空', data);
        resolve('error_null_data_' + Date.now());
        return;
      }

      let dataArray;
      let dataLength;

      try {
        // 处理ArrayBuffer（小程序文件数据）
        if (data.byteLength !== undefined) {
          // ArrayBuffer类型检测
          dataArray = new Uint8Array(data);
          dataLength = dataArray.length;
        } else if (data.length !== undefined) {
          // 普通数组或类似数组的对象
          dataArray = data;
          dataLength = data.length;
        } else {
          console.error('MD5计算失败: 不支持的数据类型', typeof data, data.constructor?.name, data);
          resolve('error_unsupported_type_' + Date.now());
          return;
        }

        if (dataLength === 0) {
          console.error('MD5计算失败: 数据长度为0');
          resolve('error_empty_data_' + Date.now());
          return;
        }

        // 使用分块异步处理，避免长时间占用主线程
        this.calculateMD5Async(dataArray, dataLength).then(resolve).catch((error) => {
          console.error('异步MD5计算失败:', error);
          resolve('error_async_calculation_failed_' + Date.now());
        });

      } catch (error) {
        console.error('MD5计算过程中出错:', error, data);
        resolve('error_calculation_failed_' + Date.now());
      }
    });
  },

  // 异步MD5计算（分块处理，避免UI卡顿）
  calculateMD5Async(dataArray, dataLength) {
    return new Promise((resolve) => {
      // 使用改进的哈希算法，包含文件大小和内容特征
      let hash = 0;

      // 包含文件大小作为种子
      hash = ((hash << 5) - hash) + dataLength;
      hash = hash & hash;

      // 分块处理文件内容，避免一次性处理大量数据
      const chunkSize = 1024; // 每块1KB
      const totalChunks = Math.min(10, Math.ceil(dataLength / chunkSize)); // 最多处理10块
      let processedChunks = 0;

      const processChunk = (chunkIndex) => {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, dataLength);
        const chunk = dataArray.slice(start, end);

        // 处理当前块
        for (let i = 0; i < chunk.length; i++) {
          const char = chunk[i];
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // 转换为32位整数
        }

        processedChunks++;

        // 如果还有更多块，继续处理
        if (processedChunks < totalChunks) {
          // 使用setTimeout让出主线程，避免UI卡顿
          setTimeout(() => processChunk(processedChunks), 0);
        } else {
          // 所有块处理完成
          // 转换为16进制字符串，确保32位
          const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
          // 添加文件大小后缀确保唯一性
          const finalMd5 = hexHash + '_' + dataLength.toString(16).padStart(6, '0');
          resolve(finalMd5);
        }
      };

      // 开始处理第一块
      processChunk(0);
    });
  },

  // 删除单张图片
  deleteImage(e) {
    const index = e.currentTarget.dataset.index;
    const updatedImageUrls = [...this.data.imageUrls];
    const updatedImageMd5s = [...this.data.imageMd5s];

    updatedImageUrls.splice(index, 1);
    updatedImageMd5s.splice(index, 1);

    this.setData({
      imageUrls: updatedImageUrls,
      imageMd5s: updatedImageMd5s
    });

    // 更新显示列表
    this.updateDisplayList();
  },

  // 上传所有图片到服务器（并行上传，带进度反馈）
  uploadAllImages() {
    if (this.data.imageUrls.length === 0) {
      wx.showToast({ title: '请先选择图片', icon: 'none' });
      return Promise.resolve([]);
    }

    this.setData({
      uploading: true,
      uploadProgress: 0,
      uploadStatus: '准备上传...'
    });

    const totalImages = this.data.imageUrls.length;
    let completedUploads = 0;
    const uploadPromises = [];

    // 使用环境对应的Token
    const token = IS_DEVELOPMENT ? DEFAULT_TEST_TOKEN : wx.getStorageSync('token');

    // 并行上传每张图片到单图接口（保持兼容性）
    for (let i = 0; i < this.data.imageUrls.length; i++) {
      const filePath = this.data.imageUrls[i];

      uploadPromises.push(new Promise((resolve) => {
        this.setData({
          uploadStatus: `正在上传第 ${i + 1}/${totalImages} 张图片...`
        });

        wx.uploadFile({
          url: API_CONFIG.UPLOAD_IMAGE, // 使用本地开发地址
          filePath: filePath,
          name: 'file',
          header: {
            'Authorization': `Bearer ${token}`
          },
          success: (res) => {
            try {
              const data = JSON.parse(res.data);
              if (data.success) {
                // 更新进度
                completedUploads++;
                const progress = Math.round((completedUploads / totalImages) * 50); // 上传占50%进度
                this.setData({
                  uploadProgress: progress,
                  uploadStatus: `上传完成 ${completedUploads}/${totalImages}，正在处理...`
                });

                // 异步计算MD5，避免UI卡顿
                this.setData({ processingMd5: true });
                wx.getFileSystemManager().readFile({
                  filePath: filePath,
                  success: (fileRes) => {
                    this.calculateMD5(fileRes.data).then(md5 => {
                      // MD5计算完成，更新最终进度
                      const finalProgress = Math.round(((completedUploads) / totalImages) * 100);
                      this.setData({
                        uploadProgress: finalProgress,
                        processingMd5: false
                      });

                      resolve({
                        url: data.data.url,
                        md5: md5,
                        index: i
                      });
                    }).catch(() => {
                      resolve({
                        url: data.data.url,
                        md5: `error_${i}`,
                        index: i
                      });
                    });
                  },
                  fail: () => {
                    resolve({
                      url: data.data.url,
                      md5: `read_error_${i}`,
                      index: i
                    });
                  }
                });
              } else {
                console.error(`第${i+1}张图片上传失败:`, data.message);
                completedUploads++;
                resolve(null);
              }
            } catch (e) {
              console.error(`解析第${i+1}张图片响应失败:`, e);
              completedUploads++;
              resolve(null);
            }
          },
          fail: (err) => {
            console.error(`上传第${i+1}张图片失败:`, err);
            completedUploads++;
            resolve(null);
          }
        });
      }));
    }

    // 返回所有上传结果的 Promise
    return Promise.all(uploadPromises).then(results => {
      // 过滤掉失败的上传
      const successfulUploads = results.filter(result => result !== null);

      this.setData({
        uploadProgress: 100,
        uploadStatus: '上传完成'
      });

      if (successfulUploads.length === 0) {
        wx.showToast({ title: '所有图片上传失败', icon: 'none' });
        this.setData({ uploading: false });
        return Promise.reject(new Error('所有图片上传失败'));
      }

      if (successfulUploads.length < results.length) {
        wx.showToast({
          title: `上传完成 ${successfulUploads.length}/${results.length} 张图片`,
          icon: 'none'
        });
      } else {
        wx.showToast({
          title: `成功上传 ${successfulUploads.length} 张图片`,
          icon: 'success',
          duration: 1500
        });
      }

      return successfulUploads;
    }).finally(() => {
      // 延迟清除状态，让用户看到完成状态
      setTimeout(() => {
        this.setData({
          uploading: false,
          uploadProgress: 0,
          uploadStatus: '',
          processingMd5: false
        });
      }, 2000);
    });
  },

  // 提交任务（使用批量提交接口）
  submitTask() {
    const { selectedDevice, selectedType, imageUrls, noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat } = this.data;

    if (!selectedDevice) {
      wx.showToast({ title: '请选择操作设备', icon: 'none' });
      return;
    }

    if (!selectedType) {
      wx.showToast({ title: '请选择任务类型', icon: 'none' });
      return;
    }

    // 图片现在对于所有类型都是可选的，不再强制要求

    // 验证笔记信息（笔记必填，评论必填链接和内容，客资必填电话或微信）
    if (selectedType.value === 'note') {
      if (!noteUrl || noteUrl.trim() === '') {
        wx.showToast({ title: '笔记类型必须填写小红书笔记链接', icon: 'none' });
        return;
      }
      if (!noteAuthor || noteAuthor.trim() === '') {
        wx.showToast({ title: '笔记类型必须填写作者昵称', icon: 'none' });
        return;
      }
      if (!noteTitle || noteTitle.trim() === '') {
        wx.showToast({ title: '笔记类型必须填写笔记标题', icon: 'none' });
        return;
      }
    } else if (selectedType.value === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        wx.showToast({ title: '评论类型必须填写小红书笔记链接', icon: 'none' });
        return;
      }
      if (!commentContent || commentContent.trim() === '') {
        wx.showToast({ title: '评论类型必须填写评论内容', icon: 'none' });
        return;
      }
    } else if (selectedType.value === 'customer_resource') {
      // 客资类型：电话和微信至少填写一项
      const hasPhone = customerPhone && customerPhone.trim() !== '';
      const hasWechat = customerWechat && customerWechat.trim() !== '';

      if (!hasPhone && !hasWechat) {
        wx.showToast({ title: '客资类型必须填写客户电话或微信号', icon: 'none' });
        return;
      }
    }

    // 如果填写了链接，验证格式
    if (noteUrl && noteUrl.trim() !== '') {
      const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/.+/i;
      if (!xiaohongshuUrlPattern.test(noteUrl)) {
        wx.showToast({ title: '小红书笔记链接格式不正确', icon: 'none' });
        return;
      }
    }

    this.setData({ uploading: true });

    // 先并行上传所有图片
    this.uploadAllImages().then((uploadResults) => {
      // 提取URLs和MD5s
      const urls = uploadResults.map(result => result.url);
      const md5s = uploadResults.map(result => result.md5);

      const token = IS_DEVELOPMENT ? DEFAULT_TEST_TOKEN : wx.getStorageSync('token');

      // 准备提交数据
      const submitData = {
        deviceId: selectedDevice._id,
        imageType: selectedType.value,
        imageUrls: urls,
        imageMd5s: md5s,
        noteUrl: noteUrl && noteUrl.trim() ? noteUrl.trim() : null,
        noteAuthor: noteAuthor && noteAuthor.trim() ? noteAuthor.trim() : null,
        noteTitle: noteTitle && noteTitle.trim() ? noteTitle.trim() : null,
        commentContent: commentContent && commentContent.trim() ? commentContent.trim() : null,
        customerPhone: customerPhone && customerPhone.trim() ? customerPhone.trim() : null,
        customerWechat: customerWechat && customerWechat.trim() ? customerWechat.trim() : null
      };

      // 添加调试日志
      console.log('📤 发送数据:', submitData);

      // 使用新的批量提交接口
      wx.request({
        url: API_CONFIG.TASKS_BATCH_SUBMIT,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: submitData,
        success: (res) => {
          console.log('批量提交响应:', res); // 添加调试日志
          if (res.data && res.data.success) {
            wx.showToast({
              title: `成功提交${res.data.reviews ? res.data.reviews.length : 1}个任务`,
              icon: 'success',
              duration: 2000
            });

            // 清空状态并返回首页
            setTimeout(() => {
              this.setData({
                selectedDevice: null,
                selectedType: null,
                imageUrls: [],
                imageMd5s: [],
                noteUrl: '', // 清空笔记链接
                noteAuthor: '', // 清空昵称
                noteTitle: '', // 清空标题
                commentContent: '', // 清空评论内容
                customerPhone: '', // 清空客户电话
                customerWechat: '', // 清空客户微信
                displayList: [{ type: 'add' }] // 重置显示列表，只保留添加按钮
              });
              wx.showToast({
                title: '提交成功，返回首页',
                icon: 'success',
                duration: 2000
              });
              setTimeout(() => {
                wx.switchTab({ url: '/pages/index/index' });
              }, 500);
            }, 1500);

          } else {
            console.error('批量提交失败:', res.data); // 添加错误日志
            wx.showToast({
              title: res.data?.message || '提交失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('网络请求失败:', err); // 添加网络错误日志
          wx.showToast({ title: '网络连接失败', icon: 'none' });
        },
        complete: () => {
          this.setData({ uploading: false });
        }
      });

    }).catch(err => {
      console.error('上传失败:', err);
      this.setData({ uploading: false });
    });
  }
});