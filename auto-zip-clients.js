const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const watchDir = '/var/www/xiaohongshu-web/xiaohongshu-audit-clients';
const versionFile = path.join(watchDir, 'version.json');
let timeout = null;
let isPacking = false;
let packCount = 0;

// 更新版本号
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
  const ext = path.extname(filename).toLowerCase();
  if (IGNORE_PATTERNS.some(pattern => filename.includes(pattern))) return true;

  // 忽略客户端子目录（只关心代码文件变化）
  const clientDirs = ['discovery-client', 'harvest-client', 'blacklist-scan-client', 'audit-client', 'short-link-client', 'shared'];
  if (clientDirs.includes(filename)) {
    // 目录自身变化不触发（目录内文件变化会单独触发）
    return true;
  }

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
  const finalTar = path.join(watchDir, 'xiaohongshu-audit-clients.tar.gz');
  const finalZip = path.join(watchDir, 'xiaohongshu-audit-clients.zip');

  // 清理旧的临时文件
  try {
    fs.readdirSync(watchDir).forEach(file => {
      if (file.startsWith('.xiaohongshu-audit-clients.') && (file.endsWith('.tar.gz') || file.endsWith('.zip'))) {
        fs.unlinkSync(path.join(watchDir, file));
      }
    });
  } catch(e) {}

  // tar.gz 打包
  exec(`cd /var/www/xiaohongshu-web && tar -czf ${tempTar} xiaohongshu-audit-clients/`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ [${currentPack}] tar.gz 失败:`, error.message);
      isPacking = false;
      return;
    }

    try {
      const { size } = fs.statSync(tempTar);
      console.log(`✅ [${currentPack}] tar.gz 完成 (${(size/1024/1024).toFixed(1)}MB)`);
    } catch(e) {}

    // zip 打包（排除压缩包自身）
    const zipCmd = `cd /var/www/xiaohongshu-web && python3 -c '
import zipfile, os, sys
zip_path = "${tempZip}"
source_dir = "xiaohongshu-audit-clients"
z = zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED)
for root, dirs, files in os.walk(source_dir):
    # 排除 node_modules
    if "node_modules" in root:
        continue
    for file in files:
        # 排除压缩包和临时文件
        if file.endswith(".tar.gz") or file.endswith(".zip") or file.startswith("."):
            continue
        file_path = os.path.join(root, file)
        arcname = os.path.relpath(file_path, "xiaohongshu-audit-clients")
        z.write(file_path, arcname)
z.close()
'`;

    exec(zipCmd, (error2, stdout2, stderr2) => {
      if (error2) {
        console.error(`❌ [${currentPack}] zip 失败:`, error2.message);
        isPacking = false;
        return;
      }

      try {
        const { size } = fs.statSync(tempZip);
        console.log(`✅ [${currentPack}] zip 完成 (${(size/1024/1024).toFixed(1)}MB)`);
      } catch(e) {}

      // 重命名为最终文件名（原子操作）
      try {
        // 删除旧文件
        if (fs.existsSync(finalTar)) fs.unlinkSync(finalTar);
        if (fs.existsSync(finalZip)) fs.unlinkSync(finalZip);

        // 重命名临时文件
        fs.renameSync(tempTar, finalTar);
        fs.renameSync(tempZip, finalZip);

        console.log(`🎉 [${currentPack}] 打包完成！`);
      } catch(renameError) {
        console.error(`⚠️ [${currentPack}] 重命名失败:`, renameError.message);
      }

      isPacking = false;
    });
  });
}

// 监控文件变化
console.log('👀 监控文件夹:', watchDir);

fs.watch(watchDir, (eventType, filename) => {
  if (shouldIgnore(filename)) {
    return;
  }

  console.log(`📝 文件变化: ${filename} (${eventType})`);

  // 清除之前的定时器
  clearTimeout(timeout);

  // 防抖延迟：10秒内无新变化才打包
  timeout = setTimeout(() => {
    console.log('⏰ 防抖计时结束，开始打包...');
    updateZip();
  }, 10000);
});

console.log('✅ 监控已启动 (防抖延迟: 10秒)');
