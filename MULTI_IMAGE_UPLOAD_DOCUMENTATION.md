# 小程序多图上传功能 - 实现文档

## 1. 概述

本文档记录了小程序多图上传功能的实现细节，包括数据结构、UI设计、交互逻辑和服务器接口适配。

## 2. 修改文件

### 2.1 核心文件

- `miniprogram/pages/upload/upload.js` - 主逻辑文件
- `miniprogram/pages/upload/upload.wxml` - UI结构文件
- `miniprogram/pages/upload/upload.wxss` - 样式文件

### 2.2 服务器端

- `server/routes/upload.js` - 上传接口（已存在，无需修改）
- `server/routes/client.js` - 任务提交接口（已存在，无需修改）

## 3. 数据结构

### 3.1 原始结构（单图）

```javascript
data: {
  imageUrl: '', // 单张图片地址
  imageMd5: ''  // 单张图片MD5
}
```

### 3.2 新结构（多图）

```javascript
data: {
  imageUrls: [], // 多张图片地址数组
  imageMd5s: [], // 多张图片MD5数组
  displayList: [] // 显示列表（图片 + 添加按钮）
}
```

## 4. UI设计

### 4.1 显示逻辑

1. **初始状态**：显示一个"+"按钮方框
2. **选择图片**：图片出现在"+"按钮位置，"+"按钮移到最后
3. **多张图片**：自动换行显示，"+"按钮始终在最后
4. **删除图片**："+"按钮仍在最后
5. **达到9张**："+"按钮消失

### 4.2 关键实现

```javascript
// 更新显示列表
updateDisplayList() {
  const displayList = [...this.data.imageUrls];
  if (displayList.length < 9) {
    displayList.push({ type: 'add' }); // 添加"+"按钮
  }
  this.setData({ displayList });
}
```

### 4.3 WXML渲染

```html
<block wx:for="{{displayList}}" wx:key="{{index}}">
  <!-- 图片项 -->
  <view class="image-item" wx:if="{{item.type !== 'add'}}">
    <image src="{{item}}" mode="aspectFill" class="preview-img"></image>
    <view class="delete-btn" bindtap="deleteImage" data-index="{{index}}">×</view>
    <view class="image-index">{{index + 1}}</view>
  </view>

  <!-- 添加按钮项 -->
  <view class="image-item add-btn" bindtap="chooseImage" wx:if="{{item.type === 'add'}}">
    <view class="add-icon">+</view>
    <text class="add-text">添加</text>
  </view>
</block>
```

## 5. 交互流程

### 5.1 选择图片

1. 点击"+"按钮
2. 调用 `wx.chooseImage({ count: 9 })`
3. 验证文件格式（JPG/PNG/GIF/WebP）
4. 添加到 `imageUrls` 数组
5. 调用 `updateDisplayList()` 更新UI

### 5.2 删除图片

1. 点击图片右上角"×"按钮
2. 从 `imageUrls` 和 `imageMd5s` 数组删除
3. 调用 `updateDisplayList()` 更新UI

### 5.3 上传图片

1. 点击"提交任务"按钮
2. 调用 `uploadAllImages()` 循环上传所有图片
3. 每张图片单独上传到 `/upload/image` 接口
4. 计算每张图片的MD5值

### 5.4 提交任务

1. 上传完成后，调用 `submitTask()`
2. 循环提交每张图片到 `/client/task/submit` 接口
3. 显示成功提交的图片数量
4. 清空状态并返回首页

## 6. 服务器接口

### 6.1 上传接口

- **路径**：`POST /xiaohongshu/api/upload/image`
- **参数**：`file`（文件上传）
- **返回**：
  ```json
  {
    "success": true,
    "data": {
      "url": "https://...",
      "name": "uploads/..."
    }
  }
  ```

### 6.2 提交接口

- **路径**：`POST /xiaohongshu/api/client/task/submit`
- **参数**：
  ```json
  {
    "deviceId": "device_001",
    "imageType": "note",
    "image_url": "https://...",
    "imageMd5": "abc123..."
  }
  ```

## 7. 错误处理

1. **文件格式错误**：提示"只能选择JPG/PNG/GIF/WebP"
2. **上传失败**：提示"第X张图片上传失败"
3. **提交失败**：提示"第X张图片提交失败"
4. **网络错误**：提示"网络错误"

## 8. 限制

1. 最多选择9张图片
2. 只支持JPG/PNG/GIF/WebP格式
3. 每张图片单独上传和提交
4. 上传过程中显示加载状态

## 9. 测试方法

1. 选择设备和任务类型
2. 点击"+"按钮选择多张图片
3. 点击"提交任务"按钮
4. 检查上传和提交是否成功
5. 检查"+"按钮是否始终在最后

## 10. 注意事项

1. 服务器端接口无需修改
2. 使用默认Token进行测试
3. 图片MD5在前端计算
4. 删除图片时需要更新显示列表

## 11. 未来优化

1. 添加图片预览功能
2. 支持图片拖拽排序
3. 添加上传进度条
4. 支持批量提交优化