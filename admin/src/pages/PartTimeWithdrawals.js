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
  Input,
  Select
} from 'antd';
import { WalletOutlined, DollarOutlined, UserOutlined, QrcodeOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { TextArea } = Input;
const { Option } = Select;

const PartTimeWithdrawals = () => {
  const { user } = useAuth();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawingUser, setWithdrawingUser] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAmount: 0,
    totalTransactions: 0
  });
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState(null);

  // 驳回兑换相关状态
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // 搜索和筛选状态
  const [filters, setFilters] = useState({
    trainingStatus: undefined,
    keyword: '',
    mentorId: undefined
  });
  const [mentorUsers, setMentorUsers] = useState([]);

  // 角色权限控制
  const canAccess = ['boss', 'finance', 'manager'].includes(user?.role);

  // 获取带教老师列表
  const fetchMentorUsers = async () => {
    try {
      const response = await axios.get('/users', {
        params: { role: 'mentor', limit: 1000 }
      });
      setMentorUsers(response.data.users || []);
    } catch (error) {
      console.error('获取带教老师列表失败:', error);
    }
  };

  // 获取兼职用户待打款列表
  const fetchPendingUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      // 添加筛选条件
      if (filters.trainingStatus) params.trainingStatus = filters.trainingStatus;
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.mentorId) params.mentorId = filters.mentorId;

      const response = await axios.get('/admin/finance/part-time-pending', { params });
      if (response.data.success) {
        setPendingUsers(response.data.transactions || []);
        // 计算统计数据
        const transactions = response.data.transactions || [];
        setStats({
          totalUsers: transactions.length,
          totalAmount: transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0),
          totalTransactions: transactions.reduce((sum, t) => sum + t.transactionCount, 0)
        });
      }
    } catch (error) {
      console.error('获取待打款列表失败:', error);
      message.error('获取待打款列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchPendingUsers();
      fetchMentorUsers();
    }
  }, []);

  // 当筛选条件变化时重新获取数据
  useEffect(() => {
    if (canAccess) {
      fetchPendingUsers();
    }
  }, [filters]);

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
      fetchPendingUsers(); // 刷新列表
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
      fetchPendingUsers(); // 刷新列表
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
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="待打款用户数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待打款总金额"
              value={stats.totalAmount / 100}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待处理交易数"
              value={stats.totalTransactions}
              suffix="笔"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 列表 */}
      <Card
        title="兼职用户待打款列表"
        extra={
          <Button
            icon={<WalletOutlined />}
            onClick={fetchPendingUsers}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {/* 搜索和筛选区域 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '12px', background: '#fafafa', borderRadius: '8px' }}>
          <span style={{ fontWeight: '500' }}>培训状态:</span>
          <Select
            placeholder="选择培训状态"
            value={filters.trainingStatus || undefined}
            onChange={(value) => {
              setFilters(prev => ({ ...prev, trainingStatus: value }));
            }}
            style={{ width: 140 }}
            allowClear
          >
            <Option value="已筛选">已筛选</Option>
            <Option value="培训中">培训中</Option>
            <Option value="业务实操">业务实操</Option>
            <Option value="评论能力培养">评论能力培养</Option>
            <Option value="发帖能力培养">发帖能力培养</Option>
            <Option value="素人已申请发帖内容">素人已申请发帖内容</Option>
            <Option value="持续跟进">持续跟进</Option>
            <Option value="已结业">已结业</Option>
            <Option value="未通过">未通过</Option>
            <Option value="中止">中止</Option>
          </Select>

          <span style={{ fontWeight: '500' }}>带教老师:</span>
          <Select
            placeholder="选择带教老师"
            value={filters.mentorId || undefined}
            onChange={(value) => {
              setFilters(prev => ({ ...prev, mentorId: value }));
            }}
            style={{ width: 140 }}
            allowClear
          >
            {mentorUsers.map(u => (
              <Option key={u._id} value={u._id}>
                {u.nickname || u.username}
              </Option>
            ))}
          </Select>

          <span style={{ fontWeight: '500' }}>搜索:</span>
          <Input
            placeholder="昵称/手机号/微信号"
            value={filters.keyword}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, keyword: e.target.value }));
            }}
            style={{ width: 180 }}
            allowClear
            prefix={<SearchOutlined />}
          />

          <Button onClick={() => setFilters({ trainingStatus: undefined, keyword: '', mentorId: undefined })}>
            重置
          </Button>
        </div>
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

export default PartTimeWithdrawals;
