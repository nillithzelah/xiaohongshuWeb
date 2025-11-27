// pages/upload/upload.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    imageList: [],
    uploading: false,
    selectedType: 'note', // 默认选择笔记
    typeOptions: [],
    taskConfigs: []
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadTaskConfigs();
  },

  /**
   * 加载任务配置
   */
  loadTaskConfigs: function() {
    wx.request({
      url: 'http://localhost:5000/api/client/task-configs',
      method: 'GET',
      success: (res) => {
        if (res.data.success) {
          const configs = res.data.configs;
          const typeOptions = configs.map(config => ({
            value: config.type_key,
            label: `${config.name} (¥${config.price})`
          }));

          this.setData({
            taskConfigs: configs,
            typeOptions: typeOptions
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '加载配置失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 选择图片
   */
  chooseImage: function() {
    const that = this
    wx.chooseImage({
      count: 9, // 最多可以选择的图片张数，默认9
      sizeType: ['original', 'compressed'], // original 原图，compressed 压缩图，默认二者都有
      sourceType: ['album', 'camera'], // album 从相册选图，camera 使用相机，默认二者都有
      success: function(res) {
        // 返回选定照片的本地文件路径列表，tempFilePath可以作为img标签的src属性显示图片
        that.setData({
          imageList: res.tempFilePaths
        })
      }
    })
  },

  /**
   * 上传图片
   */
  uploadImages: function() {
    const that = this
    if (this.data.imageList.length === 0) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      })
      return
    }

    this.setData({
      uploading: true
    })

    const token = wx.getStorageSync('token')
    if (!token) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      this.setData({
        uploading: false
      })
      return
    }

    let uploadCount = 0
    const totalCount = this.data.imageList.length

    // 简化版：直接提交任务（实际应该先上传图片到OSS）
    wx.request({
      url: 'http://localhost:5000/api/client/task/submit',
      method: 'POST',
      data: {
        taskType: this.data.selectedType,
        imageUrl: 'https://example.com/placeholder.jpg', // 模拟图片URL
        imageMd5: 'mock_md5_' + Date.now() // 模拟MD5
      },
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      success: function(res) {
        if (res.data.success) {
          that.setData({
            uploading: false,
            imageList: []
          })
          wx.showToast({
            title: '提交成功',
            icon: 'success'
          })
          // 跳转回首页
          wx.switchTab({
            url: '/pages/index/index'
          })
        } else {
          wx.showToast({
            title: res.data.message || '提交失败',
            icon: 'none'
          })
          that.setData({
            uploading: false
          })
        }
      },
      fail: function() {
        wx.showToast({
          title: '提交失败',
          icon: 'none'
        })
        that.setData({
          uploading: false
        })
      }
    })
  },

  /**
   * 选择图片类型
   */
  selectType: function(e) {
    const type = e.currentTarget.dataset.type
    this.setData({
      selectedType: type
    })
  },

  /**
   * 删除图片
   */
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index
    const imageList = this.data.imageList
    imageList.splice(index, 1)
    this.setData({
      imageList: imageList
    })
  }
})