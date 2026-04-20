import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Alert, Tooltip, Button, message, Modal, Input } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, SyncOutlined, DatabaseOutlined, ControlOutlined, WarningOutlined, StopOutlined, DownloadOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import axios from 'axios';
import './MonitoringPage.css';

const { TextArea } = Input;

const MonitoringPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(new Date());
  const [resumingClientId, setResumingClientId] = useState(null);
  const [remarkModalVisible, setRemarkModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [remarkValue, setRemarkValue] = useState('');

  useEffect(() => {
    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoringData = async () => {
    try {
      const response = await axios.get('/admin/monitoring');
      setData(response.data.data);
      setLastUpdateTime(new Date());
      setError(null);
    } catch (err) {
      console.error('获取监控数据失败:', err);
      setError('获取监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeClient = async (clientId) => {
    setResumingClientId(clientId);
    try {
      await axios.post(`/admin/clients/${encodeURIComponent(clientId)}/resume`);
      message.success('客户端已恢复');
      // 刷新数据
      fetchMonitoringData();
    } catch (err) {
      console.error('恢复客户端失败:', err);
      message.error(err.response?.data?.message || '恢复失败');
    } finally {
      setResumingClientId(null);
    }
  };

  const handleEditRemark = (record) => {
    setEditingClient(record);
    setRemarkValue(record.remark || '');
    setRemarkModalVisible(true);
  };

  const handleSaveRemark = async () => {
    try {
      await axios.put(`/admin/clients/${encodeURIComponent(editingClient.clientId)}/remark`, {
        remark: remarkValue
      });
      message.success('备注已更新');
      setRemarkModalVisible(false);
      // 刷新数据
      fetchMonitoringData();
    } catch (err) {
      console.error('更新备注失败:', err);
      message.error(err.response?.data?.message || '更新失败');
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    const date = new Date(timeStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    // 超过1天显示日期
    if (diff >= 86400) {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getClientStatus = (record) => {
    // 优先使用数据库中的 status 字段（客户端主动上报的状态）
    if (record.status === 'offline') {
      return { text: '离线', color: 'default' };
    }

    // 再检查心跳时间
    if (!record.lastHeartbeat) return { text: '未知', color: 'default' };
    const diff = Date.now() - new Date(record.lastHeartbeat).getTime();

    // 如果最近有心跳（5分钟内），说明客户端在运行，优先显示在线
    if (diff < 300000) return { text: '在线', color: 'success' };

    // 检查是否被暂停
    if (record.taskDistributionPaused) {
      return { text: '已暂停', color: 'error' };
    }

    // 检查最后成功上传时间（更准确反映客户端工作状态）
    if (record.lastSuccessUploadAt) {
      const uploadDiff = Date.now() - new Date(record.lastSuccessUploadAt).getTime();
      // 超过30分钟没有成功上传，标记为异常
      if (uploadDiff > 1800000) {
        return { text: '异常(无数据)', color: 'warning' };
      }
    }

    // 15分钟内活跃
    if (diff < 900000) return { text: '活跃', color: 'processing' };

    // 超过15分钟无心跳，显示离线
    return { text: '离线', color: 'default' };
  };

  const getHealthStatus = (record) => {
    if (record.taskDistributionPaused) {
      return {
        text: '已暂停',
        color: 'error',
        icon: <StopOutlined />
      };
    }
    if (record.consecutiveFailures >= 2) {  // 2次失败显示警告
      return {
        text: `警告(${record.consecutiveFailures}次失败)`,
        color: 'warning',
        icon: <WarningOutlined />
      };
    }
    return {
      text: '正常',
      color: 'success',
      icon: <CheckCircleOutlined />
    };
  };

  const clientColumns = [
    {
      title: '客户端ID',
      dataIndex: 'clientId',
      key: 'clientId',
      ellipsis: true,
      render: (text) => <code className="client-id">{text}</code>
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || <span style={{ color: '#999' }}>-</span>
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: text ? '#52c41a' : '#999' }}>
            {text || '无备注'}
          </span>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRemark(record)}
            style={{ padding: '0 4px' }}
          >
            编辑
          </Button>
        </div>
      )
    },
    {
      title: '类型',
      dataIndex: 'clientType',
      key: 'clientType',
      width: 100,
      render: (type) => {
        const typeMap = {
          'audit': { text: '审核', color: 'blue' },
          'harvest': { text: '采集', color: 'green' },
          'discovery': { text: '发现', color: 'purple' },
          'short-link': { text: '短链接', color: 'orange' },
          'blacklist-scan': { text: '黑名单', color: 'volcano' },
          'note-delete': { text: '删除检查', color: 'magenta' },
          'note-management': { text: '笔记管理', color: 'magenta' },
          'deletion-check': { text: '删除检测', color: 'magenta' },
          'deletion-recheck': { text: '删除复查', color: 'red' }
        };
        const config = typeMap[type] || { text: type || '未知', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '在线状态',
      key: 'status',
      render: (_, record) => {
        const status = getClientStatus(record);
        return <Tag color={status.color}>{status.text}</Tag>;
      }
    },
    {
      title: '健康度',
      key: 'health',
      render: (_, record) => {
        const health = getHealthStatus(record);
        return (
          <Tooltip title={health.text === '已暂停' ? '任务分发已暂停，请联系管理员' : health.text}>
            <Tag color={health.color} icon={health.icon}>
              {health.text === '正常' ? '正常' : health.text}
            </Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '今日统计',
      key: 'todayStats',
      width: 140,
      render: (_, record) => {
        const type = record.clientType;
        if (type === 'discovery') {
          return record.todayNotesDiscovered > 0
            ? <span style={{ color: '#52c41a' }}>{record.todayNotesDiscovered} 笔记</span>
            : <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'harvest') {
          // 新版本：显示处理任务数；老版本：只显示线索数
          const processed = record.todayNotesProcessed || 0;
          const validLeads = record.todayValidLeads || 0;
          if (processed > 0) {
            // 新版本客户端
            return <span style={{ color: '#52c41a' }}>{processed} 任务{validLeads > 0 ? ` (${validLeads}线索)` : ''}</span>;
          } else if (validLeads > 0) {
            // 老版本客户端：只显示线索数
            return <span style={{ color: '#52c41a' }}>{validLeads} 线索</span>;
          }
          return <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'blacklist-scan') {
          return record.todayBlacklisted > 0
            ? <span style={{ color: '#52c41a' }}>{record.todayBlacklisted}/{record.todayCommentsScanned} 黑名单</span>
            : <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'audit') {
          return record.todayReviewsCompleted > 0
            ? <span style={{ color: '#52c41a' }}>{record.todayReviewsCompleted} 完成</span>
            : <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'deletion-recheck' || type === 'note-delete') {
          return record.todayReviewsCompleted > 0
            ? <span style={{ color: '#52c41a' }}>{record.todayReviewsCompleted} 复查</span>
            : <span style={{ color: '#999' }}>-</span>;
        }
        // 通用显示：使用 totalReviewsCompleted 作为今日任务数
        return record.todayReviewsCompleted > 0
          ? <span style={{ color: '#52c41a' }}>{record.todayReviewsCompleted} 任务</span>
          : <span style={{ color: '#999' }}>-</span>;
      }
    },
    {
      title: '累计统计',
      key: 'totalStats',
      width: 140,
      render: (_, record) => {
        const type = record.clientType;
        if (type === 'discovery') {
          return record.totalNotesDiscovered > 0
            ? <span>{record.totalNotesDiscovered} 笔记</span>
            : <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'harvest') {
          // 新版本：显示处理任务数；老版本：只显示线索数
          const processed = record.totalNotesProcessed || 0;
          const validLeads = record.totalValidLeads || 0;
          if (processed > 0) {
            // 新版本客户端
            return <span>{processed} 任务{validLeads > 0 ? ` (${validLeads}线索)` : ''}</span>;
          } else if (validLeads > 0) {
            // 老版本客户端：只显示线索数
            return <span>{validLeads} 线索</span>;
          }
          return <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'blacklist-scan') {
          return record.totalBlacklisted > 0
            ? <span>{record.totalBlacklisted}/{record.totalCommentsScanned} 黑名单</span>
            : <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'audit') {
          return record.totalReviewsCompleted > 0
            ? <span>{record.totalReviewsCompleted} 完成</span>
            : <span style={{ color: '#999' }}>-</span>;
        } else if (type === 'deletion-recheck' || type === 'note-delete') {
          return record.totalReviewsCompleted > 0
            ? <span>{record.totalReviewsCompleted} 复查</span>
            : <span style={{ color: '#999' }}>-</span>;
        }
        // 通用显示：使用 totalReviewsCompleted 作为累计任务数
        return record.totalReviewsCompleted > 0
          ? <span>{record.totalReviewsCompleted} 任务</span>
          : <span style={{ color: '#999' }}>-</span>;
      }
    },
    {
      title: '最后心跳',
      dataIndex: 'lastHeartbeat',
      key: 'lastHeartbeat',
      render: formatTime
    },
    {
      title: '最后提交',
      dataIndex: 'lastSuccessUploadAt',
      key: 'lastSuccessUploadAt',
      render: formatTime
    },
    {
      title: '初次时间',
      dataIndex: 'firstSeenAt',
      key: 'firstSeenAt',
      render: (_, record) => {
        const time = record.firstSeenAt || record.createdAt;
        if (!time) return '-';
        const date = new Date(time);
        return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => {
        // 只在非正常状态时显示恢复按钮
        const isAbnormal = record.taskDistributionPaused || record.consecutiveFailures >= 2;
        if (!isAbnormal) return null;

        return (
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            loading={resumingClientId === record.clientId}
            onClick={() => handleResumeClient(record.clientId)}
          >
            恢复
          </Button>
        );
      }
    }
  ];

  if (loading) {
    return (
      <div className="monitoring-page">
        <div className="loading-container">
          <Spin size="large" tip="加载监控数据..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitoring-page">
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={<button className="retry-btn" onClick={fetchMonitoringData}>重试</button>}
        />
      </div>
    );
  }

  return (
    <div className="monitoring-page">
      {/* 页面标题区 */}
      <div className="page-header">
        <div className="header-content">
          <ControlOutlined className="header-icon" />
          <div>
            <h1 className="page-title">系统监控中心</h1>
            <p className="page-subtitle">实时监控系统运行状态 · 每30秒自动刷新</p>
          </div>
        </div>
        <div className="header-meta">
          <Tag color="blue">数据实时</Tag>
          <span className="update-time">更新于 {lastUpdateTime.toLocaleTimeString('zh-CN')}</span>
          <a
            href="https://www.wubug.cc/downloads/"
            target="_blank"
            rel="noopener noreferrer"
            className="download-btn"
          >
            <DownloadOutlined /> 下载客户端
          </a>
        </div>
      </div>

      {/* 审核队列卡片 */}
      <Card
        title={<span className="card-title"><ClockCircleOutlined /> 审核队列</span>}
        className="stat-card audit-card"
        bordered={false}
      >
        <Row gutter={24}>
          <Col xs={12} sm={6}>
            <Statistic
              title="笔记待审核"
              value={data?.audit?.pendingNotes || 0}
              valueStyle={{ color: '#ff7875' }}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="评论待审核"
              value={data?.audit?.pendingComments || 0}
              valueStyle={{ color: '#ffa940' }}
              prefix={<DatabaseOutlined />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="正在审核"
              value={data?.audit?.inProgress || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<SyncOutlined spin />}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="今日已审"
              value={data?.audit?.todayCompleted || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* 采集任务卡片 */}
      <Card
        title={<span className="card-title"><DatabaseOutlined /> 采集任务</span>}
        className="stat-card harvest-card"
        bordered={false}
      >
        <Row gutter={24}>
          <Col xs={24} sm={8}>
            <Statistic
              title="待采集评论笔记"
              value={data?.harvest?.pendingHarvest || 0}
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Statistic
              title="今日采集笔记"
              value={data?.harvest?.todayNotes || 0}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Col>
          <Col xs={12} sm={8}>
            <Statistic
              title="今日采集评论"
              value={data?.harvest?.todayComments || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 客户端状态卡片 */}
      <Card
        title={<span className="card-title"><ControlOutlined /> 客户端状态</span>}
        className="stat-card client-card"
        bordered={false}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8}>
            <div className="client-summary">
              <div className="summary-item">
                <span className="summary-label">在线客户端</span>
                <span className="summary-value online">{data?.clients?.online || 0}</span>
                <span className="summary-unit">台</span>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8}>
            <div className="client-summary">
              <div className="summary-item">
                <span className="summary-label">暂停任务</span>
                <span className="summary-value paused">{data?.clients?.paused || 0}</span>
                <span className="summary-unit">台</span>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className="client-summary">
              <div className="summary-item">
                <span className="summary-label">警告状态</span>
                <span className="summary-value warning">
                  {(data?.clients?.list || []).filter(c => c.consecutiveFailures >= 2 && !c.taskDistributionPaused).length}
                </span>
                <span className="summary-unit">台</span>
              </div>
            </div>
          </Col>
        </Row>
        <Table
          columns={clientColumns}
          dataSource={(data?.clients?.list || [])}
          rowKey="clientId"
          size="small"
          pagination={false}
          locale={{ emptyText: '暂无在线客户端' }}
        />
      </Card>

      {/* 编辑备注弹窗 */}
      <Modal
        title="编辑客户端备注"
        open={remarkModalVisible}
        onOk={handleSaveRemark}
        onCancel={() => setRemarkModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#999', marginBottom: 8 }}>
            客户端ID: <code>{editingClient?.clientId}</code>
          </div>
          <TextArea
            rows={3}
            placeholder="请输入备注，例如：张三的电脑、客服部等"
            value={remarkValue}
            onChange={(e) => setRemarkValue(e.target.value)}
            maxLength={100}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
};

export default MonitoringPage;
