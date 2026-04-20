<template>
  <div class="client-logs-modal" @click.self="$emit('close')">
    <div class="logs-container">
      <!-- 头部 -->
      <div class="logs-header">
        <div class="logs-title">
          <span class="client-icon">{{ client.icon }}</span>
          <span class="client-name">{{ client.name }}</span>
          <span class="log-count">{{ logs.length }} 条日志</span>
        </div>
        <div class="logs-controls">
          <button @click="toggleAutoScroll" :class="{ active: autoScroll }" class="btn-icon" title="自动滚动">
            {{ autoScroll ? '🔒' : '🔓' }}
          </button>
          <button @click="clearLogs" class="btn-icon" title="清空日志">🗑️</button>
          <button @click="$emit('close')" class="btn-icon" title="关闭">✕</button>
        </div>
      </div>

      <!-- 搜索栏 -->
      <div class="logs-search">
        <input
          v-model="searchText"
          placeholder="搜索日志内容..."
          class="search-input"
        />
        <div class="filter-buttons">
          <button
            v-for="filter in logFilters"
            :key="filter.type"
            @click="toggleFilter(filter.type)"
            :class="{ active: filter.active }"
            class="filter-btn"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <!-- 日志内容 -->
      <div class="logs-content" ref="logsContent">
        <div
          v-for="(log, index) in filteredLogs"
          :key="index"
          :class="['log-entry', `log-${log.type}`]"
        >
          <span class="log-time">{{ formatTime(log.time) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="filteredLogs.length === 0" class="empty-logs">
          暂无日志
        </div>
      </div>

      <!-- 底部状态 -->
      <div class="logs-footer" v-if="logs.length > 0">
        <span class="stats">
          stdout: {{ logCounts.stdout }} |
          stderr: {{ logCounts.stderr }} |
          info: {{ logCounts.info }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  client: {
    type: Object,
    required: true
  },
  logs: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close']);

const autoScroll = ref(true);
const searchText = ref('');
const logsContent = ref(null);

// 日志类型过滤器
const logFilters = ref([
  { type: 'all', label: '全部', active: true },
  { type: 'stdout', label: 'stdout', active: false },
  { type: 'stderr', label: 'stderr', active: false },
  { type: 'info', label: 'info', active: false }
]);

// 计算日志数量
const logCounts = computed(() => {
  const counts = { stdout: 0, stderr: 0, info: 0 };
  props.logs.forEach(log => {
    if (counts[log.type] !== undefined) {
      counts[log.type]++;
    }
  });
  return counts;
});

// 过滤后的日志
const filteredLogs = computed(() => {
  let filtered = props.logs;

  // 按类型过滤
  const activeFilter = logFilters.value.find(f => f.active);
  if (activeFilter && activeFilter.type !== 'all') {
    filtered = filtered.filter(log => log.type === activeFilter.type);
  }

  // 按搜索词过滤
  if (searchText.value.trim()) {
    const term = searchText.value.toLowerCase();
    filtered = filtered.filter(log =>
      log.message.toLowerCase().includes(term)
    );
  }

  return filtered;
});

// 格式化时间
const formatTime = (time) => {
  if (!time) return '';
  const date = new Date(time);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// 切换自动滚动
const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value;
};

// 清空日志
const clearLogs = () => {
  if (confirm('确定要清空日志吗？')) {
    emit('clear-logs', props.client.id);
  }
};

// 切换过滤器
const toggleFilter = (type) => {
  logFilters.value.forEach(f => {
    f.active = f.type === type;
  });
};

// 监听日志变化，自动滚动到底部
watch(() => props.logs, async () => {
  if (autoScroll.value) {
    await nextTick();
    scrollToBottom();
  }
}, { deep: true });

// 滚动到底部
const scrollToBottom = () => {
  if (logsContent.value) {
    logsContent.value.scrollTop = logsContent.value.scrollHeight;
  }
};

// 组件挂载时滚动到底部
onMounted(() => {
  nextTick(() => scrollToBottom());
});
</script>

<style scoped>
.client-logs-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.logs-container {
  width: 900px;
  height: 80vh;
  max-height: 700px;
  background: #1a1a2e;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logs-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.client-icon {
  font-size: 24px;
}

.client-name {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.log-count {
  font-size: 12px;
  color: #888;
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.logs-controls {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #aaa;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-icon:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.btn-icon.active {
  background: rgba(0, 210, 29, 0.3);
  color: #00d2d3;
}

.logs-search {
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  outline: none;
}

.search-input::placeholder {
  color: #666;
}

.search-input:focus {
  border-color: rgba(255, 255, 255, 0.2);
}

.filter-buttons {
  display: flex;
  gap: 5px;
}

.filter-btn {
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: #888;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.filter-btn.active {
  background: rgba(84, 160, 255, 0.3);
  color: #54a0ff;
  border-color: rgba(84, 160, 255, 0.3);
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

.logs-content::-webkit-scrollbar {
  width: 8px;
}

.logs-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
}

.logs-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.log-entry {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  line-height: 1.6;
  word-break: break-all;
}

.log-time {
  color: #666;
  min-width: 70px;
  flex-shrink: 0;
}

.log-message {
  flex: 1;
}

.log-stdout .log-message {
  color: #e0e0e0;
}

.log-stderr .log-message {
  color: #ff6b6b;
}

.log-info .log-message {
  color: #feca57;
}

.empty-logs {
  text-align: center;
  color: #666;
  padding: 50px 0;
}

.logs-footer {
  padding: 8px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
}

.stats {
  color: #666;
}
</style>
