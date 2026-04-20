const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

class ClientManager extends EventEmitter {
  constructor(clientsConfig, rootPath) {
    super();
    this.clientsConfig = clientsConfig;
    this.rootPath = rootPath;
    this.runningClients = new Map(); // clientId -> { process, startTime, logs }
  }

  /**
   * 启动客户端
   */
  startClient(clientId) {
    const clientConfig = this.clientsConfig.find(c => c.id === clientId);
    if (!clientConfig) {
      return { success: false, error: '客户端不存在' };
    }

    // 检查是否已在运行
    if (this.runningClients.has(clientId)) {
      return { success: false, error: '客户端已在运行中' };
    }

    const clientPath = path.join(this.rootPath, clientConfig.path);

    // 检查客户端目录是否存在
    if (!fs.existsSync(clientPath)) {
      return { success: false, error: `客户端目录不存在: ${clientPath}` };
    }

    // 检查 package.json
    const packageJsonPath = path.join(clientPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return { success: false, error: '客户端缺少 package.json' };
    }

    try {
      // 使用 npm start 启动客户端
      const clientProcess = spawn('npm', ['start'], {
        cwd: clientPath,
        shell: true,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const clientInfo = {
        process: clientProcess,
        startTime: new Date(),
        logs: []
      };

      // 收集日志输出
      clientProcess.stdout.on('data', (data) => {
        const log = data.toString().trim();
        const logEntry = { type: 'stdout', time: new Date(), message: log };
        clientInfo.logs.push(logEntry);
        // 限制日志数量
        if (clientInfo.logs.length > 500) {
          clientInfo.logs.shift();
        }
        // 发射日志事件
        this.emit('client-log', { clientId, log: logEntry });
      });

      clientProcess.stderr.on('data', (data) => {
        const log = data.toString().trim();
        const logEntry = { type: 'stderr', time: new Date(), message: log };
        clientInfo.logs.push(logEntry);
        if (clientInfo.logs.length > 500) {
          clientInfo.logs.shift();
        }
        // 发射日志事件
        this.emit('client-log', { clientId, log: logEntry });
      });

      // 处理进程退出
      clientProcess.on('close', (code) => {
        clientInfo.logs.push({
          type: 'info',
          time: new Date(),
          message: `客户端退出，代码: ${code}`
        });
        this.runningClients.delete(clientId);
      });

      clientProcess.on('error', (error) => {
        clientInfo.logs.push({
          type: 'error',
          time: new Date(),
          message: `进程错误: ${error.message}`
        });
      });

      this.runningClients.set(clientId, clientInfo);

      return { success: true, message: '客户端启动中...' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止客户端
   */
  stopClient(clientId) {
    const clientInfo = this.runningClients.get(clientId);
    if (!clientInfo) {
      return { success: false, error: '客户端未运行' };
    }

    try {
      // Windows 下使用 taskkill 强制结束进程树
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', clientInfo.process.pid.toString(), '/T', '/F'], {
          shell: true
        });
      } else {
        clientInfo.process.kill();
      }

      this.runningClients.delete(clientId);
      return { success: true, message: '客户端已停止' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 停止所有客户端
   */
  stopAllClients() {
    for (const clientId of this.runningClients.keys()) {
      this.stopClient(clientId);
    }
  }

  /**
   * 获取客户端状态
   */
  getClientStatus(clientId) {
    const clientInfo = this.runningClients.get(clientId);
    if (!clientInfo) {
      return { status: 'stopped', uptime: 0, logCount: 0 };
    }

    const uptime = Date.now() - clientInfo.startTime.getTime();
    return {
      status: 'running',
      uptime: uptime,
      pid: clientInfo.process.pid,
      logCount: clientInfo.logs.length
    };
  }

  /**
   * 获取客户端日志
   */
  getClientLogs(clientId) {
    const clientInfo = this.runningClients.get(clientId);
    if (!clientInfo) {
      return [];
    }
    return clientInfo.logs;
  }

  /**
   * 清空客户端日志
   */
  clearClientLogs(clientId) {
    const clientInfo = this.runningClients.get(clientId);
    if (!clientInfo) {
      return { success: false, error: '客户端未运行' };
    }
    clientInfo.logs = [];
    return { success: true, message: '日志已清空' };
  }
}

module.exports = ClientManager;
