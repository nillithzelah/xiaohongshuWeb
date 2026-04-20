import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Tag,
  Tabs,
  Statistic,
  Row,
  Col,
  Tooltip,
  Space
} from 'antd';
import {
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  UserOutlined,
  CommentOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { TabPane } = Tabs;

const HarvestQueueManagement = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingNotes, setPendingNotes] = useState([]);
  const [completedNotes, setCompletedNotes] = useState([]);
  const [pendingStats, setPendingStats] = useState({ total: 0, processing: 0, ready: 0 });
  const [completedStats, setCompletedStats] = useState({ total: 0, today: 0 });
  const [keyword, setKeyword] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // 优先级配置
  const [priorityConfig, setPriorityConfig] = useState({
    intervals: { 10: 10, 5: 60, 2: 360, 1: 1440 },
    labels: { 10: '10分钟', 5: '1小时', 2: '6小时', 1: '24小时' }
  });

  // 获取优先级配置
  useEffect(() => {
    const fetchPriorityConfig = async () => {
      try {
        const response = await axios.get('/client/system/config?key=harvest_priority_intervals');
        if (response.data.success && response.data.data.value) {
          const intervals = response.data.data.value;
          const labels = {};
          for (const [priority, minutes] of Object.entries(intervals)) {
            if (minutes < 60) {
              labels[priority] = `${minutes}分钟`;
            } else if (minutes < 1440) {
              labels[priority] = `${minutes / 60}小时`;
            } else {
              labels[priority] = `${minutes / 1440}天`;
            }
          }
          setPriorityConfig({ intervals, labels });
        }
      } catch (error) {
        console.error('获取优先级配置失败:', error);
      }
    };
    fetchPriorityConfig();
  }, []);

  // 获取数据
  const fetchData = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = {
        tab: activeTab,
        skip: (page - 1) * pageSize,
        limit: pageSize
      };
      if (keyword) {
        params.keyword = keyword;
      }

      const response = await axios.get('/client/discovery/harvest-queue', { params });
      if (response.data.success) {
        const { notes, pagination: pag, stats } = response.data.data;

        if (activeTab === 'pending') {
          setPendingNotes(notes);
          setPendingStats(stats);
        } else {
          setCompletedNotes(notes);
          setCompletedStats(stats);
        }

        setPagination({
          current: page,
          pageSize,
          total: pag.total
        });
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [activeTab, keyword]);

  // 格式化等待时间
  const formatWaitTime = (minutes) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h${mins}m`;
    }
    return `${minutes}m`;
  };

  // 待采集队列列定义
  const pendingColumns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 70,
      render: (id) => <span style={{ fontSize: '11px', color: '#999' }}>{id?.slice(-6) || '--'}</span>
    },
    {
      title: '笔记标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
      render: (title) => title || '未提取'
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 120,
      ellipsis: true,
      render: (author) => author || '未提取'
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 100,
      render: (keyword) => <Tag color="blue" style={{ fontSize: '11px' }}>{keyword || 'N/A'}</Tag>
    },
    {
      title: '优先级',
      key: 'harvestPriority',
      width: 100,
      render: (_, record) => {
        const priority = record.harvestPriority || 1;
        const colorMap = { 10: 'red', 5: 'orange', 2: 'gold', 1: 'green' };
        const emojiMap = { 10: '🔴', 5: '🟠', 2: '🟡', 1: '🟢' };
        const color = colorMap[priority] || 'green';
        const emoji = emojiMap[priority] || '🟢';
        const label = `${emoji} ${priority}分`;
        const interval = priorityConfig.labels[priority] || '未知';

        return (
          <Tooltip title={`采集间隔: ${interval}`}>
            <Tag color={color}>{label}</Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '队列状态',
      key: 'queueStatus',
      width: 120,
      render: (_, record) => {
        if (record.queueStatus === 'processing') {
          return (
            <Tooltip title={`处理中: ${record.processingClientId || '未知客户端'}`}>
              <Tag color="orange" icon={<ClockCircleOutlined />}>
                分发中
              </Tag>
            </Tooltip>
          );
        }
        if (record.queueStatus === 'waiting') {
          return (
            <Tag color="blue" icon={<ClockCircleOutlined />}>
              排队 {formatWaitTime(record.waitTime)}
            </Tag>
          );
        }
        return <Tag color="green" icon={<CheckCircleOutlined />}>可采集</Tag>;
      }
    },
    {
      title: '最后采集',
      dataIndex: 'commentsHarvestedAt',
      key: 'commentsHarvestedAt',
      width: 140,
      render: (time) => {
        if (!time) return <span style={{ color: '#999' }}>未采集</span>;
        const date = new Date(time);
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
        if (diffHours < 1) {
          return <span style={{ color: '#52c41a' }}>刚刚</span>;
        } else if (diffHours < 24) {
          return <span>{diffHours}小时前</span>;
        } else {
          const diffDays = Math.floor(diffHours / 24);
          return <span style={{ color: diffDays > 7 ? '#999' : '#faad14' }}>{diffDays}天前</span>;
        }
      }
    },
    {
      title: '评论数',
      dataIndex: 'lastCommentCount',
      key: 'lastCommentCount',
      width: 80,
      render: (count) => <span>{count || 0}</span>
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        let url = record.shortUrl || record.noteUrl;
        if (!url) {
          url = `https://www.xiaohongshu.com/explore/${record.noteId}`;
        }
        if (url && !url.startsWith('http')) {
          url = `https://www.xiaohongshu.com${url}`;
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(url, '_blank')}
          >
            打开
          </Button>
        );
      }
    }
  ];

  // 已完成任务列定义
  const completedColumns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 70,
      render: (id) => <span style={{ fontSize: '11px', color: '#999' }}>{id?.slice(-6) || '--'}</span>
    },
    {
      title: '笔记标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
      ellipsis: true,
      render: (title) => title || '未提取'
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 120,
      ellipsis: true,
      render: (author) => author || '未提取'
    },
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 100,
      render: (keyword) => <Tag color="blue" style={{ fontSize: '11px' }}>{keyword || 'N/A'}</Tag>
    },
    {
      title: '处理时间',
      dataIndex: 'processedAt',
      key: 'processedAt',
      width: 140,
      render: (time) => {
        if (!time) return '--';
        const date = new Date(time);
        return date.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    },
    {
      title: '客户端',
      dataIndex: 'processedBy',
      key: 'processedBy',
      width: 150,
      render: (clientId) => (
        <Tooltip title={clientId}>
          <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {clientId ? (clientId.length > 15 ? clientId.substring(0, 15) + '...' : clientId) : '未知'}
          </span>
        </Tooltip>
      )
    },
    {
      title: '评论数',
      dataIndex: 'commentCount',
      key: 'commentCount',
      width: 90,
      render: (count) => (
        <span>
          <CommentOutlined style={{ marginRight: 4, color: '#1890ff' }} />
          {count || 0}
        </span>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        let url = record.shortUrl || record.noteUrl;
        if (!url) {
          url = `https://www.xiaohongshu.com/explore/${record.noteId}`;
        }
        if (url && !url.startsWith('http')) {
          url = `https://www.xiaohongshu.com${url}`;
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => window.open(url, '_blank')}
          >
            打开
          </Button>
        );
      }
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      {activeTab === 'pending' ? (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Card>
              <Statistic
                title="正在分发"
                value={pendingStats.processing}
                valueStyle={{ color: pendingStats.processing > 0 ? '#fa8c16' : undefined }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card>
              <Statistic
                title="可加入队列"
                value={pendingStats.ready}
                valueStyle={{ color: pendingStats.ready > 0 ? '#52c41a' : undefined }}
              />
            </Card>
          </Col>
        </Row>
      ) : (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card>
              <Statistic title="已完成总数" value={completedStats.total} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="今日完成"
                value={completedStats.today}
                valueStyle={{ color: completedStats.today > 0 ? '#52c41a' : undefined }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="历史累计" value={completedStats.total} />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarExtraContent={
            <Space>
              <Input.Search
                placeholder="搜索标题、作者、笔记ID"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={(value) => { setKeyword(value); }}
                style={{ width: 240 }}
                allowClear
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchData(pagination.current, pagination.pageSize)}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          }
        >
          <TabPane tab="待采集队列" key="pending">
            <Table
              rowKey="_id"
              columns={pendingColumns}
              dataSource={pendingNotes}
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`
              }}
              onChange={(newPagination) => fetchData(newPagination.current, newPagination.pageSize)}
              scroll={{ x: 1000 }}
              size="small"
            />
          </TabPane>
          <TabPane tab="已完成任务" key="completed">
            <Table
              rowKey="_id"
              columns={completedColumns}
              dataSource={completedNotes}
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`
              }}
              onChange={(newPagination) => fetchData(newPagination.current, newPagination.pageSize)}
              scroll={{ x: 900 }}
              size="small"
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default HarvestQueueManagement;
