/**
 * 时间工具类 - 北京时间处理
 */
class TimeUtils {
  /**
   * 获取当前北京时间
   * @returns {Date} 北京时间对象
   */
  static getBeijingTime() {
    const now = new Date();
    // UTC时间加上8小时得到北京时间
    return new Date(now.getTime() + (8 * 60 * 60 * 1000));
  }

  /**
   * 将UTC时间转换为北京时间并格式化显示
   * @param {Date} date - UTC时间对象
   * @returns {string} 格式化的北京时间字符串
   */
  static formatBeijingTime(date) {
    if (!date) return '';

    // 直接使用toLocaleString的timeZone参数，不要手动加8小时
    return date.toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 将北京时间转换为UTC时间（用于存储到数据库）
   * @param {Date} beijingTime - 北京时间对象
   * @returns {Date} UTC时间对象
   */
  static beijingToUTC(beijingTime) {
    return new Date(beijingTime.getTime() - (8 * 60 * 60 * 1000));
  }

  /**
   * 获取当前本地时间（北京时间）
   * @returns {Date} 北京时间对象
   */
  static getLocalTime() {
    // 确保时区设置为北京时间
    if (process.env.TZ !== 'Asia/Shanghai') {
      process.env.TZ = 'Asia/Shanghai';
    }
    return new Date();
  }

  /**
   * 创建北京时间Date对象
   * @param {number} year - 年
   * @param {number} month - 月 (0-11)
   * @param {number} day - 日
   * @param {number} hour - 时
   * @param {number} minute - 分
   * @param {number} second - 秒
   * @returns {Date} 北京时间对象
   */
  static createBeijingTime(year, month, day, hour = 0, minute = 0, second = 0) {
    // 临时设置时区
    const originalTZ = process.env.TZ;
    process.env.TZ = 'Asia/Shanghai';

    const date = new Date(year, month, day, hour, minute, second);

    // 恢复原始时区
    process.env.TZ = originalTZ;

    return date;
  }

  /**
   * 解析北京时间字符串为Date对象
   * @param {string} beijingTimeStr - 北京时间字符串
   * @returns {Date} UTC时间对象
   */
  static parseBeijingTime(beijingTimeStr) {
    const beijingTime = new Date(beijingTimeStr);
    return this.beijingToUTC(beijingTime);
  }
}

module.exports = TimeUtils;