#!/bin/bash
# 自动打包监听服务
# 当 xiaohongshu-audit-clients 目录有文件变化时，自动重新打包为 zip

WATCH_DIR="/var/www/xiaohongshu-web/xiaohongshu-audit-clients"
ZIP_FILE="/var/www/xiaohongshu-web/xiaohongshu-audit-clients.zip"
LOCK_FILE="/tmp/auto-pack-clients.lock"

# 检查 zip 是否安装
if ! command -v zip &> /dev/null; then
    echo "❌ zip 未安装，正在安装..."
    apt-get update && apt-get install -y zip
fi

echo "🚀 [自动打包服务] 启动监听: $WATCH_DIR"
echo "📦 [自动打包服务] 任何文件变化将自动重新打包为 zip"

# 清理旧锁文件
rm -f "$LOCK_FILE"

# 监听目录变化
inotifywait -m -r -e modify,create,delete,move,attrib \
    --format '%w%f %e' \
    "$WATCH_DIR" | while read file event; do

    # 获取锁，避免重复打包
    (
        flock -n 9 || exit 0

        echo "📝 [文件变化] $file ($event)"
        echo "⏳ [自动打包] 等待2秒后打包（合并批量变化）..."

        # 等待2秒，合并批量变化
        sleep 2

        # 打包为 zip
        cd /var/www/xiaohongshu-web
        zip -rq "$ZIP_FILE" xiaohongshu-audit-clients/

        # 获取文件信息
        SIZE=$(ls -lh "$ZIP_FILE" | awk '{print $5}')
        TIME=$(ls -l "$ZIP_FILE" | awk '{print $6, $7, $8}')

        echo "✅ [自动打包] 完成 | 大小: $SIZE | 时间: $TIME"
        echo "🔗 下载地址: https://www.wubug.cc/downloads/"
        echo ""

    ) 9>"$LOCK_FILE"
done
