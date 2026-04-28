#!/bin/bash
# 小红书客户端代码发版脚本
# 用法: bash release-clients.sh <版本号>
# 示例: bash release-clients.sh 1.5.0
set -e

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "用法: bash release-clients.sh <版本号>"
  echo "示例: bash release-clients.sh 1.5.0"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLIENTS_DIR="/var/www/xiaohongshu-web/xiaohongshu-audit-clients"
DOWNLOADS_DIR="/var/www/xiaohongshu-web/downloads"

# 客户端子目录列表
CLIENT_SUBDIRS=(
  "audit-client"
  "harvest-client"
  "discovery-client"
  "blacklist-scan-client"
  "short-link-client"
  "deletion-check-client"
  "deletion-recheck-client"
)

echo "=== 小红书客户端代码发版 v${VERSION} ==="
echo ""

# 1. 更新 VERSION.txt
echo "[1/6] 更新 VERSION.txt ..."
if [ -f "$CLIENTS_DIR/VERSION.txt" ]; then
  echo "小红书审核客户端 v${VERSION}" > "$CLIENTS_DIR/VERSION.txt"
  echo "更新时间: $(date '+%Y-%m-%d %H:%M')" >> "$CLIENTS_DIR/VERSION.txt"
  echo "  VERSION.txt -> v${VERSION}"
fi

# 2. 更新各客户端 config.json 中的版本号 + 生成 .version.json
echo "[2/6] 更新各客户端版本号..."
for dir in "${CLIENT_SUBDIRS[@]}"; do
  CFG_PATH="$CLIENTS_DIR/$dir/config.json"
  if [ -f "$CFG_PATH" ]; then
    # 用 python 更新 JSON 中的 version 字段（保留其他字段）
    python3 -c "
import json, sys
with open('$CFG_PATH', 'r') as f:
    cfg = json.load(f)
old_ver = cfg.get('version', '?.?.?')
cfg['version'] = '$VERSION'
with open('$CFG_PATH', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
print(f'  $dir: v{old_ver} -> v$VERSION')
"
    # 生成 .version.json 供 launcher 更新时使用
    echo "{\"version\": \"${VERSION}\"}" > "$CLIENTS_DIR/$dir/.version.json"
  else
    echo "  $dir: config.json 不存在，跳过"
  fi
done

# 3. 更新内部 version.json
echo "[3/6] 更新 version.json ..."
cat > "$CLIENTS_DIR/version.json" <<VEOF
{
  "version": "${VERSION}",
  "updateDate": "$(date -Iseconds)",
  "downloadUrl": "https://www.wubug.cc/downloads/xiaohongshu-audit-clients-update.zip",
  "changelog": "发版 v${VERSION}"
}
VEOF
echo "  version.json -> v${VERSION}"

# 4. 打包（两种 zip）
echo "[4/6] 打包客户端代码..."

# 4a. 轻量包（不含 node_modules）- 供手动下载
ZIP_LIGHT="xiaohongshu-audit-clients.zip"
TMP_LIGHT="/tmp/${ZIP_LIGHT}"
rm -f "$TMP_LIGHT"
cd /var/www/xiaohongshu-web
zip -rq "$TMP_LIGHT" xiaohongshu-audit-clients/ \
  -x "*/node_modules/*" \
  -x "*/.git/*" \
  -x "xiaohongshu-audit-clients/*.msi" \
  -x "xiaohongshu-audit-clients/*.apk" \
  -x "xiaohongshu-audit-clients/*.tar.gz" \
  -x "xiaohongshu-audit-clients/xiaohongshu-audit-clients.zip"
LIGHT_SIZE=$(du -h "$TMP_LIGHT" | cut -f1)
echo "  轻量包: ${LIGHT_SIZE}"

# 4b. 全量包（含 node_modules）- 供 launcher 自动更新用
ZIP_FULL="xiaohongshu-audit-clients-update.zip"
TMP_FULL="/tmp/${ZIP_FULL}"
rm -f "$TMP_FULL"
cd /var/www/xiaohongshu-web
zip -rq "$TMP_FULL" xiaohongshu-audit-clients/ \
  -x "*/.git/*" \
  -x "xiaohongshu-audit-clients/*.msi" \
  -x "xiaohongshu-audit-clients/*.apk" \
  -x "xiaohongshu-audit-clients/*.tar.gz" \
  -x "xiaohongshu-audit-clients/xiaohongshu-audit-clients.zip"
FULL_SIZE=$(du -h "$TMP_FULL" | cut -f1)
echo "  全量包: ${FULL_SIZE}"

# 5. 部署到 downloads
echo "[5/6] 部署到下载中心..."
cp "$TMP_LIGHT" "$DOWNLOADS_DIR/${ZIP_LIGHT}"
cp "$TMP_FULL" "$DOWNLOADS_DIR/${ZIP_FULL}"
rm -f "$TMP_LIGHT" "$TMP_FULL"

# 更新 downloads 目录下的 version.json
mkdir -p "$DOWNLOADS_DIR/xiaohongshu-audit-clients"
cat > "$DOWNLOADS_DIR/xiaohongshu-audit-clients/version.json" <<VEOF
{
  "version": "${VERSION}",
  "updated": "$(date +%Y-%m-%d)",
  "files": {
    "light": "xiaohongshu-audit-clients.zip",
    "full": "xiaohongshu-audit-clients-update.zip"
  }
}
VEOF

echo "  -> $DOWNLOADS_DIR/${ZIP_LIGHT} (轻量包)"
echo "  -> $DOWNLOADS_DIR/${ZIP_FULL} (全量包)"
echo "  -> version.json updated"

# 6. 更新服务端 CLIENT_VERSION 环境变量
echo "[6/6] 更新服务端版本号..."
ENV_FILE="/opt/xiaohongshuWeb/server/.env"
if [ -f "$ENV_FILE" ]; then
  if grep -q "^CLIENT_VERSION=" "$ENV_FILE"; then
    sed -i "s/^CLIENT_VERSION=.*/CLIENT_VERSION=${VERSION}/" "$ENV_FILE"
  else
    echo "CLIENT_VERSION=${VERSION}" >> "$ENV_FILE"
  fi
else
  echo "CLIENT_VERSION=${VERSION}" > "$ENV_FILE"
fi
echo "  CLIENT_VERSION -> ${VERSION}"

echo ""
echo "=== 发版完成 ==="
echo "版本: ${VERSION}"
echo "轻量包: ${LIGHT_SIZE} (手动下载)"
echo "全量包: ${FULL_SIZE} (Launcher 自动更新)"
echo "Launcher 将在下次检查时（约5分钟内）发现更新"
echo ""
echo "⚠️  别忘了重启服务端使 CLIENT_VERSION 生效："
echo "   cd /opt/xiaohongshuWeb && pm2 restart xiaohongshu"
echo ""
