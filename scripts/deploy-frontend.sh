#!/bin/bash
# 前端部署脚本 - 构建并同步到服务器

set -e

SERVER="wubug"
REMOTE_PATH="/var/www/xiaohongshu-web/admin/public"

echo "🚀 开始部署前端..."

# 构建前端
echo "📦 构建 admin/..."
cd admin
npm run build
cd ..

# 同步到服务器
echo "📤 同步到服务器..."
scp -r admin/build/* $SERVER:$REMOTE_PATH/

# 验证部署
echo "🔍 验证部署..."
FILE_COUNT=$(ssh $SERVER "ls -1 $REMOTE_PATH/ | wc -l")
echo "✅ 服务器上有 $FILE_COUNT 个文件"

echo "✅ 前端部署完成！"
echo "📝 请刷新浏览器查看效果"
