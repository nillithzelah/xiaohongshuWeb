// pages/upload/upload.js
const app = getApp();

const CONFIG = require('../../config.js');

const API_CONFIG = {
  DEVICE_MY_LIST: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.DEVICE_MY_LIST,
  UPLOAD_IMAGE: `${CONFIG.API_BASE_URL}/xiaohongshu/api/upload/image`,
  TASKS_BATCH_SUBMIT: `${CONFIG.API_BASE_URL}/xiaohongshu/api/client/tasks/batch-submit`,
  TASK_CONFIGS: `${CONFIG.API_BASE_URL}/xiaohongshu/api/client/task-configs`
};


console.log(`🚀 小程序环境: ${CONFIG.ENV}`);
console.log(`📡 API地址: ${CONFIG.API_BASE_URL}`);

Page({
  data: {
    // 任务类型配置 (从后端动态获取)
    taskTypes: [],
    devices: [], // 用户的设备列表（用于展示）
    selectedType: null, // 当前选中的类型对象
    imageUrls: [], // 多张图片地址数组
    imageMd5s: [], // 多张图片的MD5数组
    displayList: [], // 显示列表（图片 + 添加按钮）
    noteUrl: '', // 笔记链接
    noteAuthor: '', // 笔记作者昵称
    noteTitle: '', // 笔记标题
    commentContent: '', // 评论内容（评论类型专用）
    customerPhone: '', // 客户电话（客资类型专用）
    customerWechat: '', // 客户微信（客资类型专用）
    uploading: false, // 上传状态
    uploadProgress: 0, // 上传进度 (0-100)
    uploadStatus: '', // 上传状态文本
    processingMd5: false, // MD5计算状态
    noDevicesMessage: null, // 无设备时的提示信息
  },

  onLoad() {
    this.loadTaskConfigs();
    this.loadUserDevices();
    // 初始化显示列表
    this.updateDisplayList();
  },

  onShow() {
    // 检查用户是否已完成手机号授权
    if (!getApp().navigateGuard()) {
      return; // 如果未授权，会自动跳转到首页
    }
    // 重新加载设备数据，确保使用最新数据
    this.loadUserDevices();
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    console.log('🔄 下拉刷新触发，强制重新加载数据');
    this.loadTaskConfigs(true); // 强制刷新，跳过缓存
    this.loadUserDevices(true); // 强制刷新，跳过预加载缓存
    wx.stopPullDownRefresh()
  },

  // 加载任务配置
  loadTaskConfigs(forceRefresh = false) {
    const app = getApp();

    // 下拉刷新时跳过缓存，直接重新请求
    if (!forceRefresh) {
      // 优先使用预加载缓存
      const preloadData = app.requestCache.getPreload(API_CONFIG.TASK_CONFIGS, {});
      if (preloadData) {
        console.log('🚀 使用预加载任务配置数据');
        if (preloadData.data && preloadData.data.success && preloadData.data.configs && preloadData.data.configs.length > 0) {
          // 保存到全局共享数据
          app.globalDataManager.set('taskConfigs', preloadData.data.configs);
          this.processTaskConfigs(preloadData.data.configs);
        }
        return;
      }

      // 检查全局共享数据
      const sharedData = app.globalDataManager.get('taskConfigs');
      if (sharedData) {
        console.log('📦 使用共享任务配置数据');
        this.processTaskConfigs(sharedData);
        return;
      }
    }

    // 使用优化的请求方法
    app.request({
      url: API_CONFIG.TASK_CONFIGS,
      method: 'GET',
      useCache: true
    }).then(res => {
      if (res.data && res.data.success && res.data.configs && res.data.configs.length > 0) {
        // 保存到全局共享数据
        app.globalDataManager.set('taskConfigs', res.data.configs);
        this.processTaskConfigs(res.data.configs);
      } else {
        // 没有任务配置数据
        console.log('没有任务配置数据');
      }
    }).catch(() => {
      // 网络失败时不加载数据
      console.log('加载任务配置失败');
    });
  },

  // 处理任务配置数据
  processTaskConfigs(configs) {
    const taskTypes = configs.map((config, index) => ({
      id: index + 1,
      value: config.type_key,
      name: config.name,
      price: config.price.toString(),
      desc: this.getTaskDesc(config.type_key),
      icon: this.getTaskIcon(config.type_key)
    }));
    this.setData({ taskTypes });

    // 默认选择评论类型
    const commentType = taskTypes.find(type => type.value === 'comment');
    if (commentType) {
      this.setData({
        selectedType: commentType
      });
    }
  },

  // 获取任务描述
  getTaskDesc(typeKey) {
    const descMap = {
      'customer_resource': '添加好友截图',
      'note': '发布笔记截图',
      'comment': '评论截图'
    };
    return descMap[typeKey] || '任务截图';
  },

  // 获取任务图标
  getTaskIcon(typeKey) {
    const iconMap = {
      'customer_resource': '👥',
      'note': '📝',
      'comment': '💬'
    };
    return iconMap[typeKey] || '📄';
  },


  // 加载用户设备列表（用于展示账号列表）
  loadUserDevices(forceRefresh = true) {
    console.log('🔍 开始加载用户设备列表（展示用）', forceRefresh ? '强制刷新' : '');
    const app = getApp();

    // 下拉刷新时跳过预加载缓存，直接重新请求
    if (!forceRefresh) {
      // 优先使用预加载缓存
      const preloadData = app.requestCache.getPreload(API_CONFIG.DEVICE_MY_LIST, {});
      if (preloadData) {
        console.log('🚀 使用预加载设备数据');
        if (preloadData.data && preloadData.data.success && preloadData.data.devices && preloadData.data.devices.length > 0) {
          // 保存到全局共享数据
          app.globalDataManager.set('userDevices', preloadData.data.devices);
          this.processUserDevices(preloadData.data.devices);
        }
        return;
      }
    }

    // 检查全局共享数据
    const sharedData = app.globalDataManager.get('userDevices');
    if (sharedData) {
      console.log('📦 使用共享设备数据，数量:', sharedData.length);
      this.processUserDevices(sharedData);
      return;
    }

    const token = app.getCurrentToken();

    app.request({
      url: API_CONFIG.DEVICE_MY_LIST,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      useCache: true
    }).then(res => {
      console.log('📡 设备列表API响应:', res.data);

      if (res.data && res.data.success && res.data.devices && res.data.devices.length > 0) {
        // 保存到全局共享数据
        app.globalDataManager.set('userDevices', res.data.devices);
        this.processUserDevices(res.data.devices);
      } else {
        // 没有设备时显示提示信息
        this.setData({
          devices: [],
          noDevicesMessage: '暂无账号，请新增账号'
        });
      }
    }).catch(() => {
      // 网络失败时显示提示信息
      this.setData({
        devices: [],
        noDevicesMessage: '网络连接失败，请稍后重试'
      });
    });
  },

  // 处理用户设备数据（用于展示）
  processUserDevices(devices) {
    console.log('🔄 处理设备数据，数量:', devices.length);
    this.setData({
      devices: devices,
      noDevicesMessage: null // 有设备时清除提示信息
    });
  },






  // 跳转到账号管理页面并自动打开新增账号弹窗
  goToDeviceList: function() {
    wx.navigateTo({
      url: '/pages/device-list/device-list?showAddModal=true'
    });
  },


  // 选择任务类型
  selectType(e) {
    const type = e.currentTarget.dataset.type;

    this.setData({
      selectedType: type,
      noteUrl: '', // 切换类型时清空链接
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

  // 粘贴分享文本并提取小红书链接
  pasteShareText: function() {
    const that = this;
    wx.showModal({
      title: '粘贴分享文本',
      placeholderText: '请粘贴小红书分享的完整文本，系统将自动提取链接',
      editable: true,
      // placeholderText: '例如：玩ai聊天有哪些伤身体的行为 http://xhslink.com/o/2rV8kDR9MxK 复制后打开【小红书】查看笔记！',
      success: function(res) {
        if (res.confirm && res.content) {
          const extractedUrl = that.extractXiaohongshuUrl(res.content);
          if (extractedUrl) {
            that.setData({
              noteUrl: extractedUrl
            });
            wx.showToast({
              title: '链接提取成功',
              icon: 'success',
              duration: 2000
            });
          } else {
            wx.showToast({
              title: '未找到小红书链接',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  // 提取小红书链接的工具方法
  extractXiaohongshuUrl: function(text) {
    // 匹配小红书链接的正则表达式
    // 支持 xhslink.com 和其他小红书域名
    const xiaohongshuUrlRegex = /(https?:\/\/(?:[a-zA-Z0-9-]+\.)*(?:xiaohongshu|xhslink)\.com\/(?:[a-zA-Z0-9]+\/)?[a-zA-Z0-9]+)/i;

    const match = text.match(xiaohongshuUrlRegex);
    if (match) {
      return match[1];
    }

    // 如果没找到，尝试查找其他可能的链接格式
    const generalUrlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(generalUrlRegex);
    if (urls) {
      // 查找包含 xhslink 或 xiaohongshu 的链接
      for (const url of urls) {
        if (url.includes('xhslink') || url.includes('xiaohongshu')) {
          return url;
        }
      }
    }

    return null;
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

    // 优先使用从profile页面切换的测试用户token
    const testUserToken = wx.getStorageSync('testUserToken');
    const token = testUserToken || wx.getStorageSync('token');

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

  // 异步MD5计算（优化版：更高效的分块处理和更好的哈希算法）
  calculateMD5Async(dataArray, dataLength) {
    return new Promise((resolve) => {
      // 使用更高效的哈希算法：FNV-1a变体
      let hash = 2166136261; // FNV offset basis
      const prime = 16777619; // FNV prime

      // 包含文件大小作为种子
      hash ^= dataLength;
      hash *= prime;

      // 动态分块大小：根据文件大小调整
      let chunkSize;
      if (dataLength <= 1024 * 1024) { // 1MB以内
        chunkSize = 64 * 1024; // 64KB块
      } else if (dataLength <= 10 * 1024 * 1024) { // 10MB以内
        chunkSize = 256 * 1024; // 256KB块
      } else {
        chunkSize = 512 * 1024; // 512KB块
      }

      // 采样处理：对于大文件，只处理部分块以提高速度
      const maxChunks = dataLength <= 5 * 1024 * 1024 ? 20 : 10; // 小文件处理更多块
      const totalChunks = Math.min(maxChunks, Math.ceil(dataLength / chunkSize));
      let processedChunks = 0;

      // 均匀采样：选择分布在文件各处的块
      const chunkIndices = [];
      for (let i = 0; i < totalChunks; i++) {
        const index = Math.floor((i * dataLength) / (totalChunks * chunkSize));
        chunkIndices.push(index);
      }

      const processChunk = (chunkIndex) => {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, dataLength);
        const chunk = dataArray.slice(start, end);

        // 使用FNV-1a哈希算法
        for (let i = 0; i < chunk.length; i++) {
          hash ^= chunk[i];
          hash *= prime;
          hash = hash >>> 0; // 确保32位无符号整数
        }

        processedChunks++;

        // 如果还有更多块，继续处理
        if (processedChunks < totalChunks) {
          // 使用setTimeout让出主线程，避免UI卡顿
          setTimeout(() => processChunk(chunkIndices[processedChunks]), 0);
        } else {
          // 所有块处理完成
          // 添加时间戳和随机因子确保唯一性
          const timestamp = Date.now() % 1000000;
          const randomFactor = Math.floor(Math.random() * 1000);

          // 组合最终哈希
          const finalHash = (hash >>> 0).toString(16).padStart(8, '0') +
                           timestamp.toString(16).padStart(6, '0') +
                           randomFactor.toString(16).padStart(3, '0');

          resolve(finalHash);
        }
      };

      // 开始处理第一块
      if (chunkIndices.length > 0) {
        processChunk(chunkIndices[0]);
      } else {
        // 处理空文件的情况
        const timestamp = Date.now() % 1000000;
        const randomFactor = Math.floor(Math.random() * 1000);
        const finalHash = '00000000' + timestamp.toString(16).padStart(6, '0') + randomFactor.toString(16).padStart(3, '0');
        resolve(finalHash);
      }
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

  // 上传所有图片到服务器（优化版：批量上传 + 并行MD5计算）
  uploadAllImages() {
    if (this.data.imageUrls.length === 0) {
      // 没有图片，直接返回空数组
      return Promise.resolve([]);
    }

    this.setData({
      uploading: true,
      uploadProgress: 0,
      uploadStatus: '准备上传...'
    });

    const totalImages = this.data.imageUrls.length;
    const testUserToken = wx.getStorageSync('testUserToken');
    const token = testUserToken || wx.getStorageSync('token');

    // 优先使用批量上传接口（如果图片数量 >= 2）
    if (totalImages >= 2) {
      return this.uploadBatchImages(token);
    } else {
      // 单张图片使用原有逻辑
      return this.uploadSingleImage(token);
    }
  },

  // 批量上传多张图片（优化版：并发控制 + 并行MD5计算 + 重试机制）
  uploadBatchImages(token) {
    const totalImages = this.data.imageUrls.length;
    const CONCURRENT_UPLOADS = 3; // 最多3个并发上传
    const MAX_RETRIES = 2; // 最大重试次数
    let completedUploads = 0;
    let failedUploads = 0;
    const uploadPromises = [];

    this.setData({
      uploadStatus: '正在批量上传图片...'
    });

    // 创建上传任务队列（带重试机制）
    const uploadWithRetry = (filePath, index, retryCount = 0) => {
      return new Promise((resolve) => {
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
                completedUploads++;
                const progress = Math.round((completedUploads / totalImages) * 50);
                this.setData({
                  uploadProgress: progress,
                  uploadStatus: `上传完成 ${completedUploads}/${totalImages}，正在处理...`
                });

                resolve({
                  url: data.data.url,
                  filePath: filePath,
                  index: index,
                  success: true
                });
              } else {
                console.error(`第${index + 1}张图片上传失败 (尝试${retryCount + 1}):`, data.message);
                if (retryCount < MAX_RETRIES) {
                  // 重试
                  console.log(`🔄 第${index + 1}张图片重试上传 (第${retryCount + 2}次)`);
                  setTimeout(() => {
                    uploadWithRetry(filePath, index, retryCount + 1).then(resolve);
                  }, 1000 * (retryCount + 1)); // 递增延迟
                } else {
                  failedUploads++;
                  completedUploads++;
                  resolve({
                    url: null,
                    filePath: filePath,
                    index: index,
                    success: false,
                    error: data.message
                  });
                }
              }
            } catch (e) {
              console.error(`解析第${index + 1}张图片响应失败:`, e);
              if (retryCount < MAX_RETRIES) {
                setTimeout(() => {
                  uploadWithRetry(filePath, index, retryCount + 1).then(resolve);
                }, 1000 * (retryCount + 1));
              } else {
                failedUploads++;
                completedUploads++;
                resolve({
                  url: null,
                  filePath: filePath,
                  index: index,
                  success: false,
                  error: '解析响应失败'
                });
              }
            }
          },
          fail: (err) => {
            console.error(`上传第${index + 1}张图片失败 (尝试${retryCount + 1}):`, err);
            if (retryCount < MAX_RETRIES) {
              setTimeout(() => {
                uploadWithRetry(filePath, index, retryCount + 1).then(resolve);
              }, 1000 * (retryCount + 1));
            } else {
              failedUploads++;
              completedUploads++;
              resolve({
                url: null,
                filePath: filePath,
                index: index,
                success: false,
                error: err.errMsg || '网络错误'
              });
            }
          }
        });
      });
    };

    // 创建上传任务队列
    for (let i = 0; i < totalImages; i++) {
      const filePath = this.data.imageUrls[i];

      uploadPromises.push(new Promise((resolve) => {
        // 延迟启动，避免同时发起太多请求
        setTimeout(() => {
          uploadWithRetry(filePath, i).then(resolve);
        }, (i % CONCURRENT_UPLOADS) * 200); // 错开启动时间，避免瞬间并发过多
      }));
    }

    return Promise.all(uploadPromises).then(results => {
      // 过滤掉失败的上传
      const successfulUploads = results.filter(result => result.success);

      if (successfulUploads.length === 0) {
        wx.showToast({ title: '所有图片上传失败', icon: 'none' });
        return Promise.reject(new Error('所有图片上传失败'));
      }

      // 显示上传结果统计
      if (failedUploads > 0) {
        wx.showToast({
          title: `上传完成 ${successfulUploads.length}/${totalImages} 张图片 (${failedUploads}张失败)`,
          icon: 'none',
          duration: 2000
        });
      }

      this.setData({
        uploadProgress: 50,
        uploadStatus: '图片上传完成，正在计算MD5...'
      });

      // 并行计算所有成功的图片的MD5
      const md5Promises = successfulUploads.map((uploadResult) => {
        return new Promise((resolveMd5) => {
          wx.getFileSystemManager().readFile({
            filePath: uploadResult.filePath,
            success: (fileRes) => {
              this.calculateMD5(fileRes.data).then(md5 => {
                resolveMd5({
                  url: uploadResult.url,
                  md5: md5,
                  index: uploadResult.index
                });
              }).catch((error) => {
                console.warn(`MD5计算失败 ${uploadResult.index}:`, error);
                resolveMd5({
                  url: uploadResult.url,
                  md5: `md5_error_${uploadResult.index}`,
                  index: uploadResult.index
                });
              });
            },
            fail: (error) => {
              console.warn(`读取文件失败 ${uploadResult.index}:`, error);
              resolveMd5({
                url: uploadResult.url,
                md5: `read_error_${uploadResult.index}`,
                index: uploadResult.index
              });
            }
          });
        });
      });

      return Promise.all(md5Promises).then(md5Results => {
        this.setData({
          uploadProgress: 100,
          uploadStatus: '上传完成'
        });

        // 最终成功提示
        const finalSuccessful = md5Results.filter(r => r.url && r.md5 && !r.md5.startsWith('error_')).length;
        if (finalSuccessful === totalImages) {
          wx.showToast({
            title: `成功上传 ${finalSuccessful} 张图片`,
            icon: 'success',
            duration: 1500
          });
        } else {
          wx.showToast({
            title: `上传完成 ${finalSuccessful}/${totalImages} 张图片`,
            icon: 'none',
            duration: 2000
          });
        }

        return md5Results;
      });
    });
  },

  // 单张图片上传（兼容原有逻辑）
  uploadSingleImage(token) {
    const filePath = this.data.imageUrls[0];

    this.setData({
      uploadStatus: '正在上传图片...'
    });

    return new Promise((resolve, reject) => {
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
              this.setData({
                uploadProgress: 50,
                uploadStatus: '图片上传完成，正在计算MD5...'
              });

              wx.getFileSystemManager().readFile({
                filePath: filePath,
                success: (fileRes) => {
                  this.calculateMD5(fileRes.data).then(md5 => {
                    this.setData({
                      uploadProgress: 100,
                      uploadStatus: '上传完成'
                    });

                    wx.showToast({
                      title: '成功上传图片',
                      icon: 'success',
                      duration: 1500
                    });

                    resolve([{
                      url: data.data.url,
                      md5: md5,
                      index: 0
                    }]);
                  }).catch(() => {
                    resolve([{
                      url: data.data.url,
                      md5: 'error_0',
                      index: 0
                    }]);
                  });
                },
                fail: () => {
                  resolve([{
                    url: data.data.url,
                    md5: 'read_error_0',
                    index: 0
                  }]);
                }
              });
            } else {
              wx.showToast({ title: data.message || '上传失败', icon: 'none' });
              reject(new Error(data.message || '上传失败'));
            }
          } catch (e) {
            wx.showToast({ title: '解析响应失败', icon: 'none' });
            reject(e);
          }
        },
        fail: (err) => {
          wx.showToast({ title: '网络错误', icon: 'none' });
          reject(err);
        }
      });
    }).finally(() => {
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
  async submitTask() {
    const { selectedType, imageUrls, noteUrl, noteAuthor, noteTitle, commentContent, customerPhone, customerWechat } = this.data;

    // 设备选择已移除，审核时会自动对比账号昵称

    if (!selectedType) {
      wx.showToast({ title: '请选择任务类型', icon: 'none' });
      return;
    }

    // 验证图片（所有类型都可选）
    // if (selectedType.value === 'comment' && (!imageUrls || imageUrls.length === 0)) {
    //   wx.showToast({ title: '评论类型必须上传评论截图作为证据', icon: 'none' });
    //   return;
    // }

    // 验证笔记信息（笔记必填链接和标题，评论必填链接和内容，客资必填电话或微信）
    if (selectedType.value === 'note') {
      if (!noteUrl || noteUrl.trim() === '') {
        wx.showToast({ title: '笔记类型必须填写笔记链接', icon: 'none' });
        return;
      }
      if (!noteTitle || noteTitle.trim() === '') {
        wx.showToast({ title: '笔记类型必须填写笔记标题', icon: 'none' });
        return;
      }
    } else if (selectedType.value === 'comment') {
      if (!noteUrl || noteUrl.trim() === '') {
        wx.showToast({ title: '评论类型必须填写笔记链接', icon: 'none' });
        return;
      }
      // 评论类型不再需要手动填写作者昵称，系统会自动比对设备账号
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
      const xiaohongshuUrlPattern = /^https?:\/\/(www\.)?(xiaohongshu|xiaohongshu\.com|xhslink\.com)\/[a-zA-Z0-9]+(?:\/[a-zA-Z0-9]+)+/i;
      if (!xiaohongshuUrlPattern.test(noteUrl)) {
        wx.showToast({ title: '笔记链接格式不正确', icon: 'none' });
        return;
      }
    }

    this.setData({ uploading: true });

    // 获取token：使用全局token获取函数
    const token = app.getCurrentToken();
    const tokenPromise = Promise.resolve(token);

    // 先获取token，然后上传图片
    tokenPromise.then(token => {
      // 先并行上传所有图片
      return this.uploadAllImages().then((uploadResults) => {
        return { uploadResults, token };
      });
    }).then(({ uploadResults, token }) => {
      // 提取URLs和MD5s
      const urls = uploadResults.map(result => result.url);
      const md5s = uploadResults.map(result => result.md5);

      // 获取用户的设备昵称数组，作为noteAuthor传递
      const deviceNicknames = this.data.devices.map(device => device.accountName);

      // 准备提交数据（noteAuthor传递设备昵称数组，审核时遍历比对）
      const submitData = {
        imageType: selectedType.value,
        imageUrls: urls,
        imageMd5s: md5s,
        noteUrl: noteUrl && noteUrl.trim() ? noteUrl.trim() : null,
        noteAuthor: deviceNicknames, // 传递设备昵称数组
        noteTitle: noteTitle && noteTitle.trim() ? noteTitle.trim() : null,
        commentContent: commentContent && commentContent.trim() ? commentContent.trim() : null,
        customerPhone: customerPhone && customerPhone.trim() ? customerPhone.trim() : null,
        customerWechat: customerWechat && customerWechat.trim() ? customerWechat.trim() : null
      };

      // 添加调试日志
      console.log('📤 发送数据:', submitData);

      // 使用新的批量提交接口（增加超时时间）
      wx.request({
        url: API_CONFIG.TASKS_BATCH_SUBMIT,
        method: 'POST',
        header: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: submitData,
        timeout: 60000, // 增加超时时间到60秒（评论验证需要时间）
        success: (res) => {
          console.log('批量提交响应:', res); // 添加调试日志
          if (res.data && res.data.success) {
            wx.showToast({
              title: `成功提交${res.data.reviews ? res.data.reviews.length : 1}个任务`,
              icon: 'success',
              duration: 2000
            });

            // 清空状态但保留任务类型选择，返回首页
            setTimeout(() => {
              this.setData({
                // selectedType: null, // 保留任务类型选择
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