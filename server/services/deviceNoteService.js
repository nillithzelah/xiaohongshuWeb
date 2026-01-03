const DeviceNoteHistory = require('../models/DeviceNoteHistory');

class DeviceNoteService {
  /**
   * 检查设备在过去7天内是否已经发布过笔记
   * @param {string} deviceId - 设备ID
   * @returns {Promise<{canSubmit: boolean, lastNoteDate: Date|null, message: string}>}
   */
  async checkDeviceNoteSubmission(deviceId) {
    try {
      // 计算7天前的日期
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 查找该设备在过去7天内的笔记发布记录
      const recentNote = await DeviceNoteHistory.findOne({
        deviceId: deviceId,
        createdAt: { $gte: sevenDaysAgo }
      }).sort({ createdAt: -1 });

      if (recentNote) {
        return {
          canSubmit: false,
          lastNoteDate: recentNote.createdAt,
          message: `该设备在${recentNote.createdAt.toLocaleString()}已经发布过笔记，7天内不能重复发布`
        };
      }

      return {
        canSubmit: true,
        lastNoteDate: null,
        message: '设备可以发布笔记'
      };
    } catch (error) {
      console.error('检查设备笔记发布记录失败:', error);
      return {
        canSubmit: true, // 出错时允许提交，避免影响正常功能
        lastNoteDate: null,
        message: '检查设备笔记发布记录时出错，允许提交'
      };
    }
  }

  /**
   * 记录设备笔记发布历史
   * @param {string} deviceId - 设备ID
   * @param {string} userId - 用户ID
   * @param {string} noteUrl - 笔记URL
   * @param {string} noteTitle - 笔记标题
   * @param {string} noteAuthor - 笔记作者
   * @param {string} imageReviewId - 图片审核ID
   * @returns {Promise<DeviceNoteHistory>}
   */
  async recordDeviceNoteSubmission(deviceId, userId, noteUrl, noteTitle, noteAuthor, imageReviewId) {
    try {
      const noteHistory = new DeviceNoteHistory({
        deviceId,
        userId,
        noteUrl,
        noteTitle,
        noteAuthor,
        imageReviewId
      });

      await noteHistory.save();
      return noteHistory;
    } catch (error) {
      console.error('记录设备笔记发布历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取设备的笔记发布历史
   * @param {string} deviceId - 设备ID
   * @param {number} limit - 限制数量
   * @returns {Promise<DeviceNoteHistory[]>}
   */
  async getDeviceNoteHistory(deviceId, limit = 10) {
    try {
      return await DeviceNoteHistory.find({
        deviceId: deviceId
      }).sort({ createdAt: -1 }).limit(limit);
    } catch (error) {
      console.error('获取设备笔记发布历史失败:', error);
      return [];
    }
  }
}

module.exports = new DeviceNoteService();