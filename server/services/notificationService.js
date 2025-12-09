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
    console.log('发送用户通知:', notification.message);

    return notification;
  }

  // 发送带教老师通知（老板驳回等情况）
  async sendMentorNotification(review, action, operator, reason = '') {
    // 这里简化处理，实际项目中应该从数据库查询role为'mentor'的用户
    // 目前假设带教老师用户名为 'mentor' 或 'mentor_user'
    const mentorUsernames = ['mentor', 'mentor_user'];

    const typeMap = {
      login_qr: '登录二维码',
      note: '笔记',
      comment: '评论'
    };

    const imageTypeText = typeMap[review.imageType] || review.imageType;
    const userDisplayName = review.userId?.username || '用户';

    let message = '';
    if (action === 'boss_reject') {
      message = `老板${operator}驳回了${userDisplayName}的${imageTypeText}审核，原因：${reason}。请重新审核该任务。`;
    }

    for (const mentorUsername of mentorUsernames) {
      const notification = {
        id: Date.now().toString() + '_' + mentorUsername + '_' + review._id,
        type: 'mentor_action_required',
        userId: mentorUsername, // 使用带教老师用户名作为userId
        username: mentorUsername,
        reviewId: review._id,
        imageType: review.imageType,
        action,
        operator,
        reason,
        message,
        createdAt: new Date(),
        read: false
      };

      this.notifications.push(notification);
      console.log(`发送带教老师通知给 ${mentorUsername}:`, notification.message);
    }

    return true;
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
      mentor_review: '带教老师审核中',
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