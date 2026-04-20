const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 客户端相关
  getClients: () => ipcRenderer.invoke('get-clients'),
  startClient: (clientId) => ipcRenderer.invoke('start-client', clientId),
  stopClient: (clientId) => ipcRenderer.invoke('stop-client', clientId),
  getClientLogs: (clientId) => ipcRenderer.invoke('get-client-logs', clientId),
  clearClientLogs: (clientId) => ipcRenderer.invoke('clear-client-logs', clientId),
  downloadClients: () => ipcRenderer.invoke('download-clients'),
  getClientsPath: () => ipcRenderer.invoke('get-clients-path'),

  // 批量操作
  startAllClients: () => ipcRenderer.invoke('start-all-clients'),
  stopAllClients: () => ipcRenderer.invoke('stop-all-clients'),

  // 统计数据
  getStats: () => ipcRenderer.invoke('get-stats'),

  // 首次启动检测
  isFirstLaunch: () => ipcRenderer.invoke('is-first-launch'),

  // 更新相关
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),

  // 监听更新事件 - 返回取消监听函数
  onUpdateAvailable: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateNotAvailable: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-not-available', handler);
    return () => ipcRenderer.removeListener('update-not-available', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download-progress', handler);
    return () => ipcRenderer.removeListener('download-progress', handler);
  },
  onUpdateError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },

  // 监听客户端日志事件
  onClientLog: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('client-log', handler);
    return () => ipcRenderer.removeListener('client-log', handler);
  },

  // 监听客户端下载进度事件
  onClientDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('client-download-progress', handler);
    return () => ipcRenderer.removeListener('client-download-progress', handler);
  },

  // 监听客户端准备就绪事件
  onClientsReady: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('clients-ready', handler);
    return () => ipcRenderer.removeListener('clients-ready', handler);
  },

  // 监听首次启动事件
  onFirstLaunch: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('first-launch', handler);
    return () => ipcRenderer.removeListener('first-launch', handler);
  },

  // 客户端代码更新相关
  checkClientsUpdate: () => ipcRenderer.invoke('check-clients-update'),
  updateClients: () => ipcRenderer.invoke('update-clients'),

  // 监听客户端代码更新可用事件
  onClientsUpdateAvailable: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('clients-update-available', handler);
    return () => ipcRenderer.removeListener('clients-update-available', handler);
  }
});
