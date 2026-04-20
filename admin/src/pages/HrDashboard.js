import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Table,
  Tag,
  message,
  Space,
  Modal,
  Row,
  Col,
  Statistic,
  Spin,
  Typography
} from 'antd';
import { PlusOutlined, TeamOutlined, UserOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { TextArea } = Input;

const HrDashboard = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({
    totalLeads: 0,
    assignedLeads: 0
  });
  const [xiaohongshuAccounts, setXiaohongshuAccounts] = useState([{ account: '', nickname: '' }]);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchMyLeads();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);
      // 获取HR创建的总线索数和已分配线索数
      const leadsResponse = await axios.get('/hr/my-leads');
      const leads = leadsResponse.data.leads || [];
      const totalLeads = leads.length;
      const assignedLeads = leads.filter(lead => lead.role === 'part_time').length;

      setStats({
        totalLeads,
        assignedLeads
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchMyLeads = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/hr/my-leads');
      if (response.data.success) {
        setLeads(response.data.leads);
      }
    } catch (error) {
      message.error('获取线索列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加小红书账号
  const addXiaohongshuAccount = () => {
    setXiaohongshuAccounts([...xiaohongshuAccounts, { account: '', nickname: '' }]);
  };

  // 删除小红书账号
  const removeXiaohongshuAccount = (index) => {
    if (xiaohongshuAccounts.length > 1) {
      const newAccounts = xiaohongshuAccounts.filter((_, i) => i !== index);
      setXiaohongshuAccounts(newAccounts);
    }
  };

  // 更新小红书账号
  const updateXiaohongshuAccount = (index, field, value) => {
    const newAccounts = [...xiaohongshuAccounts];
    newAccounts[index][field] = value;
    setXiaohongshuAccounts(newAccounts);
  };

  const handleCreateLead = async (values) => {
    try {
      // 过滤掉空的小红书账号
      const validAccounts = xiaohongshuAccounts.filter(
        account => account.account.trim() && account.nickname.trim()
      );

      if (validAccounts.length === 0) {
        message.error('请至少添加一个有效的小红书账号');
        return;
      }

      const leadData = {
        ...values,
        xiaohongshuAccounts: validAccounts
      };

      const response = await axios.post('/hr/create-lead', leadData);
      if (response.data.success) {
        message.success('线索创建成功');
        setCreateModalVisible(false);
        form.resetFields();
        setXiaohongshuAccounts([{ account: '', nickname: '' }]); // 重置账号列表
        fetchMyLeads();
        fetchDashboardData(); // 重新获取统计数据
      }
    } catch (error) {
      message.error('创建线索失败');
    }
  };

  const handleDeleteLead = async (leadId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个线索吗？删除后无法恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await axios.delete(`/hr/delete-lead/${leadId}`);
          if (response.data.success) {
            message.success('线索删除成功');
            fetchMyLeads();
            fetchDashboardData(); // 重新获取统计数据
          }
        } catch (error) {
          message.error('删除线索失败');
        }
      }
    });
  };

  const getStatusText = (lead) => {
    if (lead.role === 'lead') {
      return '线索';
    } else if (lead.role === 'part_time' && lead.mentor_id) {
      return `已分配给带教老师`;
    }
    return '未知状态';
  };

  const getStatusColor = (lead) => {
    if (lead.role === 'lead') {
      return 'orange';
    } else if (lead.role === 'part_time') {
      return 'green';
    }
    return 'default';
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '微信',
      dataIndex: 'wechat',
      key: 'wechat',
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => (
        <Tag color={getStatusColor(record)}>
          {getStatusText(record)}
        </Tag>
      )
    },
    {
      title: '分配带教老师',
      dataIndex: ['mentor_id', 'username'],
      key: 'mentor_id',
      render: (mentorId) => mentorId || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => {
        if (!date) return '-';
        try {
          const d = new Date(date);
          return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN');
        } catch {
          return '-';
        }
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteLead(record._id)}
            disabled={record.mentor_id} // 已分配带教老师的用户不能删除
          >
            删除
          </Button>
        </Space>
      ),
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
                title="我的线索总数"
                value={stats.totalLeads}
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
                title="已分配线索"
                value={stats.assignedLeads}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="我的线索列表"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建线索
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={leads}
          rowKey="_id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
        />
      </Card>

      {/* 创建线索模态框 */}
      <Modal
        title="创建新线索"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          onFinish={handleCreateLead}
          layout="vertical"
        >
          <Form.Item
            label="客户姓名"
            name="nickname"
            rules={[{ required: true, message: '请输入客户姓名' }]}
          >
            <Input placeholder="请输入客户姓名" />
          </Form.Item>

          <Form.Item
            label="联系电话"
            name="phone"
            rules={[
              { required: true, message: '请输入联系电话' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码' }
            ]}
          >
            <Input placeholder="请输入11位手机号码" />
          </Form.Item>

          <Form.Item
            label="微信号"
            name="wechat"
          >
            <Input placeholder="请输入微信号（可选）" />
          </Form.Item>

          <Form.Item
            label="备注信息"
            name="notes"
          >
            <TextArea
              placeholder="请输入备注信息（可选）"
              rows={4}
            />
          </Form.Item>

          <Form.Item
            label="小红书账号信息"
            required
          >
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: '#666', fontSize: '14px' }}>
                为该线索录入小红书账号信息，每个账号将对应创建一个设备
              </span>
            </div>

            {xiaohongshuAccounts.map((account, index) => (
              <Row key={index} gutter={16} style={{ marginBottom: 8 }} align="middle">
                <Col span={10}>
                  <Input
                    placeholder="小红书账号"
                    value={account.account}
                    onChange={(e) => updateXiaohongshuAccount(index, 'account', e.target.value)}
                  />
                </Col>
                <Col span={10}>
                  <Input
                    placeholder="小红书昵称"
                    value={account.nickname}
                    onChange={(e) => updateXiaohongshuAccount(index, 'nickname', e.target.value)}
                  />
                </Col>
                <Col span={4}>
                  {xiaohongshuAccounts.length > 1 && (
                    <Button
                      type="link"
                      danger
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeXiaohongshuAccount(index)}
                    >
                      删除
                    </Button>
                  )}
                </Col>
              </Row>
            ))}

            <Button
              type="dashed"
              onClick={addXiaohongshuAccount}
              block
              icon={<PlusOutlined />}
              style={{ marginTop: 8 }}
            >
              添加小红书账号
            </Button>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                创建线索
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HrDashboard;