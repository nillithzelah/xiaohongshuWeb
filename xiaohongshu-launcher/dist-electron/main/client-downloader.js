const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * 客户端代码下载器
 * 负责从服务器下载 xiaohongshu-audit-clients.zip 并解压
 * 支持版本检查，自动发现更新
 */
class ClientDownloader extends EventEmitter {
  constructor(mainWindow) {
    super();
    this.mainWindow = mainWindow;
    this.downloadUrl = 'https://www.wubug.cc/downloads/xiaohongshu-audit-clients.zip';
    this.versionUrl = 'https://www.wubug.cc/downloads/xiaohongshu-audit-clients/version.json';
    this.tempZipPath = path.join(process.env.TEMP || '/tmp', 'xiaohongshu-audit-clients.zip');
  }

  /**
   * 获取服务器版本信息
   */
  async getServerVersion() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.versionUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cache-Control': 'no-cache'
        }
      };

      protocol.get(this.versionUrl, options, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          this.versionUrl = response.headers.location;
          this.getServerVersion().then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`获取版本失败: HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('版本信息解析失败'));
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 获取本地版本信息
   */
  getLocalVersion(clientsPath) {
    // 优先读取 version.json
    const versionPath = path.join(clientsPath, 'version.json');
    if (fs.existsSync(versionPath)) {
      try {
        const content = fs.readFileSync(versionPath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        console.warn('[版本] version.json 解析失败:', e.message);
      }
    }

    // 如果没有 version.json，检查关键文件是否存在
    // 如果目录存在且包含关键客户端文件，认为已安装（返回一个默认版本）
    if (fs.existsSync(clientsPath)) {
      const keyFiles = [
        'audit-client/package.json',
        'harvest-client/package.json',
        'discovery-client/package.json',
        'deletion-check-client/package.json',
        'blacklist-scan-client/package.json'
      ];

      for (const file of keyFiles) {
        if (fs.existsSync(path.join(clientsPath, file))) {
          console.warn('[版本] version.json 不存在，但检测到客户端文件，返回默认版本');
          return { version: '1.0.0', legacy: true }; // 返回默认版本，避免重复下载
        }
      }
    }

    return null;
  }

  /**
   * 检查是否需要更新
   * @returns {Promise<{needsUpdate: boolean, localVersion: string|null, serverVersion: string, message: string}>}
   */
  async checkForUpdate(clientsPath) {
    try {
      const serverVersion = await this.getServerVersion();
      const localVersion = this.getLocalVersion(clientsPath);

      if (!localVersion) {
        return {
          needsUpdate: true,
          localVersion: null,
          serverVersion: serverVersion.version,
          message: '本地无客户端代码，需要下载'
        };
      }

      // 比较版本号
      const needsUpdate = this.compareVersions(serverVersion.version, localVersion.version) > 0;

      return {
        needsUpdate,
        localVersion: localVersion.version,
        serverVersion: serverVersion.version,
        message: needsUpdate
          ? `发现新版本 ${serverVersion.version}，当前版本 ${localVersion.version}`
          : `已是最新版本 ${localVersion.version}`
      };
    } catch (error) {
      console.error('[版本检查] 失败:', error.message);
      return {
        needsUpdate: false,
        localVersion: null,
        serverVersion: null,
        message: `版本检查失败: ${error.message}`
      };
    }
  }

  /**
   * 比较版本号
   * @returns {number} >0 表示 v1 > v2, <0 表示 v1 < v2, 0 表示相等
   */
  compareVersions(v1, v2) {
    const parts1 = (v1 || '0.0.0').split('.').map(Number);
    const parts2 = (v2 || '0.0.0').split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * 检查客户端目录是否存在
   */
  checkClientsDirectory(clientsPath) {
    return fs.existsSync(clientsPath);
  }

  /**
   * 发送进度到渲染进程
   */
  sendProgress(type, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('client-download-progress', { type, ...data });
    }
    this.emit('progress', { type, ...data });
  }

  /**
   * 下载文件
   */
  downloadFile() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.downloadUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      this.sendProgress('download-start', { url: this.downloadUrl });

      const file = fs.createWriteStream(this.tempZipPath);
      let downloadedBytes = 0;
      let totalBytes = 0;

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      protocol.get(this.downloadUrl, options, (response) => {
        // 处理重定向
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(this.tempZipPath);
          this.downloadUrl = response.headers.location;
          this.downloadFile().then(resolve).catch(reject);
          return;
        }

        // 检查响应状态
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(this.tempZipPath).catch(() => {});
          reject(new Error(`下载失败: HTTP ${response.statusCode}`));
          return;
        }

        totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        const totalMB = (totalBytes / 1024 / 1024).toFixed(2);

        this.sendProgress('download-size', { totalBytes, totalMB });

        response.pipe(file);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = totalBytes > 0 ? Math.floor((downloadedBytes / totalBytes) * 100) : 0;
          const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(2);
          this.sendProgress('download-progress', {
            percent,
            downloadedBytes,
            downloadedMB,
            totalBytes,
            totalMB
          });
        });

        file.on('finish', () => {
          file.close();
          this.sendProgress('download-complete', {
            totalBytes: downloadedBytes,
            totalMB: (downloadedBytes / 1024 / 1024).toFixed(2)
          });
          resolve(this.tempZipPath);
        });

        file.on('error', (err) => {
          fs.unlink(this.tempZipPath).catch(() => {});
          reject(err);
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(this.tempZipPath).catch(() => {});
        reject(err);
      });
    });
  }

  /**
   * 解压文件到目标目录
   * 智能处理 zip 文件中的根目录前缀问题
   */
  async extractFile(targetPath) {
    const AdmZip = require('adm-zip');
    this.sendProgress('extract-start', { targetPath });

    return new Promise((resolve, reject) => {
      try {
        const zip = new AdmZip(this.tempZipPath);
        const entries = zip.getEntries();

        this.sendProgress('extract-count', { count: entries.length });

        // 删除目标目录如果已存在
        if (fs.existsSync(targetPath)) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        }

        // 创建目标目录
        fs.mkdirSync(targetPath, { recursive: true });

        // 检测 zip 内部是否有单一根目录（如 xiaohongshu-audit-clients/）
        // 如果有，将其内容直接解压到目标目录，避免双重嵌套
        const rootEntryName = path.basename(targetPath);
        let hasSingleRoot = false;
        let rootPrefix = '';

        // 检查所有条目是否都以同一个根目录开头
        const topLevelDirs = new Set();
        for (const entry of entries) {
          const parts = entry.entryName.split('/');
          if (parts.length > 0 && parts[0]) {
            topLevelDirs.add(parts[0]);
          }
        }

        // 如果只有一个顶级目录，且名称与目标目录名相同或相似
        if (topLevelDirs.size === 1) {
          const zipRoot = [...topLevelDirs][0];
          // 检查是否是同名目录或包含相同名称
          if (zipRoot === rootEntryName || zipRoot.includes('xiaohongshu-audit-clients')) {
            hasSingleRoot = true;
            rootPrefix = zipRoot + '/';
            console.log('[解压] 检测到 zip 内部根目录:', zipRoot, '，将跳过此前缀');
          }
        }

        // 手动解压，跳过根目录前缀
        for (const entry of entries) {
          if (entry.isDirectory) continue;

          let entryPath = entry.entryName;

          // 如果有单一根目录，跳过它
          if (hasSingleRoot && entryPath.startsWith(rootPrefix)) {
            entryPath = entryPath.substring(rootPrefix.length);
          }

          if (!entryPath) continue; // 跳过空路径

          const destPath = path.join(targetPath, entryPath);
          const destDir = path.dirname(destPath);

          // 确保目标目录存在
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          // 写入文件
          const data = entry.getData();
          fs.writeFileSync(destPath, data);
        }

        this.sendProgress('extract-complete', {
          targetPath,
          count: entries.length
        });

        // 清理临时文件
        fs.unlinkSync(this.tempZipPath);

        resolve({ targetPath, count: entries.length });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 完整下载流程
   */
  async downloadAndExtract(targetPath) {
    try {
      // 1. 下载
      await this.downloadFile();

      // 2. 解压
      const result = await this.extractFile(targetPath);

      // 3. 保存版本信息到本地（避免下次重复下载）
      try {
        const serverVersion = await this.getServerVersion();
        const versionPath = path.join(targetPath, 'version.json');
        fs.writeFileSync(versionPath, JSON.stringify(serverVersion, null, 2));
        console.log('[版本] 已保存版本信息:', serverVersion.version);
      } catch (versionError) {
        console.warn('[版本] 保存版本信息失败（不影响使用）:', versionError.message);
      }

      this.sendProgress('complete', {
        targetPath: result.targetPath,
        fileCount: result.count
      });

      return result;
    } catch (error) {
      this.sendProgress('error', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

module.exports = ClientDownloader;
