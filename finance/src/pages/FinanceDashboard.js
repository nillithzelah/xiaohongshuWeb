import React, { useState, useEffect } from 'react';
import { Card, Table, Button, message, Tag, Modal, Form, Input, Statistic, Row, Col, Space, Avatar, Dropdown } from 'antd';
import { DollarOutlined, UserOutlined, CheckCircleOutlined, DownloadOutlined, LogoutOutlined, UserSwitchOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const FinanceDashboard = () => {
  const { user, logout } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalPaid: 0,
    pendingPayments: 0,
    totalUsers: 0
  });
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [paymentForm] = Form.useForm();
  const [submittingPayment, setSubmittingPayment] = useState(false); // 防止重复提交

  const handleLogout = () => {
    logout();
    message.success('已成功登出');
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchPendingPayments(),
        fetchStats()
      ]);
      message.success('数据已刷新');
    } catch (error) {
      message.error('刷新失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: `${user?.username || '用户'} (${user?.role || '角色'})`,
      disabled: true,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '登出',
      onClick: handleLogout,
    },
  ];

  useEffect(() => {
    fetchPendingPayments();
    fetchStats();
  }, []);

  // 数据验证函数
  const validateTransactionData = (data) => {
    if (!Array.isArray(data)) {
      throw new Error('返回数据格式错误：期望数组');
    }

    data.forEach((item, index) => {
      if (!item.user) {
        throw new Error(`第${index + 1}条记录缺少用户信息`);
      }
      if (!item.transactionIds || !Array.isArray(item.transactionIds)) {
        throw new Error(`第${index + 1}条记录缺少交易ID列表`);
      }
      if (typeof item.totalAmount !== 'number' || item.totalAmount <= 0) {
        throw new Error(`第${index + 1}条记录总金额无效`);
      }
    });

    return true;
  };

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/finance/pending', {
        params: {
          page: 1,
          limit: 50
        }
      });

      // 验证响应数据
      if (!response.data || !response.data.transactions) {
        throw new Error('服务器返回数据格式错误');
      }

      // 验证交易数据
      validateTransactionData(response.data.transactions);

      setReviews(response.data.transactions);
    } catch (error) {
      console.error('获取待打款列表失败:', error);
      if (error.message.includes('数据格式') || error.message.includes('缺少')) {
        message.error(`数据验证失败: ${error.message}`);
      } else {
        message.error('获取待打款列表失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/admin/finance/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  };

  const handlePayment = (record) => {
    setCurrentReview(record);
    setPaymentModalVisible(true);
    paymentForm.resetFields();
  };

  const handlePaymentSubmit = async (values) => {
    if (submittingPayment) {
      return; // 防止重复提交
    }

    setSubmittingPayment(true);

    try {
      // 验证数据完整性
      if (!currentReview?.transactionIds || currentReview.transactionIds.length === 0) {
        throw new Error('交易记录ID无效');
      }

      if (!currentReview.user?.wallet?.alipay_account) {
        throw new Error('用户支付宝账号信息不完整');
      }

      if (currentReview.totalAmount <= 0) {
        throw new Error('打款金额无效');
      }

      const response = await axios.post('/admin/finance/pay', {
        transaction_ids: currentReview.transactionIds
      });

      if (response.data.success) {
        const results = response.data.results;
        const successful = results.successful.length;
        const failed = results.failed.length;

        if (failed === 0) {
          message.success(`打款处理成功！已支付 ${currentReview.totalAmount} 元`);
        } else {
          message.warning(`部分打款成功：成功 ${successful} 笔，失败 ${failed} 笔`);
        }

        setPaymentModalVisible(false);
        setCurrentReview(null);

        // 重新获取数据
        await Promise.all([
          fetchPendingPayments(),
          fetchStats()
        ]);
      } else {
        throw new Error(response.data.message || '打款处理失败');
      }

    } catch (error) {
      console.error('打款处理失败:', error);

      // 区分不同错误类型
      let errorMessage = '打款处理失败，请稍后重试';

      if (error.response) {
        // 服务器返回错误
        const status = error.response.status;
        const data = error.response.data;

        if (status === 400) {
          errorMessage = data.message || '请求参数错误';
        } else if (status === 401) {
          errorMessage = '登录已过期，请重新登录';
          // 可以在这里触发登出
          setTimeout(() => logout(), 2000);
        } else if (status === 403) {
          errorMessage = '权限不足，无法执行此操作';
        } else if (status === 404) {
          errorMessage = '交易记录不存在';
        } else if (status === 409) {
          errorMessage = data.message || '交易已被处理或正在处理中';
        } else if (status === 500) {
          errorMessage = '服务器内部错误，请联系管理员';
        }
      } else if (error.request) {
        // 网络错误
        errorMessage = '网络连接失败，请检查网络后重试';
      } else {
        // 其他错误
        errorMessage = error.message || errorMessage;
      }

      message.error(errorMessage);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      message.loading('正在生成Excel文件...', 0);

      const response = await axios.get('/admin/finance/export-excel');

      if (response.data.success) {
        // 将数据转换为CSV格式（简化版）
        const data = response.data.data;
        if (data.length === 0) {
          message.destroy();
          message.warning('没有数据可导出');
          return;
        }

        // 生成CSV内容
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');

        // 添加UTF-8 BOM以确保Excel正确识别中文
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;

        // 创建下载链接
        const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', response.data.filename.replace('.xlsx', '.csv'));

        // 触发下载
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 释放URL对象
        window.URL.revokeObjectURL(url);
      }

      message.destroy();
      message.success('CSV文件导出成功');
    } catch (error) {
      message.destroy();
      message.error('导出文件失败');
      console.error('导出错误:', error);
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

  const columns = [
    {
      title: '用户名',
      dataIndex: ['user', 'username'],
      key: 'username',
      render: (username) => username || '未设置'
    },
    {
      title: '手机号',
      dataIndex: ['user', 'phone'],
      key: 'phone',
      render: (phone) => phone || '未设置'
    },
    {
      title: '微信号',
      dataIndex: ['user', 'integral_w'],
      key: 'integral_w',
      render: (integral_w) => integral_w || '未设置'
    },
    {
      title: '支付宝号',
      dataIndex: ['user', 'integral_z'],
      key: 'integral_z',
      render: (integral_z) => integral_z || '未设置'
    },
    {
      title: '收款人',
      dataIndex: ['user', 'wallet', 'real_name'],
      key: 'real_name',
      render: (wallet) => wallet?.real_name || '未设置'
    },
    {
      title: '收款账号',
      dataIndex: ['user', 'wallet', 'alipay_account'],
      key: 'alipay_account',
      render: (wallet) => wallet?.alipay_account || '未设置'
    },
    {
      title: '已提现',
      dataIndex: ['user', 'wallet', 'total_withdrawn'],
      key: 'totalWithdrawn',
      render: (totalWithdrawn) => totalWithdrawn !== undefined ? `${(totalWithdrawn / 100).toFixed(2)}元` : '0.00元'
    },
    {
      title: '待打款金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{(amount || 0) / 100}元</span>
    },
    {
      title: '交易数量',
      dataIndex: 'transactionCount',
      key: 'transactionCount',
      render: (count) => `${count}笔`
    },
    {
      title: '交易类型',
      dataIndex: 'types',
      key: 'types',
      render: (types) => types.map(type =>
        type === 'task_reward' ? '任务奖励' :
        type === 'referral_bonus_1' ? '一级佣金' :
        type === 'referral_bonus_2' ? '二级佣金' :
        type === 'point_exchange' ? '积分兑换' : type
      ).join(', ')
    },
    {
      title: '最早交易',
      dataIndex: 'earliestCreated',
      key: 'earliestCreated',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button type="primary" onClick={() => handlePayment(record)}>
          确认打款
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <h1>素人分发系统 - 财务管理</h1>

        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: 6,
            background: '#f5f5f5'
          }}>
            <Avatar
              icon={<UserOutlined />}
              style={{ marginRight: 8 }}
            />
            <span>{user?.nickname || user?.username || '用户'}</span>
            <span style={{ margin: '0 8px', color: '#666' }}>|</span>
            <Tag color="blue">{user?.role === 'boss' ? '老板' : user?.role === 'finance' ? '财务' : user?.role === 'manager' ? '主管' : user?.role}</Tag>
          </div>
        </Dropdown>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="累计打款金额"
              value={stats.totalPaid}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="待打款用户"
              value={stats.pendingPayments}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="待打款用户汇总"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              disabled={reviews.length === 0}
            >
              导出Excel
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={reviews}
          rowKey={(record) => record.user._id}
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title="确认打款"
        open={paymentModalVisible}
        onCancel={() => !submittingPayment && setPaymentModalVisible(false)}
        onOk={handlePaymentSubmit}
        okText={submittingPayment ? "处理中..." : "确认已打款"}
        cancelText="取消"
        confirmLoading={submittingPayment}
        maskClosable={!submittingPayment}
        closable={!submittingPayment}
      >
        <div>
          <p><strong>用户名：</strong>{currentReview?.user?.username || '未设置'}</p>
          <p><strong>手机号：</strong>{currentReview?.user?.phone || '未设置'}</p>
          <p><strong>微信号：</strong>{currentReview?.user?.integral_w || '未设置'}</p>
          <p><strong>支付宝号：</strong>{currentReview?.user?.integral_z || '未设置'}</p>
          <p><strong>收款人：</strong>{currentReview?.user?.wallet?.real_name || '未设置'}</p>
          <p><strong>收款账号：</strong>{currentReview?.user?.wallet?.alipay_account || '未设置'}</p>
          <p><strong>待打款金额：</strong>{currentReview?.totalAmount}元</p>
          <p><strong>交易数量：</strong>{currentReview?.transactionCount}笔</p>
          <p><strong>交易类型：</strong>{currentReview?.types?.map(type =>
            type === 'task_reward' ? '任务奖励' :
            type === 'referral_bonus_1' ? '一级佣金' :
            type === 'referral_bonus_2' ? '二级佣金' :
            type === 'point_exchange' ? '积分兑换' : type
          ).join(', ') || '未知'}</p>
        </div>
      </Modal>
    </div>
  );
};

export default FinanceDashboard;