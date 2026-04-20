import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  message,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Spin,
  Empty,
  Tabs,
  DatePicker,
  Input
} from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import {
  WalletOutlined,
  QrcodeOutlined,
  TrophyOutlined,
  SyncOutlined,
  UserOutlined,
  DollarOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;
const { TextArea } = Input;

const FinancialManagement = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // 根据URL路径设置默认标签
  const getDefaultTab = () => {
    if (location.pathname.endsWith('/withdrawals')) {
      return 'withdrawals';
    }
    return 'summary';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // 财务统计数据
  const [financeStats, setFinanceStats] = useState({
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
  const [statsLoading, setStatsLoading] = useState(false);

  // 提现相关状态
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawingUser, setWithdrawingUser] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState(null);

  // 驳回兑换相关状态
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 提现记录列表状态
  const [withdrawalRecords, setWithdrawalRecords] = useState([]);
  const [recordsSummary, setRecordsSummary] = useState({ totalAmount: 0, totalCount: 0, userCount: 0 });
  const [recordsLoading, setRecordsLoading] = useState(false);
  // 默认时间段为当日
  const [dateRange, setDateRange] = useState([dayjs(), dayjs()]);

  // 角色权限控制
  const canAccess = ['boss', 'finance', 'manager'].includes(user?.role);

  // 获取财务统计数据
  const fetchFinanceStats = async () => {
    setStatsLoading(true);
    try {
      const response = await axios.get('/admin/finance/stats');
      if (response.data.success) {
        setFinanceStats(response.data.stats);
      }
    } catch (error) {
      console.error('获取财务统计失败:', error);
      message.error('获取财务统计失败');
    } finally {
      setStatsLoading(false);
    }
  };

  // 获取兼职用户待打款列表
  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/finance/part-time-pending');
      if (response.data.success) {
        setPendingUsers(response.data.transactions || []);
      }
    } catch (error) {
      console.error('获取待打款列表失败:', error);
      message.error('获取待打款列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取提现记录列表
  const fetchWithdrawalRecords = async (startDate = null, endDate = null) => {
    setRecordsLoading(true);
    try {
      const params = {};
      if (startDate) {
        params.startDate = startDate.format('YYYY-MM-DD');
      }
      if (endDate) {
        params.endDate = endDate.format('YYYY-MM-DD');
      }
      const response = await axios.get('/admin/finance/withdrawal-records', { params });
      if (response.data.success) {
        setWithdrawalRecords(response.data.records || []);
        setRecordsSummary(response.data.summary || { totalAmount: 0, totalCount: 0, userCount: 0 });
      }
    } catch (error) {
      console.error('获取提现记录失败:', error);
      message.error('获取提现记录失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    if (dates && dates[0] && dates[1]) {
      fetchWithdrawalRecords(dates[0], dates[1]);
    } else {
      fetchWithdrawalRecords();
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchFinanceStats();
      fetchPendingUsers();
      // 默认查询当日提现记录
      fetchWithdrawalRecords(dayjs(), dayjs());
    }
  }, []);

  // 监听URL变化，切换标签页
  useEffect(() => {
    const tab = getDefaultTab();
    setActiveTab(tab);
  }, [location.pathname]);

  // 处理提现
  const handleWithdraw = (record) => {
    setWithdrawingUser(record);
    setWithdrawModalVisible(true);
  };

  // 确认提现
  const handleWithdrawSubmit = async () => {
    if (!withdrawingUser) return;

    setWithdrawing(true);
    try {
      const response = await axios.post(`/admin/withdraw/${withdrawingUser.user._id}`);
      message.success(response.data.message);
      setWithdrawModalVisible(false);
      setWithdrawingUser(null);
      fetchPendingUsers();
      fetchFinanceStats(); // 刷新统计数据
    } catch (error) {
      const errorMessage = error.response?.data?.message || '提现失败';
      message.error(errorMessage);
    } finally {
      setWithdrawing(false);
    }
  };

  // 处理驳回兑换
  const handleReject = (record) => {
    setRejectingUser(record);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  // 确认驳回兑换
  const handleRejectSubmit = async () => {
    if (!rejectingUser) return;

    setRejecting(true);
    try {
      const response = await axios.post(`/admin/reject-exchange/${rejectingUser.user._id}`, {
        reason: rejectReason || '管理员驳回'
      });
      message.success(response.data.message);
      setRejectModalVisible(false);
      setRejectingUser(null);
      setRejectReason('');
      fetchPendingUsers();
      fetchFinanceStats(); // 刷新统计数据
    } catch (error) {
      const errorMessage = error.response?.data?.message || '驳回失败';
      message.error(errorMessage);
    } finally {
      setRejecting(false);
    }
  };

  // 培训状态颜色映射
  const getStatusColor = (status) => {
    const statusMap = {
      '已筛选': '#1890ff',
      '培训中': '#faad14',
      '业务实操': '#722ed1',
      '评论能力培养': '#13c2c2',
      '发帖能力培养': '#36cfc9',
      '素人已申请发帖内容': '#95de64',
      '持续跟进': '#52c41a',
      '已结业': '#fa8c16',
      '未通过': '#f5222d',
      '中止': '#820014'
    };
    return statusMap[status] || '#d9d9d9';
  };

  // 提现列表表格列
  const columns = [
    {
      title: '用户ID',
      dataIndex: ['user', 'username'],
      key: 'username',
      width: 100
    },
    {
      title: '昵称',
      dataIndex: ['user', 'nickname'],
      key: 'nickname',
      width: 100
    },
    {
      title: '手机号',
      dataIndex: ['user', 'phone'],
      key: 'phone',
      width: 110
    },
    {
      title: '微信号',
      dataIndex: ['user', 'wechat'],
      key: 'wechat',
      width: 100
    },
    {
      title: '培训状态',
      dataIndex: ['user', 'training_status'],
      key: 'training_status',
      width: 100,
      render: (status) => status ? (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ) : <Tag color="#d9d9d9">未设置</Tag>
    },
    {
      title: '支付宝账号',
      dataIndex: ['user', 'integral_w'],
      key: 'alipay_account',
      width: 120,
      render: (account) => account || '-'
    },
    {
      title: '真实姓名',
      dataIndex: ['user', 'integral_z'],
      key: 'real_name',
      width: 100,
      render: (name) => name || '-'
    },
    {
      title: '收款码',
      key: 'qr_code',
      width: 80,
      render: (_, record) => {
        const qrCode = record.user?.wallet?.alipay_qr_code;
        if (!qrCode) {
          return <span style={{ color: '#999' }}>未上传</span>;
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<QrcodeOutlined />}
            onClick={() => {
              setCurrentQrCode(qrCode);
              setQrModalVisible(true);
            }}
          >
            查看
          </Button>
        );
      }
    },
    {
      title: '待打款金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      render: (amount) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '16px' }}>
          ¥{(amount || 0) / 100}
        </span>
      )
    },
    {
      title: '交易笔数',
      dataIndex: 'transactionCount',
      key: 'transactionCount',
      width: 80,
      render: (count) => <Tag color="blue">{count}笔</Tag>
    },
    {
      title: '已提现总额',
      dataIndex: ['user', 'wallet', 'total_withdrawn'],
      key: 'totalWithdrawn',
      width: 100,
      render: (amount) => (
        <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
          ¥{(amount || 0) / 100}
        </span>
      )
    },
    {
      title: '带教老师',
      dataIndex: ['user', 'mentor_id'],
      key: 'mentor_id',
      width: 100,
      render: (mentor) => mentor ? (mentor.nickname || mentor.username) : '-'
    },
    {
      title: 'HR',
      dataIndex: ['user', 'hr_id'],
      key: 'hr_id',
      width: 80,
      render: (hr) => hr ? (hr.nickname || hr.username) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<WalletOutlined />}
            onClick={() => handleWithdraw(record)}
          >
            提现
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => handleReject(record)}
          >
            驳回兑换
          </Button>
        </Space>
      )
    }
  ];

  // 权限不足
  if (!canAccess) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>权限不足</h2>
        <p>您没有权限访问此页面</p>
      </div>
    );
  }

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          // 切换标签时更新URL
          if (key === 'withdrawals') {
            navigate('/financial/withdrawals');
          } else {
            navigate('/financial');
          }
        }}
        items={[
          {
            key: 'summary',
            label: (
              <span>
                <TrophyOutlined />
                财务汇总
              </span>
            ),
            children: (
              <Spin spinning={statsLoading}>
                {/* 总提现大卡片 */}
                <Card
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    marginBottom: 24
                  }}
                >
                  <Row gutter={24} align="middle">
                    <Col flex="auto">
                      <Statistic
                        title="总提现金额"
                        value={financeStats.totalWithdrawn / 100}
                        prefix="¥"
                        precision={2}
                        valueStyle={{ color: '#fff', fontSize: 48 }}
                      />
                    </Col>
                    <Col>
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)' }}>
                        <div style={{ fontSize: 14, marginBottom: 4 }}>总提现笔数</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{financeStats.totalWithdrawnCount} 笔</div>
                      </div>
                    </Col>
                    <Col>
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.9)' }}>
                        <div style={{ fontSize: 14, marginBottom: 4 }}>兼职用户数</div>
                        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{financeStats.partTimeUserCount} 人</div>
                      </div>
                    </Col>
                  </Row>
                </Card>

                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="当日提现"
                        value={financeStats.todayWithdrawn / 100}
                        prefix="¥"
                        precision={2}
                        valueStyle={{ color: '#52c41a' }}
                        suffix={<div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{financeStats.todayWithdrawnCount} 笔</div>}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="当月提现"
                        value={financeStats.monthWithdrawn / 100}
                        prefix="¥"
                        precision={2}
                        valueStyle={{ color: '#1890ff' }}
                        suffix={<div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{financeStats.monthWithdrawnCount} 笔</div>}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="待打款金额"
                        value={financeStats.pendingAmount / 100}
                        prefix="¥"
                        precision={2}
                        valueStyle={{ color: '#faad14' }}
                        suffix={<div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{financeStats.pendingCount} 笔</div>}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="兼职用户"
                        value={financeStats.partTimeUserCount}
                        suffix="人"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 提现记录列表 */}
                <Card
                  title="用户提现记录"
                  style={{ marginTop: 24 }}
                >
                  <Space style={{ marginBottom: 16 }} size="middle">
                    <DatePicker.RangePicker
                      value={dateRange}
                      onChange={handleDateRangeChange}
                      format="YYYY-MM-DD"
                      placeholder={['开始日期', '结束日期']}
                    />
                    <Button
                      icon={<SyncOutlined />}
                      onClick={() => {
                        const startDate = dateRange?.[0] || null;
                        const endDate = dateRange?.[1] || null;
                        fetchWithdrawalRecords(startDate, endDate);
                      }}
                      loading={recordsLoading}
                    >
                      刷新
                    </Button>
                  </Space>

                  {/* 时间段汇总 */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Card size="small" style={{ background: '#f0f5ff' }}>
                        <Statistic
                          title="当前时间段提现总额"
                          value={recordsSummary.totalAmount / 100}
                          prefix="¥"
                          precision={2}
                          valueStyle={{ color: '#1890ff', fontSize: 18 }}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ background: '#f6ffed' }}>
                        <Statistic
                          title="当前时间段提现笔数"
                          value={recordsSummary.totalCount}
                          suffix="笔"
                          valueStyle={{ color: '#52c41a', fontSize: 18 }}
                        />
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" style={{ background: '#fff7e6' }}>
                        <Statistic
                          title="提现用户数"
                          value={recordsSummary.userCount}
                          suffix="人"
                          valueStyle={{ color: '#fa8c16', fontSize: 18 }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Table
                    columns={[
                      {
                        title: '用户ID',
                        dataIndex: 'username',
                        key: 'username',
                        width: 100
                      },
                      {
                        title: '昵称',
                        dataIndex: 'nickname',
                        key: 'nickname',
                        width: 120
                      },
                      {
                        title: '手机号',
                        dataIndex: 'phone',
                        key: 'phone',
                        width: 120
                      },
                      {
                        title: '提现金额',
                        dataIndex: 'totalWithdrawn',
                        key: 'totalWithdrawn',
                        width: 110,
                        render: (amount) => (
                          <span style={{ color: '#722ed1', fontWeight: 'bold' }}>
                            ¥{(amount || 0) / 100}
                          </span>
                        )
                      },
                      {
                        title: '提现笔数',
                        dataIndex: 'totalCount',
                        key: 'totalCount',
                        width: 90,
                        render: (count) => <Tag color="blue">{count}笔</Tag>
                      },
                      {
                        title: '最后提现时间',
                        dataIndex: 'lastWithdrawAtFormatted',
                        key: 'lastWithdrawAtFormatted',
                        width: 160
                      }
                    ]}
                    dataSource={withdrawalRecords}
                    rowKey={(record) => record.userId}
                    loading={recordsLoading}
                    pagination={{
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 个用户`,
                      defaultPageSize: 10
                    }}
                    scroll={{ x: 800 }}
                  />
                </Card>

                {/* 刷新按钮 */}
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                  <Button
                    icon={<SyncOutlined />}
                    onClick={() => {
                      fetchFinanceStats();
                      const startDate = dateRange?.[0] || null;
                      const endDate = dateRange?.[1] || null;
                      fetchWithdrawalRecords(startDate, endDate);
                    }}
                    loading={statsLoading || recordsLoading}
                    size="large"
                  >
                    刷新数据
                  </Button>
                </div>
              </Spin>
            )
          },
          {
            key: 'withdrawals',
            label: (
              <span>
                <WalletOutlined />
                兼职用户提现
              </span>
            ),
            children: (
              <>
                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="待打款用户数"
                        value={financeStats.pendingCount}
                        prefix={<UserOutlined />}
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="待打款总金额"
                        value={financeStats.pendingAmount / 100}
                        prefix={<DollarOutlined />}
                        precision={2}
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card>
                      <Statistic
                        title="兼职用户总数"
                        value={financeStats.partTimeUserCount}
                        suffix="人"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* 列表 */}
                <Card
                  title="兼职用户待打款列表"
                  extra={
                    <Button
                      icon={<SyncOutlined />}
                      onClick={fetchPendingUsers}
                      loading={loading}
                    >
                      刷新
                    </Button>
                  }
                >
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}>
                      <Spin size="large" />
                    </div>
                  ) : pendingUsers.length === 0 ? (
                    <Empty
                      description="暂无待打款用户"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <Table
                      columns={columns}
                      dataSource={pendingUsers}
                      rowKey={(record) => record.user._id}
                      scroll={{ x: 1400 }}
                      pagination={{
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 个用户`
                      }}
                    />
                  )}
                </Card>
              </>
            )
          }
        ]}
      />

      {/* 提现确认弹窗 */}
      <Modal
        title="确认提现"
        open={withdrawModalVisible}
        onCancel={() => {
          setWithdrawModalVisible(false);
          setWithdrawingUser(null);
        }}
        footer={null}
        width={500}
      >
        {withdrawingUser && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>用户ID:</strong> {withdrawingUser.user.username}</p>
              <p><strong>昵称:</strong> {withdrawingUser.user.nickname}</p>
              <p><strong>手机号:</strong> {withdrawingUser.user.phone}</p>
              <p><strong>微信:</strong> {withdrawingUser.user.wechat}</p>
              {withdrawingUser.user.integral_w && (
                <p><strong>支付宝账号:</strong> {withdrawingUser.user.integral_w}</p>
              )}
              {withdrawingUser.user.integral_z && (
                <p><strong>真实姓名:</strong> {withdrawingUser.user.integral_z}</p>
              )}
              <p>
                <strong>待打款金额:</strong>{' '}
                <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: '18px' }}>
                  ¥{withdrawingUser.totalAmount / 100}
                </span>
              </p>
              <p>
                <strong>交易笔数:</strong>{' '}
                <Tag color="blue">{withdrawingUser.transactionCount}笔</Tag>
              </p>
              <p>
                <strong>已提现总额:</strong>{' '}
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                  ¥{(withdrawingUser.user.wallet?.total_withdrawn || 0) / 100}
                </span>
              </p>
            </div>

            {/* 显示收款二维码 */}
            {withdrawingUser.user?.wallet?.alipay_qr_code && (
              <div style={{
                marginTop: 16,
                padding: 16,
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: '4px',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0, fontWeight: 'bold', marginBottom: 12 }}>支付宝收款二维码：</p>
                <img
                  src={withdrawingUser.user.wallet.alipay_qr_code}
                  alt="支付宝收款码"
                  style={{ width: 300, height: 300, display: 'block', margin: '0 auto' }}
                />
              </div>
            )}

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setWithdrawModalVisible(false);
                  setWithdrawingUser(null);
                }}>
                  取消
                </Button>
                <Button
                  type="primary"
                  onClick={handleWithdrawSubmit}
                  loading={withdrawing}
                >
                  确认提现
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* 收款码查看弹窗 */}
      <Modal
        title="支付宝收款码"
        open={qrModalVisible}
        onCancel={() => {
          setQrModalVisible(false);
          setCurrentQrCode(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setQrModalVisible(false);
            setCurrentQrCode(null);
          }}>
            关闭
          </Button>
        ]}
        width={450}
        centered
      >
        {currentQrCode && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <img
              src={currentQrCode}
              alt="支付宝收款码"
              style={{
                width: 350,
                height: 350,
                objectFit: 'contain',
                border: '1px solid #d9d9d9',
                borderRadius: '4px'
              }}
            />
            <p style={{ marginTop: 12, color: '#666' }}>请使用支付宝扫一扫</p>
          </div>
        )}
      </Modal>

      {/* 驳回兑换确认弹窗 */}
      <Modal
        title="驳回兑换"
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          setRejectingUser(null);
          setRejectReason('');
        }}
        footer={null}
        width={500}
      >
        {rejectingUser && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>用户ID:</strong> {rejectingUser.user.username}</p>
              <p><strong>昵称:</strong> {rejectingUser.user.nickname}</p>
              <p>
                <strong>待打款金额:</strong>{' '}
                <span style={{ color: '#f5222d', fontWeight: 'bold', fontSize: '16px' }}>
                  ¥{rejectingUser.totalAmount / 100}
                </span>
              </p>
              <p>
                <strong>返还积分:</strong>{' '}
                <span style={{ color: '#52c41a', fontWeight: 'bold', fontSize: '16px' }}>
                  {rejectingUser.totalAmount} 积分
                </span>
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <strong>驳回原因（可选）:</strong>
              </label>
              <TextArea
                rows={3}
                placeholder="请输入驳回原因..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={200}
                showCount
              />
            </div>

            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setRejectModalVisible(false);
                  setRejectingUser(null);
                  setRejectReason('');
                }}>
                  取消
                </Button>
                <Button
                  danger
                  onClick={handleRejectSubmit}
                  loading={rejecting}
                >
                  确认驳回
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FinancialManagement;
