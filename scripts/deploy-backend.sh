#!/bin/bash
# 后端部署脚本 - 同步后端代码到服务器并重启服务

set -e

SERVER="wubug"
REMOTE_PATH="/var/www/xiaohongshu-web"

echo "🚀 开始部署后端..."

# 同步路由文件
if [ -d "server/routes" ]; then
  echo "📦 同步 routes/..."
  scp server/routes/*.js $SERVER:$REMOTE_PATH/server/routes/ 2>/dev/null || true
fi

# 同步服务文件
if [ -d "server/services" ]; then
  echo "📦 同步 services/..."
  scp server/services/*.js $SERVER:$REMOTE_PATH/server/services/ 2>/dev/null || true
fi

# 同步模型文件
if [ -d "server/models" ]; then
  echo "📦 同步 models/..."
  scp server/models/*.js $SERVER:$REMOTE_PATH/server/models/ 2>/dev/null || true
fi

# 同步配置文件
if [ -f "server/.env" ]; then
  echo "📦 同步 .env..."
  scp server/.env $SERVER:$REMOTE_PATH/server/
fi

# 同步 ecosystem.config.js
if [ -f "ecosystem.config.js" ]; then
  echo "📦 同步 ecosystem.config.js..."
  scp ecosystem.config.js $SERVER:$REMOTE_PATH/
fi

# 重启服务
echo "🔄 重启 PM2 服务..."
ssh $SERVER "pm2 restart xiaohongshu-api"

# 等待服务启动
sleep 2

# 检查服务状态
echo "📊 检查服务状态..."
ssh $SERVER "pm2 list | grep xiaohongshu-api"

echo "✅ 后端部署完成！"
