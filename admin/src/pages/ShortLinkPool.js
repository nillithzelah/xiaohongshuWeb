import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  Select,
  message,
  Statistic,
  Row,
  Col,
  Input,
  Tooltip,
  Modal
} from 'antd';
import {
  ReloadOutlined,
  LinkOutlined,
  CopyOutlined,
  DeleteOutlined,
  RedoOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const ShortLinkPool = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [shortLinks, setShortLinks] = useState([]);
  const [stats, setStats] = useState({
    pending: 0,
    processing: 0,
    approved: 0,
    rejected: 0,
    failed: 0
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 删除确认模态框
  const [deleteModal, setDeleteModal] = useState({
    visible: false,
    id: null,
    shortUrl: ''
  });

  // 筛选条件
  const [filters, setFilters] = useState({
    status: ''
  });

  // 获取统计数据
  const fetchStats = async () => {
    try {
      const response = await axios.get('/short-link-pool/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  // 获取短链接列表
  const fetchShortLinks = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = {
        skip: (page - 1) * pageSize,
        limit: pageSize
      };

      if (filters.status) {
        params.status = filters.status;
      }

      const response = await axios.get('/short-link-pool/list', { params });
      if (response.data.success) {
        setShortLinks(response.data.data.shortLinks);
        setPagination({
          current: page,
          pageSize,
          total: response.data.data.pagination.total
        });
      }
    } catch (error) {
      console.error('获取短链接列表失败:', error);
      message.error('获取短链接列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchShortLinks(1, pagination.pageSize);
  }, [filters]);

  // 复制到剪贴板
  const handleCopyUrl = async (url, type = '链接') => {
    try {
      await navigator.clipboard.writeText(url);
      message.success(`${type}已复制到剪贴板`);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success(`${type}已复制到剪贴板`);
    }
  };

  // 重新处理失败的短链接
  const handleRetry = async (id) => {
    try {
      const response = await axios.post(`/short-link-pool/${id}/retry`);
      if (response.data.success) {
        message.success('已重新加入处理队列');
        fetchShortLinks(pagination.current, pagination.pageSize);
        fetchStats();
      } else {
        message.error(response.data.message || '操作失败');
      }
    } catch (error) {
      console.error('重新处理失败:', error);
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  // 删除短链接
  const handleDelete = async () => {
    try {
      const response = await axios.delete(`/short-link-pool/${deleteModal.id}`);
      if (response.data.success) {
        message.success('删除成功');
        setDeleteModal({ visible: false, id: null, shortUrl: '' });
        fetchShortLinks(pagination.current, pagination.pageSize);
        fetchStats();
      } else {
        message.error(response.data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  // 状态映射
  const statusMap = {
    pending: { text: '待处理', color: 'orange' },
    processing: { text: '处理中', color: 'blue' },
    approved: { text: '已通过', color: 'green' },
    rejected: { text: '已拒绝', color: 'red' },
    failed: { text: '处理失败', color: 'volcano' }
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 80,
      render: (id) => <span style={{ fontSize: '12px', color: '#999' }}>{id?.slice(-6) || '--'}</span>
    },
    {
      title: '短链接',
      dataIndex: 'shortUrl',
      key: 'shortUrl',
      width: 250,
      ellipsis: true,
      render: (shortUrl) => (
        <Tooltip title={shortUrl}>
          <span style={{ cursor: 'pointer' }} onClick={() => handleCopyUrl(shortUrl, '短链接')}>
            {shortUrl ? (shortUrl.length > 35 ? shortUrl.substring(0, 35) + '...' : shortUrl) : '--'}
          </span>
        </Tooltip>
      )
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (source) => <Tag color="cyan">{source || 'external'}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const config = statusMap[status] || { text: status || '未知', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '审核结果',
      key: 'auditResult',
      width: 150,
      render: (_, record) => {
        if (!record.auditResult) return '--';
        const isGenuine = record.auditResult.is_genuine_victim_post;
        const confidence = record.auditResult.confidence_score;
        return (
          <Space>
            <Tag color={isGenuine ? 'green' : 'red'}>
              {isGenuine ? '通过' : '未通过'}
            </Tag>
            {confidence !== undefined && (
              <span style={{ fontSize: '12px', color: '#999' }}>{Math.round(confidence * 100)}%</span>
            )}
          </Space>
        );
      }
    },
    {
      title: '笔记标题',
      dataIndex: ['auditResult', 'title'],
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (title) => title || '未提取'
    },
    {
      title: '作者',
      dataIndex: ['auditResult', 'author'],
      key: 'author',
      width: 120,
      ellipsis: true,
      render: (author) => author || '未提取'
    },
    {
      title: '关联笔记ID',
      dataIndex: 'noteId',
      key: 'noteId',
      width: 120,
      render: (noteId) => noteId ? (
        <Tooltip title={noteId}>
          <span style={{ fontSize: '12px', color: '#999' }}>{noteId.slice(-8)}...</span>
        </Tooltip>
      ) : '--'
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      key: 'errorMessage',
      width: 200,
      ellipsis: true,
      render: (msg) => msg ? (
        <Tooltip title={msg}>
          <span style={{ color: '#ff4d4f' }}>{msg.length > 25 ? msg.substring(0, 25) + '...' : msg}</span>
        </Tooltip>
      ) : '--'
    },
    {
      title: '重试次数',
      dataIndex: 'retryCount',
      key: 'retryCount',
      width: 90,
      render: (count) => (
        <Tag color={count > 3 ? 'red' : 'default'}>{count || 0} 次</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '--'
    },
    {
      title: '处理时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '--'
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const shortUrl = record.shortUrl;
        const noteId = record.noteId;
        let displayUrl = shortUrl;
        if (noteId && !shortUrl) {
          displayUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
        }

        return (
          <Space size="small">
            {displayUrl && (
              <Tooltip title={displayUrl}>
                <Button
                  type="link"
                  icon={<LinkOutlined />}
                  onClick={() => window.open(displayUrl, '_blank')}
                  style={{ padding: 0 }}
                >
                  打开
                </Button>
              </Tooltip>
            )}
            <Tooltip title={shortUrl}>
              <Button
                type="link"
                icon={<CopyOutlined />}
                onClick={() => handleCopyUrl(shortUrl, '短链接')}
                style={{ padding: 0 }}
              >
                复制
              </Button>
            </Tooltip>
            {(record.status === 'failed' || record.status === 'rejected') && (
              <Tooltip title="重新加入处理队列">
                <Button
                  type="link"
                  icon={<RedoOutlined />}
                  onClick={() => handleRetry(record._id)}
                  style={{ padding: 0 }}
                >
                  重试
                </Button>
              </Tooltip>
            )}
            <Tooltip title="删除记录">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setDeleteModal({ visible: true, id: record._id, shortUrl: record.shortUrl })}
                style={{ padding: 0 }}
              >
                删除
              </Button>
            </Tooltip>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="待处理"
              value={stats.pending}
              valueStyle={{ color: stats.pending > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="处理中"
              value={stats.processing}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已通过"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已拒绝"
              value={stats.rejected}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="处理失败"
              value={stats.failed}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="总计"
              value={stats.pending + stats.processing + stats.approved + stats.rejected + stats.failed}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* 筛选栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: 120 }}
            >
              <Option value="">全部状态</Option>
              <Option value="pending">待处理</Option>
              <Option value="processing">处理中</Option>
              <Option value="approved">已通过</Option>
              <Option value="rejected">已拒绝</Option>
              <Option value="failed">处理失败</Option>
            </Select>

            <Button icon={<ReloadOutlined />} onClick={() => {
              fetchShortLinks(pagination.current, pagination.pageSize);
              fetchStats();
            }}>
              刷新
            </Button>
          </Space>
        </div>

        <Table
          rowKey="_id"
          columns={columns}
          dataSource={shortLinks}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          onChange={(newPagination) => fetchShortLinks(newPagination.current, newPagination.pageSize)}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 删除确认模态框 */}
      <Modal
        title="确认删除"
        open={deleteModal.visible}
        onCancel={() => setDeleteModal({ visible: false, id: null, shortUrl: '' })}
        onOk={handleDelete}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除以下短链接记录吗？</p>
        <p style={{ color: '#ff4d4f', wordBreak: 'break-all' }}>{deleteModal.shortUrl}</p>
        <p style={{ color: '#999', fontSize: '12px' }}>此操作不可恢复</p>
      </Modal>
    </div>
  );
};

export default ShortLinkPool;
