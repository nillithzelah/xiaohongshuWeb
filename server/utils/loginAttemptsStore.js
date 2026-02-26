/**
 * 登录失败记录持久化存储
 * 解决内存存储在服务重启后丢失的问题
 */

const fs = require('fs');
const path = require('path');

// 存储文件路径
const STORE_FILE = path.join(__dirname, '../data/login-attempts.json');
const DATA_DIR = path.dirname(STORE_FILE);

// 配置参数
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30分钟

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 读取所有记录
function loadRecords() {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_FILE)) {
      const data = fs.readFileSync(STORE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取登录失败记录失败:', error.message);
  }
  return {};
}

// 保存所有记录
function saveRecords(records) {
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (error) {
    console.error('保存登录失败记录失败:', error.message);
  }
}

// 清理过期记录
function cleanupExpiredRecords(records) {
  const now = Date.now();
  let cleaned = 0;

  for (const key of Object.keys(records)) {
    const record = records[key];
    // 如果锁定期已过，删除记录
    if (record.lockedUntil && now >= record.lockedUntil) {
      delete records[key];
      cleaned++;
    }
    // 如果超过24小时没有任何尝试，也删除
    else if (now - record.lastAttempt > 24 * 60 * 60 * 1000) {
      delete records[key];
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 清理了 ${cleaned} 条过期的登录失败记录`);
    saveRecords(records);
  }

  return records;
}

/**
 * 检查用户是否被锁定
 * @param {string} username - 用户名
 * @returns {Object} { locked: boolean, remainingTime: number, remainingAttempts: number }
 */
function checkLoginLockout(username) {
  const key = username.toLowerCase().trim();
  const records = loadRecords();
  const record = records[key];

  // 没有失败记录
  if (!record) {
    return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  // 检查是否在锁定期内
  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    const remainingMinutes = Math.ceil(remainingTime / 60);
    return {
      locked: true,
      remainingTime,
      remainingMinutes,
      message: `登录失败次数过多，账户已锁定，请${remainingMinutes}分钟后再试`
    };
  }

  // 锁定期已过，删除记录
  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    delete records[key];
    saveRecords(records);
    return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  // 未锁定，返回剩余尝试次数
  const remainingAttempts = MAX_LOGIN_ATTEMPTS - record.count;
  return { locked: false, remainingAttempts };
}

/**
 * 记录登录失败
 * @param {string} username - 用户名
 * @returns {Object} { shouldLock: boolean, remainingAttempts: number, lockedUntil: Date|null }
 */
function recordLoginFailure(username) {
  const key = username.toLowerCase().trim();
  const records = loadRecords();
  const now = Date.now();

  if (!records[key]) {
    records[key] = { count: 0, lastAttempt: now, lockedUntil: null };
  }

  records[key].count++;
  records[key].lastAttempt = now;
  const remainingAttempts = MAX_LOGIN_ATTEMPTS - records[key].count;

  // 检查是否需要锁定
  if (records[key].count >= MAX_LOGIN_ATTEMPTS) {
    records[key].lockedUntil = now + LOCKOUT_DURATION;
    saveRecords(records);
    return {
      shouldLock: true,
      remainingAttempts: 0,
      lockedUntil: new Date(records[key].lockedUntil),
      message: `登录失败次数过多，账户已锁定30分钟`
    };
  }

  saveRecords(records);
  return {
    shouldLock: false,
    remainingAttempts,
    message: `用户名或密码错误，还剩${remainingAttempts}次尝试机会`
  };
}

/**
 * 清除登录失败记录（登录成功时调用）
 * @param {string} username - 用户名
 */
function clearLoginAttempts(username) {
  const key = username.toLowerCase().trim();
  const records = loadRecords();

  if (records[key]) {
    delete records[key];
    saveRecords(records);
  }
}

/**
 * 获取剩余尝试次数
 * @param {string} username - 用户名
 * @returns {number} 剩余尝试次数
 */
function getRemainingAttempts(username) {
  const key = username.toLowerCase().trim();
  const records = loadRecords();
  const record = records[key];

  if (!record) return MAX_LOGIN_ATTEMPTS;
  return Math.max(0, MAX_LOGIN_ATTEMPTS - record.count);
}

// 启动时清理过期记录
cleanupExpiredRecords(loadRecords());

// 定期清理过期记录（每小时）
setInterval(() => {
  cleanupExpiredRecords(loadRecords());
}, 60 * 60 * 1000);

module.exports = {
  checkLoginLockout,
  recordLoginFailure,
  clearLoginAttempts,
  getRemainingAttempts,
  MAX_LOGIN_ATTEMPTS
};
