import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, message, DatePicker, Button, Select, Table } from 'antd';
import {
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  UserOutlined,
  WalletOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

const { RangePicker } = DatePicker;

const FinanceDashboard = () => {
  const [stats, setStats] = useState({
    totalWithdrawn: 0,
    totalWithdrawnCount: 0,
    todayWithdrawn: 0,
    todayWithdrawnCount: 0,
    monthWithdrawn: 0,
    monthWithdrawnCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    partTimeUserCount: 0
  });
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [chartPeriod, setChartPeriod] = useState('week'); // week, month, year

  useEffect(() => {
    fetchFinanceData();
  }, [dateRange]);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/finance/stats');
      if (response.data.success) {
        setStats(response.data.stats);
      }

      // 获取最近提现记录
      const recordsRes = await axios.get('/admin/finance/withdrawal-records', {
        params: {
          startDate: dateRange[0].format('YYYY-MM-DD'),
          endDate: dateRange[1].format('YYYY-MM-DD')
        }
      });
      if (recordsRes.data.success) {
        setRecentWithdrawals(recordsRes.data.records || []);
      }
    } catch (error) {
      console.error('获取财务数据失败:', error);
      message.error('获取财务数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange(dates);
    }
  };

  // 模拟图表数据（实际应从API获取）
  const getTrendData = () => {
    const data = [];
    const now = dayjs();
    for (let i = 6; i >= 0; i--) {
      const date = now.subtract(i, 'day');
      data.push({
        date: date.format('MM-DD'),
        amount: Math.floor(Math.random() * 5000) + 1000
      });
    }
    return data;
  };

  // 模拟提现状态分布数据
  const getStatusData = () => {
    return [
      { name: '已完成', value: stats.totalWithdrawnCount - stats.pendingCount || 0, color: '#52c41a' },
      { name: '待处理', value: stats.pendingCount || 0, color: '#faad14' }
    ];
  };

  const withdrawalColumns = [
    {
      title: '用户',
      dataIndex: ['userId', 'nickname'],
      key: 'user',
      render: (user) => user || '未知'
    },
    {
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => `¥${(amount / 100).toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          pending: { text: '待处理', color: 'orange' },
          completed: { text: '已完成', color: 'green' },
          rejected: { text: '已拒绝', color: 'red' }
        };
        const config = statusMap[status] || { text: status, color: 'default' };
        return <span style={{ color: config.color }}>{config.text}</span>;
      }
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '--'
    }
  ];

  const trendData = getTrendData();
  const statusData = getStatusData();

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
              onClick={fetchFinanceData}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="总提现金额"
              value={stats.totalWithdrawn / 100}
              precision={2}
              prefix={<WalletOutlined />}
              suffix="元"
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="总提现次数"
              value={stats.totalWithdrawnCount}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="待处理提现"
              value={stats.pendingAmount / 100}
              precision={2}
              prefix={<ClockCircleOutlined />}
              suffix="元"
              styles={{ content: { color: '#faad14' } }}
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
              {stats.pendingCount} 笔待处理
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="兼职用户数"
              value={stats.partTimeUserCount}
              prefix={<UserOutlined />}
              styles={{ content: { color: '#722ed1' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 第二行统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading}>
            <Statistic
              title="今日提现"
              value={stats.todayWithdrawn / 100}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              styles={{ content: { color: '#13c2c2' } }}
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
              {stats.todayWithdrawnCount} 笔
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading}>
            <Statistic
              title="本月提现"
              value={stats.monthWithdrawn / 100}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              styles={{ content: { color: '#52c41a' } }}
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: 4 }}>
              {stats.monthWithdrawnCount} 笔
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card loading={loading}>
            <Statistic
              title="平均提现金额"
              value={stats.totalWithdrawnCount > 0 ? (stats.totalWithdrawn / stats.totalWithdrawnCount / 100).toFixed(2) : '0.00'}
              prefix={<WalletOutlined />}
              suffix="元"
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* 提现趋势图 */}
        <Col xs={24} lg={16}>
          <Card title={<><LineChartOutlined /> 提现趋势</>} extra={<Button type="link" size="small">导出</Button>}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <XAxis dataKey="date" />
                <YAxis />
                <CartesianGrid strokeDasharray="3 3" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#1890ff" name="提现金额" unit="元" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 提现状态分布 */}
        <Col xs={24} lg={8}>
          <Card title={<><CheckCircleOutlined /> 提现状态分布</>}>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} paddingAngle={5} dataKey="value" nameKey="name" label>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 10 }}>
              {statusData.map((entry) => (
                <div key={entry.name} style={{ display: 'inline-block', margin: '0 10px', fontSize: '12px' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, backgroundColor: entry.color, borderRadius: '50%', marginRight: 4 }}></span>
                  {entry.name}: {entry.value}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 最近提现记录 */}
      <Card title="最近提现记录" extra={<Button type="link" size="small" href="#/admin/financial-management">查看全部</Button>}>
        <Table
          columns={withdrawalColumns}
          dataSource={recentWithdrawals.slice(0, 5)}
          rowKey="_id"
          pagination={false}
          size="small"
          loading={loading}
          locale={{ emptyText: '暂无提现记录' }}
        />
      </Card>
    </div>
  );
};

export default FinanceDashboard;
