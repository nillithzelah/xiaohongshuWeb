/**
 * 增强版 Cookie 池服务（基于配置文件）
 * 支持轮询、优先级、失效自动切换、自动标记失效Cookie、重试机制
 * 审核前Cookie预验证：确保Cookie有效后才进行审核
 * 定时检查：每60秒检查一次Cookie是否过期
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

class SimpleCookiePool {
  constructor() {
    this.configPath = path.join(__dirname, '../config/cookie-pool.js');
    this.currentIndex = 0;
    this.cookies = [];
    // 使用统计
    this.usageStats = {}; // { cookieId: { count: 0, lastUsed: timestamp } }
    // 失效Cookie集合（持久化到配置文件）
    this.invalidCookies = new Set();
    // 审核暂停标志（当所有Cookie失效时暂停）
    this.auditsPaused = false;
    this.pauseReason = null;
    this.pauseTime = null;
    // 定时检查配置
    this.checkInterval = 60 * 1000; // 每60秒检查一次
    this.checkTimer = null;
    this.isChecking = false; // 防止重复检查
    this.checkStats = {
      totalChecks: 0,
      lastCheckTime: null,
      lastCheckResult: null
    };
    // 从配置文件加载失效标记
    this.loadInvalidCookies();
    this.loadConfig();
    // 启动定时检查
    this.startPeriodicCheck();
  }

  /**
   * 加载配置
   */
  loadConfig() {
    try {
      // 清除缓存重新加载
      delete require.cache[require.resolve(this.configPath)];
      const config = require(this.configPath);

      this.cookies = config.cookies.filter(c => c.enabled !== false);
      console.log(`🍪 [Cookie池] 已加载 ${this.cookies.length} 个 Cookie`);

    } catch (error) {
      console.error('❌ [Cookie池] 加载配置失败:', error.message);
      this.cookies = [];
    }
  }

  /**
   * 从配置文件加载失效Cookie标记
   */
  loadInvalidCookies() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        const match = configContent.match(/exported\.invalidCookies\s*=\s*(\[[\s\S]*?\]);/);
        if (match) {
          const invalidList = JSON.parse(match[1]);
          this.invalidCookies = new Set(invalidList);
          console.log(`🍪 [Cookie池] 已加载 ${this.invalidCookies.size} 个失效Cookie标记`);
        }
      }
    } catch (error) {
      console.log('ℹ️ [Cookie池] 无已保存的失效Cookie标记');
    }
  }

  /**
   * 保存失效Cookie标记到配置文件
   */
  saveInvalidCookies() {
    try {
      const invalidList = Array.from(this.invalidCookies);
      const configContent = fs.readFileSync(this.configPath, 'utf8');

      // 查找或添加 exported.invalidCookies 行
      const invalidCookiesLine = `module.exports.invalidCookies = ${JSON.stringify(invalidList)};`;

      if (configContent.includes('module.exports.invalidCookies')) {
        // 替换现有行
        const newContent = configContent.replace(
          /module\.exports\.invalidCookies\s*=\s*\[.*?\];/,
          invalidCookiesLine
        );
        fs.writeFileSync(this.configPath, newContent, 'utf8');
      } else {
        // 添加到文件末尾
        fs.appendFileSync(this.configPath, '\n' + invalidCookiesLine + '\n', 'utf8');
      }

      console.log(`💾 [Cookie池] 已保存 ${invalidList.length} 个失效Cookie标记到配置文件`);
    } catch (error) {
      console.error('❌ [Cookie池] 保存失效Cookie标记失败:', error.message);
    }
  }

  /**
   * 通过实际请求检测Cookie是否有效
   * 访问 https://www.xiaohongshu.com/explore 检查登录相关文本
   *
   * 失效判定：页面同时包含以下所有文本
   * - "登录后推荐更懂你的笔记"
   * - "可用小红书或微信扫码"
   * - "手机号登录"
   * - "我已阅读并同意"（用户协议）
   * - "新用户可直接登录"
   *
   * @param {string|Object} cookie - Cookie字符串或Cookie对象
   * @returns {Promise<Object>} { valid: boolean, reason: string }
   */
  async validateCookieByRequest(cookie) {
    const cookieValue = typeof cookie === 'string' ? cookie : (cookie?.value || '');

    if (!cookieValue) {
      return { valid: false, reason: 'Cookie为空' };
    }

    try {
      const response = await axios.get('https://www.xiaohongshu.com/explore', {
        headers: {
          'Cookie': cookieValue,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      });

      const pageText = response.data;

      // 检测失效所需的所有文本
      const requiredTexts = [
        '登录后推荐更懂你的笔记',
        '可用小红书或微信扫码',
        '手机号登录',
        '我已阅读并同意',
        '新用户可直接登录'
      ];

      // 检查是否所有文本都存在
      const allTextsPresent = requiredTexts.every(text => pageText.includes(text));

      if (allTextsPresent) {
        return {
          valid: false,
          reason: '页面显示登录页面（检测到完整登录界面）',
          texts: requiredTexts
        };
      }

      // Cookie有效
      return { valid: true, reason: 'Cookie有效' };

    } catch (error) {
      console.error('❌ [Cookie验证] 请求失败:', error.message);
      return { valid: false, reason: `请求失败: ${error.message}` };
    }
  }

  /**
   * 检查Cookie是否有效
   * 注意：不再通过时间判断，只检查是否被运行时标记为失效
   */
  isCookieValid(cookie) {
    if (!cookie || !cookie.value) return false;
    // 只检查是否被实际请求验证为失效
    return !this.invalidCookies.has(cookie.id);
  }

  /**
   * 获取下一个可用的 Cookie（轮询，跳过失效的）
   * 注意：不再通过时间判断过期，只跳过运行时检测失效的Cookie
   * @returns {Object|null} { id, name, value, loadts }
   */
  getNextCookie() {
    if (this.cookies.length === 0) {
      console.warn('⚠️ [Cookie池] 没有可用的 Cookie');
      return null;
    }

    const now = Date.now();
    let attempts = 0;
    const maxAttempts = this.cookies.length;

    while (attempts < maxAttempts) {
      const index = this.currentIndex % this.cookies.length;
      const cookie = this.cookies[index];
      this.currentIndex++;
      attempts++;

      // 检查Cookie是否有效
      if (!cookie.value) {
        console.warn(`⚠️ [Cookie池] ${cookie.name} 没有value字段，跳过`);
        continue;
      }

      // 只跳过运行时检测到失效的Cookie（通过实际请求验证过的）
      if (this.invalidCookies.has(cookie.id)) {
        console.warn(`⚠️ [Cookie池] ${cookie.name} 已被标记为失效（实际请求验证），跳过`);
        continue;
      }

      // 不再通过时间判断Cookie是否过期，让实际请求来决定
      const ageHours = (now - cookie.loadts) / (1000 * 60 * 60);
      const estimatedExpiry = cookie.estimatedExpiry || 72;

      // 记录使用统计
      if (!this.usageStats[cookie.id]) {
        this.usageStats[cookie.id] = { count: 0, lastUsed: 0 };
      }
      this.usageStats[cookie.id].count++;
      this.usageStats[cookie.id].lastUsed = now;

      console.log(`🍪 [Cookie池] 使用: ${cookie.name} (已用${ageHours.toFixed(1)}h, 第${this.usageStats[cookie.id].count}次)`);

      return {
        id: cookie.id,
        name: cookie.name,
        value: cookie.value,
        loadts: cookie.loadts
      };
    }

    // 所有Cookie都失效了
    console.error('❌ [Cookie池] 所有Cookie都已失效！');
    return null;
  }

  /**
   * 获取Cookie字符串（兼容旧代码，只返回value）
   * @returns {string|null}
   */
  getCookieString() {
    const cookie = this.getNextCookie();
    return cookie ? cookie.value : null;
  }

  /**
   * 获取完整Cookie对象（包含ID，用于追踪）
   * @returns {Object|null} { id, name, value, loadts }
   */
  getCookie() {
    return this.getNextCookie();
  }

  /**
   * 标记当前Cookie为失效并获取下一个（重试机制）
   * @param {string} failedCookieId - 失效的Cookie ID
   * @param {string} reason - 失效原因
   * @returns {Object|null} 下一个可用的Cookie
   */
  skipAndGetNext(failedCookieId, reason = '未知') {
    console.log(`🔄 [Cookie池] Cookie失效，切换到下一个... 原因: ${reason}`);

    // 标记为失效
    this.markCookieInvalid(failedCookieId, reason);

    // 获取下一个cookie
    const nextCookie = this.getNextCookie();

    if (nextCookie) {
      console.log(`✅ [Cookie池] 已切换到: ${nextCookie.name}`);
    } else {
      console.log(`❌ [Cookie池] 没有更多可用的Cookie了`);
    }

    return nextCookie;
  }

  /**
   * 获取指定 Cookie
   */
  getCookieById(id) {
    return this.cookies.find(c => c.id === id);
  }

  /**
   * 获取池状态
   */
  getStatus() {
    const now = Date.now();

    return {
      total: this.cookies.length,
      currentIndex: this.currentIndex % Math.max(1, this.cookies.length),
      totalUsage: this.currentIndex,
      invalidCookies: this.getInvalidCookies(), // 失效Cookie列表（实际请求验证过的）
      cookies: this.cookies.map(cookie => {
        const ageHours = (now - cookie.loadts) / (1000 * 60 * 60);
        const estimatedExpiry = cookie.estimatedExpiry || 72;
        const remainingHours = Math.max(0, estimatedExpiry - ageHours);
        const stats = this.usageStats[cookie.id] || { count: 0, lastUsed: 0 };
        const isRuntimeInvalid = this.invalidCookies.has(cookie.id); // 运行时标记为失效

        return {
          id: cookie.id,
          name: cookie.name,
          value: cookie.value || '', // 添加value字段，便于前端编辑时保留
          enabled: cookie.enabled !== false,
          priority: cookie.priority || 0,
          loadts: cookie.loadts, // 保留原始时间戳
          estimatedExpiry: cookie.estimatedExpiry || 72,
          loadDate: new Date(cookie.loadts).toLocaleString('zh-CN'),
          ageHours: Math.floor(ageHours * 10) / 10,
          remainingHours: Math.floor(remainingHours * 10) / 10,
          // isExpired 只反映运行时实际验证的失效状态，不再基于时间判断
          isExpired: isRuntimeInvalid,
          isRuntimeInvalid: isRuntimeInvalid,
          usageCount: stats.count || 0,
          lastUsed: (stats.lastUsed && stats.lastUsed > 0) ? new Date(stats.lastUsed).toLocaleString('zh-CN') : '未使用'
        };
      }),
      // 定时检查统计
      periodicCheck: {
        interval: this.checkInterval / 1000, // 秒
        isChecking: this.isChecking,
        totalChecks: this.checkStats.totalChecks,
        lastCheckTime: this.checkStats.lastCheckTime,
        lastCheckResult: this.checkStats.lastCheckResult ? {
          validCount: this.checkStats.lastCheckResult.validCount,
          invalidCount: this.checkStats.lastCheckResult.invalidCount,
          totalCount: this.checkStats.lastCheckResult.totalCount,
          duration: this.checkStats.lastCheckResult.duration
        } : null
      }
    };
  }

  /**
   * 重新加载配置
   */
  reload() {
    this.currentIndex = 0;
    this.loadConfig();
  }

  /**
   * 标记Cookie为失效（运行时检测到cookie无效时调用）
   * @param {string} cookieId - Cookie ID
   * @param {string} reason - 失效原因
   */
  markCookieInvalid(cookieId, reason = '未知') {
    if (!cookieId) {
      console.warn('⚠️ [Cookie池] markCookieInvalid: cookieId 为空');
      return;
    }

    // 查找cookie名称
    const cookie = this.cookies.find(c => c.id === cookieId);
    const cookieName = cookie ? cookie.name : cookieId;

    if (this.invalidCookies.has(cookieId)) {
      console.log(`⚠️ [Cookie池] ${cookieName} 已经被标记为失效，原因: ${reason}`);
      return;
    }

    this.invalidCookies.add(cookieId);
    console.log(`🚫 [Cookie池] 已标记Cookie为失效: ${cookieName}，原因: ${reason}`);

    // 持久化到配置文件
    this.saveInvalidCookies();

    // 统计剩余可用cookie
    const validCount = this.cookies.filter(c =>
      c.enabled !== false &&
      !this.invalidCookies.has(c.id) &&
      this.isCookieValid(c)
    ).length;
    console.log(`📊 [Cookie池] 剩余可用Cookie: ${validCount}/${this.cookies.length}`);
  }

  /**
   * 清除失效标记（用于重置或更新cookie后）
   * @param {string} cookieId - 可选，指定Cookie ID，不传则清除所有
   */
  clearInvalidCookies(cookieId = null) {
    if (cookieId) {
      const removed = this.invalidCookies.delete(cookieId);
      if (removed) {
        console.log(`✅ [Cookie池] 已清除Cookie失效标记: ${cookieId}`);
        this.saveInvalidCookies(); // 持久化
        // 清除失效标记后，尝试恢复审核
        this.resumeAudits();
      }
    } else {
      const count = this.invalidCookies.size;
      this.invalidCookies.clear();
      console.log(`✅ [Cookie池] 已清除所有失效标记 (${count}个)`);
      this.saveInvalidCookies(); // 持久化
      // 清除所有失效标记后，恢复审核
      this.resumeAudits();
    }
  }

  /**
   * 获取失效的Cookie列表
   */
  getInvalidCookies() {
    return Array.from(this.invalidCookies);
  }

  /**
   * 根据cookie字符串查找cookie ID
   * @param {string} cookieString - Cookie字符串
   */
  findCookieIdByValue(cookieString) {
    if (!cookieString) return null;

    // 提取一些关键字段来匹配
    const matchFields = ['a1=', 'webId=', 'gid='];

    for (const cookie of this.cookies) {
      if (!cookie.value) continue;

      let matchCount = 0;
      for (const field of matchFields) {
        const extractFromValue = (str, fieldName) => {
          const match = str.match(new RegExp(`${fieldName}([^;]+)`));
          return match ? match[1] : '';
        };

        const valueFromPool = extractFromValue(cookie.value, field);
        const valueFromInput = extractFromValue(cookieString, field);

        if (valueFromPool && valueFromPool === valueFromInput) {
          matchCount++;
        }
      }

      // 至少匹配2个字段就认为是同一个cookie
      if (matchCount >= 2) {
        return cookie.id;
      }
    }

    return null;
  }

  /**
   * 获取Cookie用于审核
   *
   * Cookie有效性检测说明：
   * - 笔记内容：公开可访问，无需Cookie即可读取
   * - 评论区：需要Cookie才能加载
   * - Cookie失效只有一种情况：页面出现密码输入框（登录页）
   *
   * 检测逻辑由CommentVerificationService（Puppeteer）在实际审核时执行，
   * 因为只有真实浏览器环境才能准确检测登录状态。
   *
   * @returns {Object|null} { id, name, value, loadts } 或 null（无可用Cookie）
   */
  async getValidatedCookie() {
    // 如果审核已暂停，直接返回null
    if (this.auditsPaused) {
      console.warn('⚠️ [Cookie池] 审核已暂停，所有Cookie均已失效');
      return null;
    }

    // 直接返回可用的Cookie
    // 实际Cookie有效性由Puppeteer在审核时通过密码框检测验证
    console.log('🍪 [Cookie池] 获取Cookie（有效性由Puppeteer在审核时检测）');
    return this.getCookie();
  }

  /**
   * 检查是否所有Cookie都失效了
   * @returns {boolean}
   */
  areAllCookiesInvalid() {
    if (this.cookies.length === 0) {
      return true;
    }

    // 计算有效Cookie数量
    const validCount = this.cookies.filter(c =>
      c.enabled !== false &&
      !this.invalidCookies.has(c.id) &&
      this.isCookieValid(c)
    ).length;

    return validCount === 0;
  }

  /**
   * 暂停所有审核（当所有Cookie失效时）
   * @param {string} reason - 暂停原因
   */
  pauseAudits(reason = '所有Cookie均已失效') {
    if (!this.auditsPaused) {
      this.auditsPaused = true;
      this.pauseReason = reason;
      this.pauseTime = new Date().toISOString();
      console.error(`🚫 [Cookie池] 所有审核已暂停！原因: ${reason}`);
      console.error(`⏰ [Cookie池] 暂停时间: ${this.pauseTime}`);
      console.error(`💡 [Cookie池] 请更新有效的Cookie后调用 resumeAudits() 恢复审核`);
    }
  }

  /**
   * 恢复所有审核（当有新Cookie生效时）
   */
  resumeAudits() {
    if (this.auditsPaused) {
      this.auditsPaused = false;
      this.pauseReason = null;
      this.pauseTime = null;
      console.log(`✅ [Cookie池] 审核已恢复！`);

      // 同时恢复asyncAiReviewService的审核状态
      try {
        const asyncAiReviewService = require('./asyncAiReviewService');
        asyncAiReviewService.reactivateCookie();
      } catch (error) {
        console.error('❌ [Cookie池] 恢复asyncAiReviewService失败:', error.message);
      }
    }
  }

  /**
   * 获取审核暂停状态
   * @returns {Object} { paused: boolean, reason: string, pauseTime: string }
   */
  getAuditPauseStatus() {
    return {
      paused: this.auditsPaused,
      reason: this.pauseReason,
      pauseTime: this.pauseTime
    };
  }

  /**
   * 重置暂停状态（手动恢复）
   */
  resetPauseStatus() {
    this.auditsPaused = false;
    this.pauseReason = null;
    this.pauseTime = null;
    console.log(`🔄 [Cookie池] 已手动重置暂停状态`);
  }

  /**
   * 启动定时检查（每60秒检查一次Cookie是否过期）
   */
  startPeriodicCheck() {
    // 先执行一次立即检查
    setTimeout(() => {
      this.checkAllCookiesValidity();
    }, 5000); // 延迟5秒执行，等待服务完全启动

    // 设置定时检查
    this.checkTimer = setInterval(() => {
      this.checkAllCookiesValidity();
    }, this.checkInterval);

    console.log(`⏰ [Cookie池] 已启动定时检查，每 ${this.checkInterval / 1000} 秒检查一次 Cookie 有效性`);
  }

  /**
   * 停止定时检查
   */
  stopPeriodicCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log(`⏰ [Cookie池] 已停止定时检查`);
    }
  }

  /**
   * 检查所有 Cookie 的有效性
   */
  async checkAllCookiesValidity() {
    // 防止重复检查
    if (this.isChecking) {
      console.log(`⏳ [Cookie池] 上一次检查仍在进行中，跳过本次检查`);
      return;
    }

    this.isChecking = true;
    this.checkStats.totalChecks++;
    const checkStartTime = Date.now();

    console.log(`🔍 [Cookie池定时检查] 开始检查 (${this.checkStats.totalChecks}次)...`);

    try {
      const results = [];
      let invalidCount = 0;
      let validCount = 0;

      // 检查所有未标记为失效的 Cookie
      for (const cookie of this.cookies) {
        // 跳过已标记为失效的 Cookie
        if (this.invalidCookies.has(cookie.id)) {
          continue;
        }

        // 跳过没有 value 的 Cookie
        if (!cookie.value) {
          continue;
        }

        try {
          const result = await this.validateCookieByRequest(cookie);
          const isValid = result.valid;

          if (!isValid) {
            // Cookie 已失效，标记并记录
            this.markCookieInvalid(cookie.id, result.reason);
            invalidCount++;
            console.log(`❌ [Cookie池定时检查] ${cookie.name} 已失效: ${result.reason}`);
          } else {
            validCount++;
          }

          results.push({
            id: cookie.id,
            name: cookie.name,
            valid: isValid,
            reason: result.reason
          });

        } catch (error) {
          // 检查出错，记录但不标记失效（可能是网络问题）
          console.warn(`⚠️ [Cookie池定时检查] ${cookie.name} 检查出错: ${error.message}`);
          results.push({
            id: cookie.id,
            name: cookie.name,
            valid: null,
            reason: `检查出错: ${error.message}`
          });
        }
      }

      // 更新统计信息
      this.checkStats.lastCheckTime = new Date().toISOString();
      this.checkStats.lastCheckResult = {
        validCount,
        invalidCount,
        totalCount: validCount + invalidCount,
        duration: Date.now() - checkStartTime,
        results
      };

      // 检查是否所有 Cookie 都失效了
      const totalValidCookies = this.cookies.filter(c =>
        c.enabled !== false &&
        !this.invalidCookies.has(c.id) &&
        c.value
      ).length;

      if (totalValidCookies === 0 && this.cookies.length > 0) {
        console.error(`🚨 [Cookie池定时检查] 所有 Cookie 均已失效！暂停审核...`);
        this.pauseAudits('定时检查发现所有Cookie均已失效');
      } else {
        // 如果之前因为所有 Cookie 失效而暂停，现在有有效的了，恢复审核
        if (this.auditsPaused) {
          console.log(`✅ [Cookie池定时检查] 检测到 ${totalValidCookies} 个有效 Cookie，恢复审核`);
          this.resumeAudits();
        }
      }

      console.log(`✅ [Cookie池定时检查] 完成: 有效 ${validCount} 个, 失效 ${invalidCount} 个, 耗时 ${this.checkStats.lastCheckResult.duration}ms`);

    } catch (error) {
      console.error(`❌ [Cookie池定时检查] 检查过程出错:`, error.message);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 获取定时检查统计信息
   */
  getCheckStats() {
    return {
      ...this.checkStats,
      isChecking: this.isChecking,
      checkInterval: this.checkInterval,
      nextCheckTime: this.checkStats.lastCheckTime
        ? new Date(new Date(this.checkStats.lastCheckTime).getTime() + this.checkInterval).toISOString()
        : null
    };
  }

  /**
   * 手动触发检查（供 API 调用）
   */
  async manualCheck() {
    console.log(`🔧 [Cookie池] 手动触发检查...`);
    await this.checkAllCookiesValidity();
    return this.getCheckStats();
  }
}

// 导出单例
module.exports = new SimpleCookiePool();
