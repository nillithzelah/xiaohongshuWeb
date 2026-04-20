import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, message, DatePicker, Button, Select, Table, Tag, Progress } from 'antd';
import {
  CommentOutlined,
  StopOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  EyeOutlined,
  LineChartOutlined,
  UserDeleteOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

const { RangePicker } = DatePicker;

const PromoterDashboard = () => {
  const [stats, setStats] = useState({
    totalLeads: 0,
    todayLeads: 0,
    todayVerifiedLeads: 0,
    blacklistCount: 0,
    totalComments: 0,
    todayComments: 0
  });
  const [recentLeads, setRecentLeads] = useState([]);
  const [blacklistStats, setBlacklistStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [chartPeriod, setChartPeriod] = useState('week');

  useEffect(() => {
    fetchPromoterData();
  }, [dateRange]);

  const fetchPromoterData = async () => {
    setLoading(true);
    try {
      // 获取评论线索统计
      const leadsRes = await axios.get('/admin/comment-leads/stats');
      if (leadsRes.data.success) {
        setStats(leadsRes.data.stats || {});
      }

      // 获取最新线索
      const recentRes = await axios.get('/admin/comment-leads', {
        params: {
          limit: 10,
          sort: '-createdAt'
        }
      });
      if (recentRes.data.success) {
        setRecentLeads(recentRes.data.leads || []);
      }

      // 获取黑名单统计
      const blacklistRes = await axios.get('/admin/comments/blacklist/stats');
      if (blacklistRes.data.success) {
        setBlacklistStats(blacklistRes.data.stats || {});
      }
    } catch (error) {
      console.error('获取推广数据失败:', error);
      message.error('获取推广数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange(dates);
    }
  };

  // 模拟线索趋势数据
  const getLeadsTrendData = () => {
    const data = [];
    const now = dayjs();
    for (let i = 6; i >= 0; i--) {
      const date = now.subtract(i, 'day');
      data.push({
        date: date.format('MM-DD'),
        leads: Math.floor(Math.random() * 50) + 10,
        verified: Math.floor(Math.random() * 30) + 5
      });
    }
    return data;
  };

  // 模拟AI分类分布数据
  const getAiAnalysisData = () => {
    return [
      { name: '高价值线索', value: Math.floor(Math.random() * 30) + 20, color: '#52c41a' },
      { name: '中价值线索', value: Math.floor(Math.random() * 40) + 30, color: '#1890ff' },
      { name: '低价值线索', value: Math.floor(Math.random() * 20) + 10, color: '#faad14' },
      { name: '无效线索', value: Math.floor(Math.random() * 10), color: '#ff4d4f' }
    ];
  };

  // 模拟黑名单来源分布
  const getBlacklistSourceData = () => {
    return [
      { name: '广告', value: Math.floor(Math.random() * 100) + 50 },
      { name: '微商', value: Math.floor(Math.random() * 80) + 30 },
      { name: '诈骗', value: Math.floor(Math.random() * 30) + 10 },
      { name: '其他', value: Math.floor(Math.random() * 20) + 5 }
    ];
  };

  const leadsTrendData = getLeadsTrendData();
  const aiAnalysisData = getAiAnalysisData();
  const blacklistSourceData = getBlacklistSourceData();

  const leadColumns = [
    {
      title: '评论内容',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (comment) => comment?.substring(0, 50) + (comment?.length > 50 ? '...' : '') || '--'
    },
    {
      title: '笔记',
      dataIndex: ['noteId'],
      key: 'note',
      render: (noteId) => noteId?.substring(0, 12) + '...' || '--'
    },
    {
      title: 'AI分类',
      dataIndex: 'aiAnalysis',
      key: 'aiAnalysis',
      render: (analysis) => {
        if (!analysis) return <Tag>-</Tag>;
        const category = analysis.category || 'unknown';
        const categoryMap = {
          high_value: { text: '高价值', color: 'green' },
          medium_value: { text: '中价值', color: 'blue' },
          low_value: { text: '低价值', color: 'orange' },
          invalid: { text: '无效', color: 'red' }
        };
        const config = categoryMap[category] || { text: category, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          pending: { text: '待处理', color: 'orange' },
          contacted: { text: '已联系', color: 'blue' },
          converted: { text: '已转化', color: 'green' },
          invalid: { text: '无效', color: 'red' }
        };
        const config = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    }
  ];

  return (
    <div>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              locale={dayjs.locale('zh-cn')}
            />
          </Col>
          <Col>
            <Select
              value={chartPeriod}
              onChange={setChartPeriod}
              style={{ width: 100 }}
            >
              <Select.Option value="week">最近7天</Select.Option>
              <Select.Option value="month">最近30天</Select.Option>
              <Select.Option value="year">最近12月</Select.Option>
            </Select>
          </Col>
          <Col>
            <Button
              icon={<SyncOutlined />}
              onClick={fetchPromoterData}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 第一行统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}>
          <Card loading={loading}>
            <Statistic
              title="总线索数"
              value={stats.totalLeads || 0}
              prefix={<CommentOutlined />}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card loading={loading}>
            <Statistic
              title="今日新增"
              value={stats.todayLeads || 0}
              prefix={<EyeOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card loading={loading}>
            <Statistic
              title="今日已验证"
              value={stats.todayVerifiedLeads || 0}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#13c2c2' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card loading={loading}>
            <Statistic
              title="黑名单用户"
              value={stats.blacklistCount || 0}
              prefix={<CloseCircleOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card loading={loading}>
            <Statistic
              title="累计评论数"
              value={stats.totalComments || 0}
              prefix={<CommentOutlined />}
              styles={{ content: { color: '#722ed1' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card loading={loading}>
            <Statistic
              title="今日评论数"
              value={stats.todayComments || 0}
              prefix={<CommentOutlined />}
              styles={{ content: { color: '#fa8c16' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* 线索趋势图 */}
        <Col xs={24} lg={12}>
          <Card title={<><LineChartOutlined /> 线索趋势</>} extra={<Button type="link" size="small">导出</Button>}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsTrendData} layout="vertical">
                <XAxis type="number" />
                <YAxis dataKey="date" type="category" width={60} />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip />
                <Legend />
                <Bar dataKey="verified" name="已验证" fill="#52c41a" />
                <Bar dataKey="leads" name="新增线索" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* AI分类分布 */}
        <Col xs={24} lg={12}>
          <Card title={<><CheckCircleOutlined /> AI分类分布</>}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: 300 }}>
              <ResponsiveContainer width="50%" height={280}>
                <PieChart>
                  <Pie data={aiAnalysisData} cx="50%" cy="50%" innerRadius={60} paddingAngle={5} dataKey="value" nameKey="name" label>
                    {aiAnalysisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginLeft: 20 }}>
                {aiAnalysisData.map((entry) => (
                  <div key={entry.name} style={{ marginBottom: 12 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: entry.color, borderRadius: '50%', marginRight: 8 }}></span>
                    {entry.name}: {entry.value}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 黑名单分析 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title={<><CloseCircleOutlined /> 黑名单来源分布</>}>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={blacklistSourceData}>
                <XAxis dataKey="name" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="数量" fill="#ff4d4f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<><UserDeleteOutlined /> 黑名单管理</>} extra={<Button type="link" size="small" href="#/admin/comment-blacklist">管理</Button>}>
            <div style={{ padding: '20px 0' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span>总黑名单用户</span>
                  <span style={{ fontWeight: 'bold', color: '#ff4d4f' }}>{stats.blacklistCount || 0}</span>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                <Button type="primary" block href="#/admin/comment-blacklist">
                  管理黑名单
                </Button>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最新线索列表 */}
      <Card title="最新线索" extra={<Button type="link" size="small" href="#/admin/comment-leads">查看全部</Button>}>
        <Table
          columns={leadColumns}
          dataSource={recentLeads.slice(0, 5)}
          rowKey="_id"
          pagination={false}
          size="small"
          loading={loading}
          locale={{ emptyText: '暂无线索数据' }}
        />
      </Card>
    </div>
  );
};

export default PromoterDashboard;
