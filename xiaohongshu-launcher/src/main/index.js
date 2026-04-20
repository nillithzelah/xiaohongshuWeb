const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const ClientManager = require('./client-manager');
const Updater = require('./updater');
const ClientDownloader = require('./client-downloader');

let mainWindow = null;
let tray = null;
let clientManager = null;
let updater = null;
let clientDownloader = null;
let isQuitting = false;

// 客户端配置
const CLIENTS = [
  { id: 'audit', name: '评论审核', icon: '✓', description: '验证评论真实性 + AI审核内容', path: 'audit-client' },
  { id: 'blacklist', name: '黑名单扫描', icon: '🚫', description: '扫描笔记评论识别黑名单用户', path: 'blacklist-scan-client' },
  { id: 'discovery', name: '笔记发现', icon: '🔍', description: '搜索发现维权笔记并上报', path: 'discovery-client' },
  { id: 'shortlink', name: '短链接处理', icon: '📎', description: '从短链接池获取待审核短链接', path: 'short-link-client' },
  { id: 'harvest', name: '评论采集', icon: '💬', description: '采集笔记评论作为线索', path: 'harvest-client' },
  { id: 'deletion', name: '删除检测', icon: '🗑️', description: '笔记删除状态检测', path: 'deletion-check-client' },
  { id: 'recheck', name: '删除复查', icon: '🔄', description: '笔记删除状态复查', path: 'deletion-recheck-client' }
];

// 客户端根目录路径
let CLIENTS_ROOT_PATH;
const fs = require('fs');

function findClientsPath() {
  const possiblePaths = [];

  if (process.env.NODE_ENV === 'development') {
    // 开发模式：项目目录
    possiblePaths.push(path.join(__dirname, '../../../xiaohongshu-audit-clients'));
  } else {
    // 生产模式：尝试多种路径
    const exePath = app.getPath('exe');
    const exeDir = path.dirname(exePath);

    // 1. exe 同级目录
    possiblePaths.push(path.join(exeDir, 'xiaohongshu-audit-clients'));

    // 2. win-unpacked 同级目录（便携版）
    if (exeDir.endsWith('win-unpacked')) {
      possiblePaths.push(path.join(exeDir, '../../xiaohongshu-audit-clients'));
  }

    // 3. 安装目录的上级
    possiblePaths.push(path.join(exeDir, '../xiaohongshu-audit-clients'));
  }

  // 查找第一个存在的路径
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log('[路径] 找到客户端目录:', p);
      return p;
  }
  }

  // 都没找到，返回默认路径并打印警告
  const defaultPath = possiblePaths[0];
  console.warn('[路径] 未找到客户端目录，使用默认路径:', defaultPath);
  console.warn('[路径] 尝试的路径:', possiblePaths);
  return defaultPath;
}

CLIENTS_ROOT_PATH = findClientsPath();

/**
 * 获取托盘图标
 */
function getTrayIcon() {
  // 尝试多种路径
  const possiblePaths = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../resources/icon.png'),
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return nativeImage.createFromPath(iconPath);
    }
  }

  // 如果图标文件不存在，创建一个简单的图标（红色圆圈）
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    // 创建红色渐变圆圈
    const x = i % size;
    const y = Math.floor(i / size);
    const cx = size / 2;
    const cy = size / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist <= size / 2) {
      buffer[offset] = 255;     // R
      buffer[offset + 1] = 36;  // G (#FF2442)
      buffer[offset + 2] = 66;  // B
      buffer[offset + 3] = 255; // A
    } else {
      buffer[offset + 3] = 0;   // 透明背景
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

/**
 * 创建系统托盘
 */
function createTray() {
  const icon = getTrayIcon();

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '启动全部',
      click: () => {
        if (clientManager) {
          const clients = CLIENTS.map(c => clientManager.startClient(c.id));
          const failed = clients.filter(r => !r.success);
          if (failed.length > 0) {
            showNotification('启动完成', `${clients.length - failed.length} 个客户端启动成功`);
          } else {
            showNotification('启动完成', '所有客户端启动成功');
          }
        }
      }
    },
    {
      label: '停止全部',
      click: () => {
        if (clientManager) {
          clientManager.stopAllClients();
          showNotification('已停止', '所有客户端已停止');
        }
      }
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        if (updater) {
          updater.checkForUpdates();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('小红书采集客户端');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  console.log('[托盘] 系统托盘已创建');
}

/**
 * 显示系统通知
 */
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body,
      silent: true
    });
  }
}

/**
 * 设置中文菜单栏
 */
function setupMenu() {
  const isDev = process.env.NODE_ENV === 'development';

  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '重新加载',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            BrowserWindow.getFocusedWindow()?.reload();
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { type: 'separator' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '重新加载（强制）',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            BrowserWindow.getFocusedWindow()?.reloadIgnoringCache();
          }
        },
        {
          label: '切换全屏',
          accelerator: 'F11',
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.setFullScreen(!win.isFullScreen());
            }
          }
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow(), {
              type: 'info',
              title: '关于 小红书采集客户端',
              message: `版本: ${app.getVersion()}`,
              detail: '小红书内容审核管理系统启动器\n\n用于统一管理所有采集客户端的启动和停止。'
            });
          }
        },
        {
          label: '检查更新',
          click: () => {
            if (updater) {
              updater.checkForUpdates();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  console.log('[菜单] 中文菜单已设置');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    },
    icon: path.join(__dirname, '../../build/icon.png'),
    title: '小红书采集客户端',
    frame: false,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hidden'
  });

  // 开发模式下加载开发服务器，生产环境加载打包后的文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // 生产模式不打开 DevTools
  }

  // 关闭窗口时直接退出程序
  mainWindow.on('close', (event) => {
    // 不再阻止关闭，直接退出
    if (!isQuitting) {
      isQuitting = true;
      // 停止所有客户端
      if (clientManager) {
        clientManager.stopAllClients();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App事件
app.whenReady().then(async () => {
  // 先创建窗口
  createWindow();

  // 窗口创建后再初始化 updater 和 clientDownloader
  updater = new Updater(mainWindow);
  clientDownloader = new ClientDownloader(mainWindow);

  // 设置中文菜单栏
  setupMenu();

  // 创建系统托盘
  createTray();

  // 检查客户端目录，如果不存在则下载
  const clientsPath = findClientsPath();
  const clientsExists = fs.existsSync(clientsPath);
  // 检查是否首次启动
  const isFirstLaunch = !fs.existsSync(path.join(app.getPath('userData'), '.xiaohongshu-launcher-launched'));
  if (isFirstLaunch) {
    console.log('[首次启动] 显示欢迎页面');
    // 标记已启动过
    fs.writeFileSync(path.join(app.getPath('userData'), '.xiaohongshu-launcher-launched'), 'true');
  }
  // 通知渲染进程首次启动状态
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('first-launch', isFirstLaunch);
  }

  // 等待窗口准备好
  await new Promise(resolve => {
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', resolve);
    } else {
      resolve();
    }
  });

  if (!clientsExists) {
    console.log('[客户端] 目录不存在，准备下载:', clientsPath);
    // 开始下载
    try {
      await clientDownloader.downloadAndExtract(clientsPath);
      console.log('[客户端] 下载完成:', clientsPath);
      CLIENTS_ROOT_PATH = clientsPath;
      clientManager = new ClientManager(CLIENTS, CLIENTS_ROOT_PATH);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clients-ready', { path: clientsPath });
      }
    } catch (error) {
      console.error('[客户端] 下载失败:', error);
      clientManager = new ClientManager(CLIENTS, CLIENTS_ROOT_PATH);
    }
  } else {
    // 目录存在，立即启动（不阻塞）
    console.log('[客户端] 目录存在，立即启动...');
    CLIENTS_ROOT_PATH = clientsPath;
    clientManager = new ClientManager(CLIENTS, CLIENTS_ROOT_PATH);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('clients-ready', { path: clientsPath });
    }

    // 延迟 5 秒后再检查版本更新（不影响启动速度）
    setTimeout(() => {
      clientDownloader.checkForUpdate(clientsPath).then(updateCheck => {
        console.log('[版本检查]', updateCheck.message);

        if (updateCheck.needsUpdate) {
          console.log('[客户端] 发现新版本，通知用户...');
          // 通知渲染进程有新版本可用
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('clients-update-available', {
              localVersion: updateCheck.localVersion,
              serverVersion: updateCheck.serverVersion,
              message: updateCheck.message
            });
          }
        }
      }).catch(error => {
        console.error('[客户端] 版本检查失败:', error);
      });
    }, 5000);
  }
  // 监听客户端管理器日志事件，转发到渲染进程
  clientManager.on('client-log', ({ clientId, log }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('client-log', { clientId, log });
    }
  });
  // 监听客户端状态变化，发送通知
  clientManager.on('client-status-changed', ({ clientId, status }) => {
    if (status.status === 'crashed') {
      showNotification('客户端崩溃', `${clientId} 客户端意外停止`);
    }
    // 更新托盘菜单状态
    if (tray) {
      updateTrayMenu();
    }
  });
  // 更新托盘菜单的函数
  function updateTrayMenu() {
    if (!clientManager || !tray) return;
    const runningCount = CLIENTS.filter(c => {
    const status = clientManager.getClientStatus(c.id);
    return status.status === 'running';
  }).length;
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `显示主窗口 (${runningCount}/${CLIENTS.length} 运行中)`,
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: '启动全部',
        click: () => {
            if (clientManager) {
              const clients = CLIENTS.map(c => clientManager.startClient(c.id));
              const failed = clients.filter(r => !r.success);
              if (failed.length > 0) {
                showNotification('启动完成', `${clients.length - failed.length} 个客户端启动成功`);
              } else {
                showNotification('启动完成', '所有客户端启动成功');
              }
            }
          }
        },
        {
          label: '停止全部',
          click: () => {
            if (clientManager) {
            clientManager.stopAllClients();
            showNotification('已停止', '所有客户端已停止');
          }
        }
      },
      { type: 'separator' },
      {
        label: '检查更新',
        click: () => {
            if (updater) {
            updater.checkForUpdates();
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});
app.on('before-quit', () => {
  isQuitting = true;
  if (clientManager) {
    clientManager.stopAllClients();
  }
});
// IPC handlers
ipcMain.handle('get-clients', () => {
  console.log('[IPC] get-clients called');
  return CLIENTS.map(client => ({
    ...client,
    status: clientManager.getClientStatus(client.id)
  }));
});
ipcMain.handle('start-client', (event, clientId) => {
  console.log('[IPC] start-client called:', clientId);
  const result = clientManager.startClient(clientId);
  console.log('[IPC] start-client result:', result);
  return result;
});
ipcMain.handle('stop-client', (event, clientId) => {
  console.log('[IPC] stop-client called:', clientId);
  return clientManager.stopClient(clientId);
});
// 批量操作
ipcMain.handle('start-all-clients', () => {
  console.log('[IPC] start-all-clients called');
  if (!clientManager) {
    return { success: false, error: 'ClientManager not initialized' };
  }
  const results = CLIENTS.map(client => ({
    id: client.id,
    result: clientManager.startClient(client.id)
  }));
  const successCount = results.filter(r => r.result.success).length;
  const failedCount = results.length - successCount;
  return {
    success: true,
    total: results.length,
    successCount,
    failedCount,
    results
  };
});
ipcMain.handle('stop-all-clients', () => {
  console.log('[IPC] stop-all-clients called');
  if (!clientManager) {
    return { success: false, error: 'ClientManager not initialized' };
  }
  clientManager.stopAllClients();
  return { success: true };
});
ipcMain.handle('get-client-logs', (event, clientId) => {
  return clientManager.getClientLogs(clientId);
});
ipcMain.handle('clear-client-logs', (event, clientId) => {
  return clientManager.clearClientLogs(clientId);
});
ipcMain.handle('check-for-updates', () => {
  return updater.checkForUpdates();
});
ipcMain.handle('download-update', () => {
  return updater.downloadUpdate();
});
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});
// 手动重新下载客户端
ipcMain.handle('download-clients', async () => {
  try {
    const clientsPath = findClientsPath();
    const result = await clientDownloader.downloadAndExtract(clientsPath);
    // 重新创建 ClientManager
    CLIENTS_ROOT_PATH = clientsPath;
    clientManager = new ClientManager(CLIENTS, CLIENTS_ROOT_PATH);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
// 获取客户端目录路径
ipcMain.handle('get-clients-path', () => {
  return {
    path: CLIENTS_ROOT_PATH,
    exists: fs.existsSync(CLIENTS_ROOT_PATH)
  };
});
// 获取统计数据
ipcMain.handle('get-stats', () => {
  if (!clientManager) {
    return { totalRunning: 0, totalClients: CLIENTS.length };
  }
  let totalRunning = 0;
  let totalUptime = 0;
  CLIENTS.forEach(client => {
    const status = clientManager.getClientStatus(client.id);
    if (status.status === 'running') {
      totalRunning++;
      totalUptime += status.uptime || 0;
    }
  });
  return {
    totalRunning,
    totalClients: CLIENTS.length,
    totalUptime,
    timestamp: Date.now()
  };
});
// 检查是否首次启动
ipcMain.handle('is-first-launch', () => {
  const markerPath = path.join(app.getPath('userData'), '.xiaohongshu-launcher-launched');
  return !fs.existsSync(markerPath);
});

// 检查客户端代码更新
ipcMain.handle('check-clients-update', async () => {
  try {
    const clientsPath = findClientsPath();
    const updateCheck = await clientDownloader.checkForUpdate(clientsPath);
    return { success: true, ...updateCheck };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 更新客户端代码
ipcMain.handle('update-clients', async () => {
  try {
    const clientsPath = findClientsPath();

    // 通知渲染进程开始下载
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('client-download-progress', {
        type: 'download-start'
      });
    }

    const result = await clientDownloader.downloadAndExtract(clientsPath);

    // 重新创建 ClientManager
    CLIENTS_ROOT_PATH = clientsPath;
    clientManager = new ClientManager(CLIENTS, CLIENTS_ROOT_PATH);

    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 窗口控制
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});
ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});
