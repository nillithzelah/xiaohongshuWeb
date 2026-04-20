#!/bin/bash
# 自动打包服务安装脚本
# 在服务器上运行此脚本以启用自动打包功能

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 安装自动打包服务"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 安装依赖
echo "[1/4] 检查并安装依赖..."
if ! command -v inotifywait &> /dev/null; then
    echo "   安装 inotify-tools..."
    apt-get update && apt-get install -y inotify-tools zip
else
    echo "   ✅ inotify-tools 已安装"
fi

if ! command -v zip &> /dev/null; then
    echo "   安装 zip..."
    apt-get install -y zip
else
    echo "   ✅ zip 已安装"
fi

# 2. 复制监听脚本
echo ""
echo "[2/4] 安装监听脚本..."
cat > /usr/local/bin/auto-pack-clients.sh << 'EOF'
#!/bin/bash
WATCH_DIR="/var/www/xiaohongshu-web/xiaohongshu-audit-clients"
ZIP_FILE="/var/www/xiaohongshu-web/xiaohongshu-audit-clients.zip"
LOCK_FILE="/tmp/auto-pack-clients.lock"

echo "🚀 [自动打包] 启动监听: $WATCH_DIR"
rm -f "$LOCK_FILE"

inotifywait -m -r -e modify,create,delete,move,attrib \
    --format '%w%f %e' \
    "$WATCH_DIR" 2>/dev/null | while read file event; do
    (
        flock -n 9 || exit 0
        sleep 2
        cd /var/www/xiaohongshu-web
        zip -rq "$ZIP_FILE" xiaohongshu-audit-clients/ 2>/dev/null
        SIZE=$(ls -lh "$ZIP_FILE" 2>/dev/null | awk '{print $5}')
        TIME=$(date '+%H:%M:%S')
        echo "✅ [自动打包] $TIME | 大小: $SIZE"
    ) 9>"$LOCK_FILE"
done
EOF

chmod +x /usr/local/bin/auto-pack-clients.sh
echo "   ✅ 脚本已安装到 /usr/local/bin/auto-pack-clients.sh"

# 3. 创建 systemd 服务
echo ""
echo "[3/4] 创建 systemd 服务..."
cat > /etc/systemd/system/auto-pack-clients.service << 'EOF'
[Unit]
Description=Auto-pack xiaohongshu audit clients on file changes
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/xiaohongshu-web
ExecStart=/usr/local/bin/auto-pack-clients.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "   ✅ 服务文件已创建"

# 4. 启动服务
echo ""
echo "[4/4] 启动服务..."
systemctl daemon-reload
systemctl enable auto-pack-clients.service
systemctl restart auto-pack-clients.service

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 自动打包服务安装完成！"
echo ""
echo "服务管理命令："
echo "  查看状态: systemctl status auto-pack-clients"
echo "  停止服务: systemctl stop auto-pack-clients"
echo "  启动服务: systemctl start auto-pack-clients"
echo "  查看日志: journalctl -u auto-pack-clients -f"
echo ""
echo "🔗 下载地址: https://www.wubug.cc/downloads/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
