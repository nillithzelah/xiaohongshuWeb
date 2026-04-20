<template>
  <div class="welcome-overlay">
    <div class="welcome-modal">
    <div class="welcome-header">
      <div class="logo">
        <svg width="64" height="64" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="welcomeBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#FF2442"/>
            <stop offset="100%" style="stop-color:#FF6B6B"/>
          </linearGradient>
          </defs>
          <rect width="256" height="256" rx="48" fill="url(#welcomeBg)"/>
          <path d="M70 80 L120 128 L70 176" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <path d="M186 80 L136 128 L186 176" stroke="white" stroke-width="24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <line x1="120" y1="128" x2="136" y2="128" stroke="white" stroke-width="16" stroke-linecap="round"/>
        </svg>
      </div>
      <h1 class="welcome-title">欢迎使用</h1>
      <h2 class="welcome-subtitle">小红书采集客户端</h2>
    </div>

    <div class="welcome-content">
      <div class="feature-list">
        <div class="feature-item" v-for="(feature, index) in features" :key="index">
          <span class="feature-icon">{{ feature.icon }}</span>
          <div class="feature-info">
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </div>
        </div>
      </div>

      <div class="quick-tips">
        <h3>快速上手</h3>
        <ul>
          <li>点击卡片上的 <strong>启动</strong> 按钮运行客户端</li>
          <li>点击 <strong>日志</strong> 按钮查看运行状态</li>
          <li>关闭窗口时程序会最小化到系统托盘继续运行</li>
          <li>右键托盘图标可快速操作</li>
        </ul>
      </div>
    </div>

    <div class="welcome-footer">
      <label class="checkbox-label">
        <input type="checkbox" v-model="dontShowAgain" />
        <span>不再显示此页面</span>
      </label>
      <button class="btn-start" @click="handleStart">
        开始使用
      </button>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['close']);

const dontShowAgain = ref(false);

const features = [
  {
    icon: '💬',
    title: '评论审核',
    description: '验证评论真实性，AI智能审核内容'
  },
  {
    icon: '🔍',
    title: '笔记发现',
    description: '自动搜索发现维权笔记并上报'
  },
  {
    icon: '📝',
    title: '评论采集',
    description: '采集笔记评论作为潜在线索'
  },
  {
    icon: '🗑️',
    title: '删除检测',
    description: '检测笔记删除状态，及时更新数据'
  }
];

const handleStart = () => {
  emit('close', dontShowAgain.value);
};
</script>

<style scoped>
.welcome-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.welcome-modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #2d2d4a 100%);
  border-radius: 24px;
  padding: 40px;
  max-width: 600px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.4s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  margin-bottom: 20px;
}

.logo svg {
  filter: drop-shadow(0 4px 20px rgba(255, 36, 66, 0.3));
}

.welcome-title {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, #FF2442, #FF6B6B);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.welcome-subtitle {
  font-size: 18px;
  color: #888;
  font-weight: 400;
}

.welcome-content {
  margin-bottom: 30px;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 36, 66, 0.3);
}

.feature-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 36, 66, 0.1);
  border-radius: 12px;
}

.feature-info h3 {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.feature-info p {
  font-size: 13px;
  color: #888;
  line-height: 1.4;
}

.quick-tips {
  background: rgba(84, 160, 255, 0.1);
  border: 1px solid rgba(84, 160, 255, 0.2);
  border-radius: 12px;
  padding: 16px;
}

.quick-tips h3 {
  font-size: 14px;
  font-weight: 600;
  color: #54a0ff;
  margin-bottom: 12px;
}

.quick-tips ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.quick-tips li {
  font-size: 13px;
  color: #aaa;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.quick-tips li:last-child {
  border-bottom: none;
}

.quick-tips strong {
  color: #fff;
}

.welcome-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #888;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #FF2442;
}

.btn-start {
  padding: 14px 32px;
  background: linear-gradient(135deg, #FF2442, #FF6B6B);
  border: none;
  border-radius: 12px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-start:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(255, 36, 66, 0.4);
}
</style>
