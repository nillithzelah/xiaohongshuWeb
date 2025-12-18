# 小程序Tab图标说明

## ⚠️ 重要说明
小程序tabBar **只支持PNG、JPG、JPEG格式**，不支持SVG格式！

## 需要添加的图标文件

请在 `miniprogram/images/` 目录下添加以下PNG图标文件：

### 图标规格
- 尺寸：40x40px (小程序标准)
- 格式：PNG (透明背景)
- 颜色：未选中状态使用灰色，选中状态使用紫色 (#667eea)

### 图标列表

1. **home.png** - 首页图标 (未选中)
   - 对应SVG：home.svg (房子图标)

2. **home-active.png** - 首页图标 (选中)
   - 建议：紫色版本的房子图标

3. **upload.png** - 上传图标 (未选中)
   - 对应SVG：update.svg (上传图标)

4. **upload-active.png** - 上传图标 (选中)
   - 建议：紫色版本的上传图标

5. **profile.png** - 我的图标 (未选中)
   - 对应SVG：user.svg (用户图标)

6. **profile-active.png** - 我的图标 (选中)
   - 建议：紫色版本的用户图标

## 转换SVG到PNG

由于小程序不支持SVG，可以使用以下工具将SVG转换为PNG：

1. **在线工具**：
   - SVG to PNG converter (搜索即可找到)
   - Convertio.co

2. **设计软件**：
   - Adobe Illustrator
   - Sketch
   - Figma

3. **命令行工具**：
   ```bash
   # 使用ImageMagick
   convert home.svg home.png
   ```

## 设计建议

- 使用简洁的线条图标
- 保持一致的视觉风格
- 选中状态可以通过颜色变化或填充来区分
- 图标应该清晰易识别

## 获取图标

可以使用以下方式获取图标：
1. 从 iconfont.cn 下载并转换为PNG
2. 使用 Sketch/Figma 设计
3. 从免费图标网站下载并修改

## 注意事项

- 确保图标文件名为小写
- PNG格式必须支持透明背景
- 测试时确保图标正确显示
- SVG文件已提供，可作为设计参考