#!/bin/bash
# 小红书客户端代码发版脚本
# 用法: bash release-clients.sh <版本号>
# 示例: bash release-clients.sh 1.6.0
set -e

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "用法: bash release-clients.sh <版本号>"
  echo "示例: bash release-clients.sh 1.6.0"
  exit 1
fi

CLIENTS_DIR="/var/www/xiaohongshu-web/xiaohongshu-audit-clients"
DOWNLOADS_DIR="/var/www/xiaohongshu-web/downloads"

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

# ─── Step 1: VERSION.txt ───
echo "[1/8] 更新 VERSION.txt ..."
echo "小红书审核客户端 v${VERSION}" > "$CLIENTS_DIR/VERSION.txt"
echo "更新时间: $(date '+%Y-%m-%d %H:%M')" >> "$CLIENTS_DIR/VERSION.txt"

# ─── Step 2: 各客户端版本号 + config.defaults.json ───
echo "[2/8] 更新各客户端版本号 + 生成 config.defaults.json ..."
for dir in "${CLIENT_SUBDIRS[@]}"; do
  CFG="$CLIENTS_DIR/$dir/config.json"
  if [ -f "$CFG" ]; then
    python3 -c "
import json
with open('$CFG', 'r') as f: cfg = json.load(f)
old = cfg.get('version', '?')
cfg['version'] = '$VERSION'
with open('$CFG', 'w') as f: json.dump(cfg, f, indent=2, ensure_ascii=False)
print(f'  $dir: v{old} -> v$VERSION')
"
    python3 -c "
import json
with open('$CFG', 'r') as f: cfg = json.load(f)
defaults = json.loads(json.dumps(cfg))
if 'deepseek' in defaults and 'apiKey' in defaults.get('deepseek', {}):
    defaults['deepseek']['apiKey'] = ''
with open('$CLIENTS_DIR/$dir/config.defaults.json', 'w') as f:
    json.dump(defaults, f, indent=2, ensure_ascii=False)
"
  else
    echo "  $dir: config.json 不存在，跳过"
  fi
done

# ─── Step 3: version.json ───
echo "[3/8] 更新 version.json ..."
cat > "$CLIENTS_DIR/version.json" <<VEOF
{
  "version": "${VERSION}",
  "updateDate": "$(date -Iseconds)",
  "downloadUrl": "https://www.wubug.cc/downloads/xiaohongshu-audit-clients-update.zip",
  "manifestUrl": "https://www.wubug.cc/downloads/xiaohongshu-audit-clients/manifest.json",
  "changelog": "发版 v${VERSION}"
}
VEOF

# ─── Step 4: manifest.json ───
echo "[4/8] 生成 manifest.json ..."
RELEASE_VERSION="$VERSION" CLIENTS_DIR="$CLIENTS_DIR" python3 << 'PYEOF'
import hashlib, json, os, datetime

base = os.environ['CLIENTS_DIR']
version = os.environ['RELEASE_VERSION']
manifest = { 'bundleVersion': version, 'generatedAt': datetime.datetime.now().isoformat(), 'files': {}, 'clientVersions': {} }

for root, dirs, files in os.walk(base):
    dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', '_backup', '_update_tmp', '.hermes')]
    for f in files:
        if f.endswith(('.tar.gz', '.zip', '.msi', '.apk')) or f.startswith('.'):
            continue
        fp = os.path.join(root, f)
        rel = os.path.relpath(fp, base)
        manifest['files'][rel] = hashlib.sha256(open(fp, 'rb').read()).hexdigest()[:16]
    for f in files:
        if f == 'config.json':
            try:
                cfg = json.load(open(os.path.join(root, f)))
                ct, v = cfg.get('clientType'), cfg.get('version')
                if ct and v: manifest['clientVersions'][ct] = v
            except: pass

with open(os.path.join(base, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print(f'  {len(manifest["files"])} files, {len(manifest["clientVersions"])} clients')
PYEOF

# ─── Step 5: 打包 ───
echo "[5/8] 打包..."

UPDATE_ZIP="xiaohongshu-audit-clients-update.zip"
TMP_UPDATE="/tmp/${UPDATE_ZIP}"
rm -f "$TMP_UPDATE"
cd /var/www/xiaohongshu-web
zip -rq "$TMP_UPDATE" xiaohongshu-audit-clients/ \
  -x "*/node_modules/*" -x "*/.git/*" \
  -x "xiaohongshu-audit-clients/*.msi" -x "xiaohongshu-audit-clients/*.apk" \
  -x "xiaohongshu-audit-clients/*.tar.gz" -x "xiaohongshu-audit-clients/xiaohongshu-audit-clients*.zip"
UPDATE_SIZE=$(du -h "$TMP_UPDATE" | cut -f1)
echo "  更新包 (轻量): ${UPDATE_SIZE}"

FULL_ZIP="xiaohongshu-audit-clients.zip"
TMP_FULL="/tmp/${FULL_ZIP}"
rm -f "$TMP_FULL"
zip -rq "$TMP_FULL" xiaohongshu-audit-clients/ \
  -x "*/.git/*" \
  -x "xiaohongshu-audit-clients/*.msi" -x "xiaohongshu-audit-clients/*.apk" \
  -x "xiaohongshu-audit-clients/*.tar.gz" -x "xiaohongshu-audit-clients/xiaohongshu-audit-clients*.zip"
FULL_SIZE=$(du -h "$TMP_FULL" | cut -f1)
echo "  完整包 (含 node_modules): ${FULL_SIZE}"

# ─── Step 6: 部署 ───
echo "[6/8] 部署..."
cp "$TMP_UPDATE" "$DOWNLOADS_DIR/${UPDATE_ZIP}"
cp "$TMP_FULL" "$DOWNLOADS_DIR/${FULL_ZIP}"
rm -f "$TMP_UPDATE" "$TMP_FULL"

mkdir -p "$DOWNLOADS_DIR/xiaohongshu-audit-clients"
cp "$CLIENTS_DIR/manifest.json" "$DOWNLOADS_DIR/xiaohongshu-audit-clients/manifest.json"

cat > "$DOWNLOADS_DIR/xiaohongshu-audit-clients/version.json" <<VEOF
{
  "version": "${VERSION}",
  "updated": "$(date +%Y-%m-%d)",
  "files": { "update": "${UPDATE_ZIP}", "full": "${FULL_ZIP}" },
  "manifestUrl": "https://www.wubug.cc/downloads/xiaohongshu-audit-clients/manifest.json"
}
VEOF

echo "  更新包 → ${UPDATE_ZIP} (${UPDATE_SIZE})"
echo "  完整包 → ${FULL_ZIP} (${FULL_SIZE})"
echo "  manifest.json → downloads/"

# ─── Step 7: 更新 .env ───
echo "[7/8] 更新服务端 CLIENT_VERSION..."
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

# ─── Step 8: 清理 ───
echo "[8/8] 清理..."
for dir in "${CLIENT_SUBDIRS[@]}"; do
  rm -f "$CLIENTS_DIR/$dir/.version.json" 2>/dev/null
done

echo ""
echo "═══════════════════════════════════════"
echo "  发版完成 v${VERSION}"
echo "  更新包: ${UPDATE_SIZE} (Launcher 自动更新)"
echo "  完整包: ${FULL_SIZE} (首次安装)"
echo ""
echo "  ⚠️  重启服务端生效: pm2 restart xiaohongshu"
echo "═══════════════════════════════════════"
echo ""
