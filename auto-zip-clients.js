const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const watchDir = '/var/www/xiaohongshu-web/xiaohongshu-audit-clients';
const versionFile = path.join(watchDir, 'version.json');
const downloadsDir = '/var/www/xiaohongshu-web/downloads';
let timeout = null;
let isPacking = false;
let packCount = 0;

// 更新版本号（自动 patch +1）
function updateVersion() {
  try {
    let versionData = { version: '1.0.0', updatedAt: new Date().toISOString() };

    // 读取现有版本
    if (fs.existsSync(versionFile)) {
      const content = fs.readFileSync(versionFile, 'utf8');
      versionData = JSON.parse(content);
    }

    // 自动增加补丁版本号 (1.0.0 -> 1.0.1)
    const parts = versionData.version.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    versionData.version = `${parts[0]}.${parts[1]}.${patch}`;
    versionData.updatedAt = new Date().toISOString();
    versionData.description = '小红书采集客户端代码';

    // 写入新版本
    fs.writeFileSync(versionFile, JSON.stringify(versionData, null, 2));
    console.log(`📝 版本已更新: ${versionData.version}`);

    // 同步更新 .env 中的 CLIENT_VERSION（让 version-check API 立即感知）
    const envFile = '/opt/xiaohongshuWeb/server/.env';
    try {
      let envContent = '';
      if (fs.existsSync(envFile)) {
        envContent = fs.readFileSync(envFile, 'utf8');
      }
      if (/^CLIENT_VERSION=/m.test(envContent)) {
        envContent = envContent.replace(/^CLIENT_VERSION=.*/m, `CLIENT_VERSION=${versionData.version}`);
      } else {
        envContent += `\nCLIENT_VERSION=${versionData.version}\n`;
      }
      fs.writeFileSync(envFile, envContent);
      console.log(`📝 .env CLIENT_VERSION 已同步: ${versionData.version}`);
    } catch (e) {
      console.warn(`⚠️ 同步 .env 失败: ${e.message}`);
    }

    return versionData.version;
  } catch (error) {
    console.error('⚠️ 版本更新失败:', error.message);
    return null;
  }
}

// 不需要监控的文件扩展名和黑名单
const IGNORE_PATTERNS = [
  // 压缩包
  '.tar.gz', '.zip', '.rar', '.7z',
  // 安装包
  '.msi', '.exe', '.dmg', '.pkg',
  // 临时文件
  '.tmp', '.temp', '.swp', '.bak',
  // 日志
  '.log',
  // 目录
  'node_modules', '.git',
  // 黑名单文件
  'node-v24'
];

const IGNORE_FILES = new Set([
  'node-v24.13.0-x64.msi',
  'install.bat',
  'discovery-client采集笔记.txt',
  'harvest-client采集评论 - 副本.txt',
  'harvest-client采集评论.txt',
  'blacklist-scan-client黑名单.txt',
  'audit-client审核评论.txt',
  'short-link-client短链接转换长链接.txt'
]);

function shouldIgnore(filename) {
  if (!filename) return true;

  // 检查黑名单文件
  if (IGNORE_FILES.has(filename)) return true;

  // 检查扩展名
  if (IGNORE_PATTERNS.some(pattern => filename.includes(pattern))) return true;

  // 临时文件
  if (filename.startsWith('.')) return true;

  return false;
}

function updateZip() {
  if (isPacking) {
    console.log('⏳ 正在打包中，跳过...');
    return;
  }

  isPacking = true;
  packCount++;
  const currentPack = packCount;
  console.log(`📦 [${currentPack}] 检测到变化，开始打包...`);

  // 更新版本号
  const newVersion = updateVersion();

  // 使用临时文件名，避免与正在删除的文件冲突
  const tempTar = path.join(watchDir, `.xiaohongshu-audit-clients.${currentPack}.tar.gz`);
  const tempZip = path.join(watchDir, `.xiaohongshu-audit-clients.${currentPack}.zip`);
  const tempZipUpdate = path.join(watchDir, `.xiaohongshu-audit-clients-update.${currentPack}.zip`);
  const finalTar = path.join(watchDir, 'xiaohongshu-audit-clients.tar.gz');
  const finalZip = path.join(watchDir, 'xiaohongshu-audit-clients.zip');
  const finalZipUpdate = path.join(downloadsDir, 'xiaohongshu-audit-clients-update.zip');

  // 清理旧的临时文件
  try {
    fs.readdirSync(watchDir).forEach(file => {
      if (file.startsWith('.xiaohongshu-audit-clients.') && (file.endsWith('.tar.gz') || file.endsWith('.zip'))) {
        fs.unlinkSync(path.join(watchDir, file));
      }
    });
  } catch(e) {}

  // tar.gz 打包
  exec(`cd /var/www/xiaohongshu-web && tar -czf ${tempTar} --exclude='node_modules' --exclude='.git' --exclude='*.tar.gz' --exclude='*.zip' xiaohongshu-audit-clients/`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [${currentPack}] tar.gz 失败:`, error.message);
      isPacking = false;
      return;
    }

    try {
      const { size } = fs.statSync(tempTar);
      console.log(`✅ [${currentPack}] tar.gz 完成 (${(size/1024/1024).toFixed(1)}MB)`);
    } catch(e) {}

    // zip 轻量包（不含 node_modules）- 保留在 xiaohongshu-audit-clients 目录下
    const zipLightCmd = `cd /var/www/xiaohongshu-web && python3 -c '
import zipfile, os
zip_path = "${tempZip}"
source_dir = "xiaohongshu-audit-clients"
z = zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED)
for root, dirs, files in os.walk(source_dir):
    if "node_modules" in root or ".git" in root:
        continue
    # 排除大文件
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
    for file in files:
        if file.endswith((".tar.gz", ".zip")) or file.startswith("."):
            continue
        file_path = os.path.join(root, file)
        # 保持 xiaohongshu-audit-clients/ 前缀（与其他打包工具一致）
        z.write(file_path)
z.close()
'`;

    exec(zipLightCmd, (errorLight, stdoutLight, stderrLight) => {
      if (errorLight) {
        console.error(`❌ [${currentPack}] 轻量zip失败:`, errorLight.message);
        isPacking = false;
        return;
      }

      try {
        const { size } = fs.statSync(tempZip);
        console.log(`✅ [${currentPack}] 轻量zip完成 (${(size/1024).toFixed(0)}KB)`);
      } catch(e) {}

      // zip 全量包（含 node_modules）- 部署到 downloads 目录供 Launcher 更新用
      const zipFullCmd = `cd /var/www/xiaohongshu-web && python3 -c '
import zipfile, os
zip_path = "${tempZipUpdate}"
source_dir = "xiaohongshu-audit-clients"
z = zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED)
for root, dirs, files in os.walk(source_dir):
    if ".git" in root:
        continue
    dirs[:] = [d for d in dirs if d != ".git"]
    for file in files:
        if file.endswith((".tar.gz", ".zip", ".msi", ".apk")) or file.startswith("."):
            continue
        file_path = os.path.join(root, file)
        z.write(file_path)
z.close()
'`;

      exec(zipFullCmd, (errorFull, stdoutFull, stderrFull) => {
        if (errorFull) {
          console.error(`❌ [${currentPack}] 全量zip失败:`, errorFull.message);
          isPacking = false;
          return;
        }

        try {
          const { size } = fs.statSync(tempZipUpdate);
          console.log(`✅ [${currentPack}] 全量zip完成 (${(size/1024/1024).toFixed(1)}MB)`);
        } catch(e) {}

        // 部署：原子重命名
        try {
          if (fs.existsSync(finalTar)) fs.unlinkSync(finalTar);
          if (fs.existsSync(finalZip)) fs.unlinkSync(finalZip);
          if (fs.existsSync(finalZipUpdate)) fs.unlinkSync(finalZipUpdate);

          fs.renameSync(tempTar, finalTar);
          fs.renameSync(tempZip, finalZip);
          fs.renameSync(tempZipUpdate, finalZipUpdate);

          console.log(`🎉 [${currentPack}] 打包完成并已部署到 downloads！`);
        } catch(renameError) {
          console.error(`⚠️ [${currentPack}] 重命名失败:`, renameError.message);
        }

        isPacking = false;
      });
    });
  });
}

// 监控文件变化 - 使用递归监控（Linux 需要 Node 19+，降级时用 find 定时扫描）
console.log('👀 监控文件夹:', watchDir);

// 尝试使用 recursive watch
let usePolling = false;
try {
  const watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
    if (shouldIgnore(filename)) {
      return;
    }
    console.log(`📝 文件变化: ${filename} (${eventType})`);
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log('⏰ 防抖计时结束，开始打包...');
      updateZip();
    }, 10000);
  });
  watcher.on('error', (err) => {
    console.warn(`⚠️ 递归监控不支持，降级为定时扫描: ${err.message}`);
    usePolling = true;
    watcher.close();
    startPolling();
  });
  console.log('✅ 递归监控已启动 (防抖延迟: 10秒)');
} catch (e) {
  console.warn(`⚠️ fs.watch recursive 不支持，使用定时扫描`);
  usePolling = true;
  startPolling();
}

// 降级方案：每 60 秒扫描一次
function startPolling() {
  let lastHash = '';
  setInterval(() => {
    try {
      exec(`find ${watchDir} -name '*.js' -newer ${versionFile} -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -5`, (err, stdout) => {
        const files = stdout.trim();
        if (files && files !== lastHash) {
          lastHash = files;
          console.log(`📝 检测到代码文件变化:\n${files}`);
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            console.log('⏰ 防抖计时结束，开始打包...');
            updateZip();
          }, 10000);
        }
      });
    } catch (e) {}
  }, 60000);
  console.log('✅ 定时扫描已启动 (间隔: 60秒)');
}
