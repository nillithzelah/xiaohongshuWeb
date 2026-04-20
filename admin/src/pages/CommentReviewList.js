import React, { useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Image,
  message,
  Card,
  Space,
  Timeline,
  Alert,
  Popconfirm,
  Carousel
} from 'antd';
import {
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  CheckSquareOutlined,
  CloseSquareOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import useReviewList from '../hooks/useReviewList';
import {
  getStatusTag,
  renderDeviceInfo,
  renderMentorReviewer,
  renderNoteAuthor,
  renderCommentContent,
  renderNoteUrl
} from '../utils/reviewUtils';

const { Option } = Select;
const { TextArea } = Input;

const CommentReviewList = () => {
  const { user } = useAuth();
  const [reviewForm] = Form.useForm();

  // 审核历史辅助函数
  const getActionColor = (action) => {
    const colors = {
      submit: '#1890ff',
      mentor_pass: '#52c41a',
      mentor_reject: '#ff4d4f',
      manager_approve: '#52c41a',
      manager_reject: '#ff4d4f',
      finance_process: '#fa8c16',
      ai_auto_approved: '#52c41a',
      ai_auto_rejected: '#ff4d4f'
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
      ai_auto_approved: 'AI自动通过',
      ai_auto_rejected: 'AI自动驳回'
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
      ai_auto_approved: 'green',
      ai_auto_rejected: 'red'
    };
    return colors[action] || 'gray';
  };
  const [rejectForm] = Form.useForm();
  const [batchRejectForm] = Form.useForm();
  const [batchManagerRejectForm] = Form.useForm();
  const [searchForm] = Form.useForm();

  // 使用公共hook
  const {
    reviews,
    loading,
    pagination,
    filters,
    selectedRowKeys,
    currentReview,
    reviewModalVisible,
    rejectModalVisible,
    historyModalVisible,
    batchRejectModalVisible,
    batchManagerRejectModalVisible,
    fetchReviews,
    handleTableChange,
    handleSearch,
    handleResetSearch,
    openReviewModal,
    openRejectModal,
    openHistoryModal,
    closeModals,
    handleRowSelectChange,
    handleBatchApprove,
    openBatchRejectModal,
    openBatchManagerRejectModal,
    setSelectedRowKeys
  } = useReviewList('comment');

  // 提交审核
  const handleReviewSubmit = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/reviews/${currentReview._id}/review`,
        {
          action: 'approve',
          comment: values.comment
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success('审核通过成功');
      closeModals();
      fetchReviews(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('审核失败:', error);
      message.error(error.response?.data?.message || '审核失败');
    }
  };

  // 提交拒绝
  const handleRejectSubmit = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `/reviews/${currentReview._id}/review`,
        {
          action: 'reject',
          reason: values.reason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success('已拒绝');
      closeModals();
      fetchReviews(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('拒绝失败:', error);
      message.error(error.response?.data?.message || '拒绝失败');
    }
  };

  // 批量拒绝提交
  const handleBatchRejectSubmit = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'reviews/batch-reject',
        {
          reviewIds: selectedRowKeys,
          reason: values.reason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(`批量拒绝成功 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      closeModals();
      fetchReviews(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('批量拒绝失败:', error);
      message.error('批量拒绝失败');
    }
  };

  // 经理批量拒绝
  const handleBatchManagerRejectSubmit = async (values) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'reviews/batch-manager-reject',
        {
          reviewIds: selectedRowKeys,
          reason: values.reason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      message.success(`批量拒绝成功 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      closeModals();
      fetchReviews(pagination.current, pagination.pageSize);
    } catch (error) {
      console.error('批量拒绝失败:', error);
      message.error('批量拒绝失败');
    }
  };

  // 表格列定义 - 评论专用
  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 80,
      render: (id) => <span style={{ fontSize: '12px', color: '#999' }}>{id.slice(-6)}</span>
    },
    {
      title: '用户',
      dataIndex: ['userId'],
      key: 'userId',
      render: (userId) => userId?.nickname || userId?.username || '--'
    },
    {
      title: '设备信息',
      dataIndex: 'deviceInfo',
      key: 'deviceInfo',
      render: renderDeviceInfo
    },
    {
      title: '评论内容',
      dataIndex: 'userNoteInfo',
      key: 'commentContent',
      render: renderCommentContent
    },
    {
      title: '小红书链接',
      dataIndex: 'noteUrl',
      key: 'noteUrl',
      render: renderNoteUrl
    },
    {
      title: '带教老师',
      dataIndex: 'mentorReview',
      key: 'mentorReviewer',
      render: renderMentorReviewer
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record)
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        // 不需要操作按钮的状态
        const noActionStatuses = ['manager_approved', 'finance_processing', 'completed'];
        const needsAction = !noActionStatuses.includes(record.status);

        // 只有老板、主管和带教老师可以操作
        const canOperate = needsAction && ['boss', 'manager', 'mentor'].includes(user?.role);

        return (
          <Space size="small">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => openReviewModal(record)}
            >
              查看
            </Button>
            {canOperate && (
              <>
                <Popconfirm
                  title="确认通过这条评论审核？"
                  onConfirm={async () => {
                    try {
                      const token = localStorage.getItem('token');
                      await axios.post(
                        `/reviews/${record._id}/review`,
                        {
                          action: 'approve',
                          comment: `[${user?.role === 'boss' ? '老板' : user?.role === 'mentor' ? '带教老师' : '主管'}操作] 审核通过`
                        },
                        { headers: { Authorization: `Bearer ${token}` } }
                      );
                      message.success('审核通过成功');
                      fetchReviews(pagination.current, pagination.pageSize);
                    } catch (error) {
                      console.error('审核失败:', error);
                      message.error(error.response?.data?.message || '审核失败');
                    }
                  }}
                >
                  <Button type="link" icon={<CheckOutlined />} style={{ color: 'green' }}>
                    通过
                  </Button>
                </Popconfirm>
                <Button
                  type="link"
                  icon={<CloseOutlined />}
                  onClick={() => openRejectModal(record)}
                  style={{ color: 'red' }}
                >
                  拒绝
                </Button>
              </>
            )}
            <Button
              type="link"
              onClick={() => openHistoryModal(record)}
            >
              历史
            </Button>
          </Space>
        );
      }
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: handleRowSelectChange
  };

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Form
          form={searchForm}
          layout="inline"
          onFinish={handleSearch}
        >
          <Form.Item name="status" label="状态">
            <Select placeholder="选择状态" style={{ width: 120 }} allowClear>
              <Option value="pending">待审核</Option>
              <Option value="ai_approved">待人工复审</Option>
              <Option value="manager_approved">审核通过</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Form.Item>
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="搜索用户、设备" style={{ width: 150 }} />
          </Form.Item>
          <Form.Item name="deviceName" label="设备名称">
            <Input placeholder="设备账号" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">搜索</Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={handleResetSearch}>重置</Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 16 }}>
          <Space>
            {['boss', 'manager'].includes(user?.role) && (
              <>
                <Button
                  type="primary"
                  icon={<CheckSquareOutlined />}
                  disabled={selectedRowKeys.length === 0}
                  onClick={handleBatchApprove}
                >
                  批量通过
                </Button>
                <Button
                  icon={<CloseSquareOutlined />}
                  disabled={selectedRowKeys.length === 0}
                  onClick={openBatchRejectModal}
                >
                  批量拒绝
                </Button>
              </>
            )}
            {user?.role === 'manager' && (
              <Button
                danger
                icon={<CloseSquareOutlined />}
                disabled={selectedRowKeys.length === 0}
                onClick={openBatchManagerRejectModal}
              >
                经理批量拒绝
              </Button>
            )}
            <span style={{ color: '#999' }}>
              已选择 {selectedRowKeys.length} 项
            </span>
          </Space>
        </div>
      </div>

      <Table
        rowKey="_id"
        columns={columns}
        dataSource={reviews}
        loading={loading}
        pagination={pagination}
        rowSelection={rowSelection}
        onChange={handleTableChange}
        scroll={{ x: 1500 }}
      />

      {/* 查看详情Modal */}
      <Modal
        title="评论详情"
        open={reviewModalVisible}
        onCancel={closeModals}
        footer={null}
        width={800}
      >
        {currentReview && (
          <div>
            <Alert
              message={`当前状态: ${getStatusTag(currentReview.status, currentReview).props.children}`}
              type="info"
              style={{ marginBottom: 16 }}
            />
            <p><strong>用户：</strong>{currentReview.userId?.nickname || currentReview.userId?.username}</p>
            <p><strong>评论作者：</strong>{currentReview.userNoteInfo?.author || '未填写'}</p>
            <p><strong>评论内容：</strong>{currentReview.userNoteInfo?.comment || '未填写'}</p>
            <p><strong>小红书链接：</strong>
              {currentReview.noteUrl ? (
                <a href={currentReview.noteUrl} target="_blank" rel="noopener noreferrer">
                  {currentReview.noteUrl}
                </a>
              ) : '未填写'}
            </p>

            {/* AI评论审核结果 */}
            {currentReview.verification?.commentAudit && (
              <>
                <p><strong>AI评论审核：</strong>
                  <Tag color={currentReview.verification.commentAudit.isSpam ? 'green' : 'red'}>
                    {currentReview.verification.commentAudit.isSpam ? '引流评论' : '正常评论'}
                  </Tag>
                </p>
                <p><strong>分类：</strong>{currentReview.verification.commentAudit.category}</p>
                <p><strong>AI理由：</strong>{currentReview.verification.commentAudit.reason}</p>
                {currentReview.verification.commentAudit.confidence && (
                  <p><strong>置信度：</strong>{(currentReview.verification.commentAudit.confidence * 100).toFixed(0)}%</p>
                )}
              </>
            )}

            {/* 笔记内容审核结果 */}
            {currentReview.verification?.contentAudit && (
              <>
                <p><strong>笔记内容审核：</strong>
                  <Tag color={currentReview.verification.contentAudit.passed ? 'green' : 'red'}>
                    {currentReview.verification.contentAudit.passed ? '通过' : '未通过'}
                  </Tag>
                </p>
                {currentReview.verification.contentAudit.keywordReason && (
                  <p><strong>关键词：</strong>{currentReview.verification.contentAudit.keywordReason}</p>
                )}
                {currentReview.verification.contentAudit.aiReason && (
                  <p><strong>AI理由：</strong>{currentReview.verification.contentAudit.aiReason}</p>
                )}
              </>
            )}

            <p><strong>图片：</strong></p>
            <Carousel autoplay dots={{ className: 'custom-dots' }}>
              {currentReview.images?.map((img, idx) => (
                <div key={idx}>
                  <Image src={img.url} width="100%" style={{ maxHeight: 400 }} />
                </div>
              ))}
            </Carousel>
          </div>
        )}
      </Modal>

      {/* 拒绝Modal */}
      <Modal
        title="拒绝审核"
        open={rejectModalVisible}
        onCancel={closeModals}
        onOk={() => rejectForm.submit()}
      >
        <Form form={rejectForm} onFinish={handleRejectSubmit}>
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="请输入拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 审核历史Modal */}
      <Modal
        title="审核历史"
        open={historyModalVisible}
        onCancel={closeModals}
        footer={null}
        width={800}
      >
        {currentReview?.auditHistory && currentReview.auditHistory.length > 0 ? (
          <Timeline mode="left">
            {currentReview.auditHistory.map((history, idx) => (
              <Timeline.Item
                key={idx}
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
          <p style={{ textAlign: 'center', color: '#999', padding: '40px' }}>暂无审核历史</p>
        )}
      </Modal>

      {/* 批量拒绝Modal */}
      <Modal
        title="批量拒绝"
        open={batchRejectModalVisible}
        onCancel={closeModals}
        onOk={() => batchRejectForm.submit()}
      >
        <p>确定要拒绝选中的 {selectedRowKeys.length} 条记录吗？</p>
        <Form form={batchRejectForm} onFinish={handleBatchRejectSubmit}>
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="请输入拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 经理批量拒绝Modal */}
      <Modal
        title="经理批量拒绝"
        open={batchManagerRejectModalVisible}
        onCancel={closeModals}
        onOk={() => batchManagerRejectForm.submit()}
      >
        <p>确定要拒绝选中的 {selectedRowKeys.length} 条记录吗？</p>
        <Form form={batchManagerRejectForm} onFinish={handleBatchManagerRejectSubmit}>
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="请输入拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default CommentReviewList;
