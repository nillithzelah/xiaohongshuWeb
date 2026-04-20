import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Spin, message, List, Avatar } from 'antd';
import {
  UserAddOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TrophyOutlined,
  FileImageOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

// 导入独立仪表板组件
import FinanceDashboard from './dashboard/FinanceDashboard';
import PromoterDashboard from './dashboard/PromoterDashboard';

// HR仪表盘组件
const HrDashboard = () => {
  const [stats, setStats] = useState({
    todayNewLeads: 0,
    monthlyClients: 0,
    pendingFollowups: 0
  });
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHrData();
  }, []);

  const fetchHrData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/dashboard/hr');
      if (response.data.success) {
        setStats(response.data.stats);
        setRecentLeads(response.data.recentLeads);
      }
    } catch (error) {
      message.error('获取HR数据失败');
    } finally {
      setLoading(false);
    }
  };

  const leadColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '录入时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    }
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="今日新增线索"
                value={stats.todayNewLeads}
                prefix={<UserAddOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="本月累计客户"
                value={stats.monthlyClients}
                prefix={<UserOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="待跟进客户"
                value={stats.pendingFollowups}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="最新录入的线索" extra={loading ? <Spin size="small" /> : null}>
        <Table
          columns={leadColumns}
          dataSource={recentLeads}
          rowKey="_id"
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: '暂无线索数据' }}
        />
      </Card>
    </div>
  );
};

// 主管仪表盘组件
const ManagerDashboard = () => {
  const [stats, setStats] = useState({
    teamPerformance: 0,
    unassignedLeads: 0,
    conversionRate: 0
  });
  const [hrRanking, setHrRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchManagerData();
  }, []);

  const fetchManagerData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/dashboard/manager');
      if (response.data.success) {
        setStats(response.data.stats);
        setHrRanking(response.data.hrRanking);
      }
    } catch (error) {
      message.error('获取主管数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="团队总业绩"
                value={stats.teamPerformance}
                prefix={<DollarOutlined />}
                suffix="元"
                styles={{ content: { color: '#52c41a' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="待分配线索"
                value={stats.unassignedLeads}
                prefix={<UserAddOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="本月转化率"
                value={stats.conversionRate}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="HR业绩排行榜" extra={loading ? <Spin size="small" /> : null}>
        <List
          dataSource={hrRanking}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar style={{ backgroundColor: index < 3 ? '#52c41a' : '#1890ff' }}>
                    {index + 1}
                  </Avatar>
                }
                title={`${item.nickname || item.username} (${item.username})`}
                description={`客户数量: ${item.clientCount}`}
              />
              {index < 3 && <TrophyOutlined style={{ color: '#faad14', fontSize: '20px' }} />}
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

// 带教老师仪表盘组件
const MentorDashboard = () => {
  const [stats, setStats] = useState({
    pendingReviews: 0,
    activeClients: 0,
    completedToday: 0
  });
  const [pendingReviewsList, setPendingReviewsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMentorData();
  }, []);

  const fetchMentorData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/dashboard/mentor');
      if (response.data.success) {
        setStats(response.data.stats);
        setPendingReviewsList(response.data.pendingReviewsList);
      }
    } catch (error) {
      message.error('获取带教老师数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getImageTypeText = (type) => {
    const types = {
      login_qr: '登录二维码',
      note: '笔记',
      comment: '评论'
    };
    return types[type] || type;
  };

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="待审核任务"
                value={stats.pendingReviews}
                prefix={<FileImageOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="我的活跃客户"
                value={stats.activeClients}
                prefix={<UserOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="今日已完成"
                value={stats.completedToday}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="待我审核的任务" extra={loading ? <Spin size="small" /> : null}>
        <List
          dataSource={pendingReviewsList}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={`${item.userId?.nickname || item.userId?.username} - ${getImageTypeText(item.imageType)}`}
                description={`提交时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}`}
              />
              <Tag color="orange">待审核</Tag>
            </List.Item>
          )}
        />
        {pendingReviewsList.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无待审核任务
          </div>
        )}
      </Card>
    </div>
  );
};

// 老板仪表盘组件
const BossDashboard = () => {
  const [stats, setStats] = useState({
    totalReviews: 0,
    pendingReviews: 0,
    inProgressReviews: 0,
    completedReviews: 0,
    rejectedReviews: 0,
    totalUsers: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/stats');
      if (response.data.success) {
        const { stats: apiStats } = response.data;
        setStats({
          totalReviews: apiStats.totalReviews || 0,
          pendingReviews: apiStats.pendingReviews || 0,
          inProgressReviews: apiStats.inProgressReviews || 0,
          completedReviews: apiStats.completedReviews || 0,
          rejectedReviews: apiStats.rejectedReviews || 0,
          totalUsers: apiStats.totalUsers || 0
        });
      }
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} md={4}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="总审核数"
                value={stats.totalReviews}
                prefix={<FileImageOutlined />}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="待审核"
                value={stats.pendingReviews}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="审核中"
                value={stats.inProgressReviews}
                prefix={<UserOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="已完成"
                value={stats.completedReviews}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="已拒绝"
                value={stats.rejectedReviews}
                prefix={<FileImageOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            )}
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="总用户数"
                value={stats.totalUsers}
                prefix={<UserOutlined />}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 主仪表盘组件
const Dashboard = () => {
  const { user } = useAuth();

  if (!user) {
    return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
  }

  // 根据用户角色渲染不同的仪表盘
  switch (user.role) {
    case 'hr':
      return <HrDashboard />;
    case 'manager':
      return <ManagerDashboard />;
    case 'mentor':
      return <MentorDashboard />;
    case 'boss':
      return <BossDashboard />;
    case 'finance':
      return <FinanceDashboard />;
    case 'promoter':
      return <PromoterDashboard />;
    default:
      return <BossDashboard />; // 默认显示老板仪表盘
  }
};

export default Dashboard;