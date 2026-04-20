import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  Select,
  message,
  Row,
  Col,
  Modal,
  Input,
  Statistic,
  Tooltip,
  Dropdown,
  DatePicker,
  Empty,
  notification,
  Badge
} from 'antd';
import {
  CheckOutlined,
  ReloadOutlined,
  LinkOutlined,
  UserOutlined,
  StarOutlined,
  ExportOutlined,
  SearchOutlined,
  FilterOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  BellOutlined,
  SoundOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// 状态配置常量
const STATUS_CONFIG = {
  pending: { text: '待处理', color: 'orange', icon: <ClockCircleOutlined /> },
  processed: { text: '已处理', color: 'cyan', icon: <CheckOutlined /> },
  contacted: { text: '已联系', color: 'blue', icon: <TeamOutlined /> },
  converted: { text: '已转化', color: 'green', icon: <CheckCircleOutlined /> },
  invalid: { text: '无效', color: 'red', icon: <CloseCircleOutlined /> }
};

const CommentLeads = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processed: 0,
    contacted: 0,
    converted: 0,
    today: 0
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  // WebSocket 相关状态
  const [unreadCount, setUnreadCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const originalTitle = useRef('评论线索管理');

  // 高级筛选状态
  const [filters, setFilters] = useState({
    status: '',  // 默认不筛选，显示所有状态
    keyword: '',
    dateRange: null
  });

  // 搜索防抖状态
  const [searchValue, setSearchValue] = useState('');

  // 转化率计算
  const conversionRate = useMemo(() => {
    return stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : 0;
  }, [stats.total, stats.converted]);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get('/client/comments/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, []);

  // 获取评论列表
  const fetchLeads = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = {
        skip: (page - 1) * pageSize,
        limit: pageSize
      };

      if (filters.status) params.status = filters.status;
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await axios.get('/client/comments/list', { params });
      if (response.data.success) {
        setLeads(response.data.data.leads);
        setPagination({
          current: page,
          pageSize,
          total: response.data.data.pagination.total
        });
      }
    } catch (error) {
      console.error('获取评论列表失败:', error);
      message.error('获取评论列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // 初始化和筛选变化时加载数据
  useEffect(() => {
    fetchStats();
    fetchLeads(1, pagination.pageSize);
  }, [fetchStats, fetchLeads, pagination.pageSize]);

  // 搜索防抖处理 - 只依赖 searchValue，避免循环
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, keyword: searchValue }));
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // 更新状态
  const handleUpdateStatus = useCallback(async (lead, newStatus, notes) => {
    try {
      const response = await axios.patch(`/client/comments/${lead._id}/status`, {
        status: newStatus,
        notes: notes || ''
      });

      if (response.data.success) {
        message.success('状态已更新');
        setModalVisible(false);
        setCurrentLead(null);
        setStatusNotes('');
        fetchLeads(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      message.error('更新状态失败');
    }
  }, [pagination, fetchLeads, fetchStats]);

  // 加入黑名单
  const handleAddToBlacklist = useCallback(async (lead, reason = '引流') => {
    try {
      const response = await axios.post(`/client/comments/${lead._id}/blacklist`, {
        reason
      });

      if (response.data.success) {
        message.success('已加入黑名单并标记为无效');
        fetchLeads(pagination.current, pagination.pageSize);
        fetchStats();
      }
    } catch (error) {
      console.error('加入黑名单失败:', error);
      message.error(error.response?.data?.message || '加入黑名单失败');
    }
  }, [pagination, fetchLeads, fetchStats]);

  // 批量更新状态
  const handleBatchUpdateStatus = useCallback(async (newStatus) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的线索');
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        selectedRowKeys.map(id =>
          axios.patch(`/client/comments/${id}/status`, { status: newStatus })
        )
      );
      message.success(`已批量更新 ${selectedRowKeys.length} 条线索`);
      setSelectedRowKeys([]);
      fetchLeads(pagination.current, pagination.pageSize);
      fetchStats();
    } catch (error) {
      console.error('批量更新失败:', error);
      message.error('批量更新失败');
    } finally {
      setLoading(false);
    }
  }, [selectedRowKeys, pagination, fetchLeads, fetchStats]);

  // 导出数据为 Excel 格式
  const handleExport = useCallback(() => {
    if (!leads || leads.length === 0) {
      message.warning('暂无数据可导出');
      return;
    }

    // Excel 表头
    const headers = ['评论者', '评论内容', '来源笔记', '关键词', '笔记作者', '发现时间', '状态'];

    // 转换数据
    const data = leads.map(lead => [
      lead.commentAuthor || '',
      lead.commentContent || '',
      lead.noteTitle || '',
      lead.keyword || 'N/A',
      lead.noteAuthor || '',
      lead.discoverTime ? dayjs(lead.discoverTime).format('YYYY-MM-DD HH:mm:ss') : '',
      STATUS_CONFIG[lead.status]?.text || lead.status || '未知'
    ]);

    // 创建工作表
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // 设置列宽
    ws['!cols'] = [
      { wch: 15 },  // 评论者
      { wch: 40 },  // 评论内容
      { wch: 30 },  // 来源笔记
      { wch: 12 },  // 关键词
      { wch: 15 },  // 笔记作者
      { wch: 20 },  // 发现时间
      { wch: 10 }   // 状态
    ];

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '评论线索');

    // 导出文件
    XLSX.writeFile(wb, `评论线索_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);

    message.success(`已导出 ${leads.length} 条数据`);
  }, [leads]);

  // 打开详情模态框
  const openDetailModal = useCallback((lead) => {
    setCurrentLead(lead);
    setStatusNotes(lead.followUp?.notes || '');
    setModalVisible(true);
  }, []);

  // ==================== WebSocket 实时通知 ====================

  // 处理新评论通知（带去重，防止同一笔记多次通知）
  const lastNotificationRef = useRef({ noteUrl: null, timestamp: 0 });

  const handleNewCommentLeads = useCallback((data) => {
    const { count, noteTitle, noteUrl } = data;
    const now = Date.now();

    // 去重：同一笔记在5秒内只通知一次
    if (noteUrl && lastNotificationRef.current.noteUrl === noteUrl) {
      const timeSinceLastNotification = now - lastNotificationRef.current.timestamp;
      if (timeSinceLastNotification < 5000) {
        console.log(`📢 [WebSocket] 跳过重复通知: ${noteTitle}`);
        // 仍然增加未读计数和刷新数据，但不显示通知
        setUnreadCount(prev => prev + count);
        fetchStats();
        fetchLeads(pagination.current, pagination.pageSize);
        return;
      }
    }

    // 更新最后通知记录
    if (noteUrl) {
      lastNotificationRef.current = { noteUrl, timestamp: now };
    }

    // 增加未读计数
    setUnreadCount(prev => {
      const newCount = prev + count;
      // 更新文档标题
      document.title = `(${newCount}) 💬 新评论`;
      return newCount;
    });

    // 显示通知
    notification.open({
      message: '新评论线索',
      description: `《${noteTitle}》下有 ${count} 条新评论`,
      icon: <SoundOutlined style={{ color: '#1890ff' }} />,
      placement: 'topRight',
      duration: 5,
      className: 'new-comment-notification',
      style: {
        borderLeft: '4px solid #1890ff',
        borderRadius: '4px'
      }
    });

    // 播放提示音
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // 静默处理播放失败（浏览器可能阻止自动播放）
      });
    } catch (e) {
      // 静默处理
    }

    // 刷新数据
    fetchStats();
    fetchLeads(pagination.current, pagination.pageSize);

    console.log(`📢 [WebSocket] 收到新评论通知: ${count}条`);
  }, [fetchStats, fetchLeads, pagination]);

  // 建立 WebSocket 连接
  useEffect(() => {
    // 构建 WebSocket URL
    // 生产环境使用 Nginx 代理的 /ws 路径，本地开发直接连接 5001 端口
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let wsUrl;
    if (isLocalhost) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.hostname}:5001`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.hostname}/ws`;
    }

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('📡 [WebSocket] 已连接');
          setWsConnected(true);
          // 清除重连定时器
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'new_comment_leads') {
              handleNewCommentLeads(message.data);
            }
          } catch (e) {
            console.error('WebSocket 消息解析失败:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket 错误:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket 连接断开');
          setWsConnected(false);
          // 5秒后重连
          reconnectTimerRef.current = setTimeout(() => {
            console.log('📡 [WebSocket] 尝试重连...');
            connectWebSocket();
          }, 5000);
        };
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
      }
    };

    connectWebSocket();

    // 清理函数
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [handleNewCommentLeads]);

  // 页面可见性处理 - 用户回到页面时清除未读计数
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && unreadCount > 0) {
        setUnreadCount(0);
        document.title = originalTitle.current;
        // 刷新数据
        fetchLeads(pagination.current, pagination.pageSize);
        fetchStats();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [unreadCount, fetchLeads, fetchStats]);

  // 组件卸载时恢复标题
  useEffect(() => {
    return () => {
      document.title = originalTitle.current;
    };
  }, []);

  // ==================== 快速状态切换 ====================
  const QuickStatusButtons = ({ record }) => (
    <Space size={4}>
      <Tooltip title="加入黑名单">
        <Button
          type="text"
          size="small"
          icon={<StopOutlined />}
          onClick={(e) => { e.stopPropagation(); handleAddToBlacklist(record, '引流'); }}
          style={{ color: '#722ed1' }}
        />
      </Tooltip>
      <Tooltip title="标记已处理">
        <Button
          type="text"
          size="small"
          icon={<CheckOutlined />}
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(record, 'processed', ''); }}
          style={{ color: '#13c2c2' }}
        />
      </Tooltip>
      <Tooltip title="标记已联系">
        <Button
          type="text"
          size="small"
          icon={<TeamOutlined />}
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(record, 'contacted', ''); }}
          style={{ color: '#1890ff' }}
        />
      </Tooltip>
      <Tooltip title="标记已转化">
        <Button
          type="text"
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(record, 'converted', ''); }}
          style={{ color: '#52c41a' }}
        />
      </Tooltip>
      <Tooltip title="标记无效">
        <Button
          type="text"
          size="small"
          icon={<CloseCircleOutlined />}
          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(record, 'invalid', ''); }}
          style={{ color: '#ff4d4f' }}
        />
      </Tooltip>
    </Space>
  );

  // 评论列表表格列
  const leadColumns = useMemo(() => [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 70,
      render: (id) => (
        <Tooltip title={id}>
          <span style={{ fontSize: '11px', color: '#999', fontFamily: 'monospace' }}>
            {id?.slice(-6) || '--'}
          </span>
        </Tooltip>
      )
    },
    {
      title: '评论者',
      dataIndex: 'commentAuthor',
      key: 'commentAuthor',
      width: 120,
      render: (author) => (
        <Space size={4}>
          <UserOutlined style={{ color: '#8c8c8c' }} />
          <span style={{ fontWeight: 500 }}>{author || '未知'}</span>
        </Space>
      )
    },
    {
      title: '评论内容',
      dataIndex: 'commentContent',
      key: 'commentContent',
      width: 280,
      ellipsis: { showTitle: false },
      render: (content) => (
        <Tooltip title={content}>
          <span style={{ fontSize: '13px', color: '#262626' }}>{content || '--'}</span>
        </Tooltip>
      )
    },
    {
      title: '来源笔记',
      key: 'noteInfo',
      width: 220,
      render: (_, record) => (
        <div>
          <Tooltip title={record.noteTitle}>
            <div style={{ fontSize: '12px', color: '#595959', marginBottom: 4 }}
                 className="text-ellipsis">
              {record.noteTitle?.substring(0, 18) || '--'}
              {record.noteTitle?.length > 18 && '...'}
            </div>
          </Tooltip>
          <Space size={4}>
            <Tag color="cyan" style={{ fontSize: '11px', margin: 0 }}>
              {record.keyword || 'N/A'}
            </Tag>
            {record.aiAnalysis?.category && (
              <Tag color="geekblue" style={{ fontSize: '11px', margin: 0 }}>
                {record.aiAnalysis.category}
              </Tag>
            )}
          </Space>
        </div>
      )
    },
    {
      title: '发现时间',
      dataIndex: 'discoverTime',
      key: 'discoverTime',
      width: 130,
      render: (time) => (
        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
          {time ? dayjs(time).format('MM-DD HH:mm') : '--'}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => {
        const config = STATUS_CONFIG[status] || { text: status || '未知', color: 'default', icon: null };
        return (
          <Tag color={config.color} icon={config.icon} style={{ margin: 0 }}>
            {config.text}
          </Tag>
        );
      }
    },
    {
      title: '操作人员',
      dataIndex: 'lastOperatedBy',
      key: 'lastOperatedBy',
      width: 100,
      render: (operator) => (
        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
          {operator?.username || operator?.nickname || '--'}
        </span>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          {record.noteUrl && (
            <Tooltip title={record.commentId ? '查看原文（跳转评论）' : '查看原文'}>
              <a
                href={record.commentId
                  ? `${record.noteUrl}#comment-${record.commentId}`
                  : record.noteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <LinkOutlined style={{ color: '#1890ff' }} />
              </a>
            </Tooltip>
          )}
          <QuickStatusButtons record={record} />
        </Space>
      )
    }
  ], [openDetailModal, handleUpdateStatus, handleAddToBlacklist]);

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      disabled: record.status === 'invalid'
    })
  };

  // 批量操作菜单
  const batchMenuItems = [
    {
      key: 'contacted',
      label: '批量标记已联系',
      icon: <TeamOutlined />,
      onClick: () => handleBatchUpdateStatus('contacted')
    },
    {
      key: 'converted',
      label: '批量标记已转化',
      icon: <CheckCircleOutlined />,
      onClick: () => handleBatchUpdateStatus('converted')
    },
    {
      key: 'invalid',
      label: '批量标记无效',
      icon: <CloseCircleOutlined />,
      onClick: () => handleBatchUpdateStatus('invalid'),
      danger: true
    }
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              minHeight: 140
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>总线索</span>}
              value={stats.total}
              suffix="条"
              valueStyle={{ color: 'white', fontSize: 28 }}
              prefix={<StarOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card
            bordered={false}
            style={{
              background: stats.pending > 0
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
              color: 'white',
              minHeight: 140
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>待处理</span>}
              value={stats.pending}
              suffix="条"
              valueStyle={{ color: 'white', fontSize: 28 }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card
            bordered={false}
            style={{
              background: stats.processed > 0
                ? 'linear-gradient(135deg, #00c6fb 0%, #005bea 100%)'
                : 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
              color: 'white',
              minHeight: 140
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>已处理</span>}
              value={stats.processed}
              suffix="条"
              valueStyle={{ color: 'white', fontSize: 28 }}
              prefix={<CheckOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              color: 'white',
              minHeight: 140
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>已联系</span>}
              value={stats.contacted}
              suffix="条"
              valueStyle={{ color: 'white', fontSize: 28 }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card
            bordered={false}
            style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              color: 'white',
              minHeight: 140
            }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>已转化</span>}
              value={stats.converted}
              suffix="条"
              valueStyle={{ color: 'white', fontSize: 28 }}
              prefix={<CheckCircleOutlined />}
            />
            <div style={{ marginTop: 4, fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
              转化率: {conversionRate}%
            </div>
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title={
        <Space>
          <StarOutlined />
          评论线索
          {stats.pending > 0 && (
            <Tag color="red" style={{ borderRadius: 10 }}>
              {stats.pending}
            </Tag>
          )}
        </Space>
      }>
        {/* 筛选栏 */}
        <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              background: '#fafafa',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <Space wrap size={8}>
                <Select
                  value={filters.status}
                  onChange={(value) => setFilters({ ...filters, status: value })}
                  style={{ width: 130 }}
                  suffixIcon={<FilterOutlined />}
                >
                  <Option value="">全部状态</Option>
                  <Option value="pending">待处理</Option>
                  <Option value="processed">已处理</Option>
                  <Option value="contacted">已联系</Option>
                  <Option value="converted">已转化</Option>
                  <Option value="invalid">❌ 无效</Option>
                </Select>

                <RangePicker
                  value={filters.dateRange}
                  onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
                  format="YYYY-MM-DD"
                  placeholder={['开始日期', '结束日期']}
                  style={{ width: 240 }}
                />

                <Input
                  placeholder="搜索评论者或内容..."
                  prefix={<SearchOutlined />}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  allowClear
                  style={{ width: 200 }}
                />
              </Space>

              <Space>
                {selectedRowKeys.length > 0 && (
                  <Dropdown menu={{ items: batchMenuItems }} trigger={['click']}>
                    <Button type="primary">
                      批量操作 ({selectedRowKeys.length})
                    </Button>
                  </Dropdown>
                )}
                <Button
                  icon={<ExportOutlined />}
                  onClick={handleExport}
                  disabled={leads.length === 0}
                >
                  导出
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    fetchLeads(pagination.current, pagination.pageSize);
                    fetchStats();
                  }}
                >
                  刷新
                </Button>
              </Space>
            </div>

            <Table
              rowKey="_id"
              columns={leadColumns}
              dataSource={leads}
              loading={loading}
              pagination={{
                ...pagination,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <span style={{ color: '#8c8c8c' }}>
                    显示 {range[0]}-{range[1]} 条，共 {total} 条
                  </span>
                ),
                pageSizeOptions: [10, 20, 50, 100]
              }}
              rowSelection={rowSelection}
              onChange={(newPagination) => fetchLeads(newPagination.current, newPagination.pageSize)}
              scroll={{ x: 1500 }}
              onRow={(record) => ({
                onDoubleClick: () => openDetailModal(record),
                style: { cursor: 'pointer' }
              })}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <div>
                        <div style={{ color: '#8c8c8c', marginBottom: 8 }}>暂无评论线索</div>
                        <div style={{ fontSize: '12px', color: '#bfbfbf' }}>
                          {filters.status === 'qualified'
                            ? '筛选条件下没有数据，尝试选择"全部状态"'
                            : '点击刷新按钮获取最新数据'}
                        </div>
                      </div>
                    }
                  />
                )
              }}
            />
        </Card>

        {/* 详情模态框 */}
        <Modal
          title={
            <Space>
              <StarOutlined style={{ color: '#faad14' }} />
              <span>线索详情</span>
            </Space>
          }
          visible={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            setCurrentLead(null);
            setStatusNotes('');
          }}
          footer={[
            <Button
              key="close"
              onClick={() => setModalVisible(false)}
            >
              关闭
            </Button>,
            <Button
              key="blacklist"
              danger
              onClick={() => {
                handleAddToBlacklist(currentLead, '引流');
                setModalVisible(false);
              }}
              icon={<StopOutlined />}
              style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
            >
              加入黑名单
            </Button>,
            <Button
              key="invalid"
              danger
              onClick={() => handleUpdateStatus(currentLead, 'invalid', statusNotes)}
              icon={<CloseCircleOutlined />}
            >
              标记无效
            </Button>,
            <Button
              key="contacted"
              type="primary"
              onClick={() => handleUpdateStatus(currentLead, 'contacted', statusNotes)}
              icon={<TeamOutlined />}
            >
              标记已联系
            </Button>,
            <Button
              key="converted"
              type="primary"
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => handleUpdateStatus(currentLead, 'converted', statusNotes)}
              icon={<CheckCircleOutlined />}
            >
              标记已转化
            </Button>
          ]}
          width={600}
        >
          {currentLead && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: 16
              }}>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>评论者</div>
                  <div style={{ fontWeight: 500 }}>
                    <UserOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
                    {currentLead.commentAuthor || '--'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>发现时间</div>
                  <div style={{ fontWeight: 500 }}>
                    {currentLead.discoverTime ? dayjs(currentLead.discoverTime).format('YYYY-MM-DD HH:mm:ss') : '--'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>来源笔记</div>
                  <div style={{ fontWeight: 500 }}>{currentLead.noteTitle || '--'}</div>
                </div>
                <div>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>关键词</div>
                  <Tag color="blue">{currentLead.keyword || 'N/A'}</Tag>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>笔记作者</div>
                <div style={{ fontWeight: 500 }}>{currentLead.noteAuthor || '--'}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>评论内容</div>
                <div style={{
                  padding: '8px 12px',
                  background: '#f5f5f5',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}>
                  {currentLead.commentContent || '--'}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>当前状态</div>
                {STATUS_CONFIG[currentLead.status] && (
                  <Tag
                    color={STATUS_CONFIG[currentLead.status].color}
                    icon={STATUS_CONFIG[currentLead.status].icon}
                    style={{ fontSize: '14px', padding: '4px 12px' }}
                  >
                    {STATUS_CONFIG[currentLead.status].text}
                  </Tag>
                )}
              </div>

              {currentLead.noteUrl && (
                <div style={{ marginBottom: 16 }}>
                  <a
                    href={currentLead.commentId
                      ? `${currentLead.noteUrl}#comment-${currentLead.commentId}`
                      : currentLead.noteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <LinkOutlined />
                    查看原文 {currentLead.commentId && '(跳转评论)'}
                  </a>
                </div>
              )}

              <div>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 8 }}>
                  跟进备注
                </div>
                <TextArea
                  rows={3}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="输入跟进备注，记录联系情况、用户反馈等..."
                  style={{ borderRadius: '6px' }}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  };

export default CommentLeads;
