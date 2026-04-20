/**
 * 共享日志工具
 */
class Logger {
  constructor(clientType) {
    this.clientType = clientType;
  }

  /**
   * 格式化日志前缀
   */
  formatPrefix(level, tag) {
    const emoji = {
      'info': 'ℹ️',
      'success': '✅',
      'warn': '⚠️',
      'error': '❌',
      'debug': '🔍'
    };
    const prefix = tag ? `[${tag}]` : '';
    return `${emoji[level] || ''} ${this.clientType ? `[${this.clientType}]` : ''}${prefix}`;
  }

  info(message, tag) {
    console.log(`${this.formatPrefix('info', tag)} ${message}`);
  }

  success(message, tag) {
    console.log(`${this.formatPrefix('success', tag)} ${message}`);
  }

  warn(message, tag) {
    console.warn(`${this.formatPrefix('warn', tag)} ${message}`);
  }

  error(message, tag) {
    console.error(`${this.formatPrefix('error', tag)} ${message}`);
  }

  debug(message, tag) {
    console.log(`${this.formatPrefix('debug', tag)} ${message}`);
  }

  section(title) {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${this.clientType ? `[${this.clientType}]` : ''} ${title}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  separator() {
    console.log('');
  }
}

module.exports = Logger;
