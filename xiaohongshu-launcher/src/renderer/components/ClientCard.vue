<template>
  <div class="client-card" :class="{ running: isRunning }">
    <div class="card-header">
      <span class="icon">{{ client.icon }}</span>
      <span class="status-badge" :class="statusClass">{{ statusText }}</span>
    </div>
    <h3 class="card-title">{{ client.name }}</h3>
    <p class="card-description">{{ client.description }}</p>

    <div class="card-footer">
      <div class="footer-info">
        <div class="uptime" v-if="isRunning">
          <span>⏱️ 运行: {{ formattedUptime }}</span>
        </div>
        <button
          @click="$emit('view-logs', client.id)"
          class="btn-logs"
          title="查看日志"
        >
          📋 日志 <span v-if="logCount > 0" class="log-badge">{{ logCount }}</span>
        </button>
      </div>
      <button
        @click="toggleClient"
        class="btn-action"
        :class="isRunning ? 'btn-stop' : 'btn-start'"
        :disabled="isStarting"
      >
        {{ buttonLabel }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  client: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['start', 'stop', 'view-logs']);

const isStarting = ref(false);

const isRunning = computed(() => {
  return props.client.status?.status === 'running';
});

const statusClass = computed(() => {
  const status = props.client.status?.status;
  if (status === 'running') return 'status-running';
  return 'status-stopped';
});

const statusText = computed(() => {
  const status = props.client.status?.status;
  if (status === 'running') return '运行中';
  return '已停止';
});

const buttonLabel = computed(() => {
  if (isStarting.value) return '启动中...';
  if (isRunning.value) return '⏹ 停止';
  return '▶ 启动';
});

const formattedUptime = computed(() => {
  const uptime = props.client.status?.uptime || 0;
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
});

// 日志数量
const logCount = computed(() => {
  return props.client.status?.logCount || 0;
});

const toggleClient = () => {
  if (isRunning.value) {
    emit('stop', props.client.id);
  } else {
    isStarting.value = true;
    emit('start', props.client.id);
    setTimeout(() => {
      isStarting.value = false;
    }, 2000);
  }
};
</script>

<style scoped>
.client-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.client-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 159, 67, 0.1));
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.client-card:hover::before {
  opacity: 1;
}

.client-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  border-color: rgba(255, 255, 255, 0.2);
}

.client-card.running {
  border-color: rgba(0, 210, 29, 0.3);
  background: rgba(0, 210, 29, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.icon {
  font-size: 32px;
  background: rgba(255, 255, 255, 0.1);
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.status-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.status-running {
  background: rgba(0, 210, 29, 0.2);
  color: #00d2d3;
}

.status-stopped {
  background: rgba(255, 255, 255, 0.1);
  color: #888;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #fff;
}

.card-description {
  font-size: 14px;
  color: #aaa;
  line-height: 1.5;
  margin-bottom: 20px;
  min-height: 40px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.uptime {
  font-size: 13px;
  color: #00d2d3;
}

.btn-logs {
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: #888;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
}

.btn-logs:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

.log-badge {
  background: rgba(84, 160, 255, 0.3);
  color: #54a0ff;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
}

.btn-action {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 80px;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start {
  background: linear-gradient(135deg, #00d2d3, #54a0ff);
  color: #fff;
}

.btn-start:hover:not(:disabled) {
  box-shadow: 0 4px 15px rgba(0, 210, 29, 0.3);
  transform: translateY(-2px);
}

.btn-stop {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.btn-stop:hover:not(:disabled) {
  background: rgba(255, 107, 107, 0.3);
  transform: translateY(-2px);
}
</style>
