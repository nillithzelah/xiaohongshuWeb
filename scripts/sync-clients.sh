#!/bin/bash
# 小红书审核客户端同步脚本
# 功能：同步客户端代码到服务器（自动打包服务会自动创建 zip）

set -e

SERVER="wubug"
REMOTE_DIR="/var/www/xiaohongshu-web/xiaohongshu-audit-clients"
LOCAL_DIR="$(pwd)/xiaohongshu-audit-clients"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 小红书审核客户端同步脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 提示：服务器上的自动打包服务会在文件变化后自动生成 zip"
echo ""

# 同步代码到服务器
echo "📤 同步代码到服务器..."
echo ""

if [ -d "$LOCAL_DIR/audit-client" ]; then
  scp "$LOCAL_DIR/audit-client/index.js" ${SERVER}:${REMOTE_DIR}/audit-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/audit-client/config.json" ${SERVER}:${REMOTE_DIR}/audit-client/ 2>/dev/null || true
  echo "   ✅ audit-client 已同步"
fi

if [ -d "$LOCAL_DIR/discovery-client" ]; then
  scp "$LOCAL_DIR/discovery-client/index.js" ${SERVER}:${REMOTE_DIR}/discovery-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/discovery-client/services/"*.js ${SERVER}:${REMOTE_DIR}/discovery-client/services/ 2>/dev/null || true
  scp "$LOCAL_DIR/discovery-client/config.json" ${SERVER}:${REMOTE_DIR}/discovery-client/ 2>/dev/null || true
  echo "   ✅ discovery-client 已同步"
fi

if [ -d "$LOCAL_DIR/harvest-client" ]; then
  scp "$LOCAL_DIR/harvest-client/index.js" ${SERVER}:${REMOTE_DIR}/harvest-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/harvest-client/services/"*.js ${SERVER}:${REMOTE_DIR}/harvest-client/services/ 2>/dev/null || true
  scp "$LOCAL_DIR/harvest-client/config.json" ${SERVER}:${REMOTE_DIR}/harvest-client/ 2>/dev/null || true
  echo "   ✅ harvest-client 已同步"
fi

if [ -d "$LOCAL_DIR/blacklist-scan-client" ]; then
  scp "$LOCAL_DIR/blacklist-scan-client/index.js" ${SERVER}:${REMOTE_DIR}/blacklist-scan-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/blacklist-scan-client/services/"*.js ${SERVER}:${REMOTE_DIR}/blacklist-scan-client/services/ 2>/dev/null || true
  scp "$LOCAL_DIR/blacklist-scan-client/config.json" ${SERVER}:${REMOTE_DIR}/blacklist-scan-client/ 2>/dev/null || true
  echo "   ✅ blacklist-scan-client 已同步"
fi

if [ -d "$LOCAL_DIR/deletion-check-client" ]; then
  scp "$LOCAL_DIR/deletion-check-client/index.js" ${SERVER}:${REMOTE_DIR}/deletion-check-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/deletion-check-client/services/"*.js ${SERVER}:${REMOTE_DIR}/deletion-check-client/services/ 2>/dev/null || true
  scp "$LOCAL_DIR/deletion-check-client/config.json" ${SERVER}:${REMOTE_DIR}/deletion-check-client/ 2>/dev/null || true
  echo "   ✅ deletion-check-client 已同步"
fi

if [ -d "$LOCAL_DIR/deletion-recheck-client" ]; then
  scp "$LOCAL_DIR/deletion-recheck-client/index.js" ${SERVER}:${REMOTE_DIR}/deletion-recheck-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/deletion-recheck-client/services/"*.js ${SERVER}:${REMOTE_DIR}/deletion-recheck-client/services/ 2>/dev/null || true
  scp "$LOCAL_DIR/deletion-recheck-client/config.json" ${SERVER}:${REMOTE_DIR}/deletion-recheck-client/ 2>/dev/null || true
  echo "   ✅ deletion-recheck-client 已同步"
fi

if [ -d "$LOCAL_DIR/short-link-client" ]; then
  scp "$LOCAL_DIR/short-link-client/index.js" ${SERVER}:${REMOTE_DIR}/short-link-client/ 2>/dev/null || true
  scp "$LOCAL_DIR/short-link-client/services/"*.js ${SERVER}:${REMOTE_DIR}/short-link-client/services/ 2>/dev/null || true
  scp "$LOCAL_DIR/short-link-client/config.json" ${SERVER}:${REMOTE_DIR}/short-link-client/ 2>/dev/null || true
  echo "   ✅ short-link-client 已同步"
fi

if [ -d "$LOCAL_DIR/shared" ]; then
  scp -r "$LOCAL_DIR/shared/"* ${SERVER}:${REMOTE_DIR}/shared/
  echo "   ✅ shared 已同步"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 同步完成！自动打包服务正在生成 zip..."
echo "🔗 下载地址: https://www.wubug.cc/downloads/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
