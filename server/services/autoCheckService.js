/**
 * 自动化检查服务 (AutoCheckService)
 *
 * 功能：
 * 1. 服务健康检查 (每5分钟) - PM2状态、API响应、数据库连接
 * 2. 业务队列检查 (每15分钟) - 采集队列、审核积压、客户端离线
 * 3. 代码质量检查 (每小时) - ESLint、依赖安全
 * 4. 系统资源检查 (每6小时) - 磁盘、内存使用率
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AutoCheckService {
  constructor() {
    this.isRunning = false;
    this.lastCheckResults = {};
    this.alertHistory = [];

    // 告警阈值配置
    this.thresholds = {
      apiResponseTime: 2000,       // API响应时间警告阈值 (ms)
      queueBacklog: 100,           // 队列积压警告阈值
      diskUsagePercent: 80,        // 磁盘使用率警告阈值
      memoryUsagePercent: 90,      // 内存使用率警告阈值
      clientOfflineCount: 5        // 离线客户端数量警告阈值
    };
  }

  /**
   * 启动服务
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  [AutoCheck] 服务已在运行');
      return;
    }

    this.isRunning = true;

    // 每5分钟: 服务健康检查
    cron.schedule('*/5 * * * *', () => this.checkServiceHealth());

    // 每15分钟: 业务队列检查
    cron.schedule('*/15 * * * *', () => this.checkBusinessQueue());

    // 每小时: 代码质量检查
    cron.schedule('0 * * * *', () => this.checkCodeQuality());

    // 每6小时: 系统资源检查
    cron.schedule('0 */6 * * *', () => this.checkSystemResources());

    console.log('🔍 [AutoCheck] 自动检查服务已启动');
    console.log('   - 每5分钟:  服务健康检查');
    console.log('   - 每15分钟: 业务队列检查');
    console.log('   - 每小时:   代码质量检查');
    console.log('   - 每6小时:  系统资源检查');

    // 启动时立即执行一次检查
    setTimeout(() => this.runStartupCheck(), 5000);
  }

  /**
   * 停止服务
   */
  stop() {
    this.isRunning = false;
    console.log('⏹️  [AutoCheck] 服务已停止');
  }

  /**
   * 启动时检查
   */
  async runStartupCheck() {
    console.log('🚀 [AutoCheck] 执行启动检查...');
    await this.checkServiceHealth();
    await this.checkBusinessQueue();
  }

  /**
   * 1. 服务健康检查 (每5分钟)
   */
  async checkServiceHealth() {
    const checkStart = Date.now();
    const results = {
      timestamp: new Date(),
      checks: {}
    };

    try {
      // 1.1 检查数据库连接
      results.checks.database = await this.checkDatabaseConnection();

      // 1.2 检查API响应
      results.checks.api = await this.checkAPIResponse();

      // 1.3 检查PM2状态（仅在生产环境）
      if (process.env.NODE_ENV === 'production') {
        results.checks.pm2 = await this.checkPM2Status();
      }

      const duration = Date.now() - checkStart;
      results.duration = duration;

      // 记录结果
      this.lastCheckResults.health = results;

      // 检查是否有严重问题
      const hasCriticalIssue = Object.values(results.checks).some(c => c.level === 'critical');
      if (hasCriticalIssue) {
        await this.sendAlert('critical', '服务健康检查发现严重问题');
      }

      console.log(`✅ [AutoCheck] 服务健康检查完成 (${duration}ms)`);

    } catch (error) {
      console.error('❌ [AutoCheck] 服务健康检查失败:', error.message);
      await this.sendAlert('critical', `服务健康检查异常: ${error.message}`);
    }
  }

  /**
   * 1.1 检查数据库连接
   */
  async checkDatabaseConnection() {
    const start = Date.now();
    try {
      // 检查连接状态
      const state = mongoose.connection.readyState;
      const stateMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      if (state !== 1) {
        return {
          status: 'error',
          level: 'critical',
          message: `数据库未连接 (${stateMap[state]})`,
          responseTime: Date.now() - start
        };
      }

      // 执行简单查询测试
      await mongoose.connection.db.admin().ping();

      return {
        status: 'ok',
        level: 'normal',
        message: '数据库连接正常',
        responseTime: Date.now() - start,
        state: stateMap[state]
      };

    } catch (error) {
      return {
        status: 'error',
        level: 'critical',
        message: `数据库连接异常: ${error.message}`,
        responseTime: Date.now() - start
      };
    }
  }

  /**
   * 1.2 检查API响应
   */
  async checkAPIResponse() {
    const start = Date.now();
    try {
      // 内部API健康检查
      const port = process.env.PORT || 5000;
      const http = require('http');

      return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/xiaohongshu/api/health`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            const responseTime = Date.now() - start;

            if (res.statusCode === 200) {
              const level = responseTime > this.thresholds.apiResponseTime ? 'warning' : 'normal';
              resolve({
                status: 'ok',
                level,
                message: level === 'warning' ? `API响应较慢 (${responseTime}ms)` : 'API响应正常',
                responseTime,
                statusCode: res.statusCode
              });
            } else {
              resolve({
                status: 'error',
                level: 'critical',
                message: `API返回非200状态码: ${res.statusCode}`,
                responseTime,
                statusCode: res.statusCode
              });
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            status: 'error',
            level: 'critical',
            message: `API请求失败: ${error.message}`,
            responseTime: Date.now() - start
          });
        });

        req.setTimeout(5000, () => {
          req.destroy();
          resolve({
            status: 'error',
            level: 'critical',
            message: 'API请求超时',
            responseTime: Date.now() - start
          });
        });
      });

    } catch (error) {
      return {
        status: 'error',
        level: 'critical',
        message: `API检查异常: ${error.message}`,
        responseTime: Date.now() - start
      };
    }
  }

  /**
   * 1.3 检查PM2进程状态
   */
  async checkPM2Status() {
    try {
      const { stdout } = await execPromise('pm2 jlist');
      const processes = JSON.parse(stdout);

      const xiaohongshuApi = processes.find(p => p.name === 'xiaohongshu-api');

      if (!xiaohongshuApi) {
        return {
          status: 'error',
          level: 'critical',
          message: '未找到 xiaohongshu-api 进程'
        };
      }

      if (xiaohongshuApi.pm2_env.status !== 'online') {
        return {
          status: 'error',
          level: 'critical',
          message: `进程状态异常: ${xiaohongshuApi.pm2_env.status}`,
          restarts: xiaohongshuApi.pm2_env.restart_time
        };
      }

      // 检查重启次数是否过多
      if (xiaohongshuApi.pm2_env.restart_time > 10) {
        return {
          status: 'warning',
          level: 'warning',
          message: `进程重启次数过多: ${xiaohongshuApi.pm2_env.restart_time}`,
          restarts: xiaohongshuApi.pm2_env.restart_time
        };
      }

      return {
        status: 'ok',
        level: 'normal',
        message: 'PM2进程运行正常',
        uptime: Math.floor(xiaohongshuApi.pm2_env.pm_uptime / 1000),
        restarts: xiaohongshuApi.pm2_env.restart_time
      };

    } catch (error) {
      return {
        status: 'warning',
        level: 'warning',
        message: `PM2检查失败: ${error.message}`
      };
    }
  }

  /**
   * 2. 业务队列检查 (每15分钟)
   */
  async checkBusinessQueue() {
    const checkStart = Date.now();
    const results = {
      timestamp: new Date(),
      checks: {}
    };

    try {
      // 2.1 检查采集队列积压
      results.checks.harvestQueue = await this.checkHarvestQueue();

      // 2.2 检查审核积压
      results.checks.reviewQueue = await this.checkReviewQueue();

      // 2.3 检查客户端离线数
      results.checks.clientStatus = await this.checkClientStatus();

      const duration = Date.now() - checkStart;
      results.duration = duration;

      this.lastCheckResults.business = results;

      console.log(`✅ [AutoCheck] 业务队列检查完成 (${duration}ms)`);

    } catch (error) {
      console.error('❌ [AutoCheck] 业务队列检查失败:', error.message);
    }
  }

  /**
   * 2.1 检查采集队列积压
   */
  async checkHarvestQueue() {
    try {
      const CommentLead = mongoose.model('CommentLead');
      const pendingCount = await CommentLead.countDocuments({ status: 'pending' });

      const level = pendingCount > this.thresholds.queueBacklog ? 'warning' : 'normal';

      return {
        status: level === 'normal' ? 'ok' : 'warning',
        level,
        message: level === 'warning' ? `采集队列积压: ${pendingCount} 条` : `采集队列正常: ${pendingCount} 条`,
        pendingCount
      };

    } catch (error) {
      return {
        status: 'error',
        level: 'warning',
        message: `采集队列检查失败: ${error.message}`
      };
    }
  }

  /**
   * 2.2 检查审核积压
   */
  async checkReviewQueue() {
    try {
      const ImageReview = mongoose.model('ImageReview');
      const pendingCount = await ImageReview.countDocuments({ status: 'pending' });
      const aiPendingCount = await ImageReview.countDocuments({ status: 'ai_pending' });

      const totalPending = pendingCount + aiPendingCount;
      const level = totalPending > this.thresholds.queueBacklog ? 'warning' : 'normal';

      return {
        status: level === 'normal' ? 'ok' : 'warning',
        level,
        message: level === 'warning' ? `审核队列积压: ${totalPending} 条` : `审核队列正常: ${totalPending} 条`,
        pendingCount,
        aiPendingCount,
        totalPending
      };

    } catch (error) {
      return {
        status: 'error',
        level: 'warning',
        message: `审核队列检查失败: ${error.message}`
      };
    }
  }

  /**
   * 2.3 检查客户端状态
   */
  async checkClientStatus() {
    try {
      const ClientHeartbeat = mongoose.model('ClientHeartbeat');
      const offlineCount = await ClientHeartbeat.countDocuments({ status: 'offline' });
      const onlineCount = await ClientHeartbeat.countDocuments({ status: 'online' });

      const level = offlineCount > this.thresholds.clientOfflineCount ? 'warning' : 'normal';

      return {
        status: level === 'normal' ? 'ok' : 'warning',
        level,
        message: level === 'warning' ? `离线客户端较多: ${offlineCount} 个` : `客户端状态正常`,
        onlineCount,
        offlineCount
      };

    } catch (error) {
      return {
        status: 'error',
        level: 'warning',
        message: `客户端状态检查失败: ${error.message}`
      };
    }
  }

  /**
   * 3. 代码质量检查 (每小时)
   */
  async checkCodeQuality() {
    const checkStart = Date.now();
    const results = {
      timestamp: new Date(),
      checks: {}
    };

    try {
      // 只在生产环境执行
      if (process.env.NODE_ENV !== 'production') {
        results.checks.note = { status: 'skipped', message: '非生产环境，跳过检查' };
        return;
      }

      // 3.1 检查依赖安全 (npm audit)
      results.checks.dependencies = await this.checkDependencies();

      const duration = Date.now() - checkStart;
      results.duration = duration;

      this.lastCheckResults.codeQuality = results;

      console.log(`✅ [AutoCheck] 代码质量检查完成 (${duration}ms)`);

    } catch (error) {
      console.error('❌ [AutoCheck] 代码质量检查失败:', error.message);
    }
  }

  /**
   * 3.1 检查依赖安全
   */
  async checkDependencies() {
    try {
      const { stdout, stderr } = await execPromise('npm audit --json', {
        timeout: 30000,
        cwd: '/var/www/xiaohongshu-web/server'
      });

      const audit = JSON.parse(stdout || '{}');
      const vulnerabilities = audit.metadata?.vulnerabilities || {};

      const total = (vulnerabilities.total || 0);
      const critical = vulnerabilities.critical || 0;
      const high = vulnerabilities.high || 0;

      if (critical > 0) {
        return {
          status: 'error',
          level: 'critical',
          message: `发现 ${critical} 个严重安全漏洞`,
          critical,
          high,
          total
        };
      }

      if (high > 0) {
        return {
          status: 'warning',
          level: 'warning',
          message: `发现 ${high} 个高危安全漏洞`,
          critical,
          high,
          total
        };
      }

      return {
        status: 'ok',
        level: 'normal',
        message: '依赖安全检查通过',
        total
      };

    } catch (error) {
      // npm audit 在有漏洞时返回非0退出码，需要解析输出
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          const vulnerabilities = audit.metadata?.vulnerabilities || {};
          const critical = vulnerabilities.critical || 0;
          const high = vulnerabilities.high || 0;

          if (critical > 0) {
            return {
              status: 'error',
              level: 'critical',
              message: `发现 ${critical} 个严重安全漏洞`,
              critical,
              high,
              total: vulnerabilities.total || 0
            };
          }

          return {
            status: 'warning',
            level: 'warning',
            message: `发现安全漏洞`,
            critical,
            high,
            total: vulnerabilities.total || 0
          };
        } catch (parseError) {
          // 忽略解析错误
        }
      }

      return {
        status: 'warning',
        level: 'warning',
        message: `依赖检查失败: ${error.message}`
      };
    }
  }

  /**
   * 4. 系统资源检查 (每6小时)
   */
  async checkSystemResources() {
    const checkStart = Date.now();
    const results = {
      timestamp: new Date(),
      checks: {}
    };

    try {
      // 4.1 检查磁盘使用率
      results.checks.disk = await this.checkDiskUsage();

      // 4.2 检查内存使用率
      results.checks.memory = await this.checkMemoryUsage();

      const duration = Date.now() - checkStart;
      results.duration = duration;

      this.lastCheckResults.systemResources = results;

      console.log(`✅ [AutoCheck] 系统资源检查完成 (${duration}ms)`);

    } catch (error) {
      console.error('❌ [AutoCheck] 系统资源检查失败:', error.message);
    }
  }

  /**
   * 4.1 检查磁盘使用率
   */
  async checkDiskUsage() {
    try {
      const { stdout } = await execPromise("df -h / | tail -1 | awk '{print $5}' | tr -d '%'");
      const usagePercent = parseInt(stdout.trim());

      const level = usagePercent > this.thresholds.diskUsagePercent ? 'warning' : 'normal';

      return {
        status: level === 'normal' ? 'ok' : 'warning',
        level,
        message: level === 'warning' ? `磁盘使用率过高: ${usagePercent}%` : `磁盘使用率正常: ${usagePercent}%`,
        usagePercent
      };

    } catch (error) {
      return {
        status: 'warning',
        level: 'warning',
        message: `磁盘检查失败: ${error.message}`
      };
    }
  }

  /**
   * 4.2 检查内存使用率
   */
  async checkMemoryUsage() {
    try {
      const totalMemory = process.memoryUsage();
      const usedMB = Math.round(totalMemory.heapUsed / 1024 / 1024);
      const totalMB = Math.round(totalMemory.heapTotal / 1024 / 1024);
      const usagePercent = Math.round((totalMemory.heapUsed / totalMemory.heapTotal) * 100);

      const level = usagePercent > this.thresholds.memoryUsagePercent ? 'warning' : 'normal';

      return {
        status: level === 'normal' ? 'ok' : 'warning',
        level,
        message: level === 'warning' ? `内存使用率过高: ${usagePercent}% (${usedMB}MB/${totalMB}MB)` : `内存使用率正常: ${usagePercent}% (${usedMB}MB/${totalMB}MB)`,
        usedMB,
        totalMB,
        usagePercent
      };

    } catch (error) {
      return {
        status: 'warning',
        level: 'warning',
        message: `内存检查失败: ${error.message}`
      };
    }
  }

  /**
   * 发送告警
   */
  async sendAlert(level, message) {
    const alert = {
      level,
      message,
      timestamp: new Date(),
      results: this.lastCheckResults
    };

    // 记录到历史
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }

    // 控制台输出
    const emoji = level === 'critical' ? '🔴' : level === 'warning' ? '🟡' : '🟢';
    console.log(`${emoji} [AutoCheck] [${level.toUpperCase()}] ${message}`);

    // 钉钉告警 (可选)
    if (process.env.DINGTALK_WEBHOOK && (level === 'critical' || level === 'warning')) {
      await this.sendDingTalkAlert(level, message);
    }

    return alert;
  }

  /**
   * 发送钉钉告警
   */
  async sendDingTalkAlert(level, message) {
    try {
      const axios = require('axios');
      const { withRetry } = require('../utils/apiRetry');
      const webhook = process.env.DINGTALK_WEBHOOK;

      const emoji = level === 'critical' ? '🔴' : '🟡';

      // 🔧 使用重试机制包装告警发送
      await withRetry(async () => {
        return await axios.post(webhook, {
          msgtype: 'text',
          text: {
            content: `${emoji} [小红书审核系统]\n${message}\n时间: ${new Date().toLocaleString('zh-CN')}`
          }
        });
      }, {
        maxRetries: 2,
        delay: 1000,
        backoffMultiplier: 2
      });

      console.log('📱 [AutoCheck] 钉钉告警已发送');

    } catch (error) {
      console.error('❌ [AutoCheck] 钉钉告警发送失败:', error.message);
    }
  }

  /**
   * 获取最新检查结果
   */
  getLatestResults() {
    return {
      health: this.lastCheckResults.health || null,
      business: this.lastCheckResults.business || null,
      codeQuality: this.lastCheckResults.codeQuality || null,
      systemResources: this.lastCheckResults.systemResources || null,
      alertHistory: this.alertHistory.slice(-10) // 最近10条告警
    };
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      thresholds: this.thresholds,
      lastCheckTime: Object.values(this.lastCheckResults).reduce((latest, result) => {
        if (!result || !result.timestamp) return latest;
        const time = new Date(result.timestamp);
        return time > latest ? time : latest;
      }, new Date(0)),
      alertCount: this.alertHistory.length
    };
  }
}

// 创建单例实例
const autoCheckService = new AutoCheckService();

module.exports = autoCheckService;
