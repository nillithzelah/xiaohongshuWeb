<template>
  <div class="app">
    <!-- 头部 -->
    <header class="header">
      <div class="header-left">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="8" fill="#FF2442"/>
            <path d="M8 12 L16 20 L8 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M24 12 L16 20 L24 12" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <line x1="16" y1="16" x2="16" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="title-group">
          <h1 class="title">小红书采集客户端</h1>
          <span class="version">v{{ appVersion }}</span>
        </div>
      </div>
      <div class="header-right">
        <!-- 批量操作按钮 -->
        <div class="batch-actions">
          <button
            @click="handleStartAll"
            class="btn btn-start-all"
            :disabled="isBatchLoading"
          >
            {{ isBatchLoading ? '启动中...' : '全部启动' }}
          </button>
          <button
            @click="handleStopAll"
            class="btn btn-stop-all"
            :disabled="isBatchLoading || runningCount === 0"
          >
            全部停止
          </button>
        </div>

        <button
          @click="handleCheckClientsUpdate"
          class="btn btn-check-clients"
          :disabled="isCheckingClientsUpdate"
        >
          {{ isCheckingClientsUpdate ? '检查中...' : '检查更新' }}
        </button>

        <!-- 窗口控制按钮 -->
        <div class="window-controls">
          <button class="win-btn win-minimize" @click="minimizeWindow" title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect y="5" width="12" height="2" fill="currentColor"/>
            </svg>
          </button>
          <button class="win-btn win-maximize" @click="maximizeWindow" title="最大化">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1" y="1" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none"/>
            </svg>
          </button>
          <button class="win-btn win-close" @click="closeWindow" title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 1 L11 11 M11 1 L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- 统计面板 -->
    <div class="stats-panel" v-if="showStats">
      <div class="stats-header">
        <h3>运行统计</h3>
        <button class="btn-close-stats" @click="showStats = false">✕</button>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ runningCount }}</div>
          <div class="stat-label">运行中</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalClients }}</div>
          <div class="stat-label">总客户端</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ formatUptime(stats.totalUptime) }}</div>
          <div class="stat-label">总运行时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.timestamp ? formatTime(stats.timestamp) : '--:--' }}</div>
          <div class="stat-label">更新时间</div>
        </div>
      </div>
      <button class="btn-stats-toggle" @click="showStats = !showStats">
        {{ showStats ? '收起统计' : '查看统计' }}
      </button>
    </div>

    <!-- 更新提示区域 -->
    <div v-if="updateMessage" class="update-message" :class="updateMessage.type">
      {{ updateMessage.text }}
    </div>

    <!-- 客户端代码更新提示 -->
    <div v-if="clientsUpdateInfo" class="clients-update-banner">
      <div class="update-info">
        <span class="update-icon">📦</span>
        <span class="update-text">发现客户端代码新版本: v{{ clientsUpdateInfo.serverVersion }}</span>
        <span class="update-current">(当前: {{ clientsUpdateInfo.localVersion ? 'v' + clientsUpdateInfo.localVersion : '未安装' }})</span>
      </div>
      <div class="update-actions">
        <button
          @click="handleUpdateClients"
          class="btn btn-update-clients"
          :disabled="isUpdatingClients"
        >
          {{ isUpdatingClients ? '更新中...' : '立即更新' }}
        </button>
        <button @click="clientsUpdateInfo = null" class="btn btn-later">稍后提醒</button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div class="loading-text">加载中...</div>
    </div>

    <!-- 客户端列表 -->
    <main class="main">
      <div v-if="isLoading" class="skeleton-grid">
        <div class="skeleton-card" v-for="i in 7" :key="i">
          <div class="skeleton-header"></div>
          <div class="skeleton-title"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-footer"></div>
        </div>
      </div>
      <div v-else class="clients-grid">
        <ClientCard
          v-for="client in clients"
          :key="client.id"
          :client="client"
          @start="handleStartClient"
          @stop="handleStopClient"
          @view-logs="handleViewLogs"
        />
      </div>
    </main>

    <!-- 底部状态栏 -->
    <footer class="footer">
      <div class="status">
        <span class="status-dot" :class="{ running: runningCount > 0 }"></span>
        运行中: {{ runningCount }} / {{ clients.length }}
      </div>
      <div class="status">
        {{ currentTime }}
      </div>
    </footer>

    <!-- 日志模态框 -->
    <ClientLogs
      v-if="showLogsModal && currentLogsClient"
      :client="currentLogsClient"
      :logs="clientLogs"
      @close="closeLogsModal"
      @clear-logs="handleClearLogs"
    />

    <!-- 欢迎引导模态框 -->
    <WelcomeModal
      v-if="showWelcomeModal"
      @close="handleWelcomeClose"
    />

    <!-- 客户端下载进度遮罩层 -->
    <div v-if="isDownloadingClients" class="download-overlay">
      <div class="download-modal">
        <div class="download-icon">📦</div>
        <h2 class="download-title">下载客户端代码</h2>
        <div class="download-status">{{ downloadStatusText }}</div>
        <div v-if="downloadProgressPercent > 0" class="download-progress-bar">
          <div class="download-progress-fill" :style="{ width: downloadProgressPercent + '%' }"></div>
        </div>
        <div class="download-percent">
          {{ downloadProgressPercent > 0 ? downloadProgressPercent + '%' : '准备中...' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import ClientCard from './components/ClientCard.vue';
import ClientLogs from './components/ClientLogs.vue';
import WelcomeModal from './components/WelcomeModal.vue';

const clients = ref([]);
const appVersion = ref('1.1.0');
const updateStatus = ref('none'); // none, checking, available, downloading, downloaded, error
const downloadProgress = ref(0);
const updateMessage = ref(null);
const runningCount = ref(0);
const currentTime = ref('');
const isLoading = ref(true);
const showStats = ref(false);
const stats = ref({ totalRunning: 0, totalClients: 0, totalUptime: 0, timestamp: null });
const isBatchLoading = ref(false);
const showWelcomeModal = ref(false);

// 日志相关状态
const showLogsModal = ref(false);
const currentLogsClient = ref(null);
const clientLogs = ref([]);

// 客户端下载相关状态
const isDownloadingClients = ref(false);
const downloadStatusText = ref('正在连接服务器...');
const downloadProgressPercent = ref(0);

// 客户端代码更新相关状态
const clientsUpdateInfo = ref(null);
const isUpdatingClients = ref(false);
const isCheckingClientsUpdate = ref(false);

// 格式化时间
const updateTime = () => {
  const now = new Date();
  currentTime.value = now.toLocaleString('zh-CN');
};

// 格式化运行时长
const formatUptime = (ms) => {
  if (!ms) return '0m';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
};

// 格式化时间戳
const formatTime = (timestamp) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN');
};

// 获取客户端列表
const loadClients = async () => {
  isLoading.value = true;
  try {
    const data = await window.electronAPI.getClients();
    clients.value = data;
    updateRunningCount();
  } catch (error) {
    console.error('获取客户端列表失败:', error);
  } finally {
    isLoading.value = false;
  }
};

// 更新运行计数
const updateRunningCount = () => {
  runningCount.value = clients.value.filter(c => c.status?.status === 'running').length;
};

// 加载统计数据
const loadStats = async () => {
  try {
    const data = await window.electronAPI.getStats();
    stats.value = data;
  } catch (error) {
    console.error('获取统计数据失败:', error);
  }
};

// 检查是否首次启动
const checkFirstLaunch = async () => {
  try {
    const isFirst = await window.electronAPI.isFirstLaunch();
    if (isFirst) {
    showWelcomeModal.value = true;
  }
  } catch (error) {
    console.error('检查首次启动失败:', error);
  }
};

// 启动单个客户端
const handleStartClient = async (clientId) => {
  try {
    const result = await window.electronAPI.startClient(clientId);
    if (result.success) {
      showUpdateMessage('success', `客户端启动成功`);
      await loadClients();
      loadStats();
    } else {
      showUpdateMessage('error', result.error);
    }
  } catch (error) {
    showUpdateMessage('error', error.message);
  }
};

// 停止单个客户端
const handleStopClient = async (clientId) => {
  try {
    const result = await window.electronAPI.stopClient(clientId);
    if (result.success) {
      showUpdateMessage('success', `客户端已停止`);
      await loadClients();
      loadStats();
    } else {
      showUpdateMessage('error', result.error);
    }
  } catch (error) {
    showUpdateMessage('error', error.message);
  }
};

// 批量启动所有客户端
const handleStartAll = async () => {
  isBatchLoading.value = true;
  try {
    const result = await window.electronAPI.startAllClients();
    if (result.success) {
      const message = result.successCount === result.total
        ? '所有客户端启动成功'
        : `${result.successCount}/${result.total} 个客户端启动成功`;
      showUpdateMessage('success', message);
      await loadClients();
      loadStats();
    } else {
      showUpdateMessage('error', result.error);
    }
  } catch (error) {
    showUpdateMessage('error', error.message);
  } finally {
    isBatchLoading.value = false;
  }
};

// 批量停止所有客户端
const handleStopAll = async () => {
  isBatchLoading.value = true;
  try {
    const result = await window.electronAPI.stopAllClients();
    if (result.success) {
      showUpdateMessage('success', '所有客户端已停止');
      await loadClients();
      loadStats();
    } else {
    showUpdateMessage('error', result.error);
    }
  } catch (error) {
    showUpdateMessage('error', error.message);
  } finally {
    isBatchLoading.value = false;
  }
};

// 查看客户端日志
const handleViewLogs = async (clientId) => {
  currentLogsClient.value = clients.value.find(c => c.id === clientId);
  showLogsModal.value = true;
  await loadClientLogs(clientId);
};

// 加载客户端日志
const loadClientLogs = async (clientId) => {
  try {
    const logs = await window.electronAPI.getClientLogs(clientId);
    clientLogs.value = logs || [];
  } catch (error) {
    console.error('获取客户端日志失败:', error);
  }
};

// 清空日志
const handleClearLogs = async (clientId) => {
  try {
    await window.electronAPI.clearClientLogs(clientId);
    clientLogs.value = [];
    showUpdateMessage('success', '日志已清空');
  } catch (error) {
    showUpdateMessage('error', '清空日志失败');
  }
};

// 关闭日志模态框
const closeLogsModal = () => {
  showLogsModal.value = false;
  currentLogsClient.value = null;
  clientLogs.value = [];
};

// 关闭欢迎页
const handleWelcomeClose = async (dontShowAgain) => {
  showWelcomeModal.value = false;
  // 如果用户勾选了不再显示，可以保存到本地存储
  if (dontShowAgain) {
    localStorage.setItem('hide-welcome', 'true');
  }
};

// 检查更新
const checkUpdates = async () => {
  updateStatus.value = 'checking';
  try {
    await window.electronAPI.checkForUpdates();
  } catch (error) {
    updateStatus.value = 'error';
    showUpdateMessage('error', '检查更新失败');
  }
};

// 下载更新
const downloadUpdate = async () => {
  updateStatus.value = 'downloading';
  try {
    await window.electronAPI.downloadUpdate();
  } catch (error) {
    updateStatus.value = 'error';
    showUpdateMessage('error', '下载更新失败');
  }
};

// 安装更新
const installUpdate = () => {
  showUpdateMessage('info', '应用将关闭并安装更新...');
  setTimeout(() => {
    window.location.reload();
  }, 2000);
};

// 手动检查客户端代码更新
const handleCheckClientsUpdate = async () => {
  isCheckingClientsUpdate.value = true;
  try {
    const result = await window.electronAPI.checkClientsUpdate();
    if (result.success) {
      if (result.needsUpdate) {
        clientsUpdateInfo.value = {
          localVersion: result.localVersion,
          serverVersion: result.serverVersion,
          message: result.message
        };
        showUpdateMessage('info', `发现客户端代码新版本: v${result.serverVersion}`);
      } else {
        showUpdateMessage('success', '客户端代码已是最新版本');
      }
    } else {
      showUpdateMessage('error', `检查失败: ${result.error}`);
    }
  } catch (error) {
    showUpdateMessage('error', `检查失败: ${error.message}`);
  } finally {
    isCheckingClientsUpdate.value = false;
  }
};

// 更新客户端代码
const handleUpdateClients = async () => {
  isUpdatingClients.value = true;
  isDownloadingClients.value = true;
  downloadStatusText.value = '正在下载客户端代码更新...';
  downloadProgressPercent.value = 0;

  try {
    const result = await window.electronAPI.updateClients();
    if (result.success) {
      clientsUpdateInfo.value = null;
      showUpdateMessage('success', '客户端代码更新完成');
      // 刷新客户端列表
      await loadClients();
    } else {
      showUpdateMessage('error', `更新失败: ${result.error}`);
    }
  } catch (error) {
    showUpdateMessage('error', `更新失败: ${error.message}`);
  } finally {
    isUpdatingClients.value = false;
    isDownloadingClients.value = false;
  }
};

// 窗口控制
const minimizeWindow = () => {
  window.electronAPI.minimizeWindow();
};
const maximizeWindow = () => {
  window.electronAPI.maximizeWindow();
};
const closeWindow = () => {
  window.electronAPI.closeWindow();
};

// 显示更新消息
const showUpdateMessage = (type, text) => {
  updateMessage.value = { type, text };
  setTimeout(() => {
    updateMessage.value = null;
  }, 5000);
};

// 设置更新监听
const setupUpdateListeners = () => {
  const cleanups = [];

  cleanups.push(window.electronAPI.onUpdateAvailable((data) => {
    updateStatus.value = 'available';
    showUpdateMessage('info', `发现新版本: ${data.version}`);
  }));

  cleanups.push(window.electronAPI.onUpdateNotAvailable((data) => {
    updateStatus.value = 'none';
    showUpdateMessage('success', '当前已是最新版本');
  }));

  cleanups.push(window.electronAPI.onUpdateDownloaded((data) => {
    updateStatus.value = 'downloaded';
    showUpdateMessage('success', '更新下载完成，请安装');
  }));

  cleanups.push(window.electronAPI.onDownloadProgress((data) => {
    downloadProgress.value = data.percent;
  }));

  cleanups.push(window.electronAPI.onUpdateError((data) => {
    updateStatus.value = 'error';
    showUpdateMessage('error', `更新错误: ${data.message}`);
  }));

  // 返回清理函数
  return () => cleanups.forEach(fn => fn && fn());
};

// 设置客户端下载监听
const setupClientDownloadListeners = () => {
  const cleanups = [];

  cleanups.push(window.electronAPI.onClientDownloadProgress((data) => {
    switch (data.type) {
      case 'download-start':
        isDownloadingClients.value = true;
        downloadStatusText.value = '正在下载客户端代码...';
        downloadProgressPercent.value = 0;
        break;
      case 'download-size':
        downloadStatusText.value = `正在下载 (${data.totalMB} MB)...`;
        break;
      case 'download-progress':
        downloadStatusText.value = `正在下载... (${data.downloadedMB} MB / ${data.totalMB} MB)`;
        downloadProgressPercent.value = data.percent;
        break;
      case 'download-complete':
        downloadStatusText.value = '下载完成，正在解压...';
        downloadProgressPercent.value = 100;
        break;
      case 'extract-start':
        downloadStatusText.value = '正在解压文件...';
        break;
      case 'extract-count':
        downloadStatusText.value = `正在解压 (${data.count} 个文件)...`;
        break;
      case 'extract-complete':
        downloadStatusText.value = `解压完成 (${data.count} 个文件)`;
        break;
      case 'complete':
        isDownloadingClients.value = false;
        downloadStatusText.value = '客户端代码安装完成！';
        downloadProgressPercent.value = 100;
        showUpdateMessage('success', '客户端代码下载完成');
        // 刷新客户端列表
        setTimeout(() => {
          loadClients();
        }, 1000);
        break;
      case 'error':
        isDownloadingClients.value = false;
        downloadStatusText.value = '下载失败';
        showUpdateMessage('error', `下载失败: ${data.message}`);
        break;
    }
  }));

  // 监听客户端准备就绪
  cleanups.push(window.electronAPI.onClientsReady((data) => {
    isDownloadingClients.value = false;
    showUpdateMessage('success', '客户端代码下载完成');
    loadClients();
  }));

  // 监听首次启动
  cleanups.push(window.electronAPI.onFirstLaunch((isFirst) => {
    if (isFirst) {
      showWelcomeModal.value = true;
    }
  }));

  // 监听客户端代码更新可用
  cleanups.push(window.electronAPI.onClientsUpdateAvailable((data) => {
    clientsUpdateInfo.value = data;
    showUpdateMessage('info', `发现客户端代码新版本: v${data.serverVersion}`);
  }));

  // 返回清理函数
  return () => cleanups.forEach(fn => fn && fn());
};

// 获取应用版本
const loadVersion = async () => {
  try {
    appVersion.value = await window.electronAPI.getAppVersion();
  } catch (error) {
    console.error('获取版本失败:', error);
  }
};

// 定时刷新客户端状态
let refreshInterval = null;
let logsRefreshInterval = null;
let statsRefreshInterval = null;

// 事件监听器清理函数
const cleanupFunctions = [];

onMounted(async () => {
  await loadVersion();
  // 保存清理函数
  cleanupFunctions.push(setupUpdateListeners());
  cleanupFunctions.push(setupClientDownloadListeners());

  // 检查是否隐藏欢迎页
  if (localStorage.getItem('hide-welcome') !== 'true') {
    await checkFirstLaunch();
  }
  // 检查客户端目录是否存在，如果不存在则等待下载
  const clientsPathInfo = await window.electronAPI.getClientsPath();
  if (clientsPathInfo.exists) {
    await loadClients();
  } else {
    // 客户端目录不存在，等待下载...
    console.log('客户端目录不存在，等待下载...');
  }
  updateTime();
  // 定时更新时间和客户端状态
  setInterval(updateTime, 1000);
  refreshInterval = setInterval(loadClients, 5000);
  // 定时更新统计
  statsRefreshInterval = setInterval(loadStats, 30000);
});
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (logsRefreshInterval) {
    clearInterval(logsRefreshInterval);
  }
  if (statsRefreshInterval) {
    clearInterval(statsRefreshInterval);
  }
  // 清理所有事件监听器
  cleanupFunctions.forEach(fn => fn && fn());
});

// 监听日志模态框状态，定时刷新日志
watch(showLogsModal, (isOpen) => {
  if (isOpen && currentLogsClient.value) {
    // 打开日志时，立即刷新一次
    loadClientLogs(currentLogsClient.value.id);
    // 每2秒刷新日志
    logsRefreshInterval = setInterval(() => {
      if (currentLogsClient.value) {
        loadClientLogs(currentLogsClient.value.id);
      }
    }, 2000);
  } else {
    // 关闭日志时，停止刷新
    if (logsRefreshInterval) {
      clearInterval(logsRefreshInterval);
      logsRefreshInterval = null;
    }
  }
});
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  /* 允许拖动窗口 */
  -webkit-app-region: drag;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.logo {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FF2442, #FF6B6B);
  border-radius: 10px;
}

.logo svg {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  background: linear-gradient(135deg, #ff6b6b, #feca57);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.version {
  font-size: 14px;
  color: #888;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 15px;
}

.header-right {
  display: flex;
  gap: 10px;
  /* 按钮区域禁止拖动，确保可点击 */
  -webkit-app-region: no-drag;
}

.batch-actions {
  display: flex;
  gap: 8px;
  margin-right: 10px;
  padding-right: 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn:hover:not(.btn:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start-all {
  background: linear-gradient(135deg, #00d2d3, #54a0ff);
  color: #fff;
}

.btn-start-all:hover:not(.btn-start-all:disabled) {
  box-shadow: 0 4px 15px rgba(0, 210, 211, 0.3);
}

.btn-stop-all {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.btn-stop-all:hover:not(.btn-stop-all.disabled) {
  background: rgba(255, 107, 107, 0.3);
}

.btn-check {
  background: rgba(255, 255, 255, 0.1);
  color: #eaeaea;
}

.btn-update {
  background: linear-gradient(135deg, #feca57, #ff9f43);
  color: #1a1a2e;
  font-weight: 600;
}

.btn-install {
  background: linear-gradient(135deg, #00d2d3, #54a0ff);
  color: #fff;
  font-weight: 600;
}

.btn-check-clients {
  background: rgba(255, 193, 7, 0.2);
  color: #ffc107;
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.btn-check-clients:hover:not(.btn-check-clients:disabled) {
  background: rgba(255, 193, 7, 0.3);
}

/* 窗口控制按钮 */
.window-controls {
  display: flex;
  margin-left: 15px;
  padding-left: 15px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.win-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.win-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.win-close:hover {
  background: #e81123;
  color: #fff;
}

/* 统计面板 */
.stats-panel {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px 20px;
  margin: 0 30px 15px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stats-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.btn-close-stats {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
}

.btn-close-stats:hover {
  color: #fff;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #888;
}

.btn-stats-toggle {
  display: none;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  color: #888;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 1200px) {
  .btn-stats-toggle {
    display: block;
  }
}

.update-message {
  padding: 12px 20px;
  margin: 0 30px;
  border-radius: 8px;
  font-size: 14px;
}

.update-message.success {
  background: rgba(0, 210, 211, 0.2);
  color: #00d2d3;
  border: 1px solid rgba(0, 210, 211, 0.3);
}

.update-message.error {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.update-message.info {
  background: rgba(84, 160, 255, 0.2);
  color: #54a0ff;
  border: 1px solid rgba(84, 160, 255, 0.3);
}

/* 客户端代码更新横幅 */
.clients-update-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 30px;
  margin: 0;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(255, 152, 0, 0.15));
  border-bottom: 1px solid rgba(255, 193, 7, 0.3);
}

.update-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.update-icon {
  font-size: 20px;
}

.update-text {
  color: #ffc107;
  font-weight: 600;
}

.update-current {
  color: #888;
  font-size: 13px;
}

.update-actions {
  display: flex;
  gap: 10px;
}

.btn-update-clients {
  background: linear-gradient(135deg, #ffc107, #ff9800);
  color: #1a1a2e;
  font-weight: 600;
  padding: 8px 16px;
  font-size: 13px;
}

.btn-update-clients:hover:not(.btn-update-clients:disabled) {
  box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3);
}

.btn-later {
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  padding: 8px 16px;
  font-size: 13px;
}

.btn-later:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 46, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #FF2442;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #888;
  margin-top: 12px;
  font-size: 14px;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding: 20px 30px;
}

/* 骨架屏 */
.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.skeleton-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
.skeleton-header {
  height: 50px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 15px;
}
.skeleton-title {
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin-bottom: 8px;
  width: 60%;
}
.skeleton-text {
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  margin-bottom: 15px;
}
.skeleton-footer {
  height: 36px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.clients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 30px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 14px;
  color: #888;
}
.status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  transition: background 0.3s;
}

.status-dot.running {
  background: #00d2d3;
  box-shadow: 0 0 8px rgba(0, 210, 211, 0.5);
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
/* 滚动条样式 */
.main::-webkit-scrollbar {
  width: 8px;
}

.main::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.main::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.main::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 客户端下载进度遮罩层 */
.download-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.download-modal {
  background: #1a1a2e;
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  min-width: 320px;
}

.download-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.download-title {
  font-size: 24px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 10px;
}

.download-status {
  font-size: 14px;
  color: #aaa;
  margin-bottom: 20px;
  min-height: 20px;
}

.download-progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}
.download-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d2d3, #54a0ff);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.download-percent {
  font-size: 18px;
  font-weight: 600;
  color: #00d2d3;
}
</style>
