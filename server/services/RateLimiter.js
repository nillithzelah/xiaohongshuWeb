/**
 * RateLimiter - 请求限流服务
 * 使用令牌桶算法实现灵活的限流控制
 * 
 * 功能：
 * - 全局限流（令牌桶）
 * - Cookie级别限流
 * - 随机延迟
 * - 统计和监控
 */

class RateLimiter {
  constructor() {
    // 全局限流配置
    this.globalConfig = {
      capacity: 100,        // 桶容量：最多同时处理100个请求
      refillRate: 60,       // 填充速率：每秒补充60个令牌
      tokens: 100,            // 当前令牌数
      lastRefill: Date.now()  // 上次填充时间
    };

    // Cookie级别限流配置
    this.cookieBuckets = new Map(); // Map<cookieId, { tokens, lastRefill, useCount }>

    // Cookie级别限流配置
    this.cookieConfig = {
      capacity: 10,         // 每个Cookie每分钟最多10次请求
      refillRate: 10,        // 每分钟补充10个令牌
      windowMs: 60000        // 时间窗口：60秒
    };

    // 随机延迟配置
    this.delayConfig = {
      minDelay: 1000,        // 最小延迟：1秒
      maxDelay: 5000,        // 最大延迟：5秒
      enabled: true           // 是否启用随机延迟
    };

    // 统计信息
    this.stats = {
      totalRequests: 0,
      totalRejected: 0,
      totalDelayed: 0,
      cookieStats: {}        // Map<cookieId, { useCount, lastUsed }>
    };

    // 启动定时填充令牌
    this.startRefill();
  }

  /**
   * 检查全局限流（令牌桶算法）
   * @returns {Object} { allowed: boolean, waitTime: number, reason: string }
   */
  checkGlobalLimit() {
    this.stats.totalRequests++;

    // 填充令牌
    this.refillGlobalTokens();

    // 检查是否有可用令牌
    if (this.globalConfig.tokens >= 1) {
      this.globalConfig.tokens--;
      return {
        allowed: true,
        waitTime: 0,
        reason: '全局限流通过'
      };
    }

    // 没有令牌，需要等待
    this.stats.totalRejected++;
    const waitTime = Math.ceil(1000 / this.globalConfig.refillRate); // 等待时间（毫秒）

    return {
      allowed: false,
      waitTime,
      reason: '全局限流：令牌不足，需要等待'
    };
  }

  /**
   * 检查Cookie级别限流
   * @param {string} cookieId - Cookie ID
   * @returns {Object} { allowed: boolean, waitTime: number, reason: string }
   */
  checkCookieLimit(cookieId) {
    if (!cookieId) {
      return {
        allowed: true,
        waitTime: 0,
        reason: '未提供Cookie ID，跳过限流'
      };
    }

    // 获取或创建Cookie桶
    let bucket = this.cookieBuckets.get(cookieId);
    if (!bucket) {
      bucket = {
        tokens: this.cookieConfig.capacity,
        lastRefill: Date.now(),
        useCount: 0
      };
      this.cookieBuckets.set(cookieId, bucket);
    }

    // 填充令牌
    this.refillCookieTokens(bucket);

    // 检查是否有可用令牌
    if (bucket.tokens >= 1) {
      bucket.tokens--;
      bucket.useCount++;
      this.cookieBuckets.set(cookieId, bucket);

      // 更新统计
      if (!this.stats.cookieStats[cookieId]) {
        this.stats.cookieStats[cookieId] = { useCount: 0, lastUsed: Date.now() };
      }
      this.stats.cookieStats[cookieId].useCount++;
      this.stats.cookieStats[cookieId].lastUsed = Date.now();

      return {
        allowed: true,
        waitTime: 0,
        reason: 'Cookie限流通过'
      };
    }

    // 没有令牌，需要等待
    const waitTime = Math.ceil(this.cookieConfig.windowMs / this.cookieConfig.refillRate);

    return {
      allowed: false,
      waitTime,
      reason: 'Cookie限流：令牌不足，需要等待'
    };
  }

  /**
   * 获取随机延迟时间
   * @returns {number} 延迟时间（毫秒）
   */
  getRandomDelay() {
    if (!this.delayConfig.enabled) {
      return 0;
    }

    const delay = Math.floor(
      Math.random() * (this.delayConfig.maxDelay - this.delayConfig.minDelay + 1)
    ) + this.delayConfig.minDelay;

    this.stats.totalDelayed++;
    return delay;
  }

  /**
   * 等待指定时间
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   */
  async wait(ms) {
    if (ms <= 0) {
      return;
    }

    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 组合限流检查（全局 + Cookie级别）
   * @param {string} cookieId - Cookie ID
   * @returns {Promise<Object>} { allowed: boolean, waitTime: number, reason: string }
   */
  async checkLimit(cookieId = null) {
    // 检查全局限流
    const globalResult = this.checkGlobalLimit();
    if (!globalResult.allowed) {
      console.log(`🚫 [RateLimiter] ${globalResult.reason}，等待 ${globalResult.waitTime}ms`);
      return globalResult;
    }

    // 检查Cookie级别限流
    if (cookieId) {
      const cookieResult = this.checkCookieLimit(cookieId);
      if (!cookieResult.allowed) {
        console.log(`🚫 [RateLimiter] ${cookieResult.reason}，等待 ${cookieResult.waitTime}ms`);
        return cookieResult;
      }
    }

    // 通过限流检查
    return {
      allowed: true,
      waitTime: 0,
      reason: '限流检查通过'
    };
  }

  /**
   * 执行限流检查并等待（如果需要）
   * @param {string} cookieId - Cookie ID
   * @returns {Promise<Object>} { success: boolean, reason: string }
   */
  async acquire(cookieId = null) {
    try {
      // 检查限流
      const checkResult = await this.checkLimit(cookieId);

      // 如果需要等待
      if (!checkResult.allowed && checkResult.waitTime > 0) {
        console.log(`⏳ [RateLimiter] 等待 ${checkResult.waitTime}ms...`);
        await this.wait(checkResult.waitTime);
      }

      // 添加随机延迟
      const randomDelay = this.getRandomDelay();
      if (randomDelay > 0) {
        console.log(`⏳ [RateLimiter] 随机延迟 ${randomDelay}ms...`);
        await this.wait(randomDelay);
      }

      return {
        success: true,
        reason: '限流检查通过'
      };

    } catch (error) {
      console.error('❌ [RateLimiter] 限流检查失败:', error);
      return {
        success: false,
        reason: `限流检查失败: ${error.message}`
      };
    }
  }

  /**
   * 填充全局令牌
   */
  refillGlobalTokens() {
    const now = Date.now();
    const elapsed = now - this.globalConfig.lastRefill;
    const tokensToAdd = Math.floor(elapsed / 1000 * this.globalConfig.refillRate);

    if (tokensToAdd > 0) {
      this.globalConfig.tokens = Math.min(
        this.globalConfig.tokens + tokensToAdd,
        this.globalConfig.capacity
      );
      this.globalConfig.lastRefill = now;
    }
  }

  /**
   * 填充Cookie令牌
   * @param {Object} bucket - Cookie桶对象
   */
  refillCookieTokens(bucket) {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;

    // 计算应该补充的令牌数
    const tokensToAdd = Math.floor(elapsed / this.cookieConfig.windowMs * this.cookieConfig.refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(
        bucket.tokens + tokensToAdd,
        this.cookieConfig.capacity
      );
      bucket.lastRefill = now;
    }
  }

  /**
   * 启动定时填充令牌
   */
  startRefill() {
    // 每秒填充一次令牌
    setInterval(() => {
      this.refillGlobalTokens();

      // 填充所有Cookie桶
      for (const [cookieId, bucket] of this.cookieBuckets) {
        this.refillCookieTokens(bucket);
      }
    }, 1000);

    console.log(`✅ [RateLimiter] 令牌桶定时填充已启动`);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      global: {
        capacity: this.globalConfig.capacity,
        tokens: this.globalConfig.tokens,
        refillRate: this.globalConfig.refillRate,
        utilizationRate: ((this.globalConfig.capacity - this.globalConfig.tokens) / this.globalConfig.capacity * 100).toFixed(2) + '%'
      },
      cookies: {
        total: this.cookieBuckets.size,
        stats: this.stats.cookieStats
      },
      stats: {
        totalRequests: this.stats.totalRequests,
        totalRejected: this.stats.totalRejected,
        totalDelayed: this.stats.totalDelayed,
        rejectRate: ((this.stats.totalRejected / this.stats.totalRequests) * 100).toFixed(2) + '%',
        delayRate: ((this.stats.totalDelayed / this.stats.totalRequests) * 100).toFixed(2) + '%'
      },
      config: {
        global: this.globalConfig,
        cookie: this.cookieConfig,
        delay: this.delayConfig
      }
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      totalRejected: 0,
      totalDelayed: 0,
      cookieStats: {}
    };
    console.log('🔄 [RateLimiter] 统计信息已重置');
  }

  /**
   * 更新配置
   * @param {Object} config - 新的配置
   */
  updateConfig(config) {
    if (config.global) {
      Object.assign(this.globalConfig, config.global);
    }

    if (config.cookie) {
      Object.assign(this.cookieConfig, config.cookie);
    }

    if (config.delay) {
      Object.assign(this.delayConfig, config.delay);
    }

    console.log('✅ [RateLimiter] 配置已更新:', config);
  }

  /**
   * 清理过期的Cookie桶（超过1小时未使用的）
   */
  cleanupExpiredBuckets() {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1小时前

    let cleanedCount = 0;

    for (const [cookieId, bucket] of this.cookieBuckets) {
      if (bucket.lastUsed < oneHourAgo) {
        this.cookieBuckets.delete(cookieId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 [RateLimiter] 已清理 ${cleanedCount} 个过期的Cookie桶`);
    }

    return cleanedCount;
  }
}

// 导出单例
module.exports = new RateLimiter();
