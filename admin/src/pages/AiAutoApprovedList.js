import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Image,
  message,
  Card,
  Space,
  Timeline,
  Alert,
  Carousel,
  Input,
  Select
} from 'antd';

import { EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const AiAutoApprovedList = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const { user } = useAuth();

  // 搜索和筛选状态
  const [filters, setFilters] = useState({
    status: undefined,
    userId: undefined,
    keyword: '',
    noteId: '',
    reviewer: undefined,
    deviceName: ''
  });

  useEffect(() => {
    fetchReviews();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      // 添加筛选条件
      if (filters.status) params.status = filters.status;
      if (filters.userId) params.userId = filters.userId;
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.noteId) params.noteId = filters.noteId;
      if (filters.reviewer) params.reviewer = filters.reviewer;
      if (filters.deviceName) params.deviceName = filters.deviceName;

      const response = await axios.get('/reviews/ai-auto-approved', { params });

      setReviews(response.data.reviews);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total
      }));
    } catch (error) {
      message.error('获取AI自动审核记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索和筛选
  const handleSearch = (values) => {
    setFilters({
      status: values.status,
      userId: values.userId,
      keyword: values.keyword,
      noteId: values.noteId || '',
      reviewer: values.reviewer,
      deviceName: values.deviceName
    });
    setPagination(prev => ({ ...prev, current: 1 })); // 重置到第一页
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      status: undefined,
      userId: undefined,
      keyword: '',
      noteId: '',
      reviewer: undefined,
      deviceName: ''
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'orange',
      ai_approved: 'cyan',
      manager_rejected: 'orange',
      manager_approved: 'green',
      finance_processing: 'cyan',
      completed: 'green',
      rejected: 'red'
    };
    return colors[status] || 'default';
  };

  const getDeviceStatusText = (status) => {
    const texts = {
      online: '在线',
      offline: '离线',
      protected: '保护',
      frozen: '冻结'
    };
    return texts[status] || status;
  };

  const getDeviceInfluenceText = (influence) => {
    const texts = {
      new: '新号',
      old: '老号',
      real_name: '实名',
      opened_shop: '开店'
    };
    return texts[influence] || influence;
  };

  const getStatusText = (status) => {
    const texts = {
      pending: '待审核',
      ai_approved: '待人工复审',
      manager_rejected: '主管驳回重审',
      manager_approved: '审核通过',
      finance_processing: '财务处理中',
      completed: '已完成',
      rejected: '已拒绝'
    };
    return texts[status] || status;
  };


  const getActionColor = (action) => {
    const colors = {
      submit: '#1890ff',
      mentor_pass: '#52c41a',
      mentor_reject: '#ff4d4f',
      manager_approve: '#52c41a',
      manager_reject: '#ff4d4f',
      finance_process: '#fa8c16',
      ai_auto_approved: '#722ed1'
    };
    return colors[action] || '#d9d9d9';
  };

  const getActionText = (action) => {
    const texts = {
      submit: '提交审核',
      mentor_pass: '带教老师通过',
      mentor_reject: '带教老师驳回',
      manager_approve: '主管确认',
      manager_reject: '主管驳回',
      finance_process: '财务处理',
      ai_auto_approved: 'AI自动审核通过'
    };
    return texts[action] || action;
  };

  const getTimelineColor = (action) => {
    const colors = {
      submit: 'blue',
      mentor_pass: 'green',
      mentor_reject: 'red',
      manager_approve: 'green',
      manager_reject: 'red',
      finance_process: 'orange',
      ai_auto_approved: 'purple'
    };
    return colors[action] || 'gray';
  };

  const getMatchColor = (matchPercentage) => {
    if (matchPercentage >= 80) return '#52c41a'; // 绿色 - 高匹配
    if (matchPercentage >= 60) return '#fa8c16'; // 橙色 - 中等匹配
    return '#ff4d4f'; // 红色 - 低匹配
  };

  const getStatusTag = (status, record) => {
    const statusConfig = {
      pending: { color: 'gold', text: record?.managerApproval ? '主管驳回重审' : '待审核' },
      processing: { color: 'blue', text: '处理中' },
      ai_approved: { color: 'cyan', text: '待人工复审' },
      mentor_approved: { color: 'green', text: '带教通过' },
      manager_rejected: { color: 'orange', text: '主管驳回重审' },
      manager_approved: { color: 'green', text: '审核通过' },
      finance_processing: { color: 'cyan', text: '财务处理中' },
      completed: { color: 'green', text: '已完成' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' },
      client_verification_pending: { color: 'blue', text: '待客户端验证' },
      client_verification_failed: { color: 'orange', text: '客户端验证失败' }
    };

    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const handleViewHistory = (record) => {
    setCurrentReview(record);
    setHistoryModalVisible(true);
  };

  const getActionButtons = (record) => {
    const buttons = [];

    // 所有角色都可以查看详情
    buttons.push(
      <Button
        key="history"
        type="link"
        size="small"
        onClick={() => handleViewHistory(record)}
      >
        查看详情
      </Button>
    );

    return <div style={{ display: 'flex', gap: '8px' }}>{buttons}</div>;
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 80,
      render: (id) => {
        if (!id) return '-';
        // 显示ObjectId后6位，与笔记审核页面一致
        const shortId = typeof id === 'string' ? id.slice(-6) : (id.toString ? id.toString().slice(-6) : '-');
        return <span style={{ fontSize: '12px', color: '#999' }}>{shortId}</span>;
      }
    },
    {
      title: '昵称',
      dataIndex: ['userId', 'nickname'],
      key: 'nickname',
      render: (nickname, record) => nickname || record.userId?.username || '-'
    },
    {
      title: '图片',
      dataIndex: 'imageUrls',
      key: 'imageUrls',
      width: 120,
      render: (imageUrls, record) => {
        // 兼容旧数据格式和迁移后的数据
        let urls = [];

        if (imageUrls && Array.isArray(imageUrls)) {
          // 新格式：过滤掉null/undefined值
          urls = imageUrls.filter(url => url && typeof url === 'string' && url.trim());
        } else if (record.imageUrl && typeof record.imageUrl === 'string' && record.imageUrl.trim()) {
          // 旧格式：单图
          urls = [record.imageUrl];
        }

        if (!urls || urls.length === 0) {
          return <span style={{ color: '#999' }}>无图片</span>;
        }

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
            {urls.slice(0, 4).map((url, index) => (
              <Image
                key={index}
                width={25}
                height={25}
                src={url}
                alt={`图片${index + 1}`}
                style={{
                  objectFit: 'cover',
                  borderRadius: '2px',
                  border: '1px solid #d9d9d9'
                }}
                preview={{
                  src: url,
                  mask: `${index + 1}/${urls.length}`
                }}
                placeholder={
                  <div style={{
                    width: 25,
                    height: 25,
                    backgroundColor: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px'
                  }}>
                    加载中...
                  </div>
                }
              />
            ))}
            {urls.length > 4 && (
              <div style={{
                width: 25,
                height: 25,
                backgroundColor: '#f0f0f0',
                borderRadius: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: '#666',
                border: '1px solid #d9d9d9'
              }}>
                +{urls.length - 4}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: '小红书链接',
      dataIndex: 'noteUrl',
      key: 'noteUrl',
      width: 120,
      render: (noteUrl) => {
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
              maxWidth: '100px',
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
      }
    },
    {
      title: '上传昵称',
      dataIndex: 'userNoteInfo',
      key: 'uploadNickname',
      width: 120,
      render: (userNoteInfo) => {
        // 显示用户上传时填写的昵称（与笔记审核的设备信息一致）
        if (!userNoteInfo || !userNoteInfo.author) {
          return <span style={{ color: '#999' }}>-</span>;
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
      }
    },
    {
      title: '带教老师',
      dataIndex: 'mentorReview',
      key: 'mentorReviewer',
      render: (mentorReview) => {
        if (!mentorReview || !mentorReview.reviewer) return '--';
        return mentorReview.reviewer.nickname || mentorReview.reviewer.username;
      }
    },
    {
      title: '审核时间',
      dataIndex: 'auditHistory',
      key: 'aiAuditTime',
      render: (auditHistory) => {
        const aiAudit = auditHistory?.find(h => h.action === 'skip_server_audit');
        if (!aiAudit) return '--';
        const date = new Date(aiAudit.timestamp);
        return `${date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} ${date.toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Shanghai'
        })}`;
      }
    },
    {
      title: '生存天数',
      dataIndex: 'survivalDays',
      key: 'survivalDays',
      render: (survivalDays) => survivalDays || 1
    },
    {
      title: '总收益',
      dataIndex: 'totalEarnings',
      key: 'totalEarnings',
      render: (totalEarnings, record) => {
        // 计算总收益：初始收益 + 后续收益
        const initialPrice = Number(record.initialPrice) || 0;
        const additionalEarnings = Number(record.additionalEarnings) || 0;
        const total = initialPrice + additionalEarnings;
        return `${total}`;
      }
    },
    // {
    //   title: '上级佣金(积分)',
    //   dataIndex: 'parentCommission',
    //   key: 'parentCommission',
    //   render: (parentCommission) => {
    //     const commission = Number(parentCommission) || 0;
    //     return commission;
    //   }
    // },
    // {
    //   title: '二级佣金(积分)',
    //   dataIndex: 'grandParentCommission',
    //   key: 'grandParentCommission',
    //   render: (grandParentCommission) => {
    //     const commission = Number(grandParentCommission) || 0;
    //     return commission;
    //   }
    // },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record)
    },
    {
      title: '用户奖励(积分/天)',
      dataIndex: 'dailyReward',
      key: 'dailyReward',
      render: (dailyReward) => {
        const reward = Number(dailyReward) || 30;
        return reward;
      }
    },
    // {
    //   title: '上级佣金(积分/天)',
    //   dataIndex: 'parentCommission',
    //   key: 'parentCommission',
    //   render: (parentCommission) => {
    //     const commission = Number(parentCommission) || 0;
    //     return commission;
    //   }
    // },
    // {
    //   title: '二级佣金(积分/天)',
    //   dataIndex: 'grandParentCommission',
    //   key: 'grandParentCommission',
    //   render: (grandParentCommission) => {
    //     const commission = Number(grandParentCommission) || 0;
    //     return commission;
    //   }
    // },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => getActionButtons(record)
    }
  ];

  const getModalContent = () => {
    if (!currentReview) return null;

    // 兼容旧数据格式和迁移后的数据
    let imageUrls = [];
    if (currentReview.imageUrls && Array.isArray(currentReview.imageUrls)) {
      // 新格式：过滤掉null/undefined值
      imageUrls = currentReview.imageUrls.filter(url => url && typeof url === 'string' && url.trim());
    } else if (currentReview.imageUrl && typeof currentReview.imageUrl === 'string' && currentReview.imageUrl.trim()) {
      // 旧格式：单图
      imageUrls = [currentReview.imageUrl];
    }

    return (
      <div style={{ marginBottom: 16 }}>
        {imageUrls && imageUrls.length > 0 ? (
          <div style={{ marginBottom: 16 }}>
            <Carousel
              autoplay={false}
              dots={{ className: 'carousel-dots' }}
              style={{ maxWidth: 400, margin: '0 auto' }}
            >
              {imageUrls.map((url, index) => (
                <div key={index}>
                  <Image
                    width={350}
                    height={350}
                    src={url}
                    alt={`审核图片 ${index + 1}`}
                    style={{
                      objectFit: 'contain',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px'
                    }}
                    placeholder={
                      <div style={{
                        width: 350,
                        height: 350,
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px'
                      }}>
                        图片加载中...
                      </div>
                    }
                  />
                  <div style={{
                    textAlign: 'center',
                    marginTop: 8,
                    color: '#666',
                    fontSize: '14px'
                  }}>
                    {index + 1} / {imageUrls.length}
                  </div>
                </div>
              ))}
            </Carousel>
          </div>
        ) : (
          <div style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            color: '#999',
            marginBottom: 16
          }}>
            无图片数据
          </div>
        )}

        {/* 持续检查收益展示 */}
<div style={{ marginBottom: 16, padding: 16, backgroundColor: '#f0f8ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
  <h4 style={{ marginBottom: 12, color: '#1890ff' }}>
    💰 持续检查收益统计
  </h4>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {currentReview.noteUrl && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>笔记链接:</span>
        <a
          href={currentReview.noteUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 'bold', color: '#1890ff', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {currentReview.noteUrl}
        </a>
      </div>
    )}
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>生存天数:</span>
      <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{currentReview.survivalDays || 1} 天</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>每天奖励:</span>
      <span style={{ fontWeight: 'bold' }}>{(currentReview.dailyReward || 30)} 积分/天</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>初始收益:</span>
      <span style={{ fontWeight: 'bold' }}>{(currentReview.initialPrice || 0)} 积分</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>后续收益:</span>
      <span style={{ fontWeight: 'bold' }}>{(currentReview.additionalEarnings || 0)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #d9d9d9', paddingTop: 8 }}>
      <span>总收益:</span>
      <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#52c41a' }}>
        {((currentReview.initialPrice || 0) + (currentReview.additionalEarnings || 0))}
      </span>
    </div>
    {(currentReview.parentCommission > 0 || currentReview.grandParentCommission > 0) && (
      <>
        <div style={{ borderTop: '1px solid #d9d9d9', margin: '8px 0' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>上级佣金:</span>
          <span style={{ fontWeight: 'bold', color: '#fa8c16' }}>{(currentReview.parentCommission || 0)} 积分</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>二级佣金:</span>
          <span style={{ fontWeight: 'bold', color: '#fa8c16' }}>{(currentReview.grandParentCommission || 0)} 积分</span>
        </div>
      </>
    )}
  </div>
</div>
      </div>
    );
  };

  return (
    <div>
      <Card
        title="AI自动审核记录"
        extra={
          <Alert
            message="此页面显示所有通过AI自动审核的笔记记录"
            type="info"
            showIcon
            style={{ marginBottom: 0 }}
          />
        }
      >
        {/* 搜索和筛选区域 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '500' }}>状态:</span>
          <Select
            placeholder="选择状态"
            value={filters.status || undefined}
            onChange={(value) => {
              setFilters(prev => ({ ...prev, status: value }));
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="completed">已完成</Option>
            <Option value="finance_processing">财务处理中</Option>
            <Option value="manager_approved">审核通过</Option>
          </Select>

          <span style={{ fontWeight: '500' }}>ID:</span>
          <Input
            placeholder="笔记ID后6位"
            value={filters.noteId}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, noteId: e.target.value }));
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 120 }}
            allowClear
          />

          <span style={{ fontWeight: '500' }}>搜索:</span>
          <Input
            placeholder="提交用户昵称"
            value={filters.keyword}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, keyword: e.target.value }));
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 200 }}
            allowClear
          />

          <Button onClick={handleReset}>
            重置
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={reviews}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          onChange={(pagination) => {
            setPagination(pagination);
          }}
        />
      </Card>

      <Modal
        title="AI自动审核详情"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentReview && (
          <div>
            {/* 🔍 调试：打印前端收到的auditHistory */}
            {console.log('🔍 前端收到的AI审核记录auditHistory:', currentReview.auditHistory)}

            <div style={{ marginBottom: 16 }}>
              <p><strong>昵称:</strong> {currentReview.userId?.nickname || currentReview.userId?.username || '未知'}</p>
              <p><strong>上传昵称:</strong> {currentReview.deviceInfo?.accountName || '未分配'}</p>
              {currentReview.noteUrl && (
                <p><strong>小红书链接:</strong> <a href={currentReview.noteUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>{currentReview.noteUrl.length > 50 ? currentReview.noteUrl.substring(0, 50) + '...' : currentReview.noteUrl}</a></p>
              )}
              <p><strong>带教老师:</strong> {currentReview.mentorReview?.reviewer ? (currentReview.mentorReview.reviewer.nickname || currentReview.mentorReview.reviewer.username) : '未分配'}</p>
              <p><strong>当前状态:</strong> {getStatusText(currentReview.status)}</p>
            </div>

            {/* 图片显示区域 */}
            {(() => {
              // 兼容旧数据格式和迁移后的数据
              let imageUrls = [];

              if (currentReview.imageUrls && Array.isArray(currentReview.imageUrls)) {
                // 新格式：过滤掉null/undefined值
                imageUrls = currentReview.imageUrls.filter(url => url && typeof url === 'string' && url.trim());
              } else if (currentReview.imageUrl && typeof currentReview.imageUrl === 'string' && currentReview.imageUrl.trim()) {
                // 旧格式：单图
                imageUrls = [currentReview.imageUrl];
              }

              return imageUrls && imageUrls.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: '8px',
                    maxHeight: '300px',
                    overflow: 'auto',
                    padding: '8px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px'
                  }}>
                    {imageUrls.map((url, index) => (
                      <Image
                        key={index}
                        width={100}
                        height={100}
                        src={url}
                        alt={`审核图片 ${index + 1}`}
                        style={{ objectFit: 'cover', borderRadius: '4px' }}
                        preview={{
                          src: url,
                          mask: `${index + 1}/${imageUrls.length}`
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 16, color: '#999' }}>
                  无图片数据
                </div>
              );
            })()}

            {/* 用户填写信息 */}
            {currentReview.userNoteInfo && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 12, color: '#1890ff' }}>📝 用户填写信息</h4>
                <div style={{
                  backgroundColor: '#f9f9f9',
                  padding: '12px',
                  borderRadius: '4px',
                  border: '1px solid #e6e6e6'
                }}>
                  {currentReview.userNoteInfo.author && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>作者昵称:</strong> {currentReview.userNoteInfo.author}
                    </p>
                  )}
                  {currentReview.userNoteInfo.title && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>笔记标题:</strong> {currentReview.userNoteInfo.title}
                    </p>
                  )}
                  {currentReview.userNoteInfo.comment && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>评论内容:</strong> {currentReview.userNoteInfo.comment}
                    </p>
                  )}
                  {currentReview.userNoteInfo.customerPhone && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>客户电话:</strong> {currentReview.userNoteInfo.customerPhone}
                    </p>
                  )}
                  {currentReview.userNoteInfo.customerWechat && (
                    <p style={{ margin: '4px 0' }}>
                      <strong>客户微信:</strong> {currentReview.userNoteInfo.customerWechat}
                    </p>
                  )}
                  {!currentReview.userNoteInfo.author &&
                   !currentReview.userNoteInfo.title &&
                   !currentReview.userNoteInfo.comment &&
                   !currentReview.userNoteInfo.customerPhone &&
                   !currentReview.userNoteInfo.customerWechat && (
                    <p style={{ margin: '4px 0', color: '#999', fontStyle: 'italic' }}>
                      无填写信息
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <h4>审核历史时间线:</h4>
              <div style={{ maxHeight: '400px', overflow: 'auto', padding: '16px 0' }}>
                {currentReview.auditHistory && currentReview.auditHistory.length > 0 ? (
                  <Timeline mode="left">
                    {currentReview.auditHistory.map((history, index) => (
                      <Timeline.Item
                        key={index}
                        color={getTimelineColor(history.action)}
                        label={
                          <span style={{ fontSize: '12px', color: '#666' }}>
                            {new Date(history.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                          </span>
                        }
                      >
                        <div style={{ padding: '8px 0' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <strong style={{ color: '#1890ff' }}>{history.operatorName}</strong>
                            <span style={{
                              marginLeft: '8px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              backgroundColor: getActionColor(history.action),
                              color: 'white'
                            }}>
                              {getActionText(history.action)}
                            </span>
                          </div>
                          {history.comment && (
                            <div style={{
                              backgroundColor: '#f5f5f5',
                              padding: '8px 12px',
                              borderRadius: '4px',
                              color: '#333',
                              fontSize: '14px',
                              borderLeft: `3px solid ${getActionColor(history.action)}`
                            }}>
                              {history.comment}
                            </div>
                          )}
                        </div>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                ) : (
                  <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
                    暂无审核历史
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* 自定义轮播样式 */
const styles = `
.carousel-dots li {
  background: #d9d9d9 !important;
  width: 8px !important;
  height: 8px !important;
  border-radius: 50% !important;
  margin: 0 4px !important;
}

.carousel-dots li.slick-active {
  background: #1890ff !important;
}

.carousel-dots {
  bottom: -20px !important;
}
`;

// 动态添加样式
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default AiAutoApprovedList;