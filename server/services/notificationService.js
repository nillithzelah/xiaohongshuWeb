// 简单的通知服务，实际项目中可以使用邮件、短信、推送等
class NotificationService {
  constructor() {
    this.notifications = []; // 内存存储，实际项目中应该用数据库
  }

  // 发送审核状态变更通知
  async sendReviewStatusNotification(review, oldStatus, newStatus) {
    const notification = {
      id: Date.now().toString(),
      type: 'review_status_change',
      userId: review.userId._id || review.userId,
      username: review.userId.username || review.userId,
      reviewId: review._id,
      imageType: review.imageType,
      oldStatus,
      newStatus,
      message: this.getStatusChangeMessage(review, oldStatus, newStatus),
      createdAt: new Date(),
      read: false
    };

    this.notifications.push(notification);

    // 实际项目中这里应该发送邮件、短信等
    console.log('发送通知:', notification.message);

    return notification;
  }

  // 获取状态变更消息
  getStatusChangeMessage(review, oldStatus, newStatus) {
    const typeMap = {
      login_qr: '登录二维码',
      note: '笔记',
      comment: '评论'
    };

    const statusMap = {
      pending: '待审核',
      cs_review: '客服审核中',
      boss_approved: '老板确认中',
      finance_done: '财务处理中',
      completed: '已完成',
      rejected: '已拒绝'
    };

    const imageTypeText = typeMap[review.imageType] || review.imageType;

    if (newStatus === 'rejected') {
      return `您的${imageTypeText}审核未通过`;
    } else if (newStatus === 'completed') {
      return `您的${imageTypeText}审核已完成，打款处理中`;
    } else {
      return `您的${imageTypeText}状态已更新为：${statusMap[newStatus] || newStatus}`;
    }
  }

  // 获取用户通知
  getUserNotifications(userId, limit = 10) {
    return this.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  // 标记通知为已读
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
    }
  }

  // 获取未读通知数量
  getUnreadCount(userId) {
    return this.notifications.filter(n => n.userId === userId && !n.read).length;
  }
}

module.exports = new NotificationService();