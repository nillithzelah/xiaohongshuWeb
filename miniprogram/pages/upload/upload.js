// pages/upload/upload.js
const app = getApp();

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
    imageUrl: '', // 上传后的图片地址
    uploading: false
  },

  onLoad() {
    this.loadUserDevices();
  },

  // 加载用户设备列表
  loadUserDevices() {
    const token = wx.getStorageSync('token');

    wx.request({
      url: 'http://localhost:5000/api/client/device/my-list',
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      success: (res) => {
        if (res.data && res.data.success) {
          this.setData({ devices: res.data.devices || [] });
        } else {
          // 使用模拟设备数据
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
      selectedType: type
    });
  },

  // 选择并上传图片
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

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadImage(tempFilePath);
      }
    });
  },

  // 上传图片到服务器
  uploadImage(filePath) {
    this.setData({ uploading: true });

    // 获取 Token
    const token = wx.getStorageSync('token');

    wx.uploadFile({
      url: 'http://localhost:5000/api/upload/image', // 你的本地后端地址
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
              imageUrl: data.data.url
            });
            wx.showToast({ title: '上传成功', icon: 'success' });
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ uploading: false });
      }
    });
  },

  // 删除图片
  deleteImage() {
    this.setData({ imageUrl: '' });
  },

  // 提交任务
  submitTask() {
    const { selectedDevice, selectedType, imageUrl } = this.data;

    if (!selectedDevice) {
      wx.showToast({ title: '请选择操作设备', icon: 'none' });
      return;
    }

    if (!selectedType) {
      wx.showToast({ title: '请选择任务类型', icon: 'none' });
      return;
    }

    if (!imageUrl) {
      wx.showToast({ title: '请上传凭证图片', icon: 'none' });
      return;
    }

    const token = wx.getStorageSync('token');

    wx.request({
      url: 'http://localhost:5000/api/client/task/submit',
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        deviceId: selectedDevice._id, // 设备ID
        task_type: selectedType.value, // 发送给后端的类型 key
        image_url: imageUrl,
        // 这里后端会自动计算 snapshot_price，不需要前端传
      },
      success: (res) => {
        if (res.data.success) {
          wx.showToast({
            title: '提交成功',
            icon: 'success',
            duration: 2000
          });

          // 延迟跳转回首页
          setTimeout(() => {
            // 清空状态
            this.setData({ selectedDevice: null, selectedType: null, imageUrl: '' });
            wx.switchTab({ url: '/pages/index/index' });
          }, 1500);
        } else {
          wx.showToast({
            title: res.data.message || '提交失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络连接失败', icon: 'none' });
      }
    });
  }
});