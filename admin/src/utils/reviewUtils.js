import { Tag } from 'antd';

/**
 * 审核列表公共工具函数
 */

// 获取图片类型文本
export const getImageTypeText = (imageType) => {
  const typeMap = {
    'note': '笔记',
    'comment': '评论',
    'customer_resource': '客资'
  };
  return typeMap[imageType] || imageType;
};

// 获取状态标签
export const getStatusTag = (status, record) => {
  const statusMap = {
    'pending': { color: 'orange', text: '待审核' },
    'processing': { color: 'blue', text: '处理中' },
    'ai_approved': { color: 'cyan', text: '待人工复审' },
    'mentor_approved': { color: 'green', text: '带教通过' },
    'manager_approved': { color: 'green', text: '审核通过' },
    'manager_rejected': { color: 'orange', text: '主管驳回重审' },
    'finance_processing': { color: 'cyan', text: '财务处理中' },
    'completed': { color: 'green', text: '已完成' },
    'approved': { color: 'green', text: '已通过' },
    'rejected': { color: 'red', text: '已拒绝' },
    'client_verification_pending': { color: 'blue', text: '待客户端验证' },
    'client_verification_failed': { color: 'orange', text: '客户端验证失败' }
  };

  const statusInfo = statusMap[status] || { color: 'default', text: status };
  return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
};

// 获取设备状态文本
export const getDeviceStatusText = (status) => {
  const statusMap = {
    'pending': '待审核',
    'approved': '已通过',
    'rejected': '已拒绝',
    'active': '使用中',
    'locked': '已锁定'
  };
  return statusMap[status] || status;
};

// 获取设备影响力文本
export const getDeviceInfluenceText = (influence) => {
  const influenceMap = {
    'low': '低影响力',
    'medium': '中影响力',
    'high': '高影响力'
  };
  return influenceMap[influence] || influence || '未知';
};

// 渲染设备信息 - 显示用户提交的小红书作者昵称
export const renderDeviceInfo = (deviceInfo, record) => {
  // 优先显示用户提交时填写的小红书作者昵称
  if (record.userNoteInfo && record.userNoteInfo.author) {
    return (
      <div>
        <div>{record.userNoteInfo.author}</div>
        {deviceInfo && (
          <div style={{ fontSize: '12px', color: '#666' }}>
            {getDeviceStatusText(deviceInfo.status)} | {getDeviceInfluenceText(deviceInfo.influence)}
          </div>
        )}
      </div>
    );
  }

  // 如果没有填写作者昵称，显示设备账号名
  if (deviceInfo) {
    return (
      <div>
        <div>{deviceInfo.accountName}</div>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {getDeviceStatusText(deviceInfo.status)} | {getDeviceInfluenceText(deviceInfo.influence)}
        </div>
      </div>
    );
  }

  return <span style={{ color: '#999' }}>未关联设备</span>;
};

// 渲染带教老师
export const renderMentorReviewer = (mentorReview) => {
  if (!mentorReview || !mentorReview.reviewer) return '--';
  return mentorReview.reviewer.nickname || mentorReview.reviewer.username;
};

// 渲染笔记作者（仅笔记和评论）
export const renderNoteAuthor = (userNoteInfo, record) => {
  if (record.imageType !== 'note' && record.imageType !== 'comment') {
    return '--';
  }

  if (!userNoteInfo || !userNoteInfo.author) {
    return <span style={{ color: '#999' }}>未填写</span>;
  }

  return (
    <span
      style={{
        maxWidth: '120px',
        display: 'inline-block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
      title={userNoteInfo.author}
    >
      {userNoteInfo.author}
    </span>
  );
};

// 渲染笔记标题（仅笔记）
export const renderNoteTitle = (userNoteInfo, record) => {
  if (record.imageType !== 'note') {
    return '--';
  }

  if (!userNoteInfo || !userNoteInfo.title) {
    return <span style={{ color: '#999' }}>未填写</span>;
  }

  return (
    <div
      style={{
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
      title={userNoteInfo.title}
    >
      {userNoteInfo.title}
    </div>
  );
};

// 渲染评论内容（仅评论）
export const renderCommentContent = (userNoteInfo, record) => {
  if (record.imageType !== 'comment') {
    return '--';
  }

  if (!userNoteInfo || !userNoteInfo.comment) {
    return <span style={{ color: '#999' }}>未填写</span>;
  }

  return (
    <div
      style={{
        maxWidth: '200px',
        wordBreak: 'break-word',
        lineHeight: '1.4'
      }}
      title={userNoteInfo.comment}
    >
      {userNoteInfo.comment}
    </div>
  );
};

// 渲染客资信息（仅客资）
export const renderCustomerInfo = (userNoteInfo, record) => {
  if (record.imageType !== 'customer_resource') {
    return '--';
  }

  const customerInfo = [];
  if (userNoteInfo?.customerPhone) {
    customerInfo.push(`📞${userNoteInfo.customerPhone}`);
  }
  if (userNoteInfo?.customerWechat) {
    customerInfo.push(`💬${userNoteInfo.customerWechat}`);
  }

  if (customerInfo.length === 0) {
    return <span style={{ color: '#999' }}>未填写</span>;
  }

  return (
    <div
      style={{
        maxWidth: '200px',
        wordBreak: 'break-word',
        lineHeight: '1.4'
      }}
      title={customerInfo.join(' ')}
    >
      <div style={{
        fontSize: '12px',
        color: '#fa8c16',
        fontWeight: '500'
      }}>
        {customerInfo.join(' ')}
      </div>
    </div>
  );
};

// 渲染小红书链接（仅笔记和评论）
export const renderNoteUrl = (noteUrl, record) => {
  if (record.imageType !== 'note' && record.imageType !== 'comment') {
    return '--';
  }

  if (!noteUrl) {
    return <span style={{ color: '#999' }}>未填写</span>;
  }

  return (
    <a
      href={noteUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: '#1890ff',
        textDecoration: 'none',
        maxWidth: '200px',
        display: 'inline-block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}
      title={noteUrl}
      onClick={(e) => e.stopPropagation()}
    >
      查看链接
    </a>
  );
};
