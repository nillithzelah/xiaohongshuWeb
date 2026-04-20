const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

class Updater {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isChecking = false;  // 防止重复检查
    this.configureAutoUpdater();
  }

  configureAutoUpdater() {
    // ✅ 配置日志（关键！）
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';

    // 配置更新服务器地址
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://www.wubug.cc/downloads/xiaohongshu-launcher'
    });

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // ✅ 新增：检查开始事件
    autoUpdater.on('checking-for-update', () => {
      log.info('正在检查更新...');
    });

    // 更新可用
    autoUpdater.on('update-available', (info) => {
      log.info('发现新版本:', info.version);
      this.isChecking = false;
      this.sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    });

    // 更新不可用
    autoUpdater.on('update-not-available', (info) => {
      log.info('当前已是最新版本:', info.version);
      this.isChecking = false;
      this.sendToRenderer('update-not-available', {
        version: info.version
      });
    });

    // 下载完成
    autoUpdater.on('update-downloaded', (info) => {
      log.info('更新下载完成:', info.version);
      this.sendToRenderer('update-downloaded', {
        version: info.version
      });
    });

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      this.sendToRenderer('download-progress', {
        percent: Math.floor(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      });
    });

    // 更新错误
    autoUpdater.on('error', (error) => {
      log.error('更新错误:', error);
      this.isChecking = false;
      this.sendToRenderer('update-error', {
        message: error.message || '未知错误'
      });
    });
  }

  /**
   * 检查更新
   */
  async checkForUpdates() {
    // 防止重复检查
    if (this.isChecking) {
      log.warn('已在检查中，请稍候');
      return null;
    }

    this.isChecking = true;

    try {
      log.info('开始检查更新...');
      log.info('更新服务器: https://www.wubug.cc/downloads/xiaohongshu-launcher');

      const result = await autoUpdater.checkForUpdates();

      if (result && result.updateInfo) {
        log.info('服务器版本:', result.updateInfo.version);
        log.info('当前版本:', autoUpdater.currentVersion);
      }

      return result;
    } catch (error) {
      log.error('检查更新失败:', error);
      this.isChecking = false;
      this.sendToRenderer('update-error', {
        message: error.message
      });
      return null;
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate() {
    try {
      log.info('开始下载更新...');
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error('下载更新失败:', error);
      throw error;
    }
  }

  /**
   * 安装更新并重启
   */
  quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  /**
   * 发送消息到渲染进程
   */
  sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

module.exports = Updater;
