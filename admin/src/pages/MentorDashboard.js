import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Spin
} from 'antd';
import { EditOutlined, UserOutlined, TeamOutlined, FileImageOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const MentorDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [stats, setStats] = useState({
    totalClients: 0,
    pendingReviews: 0
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchMyUsers();
  }, [pagination.current, pagination.pageSize]);

  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);
      // 获取带教老师管理的用户数量
      const usersResponse = await axios.get('/users', {
        params: { page: 1, limit: 1 }
      });

      // 获取HR创建的线索数量（通过hr API）
      const leadsResponse = await axios.get('/hr/my-leads');

      setStats({
        totalClients: usersResponse.data.pagination?.total || 0,
        totalLeads: leadsResponse.data.leads?.length || 0
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchMyUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/users', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          viewType: 'client'  // 过滤掉没有昵称的小程序自动创建用户
        }
      });

      if (response.data.success) {
        // 后端已过滤（通过viewType='client'）
        setUsers(response.data.users || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }));
      }
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (record) => {
    setCurrentUser(record);
    setEditModalVisible(true);
    form.setFieldsValue({
      integral_w: record.integral_w || '',
      integral_z: record.integral_z || ''
    });
  };

  const handleEditSubmit = async (values) => {
    try {
      const response = await axios.put(`/users/${currentUser._id}`, values);

      if (response.data.success) {
        message.success('用户信息更新成功');
        setEditModalVisible(false);
        setCurrentUser(null);
        form.resetFields();
        fetchMyUsers();
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || '更新失败';
      message.error(errorMsg);
    }
  };

  const columns = [
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
      title: '积分号W',
      dataIndex: 'integral_w',
      key: 'integral_w',
      render: (value) => value || <Tag color="orange">未填写</Tag>
    },
    {
      title: '积分号Z',
      dataIndex: 'integral_z',
      key: 'integral_z',
      render: (value) => value || <Tag color="orange">未填写</Tag>
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEditUser(record)}
        >
          编辑积分信息
        </Button>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡片区域 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="客户总数"
                value={stats.totalClients}
                prefix={<TeamOutlined />}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="small" />
              </div>
            ) : (
              <Statistic
                title="我的线索数"
                value={stats.totalLeads}
                prefix={<FileImageOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* <Card
        title={
          <Space>
            <UserOutlined />
            客户管理
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <p>这里显示您创建的所有客户线索，您可以编辑他们的积分信息。</p>
      </Card> */}

      <Card title="客户列表">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          onChange={(pagination) => {
            setPagination(pagination);
          }}
        />
      </Card>

      <Modal
        title="编辑客户积分信息"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentUser(null);
          form.resetFields();
        }}
        footer={null}
      >
        {currentUser && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>客户信息：</strong></p>
            <p>用户名：{currentUser.username}</p>
            <p>昵称：{currentUser.nickname}</p>
            <p>电话：{currentUser.phone}</p>
            {currentUser.wechat && <p>微信：{currentUser.wechat}</p>}
          </div>
        )}

        <Form
          form={form}
          onFinish={handleEditSubmit}
          layout="vertical"
        >
          <Form.Item
            label="积分号W"
            name="integral_w"
            rules={[{ required: true, message: '请输入积分号W' }]}
          >
            <Input placeholder="请输入积分号W" />
          </Form.Item>

          <Form.Item
            label="积分号Z"
            name="integral_z"
            rules={[{ required: true, message: '请输入积分号Z' }]}
          >
            <Input placeholder="请输入积分号Z" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => {
                setEditModalVisible(false);
                setCurrentUser(null);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MentorDashboard;