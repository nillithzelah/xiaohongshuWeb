// pages/device-list/device-list.js
const app = getApp();
const CONFIG = require('../../config.js');

// 使用配置文件中的API端点（已统一管理）
const API_CONFIG = {
  DEVICE_MY_LIST: CONFIG.API_BASE_URL + CONFIG.API_ENDPOINTS.CLIENT.DEVICE_MY_LIST
};


console.log(`📱 设备列表页环境: ${CONFIG.ENV}`);

Page({

  /**
   * 页面的初始数据
   */
  data: {
    devices: [],
    loading: true, // 骨架屏状态
    noDevicesMessage: null, // 无设备时的提示信息
    showAddModal: false, // 新增弹窗显示
    adding: false, // 添加中状态
    addForm: {
      accountId: '',
      accountName: '',
      accountUrl: '',
      reviewImage: '' // 新增审核图片字段
    },
    reviewImage: '', // 审核图片URL
    uploadingImage: false, // 上传图片中状态
    showEditModal: false, // 修改弹窗显示
    editing: false, // 修改中状态
    editingDevice: null, // 当前编辑的设备
    editForm: {
      accountName: ''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查是否需要自动显示新增账号弹窗
    if (options && options.showAddModal === 'true') {
      console.log('📱 从上传页面跳转，自动显示新增账号弹窗');
      // 延迟一点时间，确保页面渲染完成后再显示弹窗
      setTimeout(() => {
        this.showAddModal();
      }, 500);
    }

    this.loadUserDevices();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('📱 设备管理页面 onShow 被调用');

    // 检查用户是否已完成手机号授权
    const app = getApp();
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    console.log('👤 当前用户信息:', userInfo);
    console.log('📞 用户手机号:', userInfo?.phone);

    if (!app.checkPhoneAuthForNavigation()) {
      console.log('🚫 用户未完成手机号授权，跳转登录页');
      wx.showModal({
        title: '需要完成授权',
        content: '请先完成手机号授权才能使用其他功能',
        showCancel: false,
        confirmText: '立即授权',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({
              url: '/pages/login/login?needPhoneAuth=true'
            });
          }
        }
      });
      return;
    }

    console.log('✅ 用户已授权，开始加载设备数据');
    // 重新加载设备数据，确保使用最新缓存
    this.loadUserDevices();
  },

  /**
   * 加载用户设备列表
   */
  loadUserDevices: function(forceRefresh = false) {
    console.log('🔍 开始加载用户设备列表, 强制刷新:', forceRefresh);
    // 设置加载状态
    this.setData({ loading: true });

    const app = getApp();

    // 如果不是强制刷新，检查全局共享数据
    if (!forceRefresh) {
      const sharedData = app.globalDataManager.get('userDevices');
      console.log('📊 缓存中的设备数据:', sharedData);

      if (sharedData && Array.isArray(sharedData) && sharedData.length > 0) {
        console.log('📦 使用共享设备数据，数量:', sharedData.length);
        this.processUserDevices(sharedData);
        return;
      }
    } else {
      console.log('🔄 强制刷新，跳过缓存检查');
    }

    console.log('🌐 调用API获取数据');

    const token = app.getCurrentToken();
    console.log('🎯 使用token:', token ? token.substring(0, 50) + '...' : '无token');

    console.log('🔗 请求URL:', API_CONFIG.DEVICE_MY_LIST);
    console.log('🎫 请求token:', token ? token.substring(0, 50) + '...' : '无token');

    app.request({
      url: API_CONFIG.DEVICE_MY_LIST,
      method: 'GET',
      header: token ? { 'Authorization': `Bearer ${token}` } : {},
      useCache: false // 强制不使用缓存
    }).then(res => {
      console.log('📡 设备列表API响应:', res);

      // 严谨的数据验证
      if (!res || !res.data) {
        console.error('❌ API响应异常: 响应数据为空');
        this.setData({
          devices: [],
          noDevicesMessage: '服务器响应异常，请稍后重试'
        });
        return;
      }

      console.log('📊 响应数据结构:', res.data);

      if (res.data.success === true) {
        const devices = getApp().utils.ensureArray(res.data.devices);
        console.log('✅ API返回成功，设备数量:', devices.length);

        // 保存到全局共享数据
        app.globalDataManager.set('userDevices', devices);

        if (devices.length > 0) {
          // 有设备数据，正常处理
          this.processUserDevices(devices);
        } else {
          // 没有设备，显示友好提示
          this.setData({
            devices: [],
            noDevicesMessage: '暂无设备分配，请联系管理员分配设备'
          });
        }
      } else {
        // API返回失败
        const errorMessage = res.data?.message || '获取设备列表失败';
        console.log('❌ API返回失败:', errorMessage);

        this.setData({
          devices: [],
          noDevicesMessage: errorMessage
        });
      }
    }).catch(err => {
      console.error('❌ 网络请求失败:', err);

      // 更详细的错误信息
      let errorMessage = '网络连接失败';
      if (err && err.errMsg) {
        if (err.errMsg.includes('timeout')) {
          errorMessage = '网络请求超时，请检查网络连接';
        } else if (err.errMsg.includes('fail')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        }
      }

      this.setData({
        devices: [],
        noDevicesMessage: errorMessage
      });
    }).finally(() => {
      // 无论成功失败，都关闭骨架屏
      this.setData({ loading: false });
      // 停止下拉刷新
      wx.stopPullDownRefresh();
    });
  },

  // 处理用户设备数据
  processUserDevices: function(devices) {
    console.log('🔄 处理设备数据，数量:', devices.length);
    this.setData({
      devices: devices,
      loading: false // 确保关闭骨架屏
    });
    console.log('✅ 设备数据已设置到页面');
  },


  /**
    * 页面相关事件处理函数--监听用户下拉动作
    */
   onPullDownRefresh: function () {
     this.loadUserDevices();
     // 注意：wx.stopPullDownRefresh() 会在 loadUserDevices 的 complete 回调中调用
   },

   // 显示新增弹窗
   showAddModal: function() {
     this.setData({
       showAddModal: true,
       addForm: {
         accountId: '',
         accountName: '',
         accountUrl: '',
         reviewImage: '' // 新增审核图片字段
       },
       reviewImage: '', // 重置审核图片
       uploadingImage: false // 重置上传状态
     });
   },

   // 隐藏新增弹窗
   hideAddModal: function() {
     this.setData({
       showAddModal: false
     });
   },

   // 输入处理
   onAccountIdInput: function(e) {
     this.setData({
       'addForm.accountId': e.detail.value
     });
   },

   onAccountNameInput: function(e) {
     this.setData({
       'addForm.accountName': e.detail.value
     });
   },

   onAccountUrlInput: function(e) {
     this.setData({
       'addForm.accountUrl': e.detail.value
     });
   },

   // 从文本中提取账号ID
   extractAccountId: function(text) {
     console.log(`🔍 尝试从文本中提取账号ID: "${text}"`);

     // 匹配小红书号格式
     const patterns = [
       /账号[号:]\s*([0-9]+)/i,  // "账号号：123456" 或 "账号号 123456"
       /账号号[：:]\s*([0-9]+)/i, // "账号号：123456"
       /账号[：:]\s*([0-9]+)/i,     // "账号：123456"
       /ID[：:]\s*([0-9]+)/i,       // "ID：123456"
       /\b([0-9]{8,12})\b/          // 纯数字账号ID (8-12位)
     ];

     for (const pattern of patterns) {
       const match = text.match(pattern);
       if (match && match[1]) {
         console.log(`✅ 匹配到账号ID: ${match[1]} (使用正则: ${pattern})`);
         return match[1];
       }
     }

     console.log('❌ 未找到账号ID');
     return null;
   },

   // 上传审核图片
   uploadReviewImage: function() {
     wx.chooseImage({
       count: 1,
       sizeType: ['compressed'],
       sourceType: ['album', 'camera'],
       success: (res) => {
         const tempFilePath = res.tempFilePaths[0];
         if (!tempFilePath) {
           wx.showToast({
             title: '选择图片失败',
             icon: 'none'
           });
           return;
         }
         this.setData({ uploadingImage: true });

         // 上传到服务器
         const token = app.getCurrentToken();
         wx.uploadFile({
           url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/upload/image`,
           filePath: tempFilePath,
           name: 'file',
           header: {
             'Authorization': `Bearer ${token}`
           },
           success: (uploadRes) => {
             try {
               const data = JSON.parse(uploadRes.data);
               if (data.success) {
                 this.setData({
                   reviewImage: data.data.url,
                   'addForm.reviewImage': data.data.url
                 });
                 wx.showToast({
                   title: '上传成功',
                   icon: 'success'
                 });
               } else {
                 throw new Error(data.message || '上传失败');
               }
             } catch (e) {
               console.error('图片上传失败:', e);
               wx.showToast({
                 title: '上传失败，请重试',
                 icon: 'none'
               });
             }
           },
           fail: (err) => {
             console.error('图片上传失败:', err);
             wx.showToast({
               title: '上传失败，请重试',
               icon: 'none'
             });
           },
           complete: () => {
             // 确保无论成功或失败都重置上传状态
             this.setData({ uploadingImage: false });
           }
         });
       },
       fail: (err) => {
         // 用户取消选择图片或其他错误
         if (err.errMsg && err.errMsg.includes('cancel')) {
           console.log('用户取消选择图片');
         } else {
           console.error('选择图片失败:', err);
           wx.showToast({
             title: '选择图片失败',
             icon: 'none'
           });
         }
       }
     });
   },

   // 粘贴分享文本
   pasteAccountUrl: function() {
     wx.getClipboardData({
       success: (res) => {
         const text = res.data;
         console.log('📋 粘贴的文本:', text);

         // 尝试提取链接
         const xhsUrlMatch = text.match(/https?:\/\/[^\s]+/);
         if (xhsUrlMatch) {
           this.setData({
             'addForm.accountUrl': xhsUrlMatch[0]
           });
           wx.showToast({
             title: '已提取链接',
             icon: 'success'
           });
         } else {
           // 如果没有找到链接，放进链接字段让用户手动处理
           this.setData({
             'addForm.accountUrl': text
           });
           wx.showToast({
             title: '已粘贴，请手动填写',
             icon: 'none'
           });
         }
       },
       fail: () => {
         wx.showToast({
           title: '粘贴失败',
           icon: 'none'
         });
       }
     });
   },

   // 新增账号
   addAccount: function() {
     const { accountId, accountName, accountUrl, reviewImage } = this.data.addForm;

     if (!accountId.trim()) {
       wx.showToast({
         title: '请输入账号ID',
         icon: 'none'
       });
       return;
     }

     if (!accountName.trim()) {
       wx.showToast({
         title: '请输入账号昵称',
         icon: 'none'
       });
       return;
     }

     if (!reviewImage.trim()) {
       wx.showToast({
         title: '请上传小红薯个人页面截图',
         icon: 'none'
       });
       return;
     }

     this.setData({ adding: true });

     const token = app.getCurrentToken();

     // 跳过AI审核，直接创建设备
     console.log('✅ 跳过AI审核，直接创建设备...');

     app.request({
         url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/devices`,
         method: 'POST',
         header: { 'Authorization': `Bearer ${token}` },
         data: {
           accountId: accountId.trim(),
           accountName: accountName.trim(),
           accountUrl: accountUrl.trim(),
           reviewImage: reviewImage.trim()
           // assignedUser 由服务器端自动设置为当前用户
         }
       }).then(res => {
         if (res.data && res.data.success) {
           wx.showToast({
             title: '提交成功，等待人工审核',
             icon: 'success'
           });
           this.hideAddModal();
           // 强制重新加载设备列表（跳过缓存）
           this.loadUserDevices(true);
         } else {
           wx.showToast({
             title: res.data?.message || '提交失败',
             icon: 'none'
           });
         }
       }).catch(err => {
         console.error('新增账号失败:', err);
         wx.showToast({
           title: '网络错误，请重试',
           icon: 'none'
         });
       }).finally(() => {
       this.setData({ adding: false });
     });
   },

   // 显示修改弹窗
   showEditModal: function(e) {
     const device = e.currentTarget.dataset.device;
     this.setData({
       showEditModal: true,
       editingDevice: device,
       editForm: {
         accountName: device.accountName
       }
     });
   },

   // 隐藏修改弹窗
   hideEditModal: function() {
     this.setData({
       showEditModal: false,
       editingDevice: null,
       editForm: {
         accountName: ''
       }
     });
   },

   // 修改昵称输入处理
   onEditAccountNameInput: function(e) {
     this.setData({
       'editForm.accountName': e.detail.value
     });
   },

   // 修改账号
   editAccount: function() {
     const { accountName } = this.data.editForm;
     const device = this.data.editingDevice;

     if (!accountName.trim()) {
       wx.showToast({
         title: '请输入账号昵称',
         icon: 'none'
       });
       return;
     }

     if (accountName.trim() === device.accountName) {
       wx.showToast({
         title: '昵称未修改',
         icon: 'none'
       });
       return;
     }

     this.setData({ editing: true });

     const token = app.getCurrentToken();

     app.request({
         url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/devices/${device._id}`,
         method: 'PUT',
         header: { 'Authorization': `Bearer ${token}` },
         data: {
           accountName: accountName.trim()
         }
       }).then(res => {
         if (res.data && res.data.success) {
           wx.showToast({
             title: '修改成功',
             icon: 'success'
           });
           this.hideEditModal();
           // 强制重新加载设备列表（跳过缓存）
           this.loadUserDevices(true);
         } else {
           wx.showToast({
             title: res.data?.message || '修改失败',
             icon: 'none'
           });
         }
       }).catch(err => {
         console.error('修改账号失败:', err);
         wx.showToast({
           title: '网络错误，请重试',
           icon: 'none'
         });
       }).catch(err => {
         console.error('修改账号失败:', err);
         wx.showToast({
           title: '网络错误，请重试',
           icon: 'none'
         });
       }).finally(() => {
       this.setData({ editing: false });
     });
   },

   // 确认删除设备
   confirmDeleteDevice: function(e) {
     const device = e.currentTarget.dataset.device;

     wx.showModal({
       title: '确认删除',
       content: `确定要删除账号"${device.accountName}"吗？此操作不可恢复！`,
       confirmText: '删除',
       confirmColor: '#ff4d4f',
       success: (res) => {
         if (res.confirm) {
           this.deleteDevice(device);
         }
       }
     });
   },

   // 删除设备
   deleteDevice: function(device) {
     console.log('🗑️ 开始删除设备:', device._id);

     const token = app.getCurrentToken();

     wx.showLoading({
       title: '删除中...'
     });

     app.request({
       url: `${CONFIG.API_BASE_URL}/xiaohongshu/api/devices/${device._id}`,
       method: 'DELETE',
       header: { 'Authorization': `Bearer ${token}` }
     }).then(res => {
       wx.hideLoading();

       if (res.data && res.data.success) {
         wx.showToast({
           title: '删除成功',
           icon: 'success'
         });

         // 强制重新加载设备列表（跳过缓存）
         this.loadUserDevices(true);
       } else {
         wx.showToast({
           title: res.data?.message || '删除失败',
           icon: 'none'
         });
       }
     }).catch(err => {
       wx.hideLoading();
       console.error('删除设备失败:', err);
       wx.showToast({
         title: '网络错误，请重试',
         icon: 'none'
       });
     });
   }
 });
