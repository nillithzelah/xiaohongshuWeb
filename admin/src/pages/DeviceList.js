import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  message,
  Card,
  Space,
  Popconfirm,
  InputNumber,
  Image
} from 'antd';
import { EditOutlined, LockOutlined, UnlockOutlined, PlusOutlined, PlusCircleOutlined } from '@ant-design/icons';
// 注意：已移除DeleteOutlined，改为使用LockOutlined进行锁定操作
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;
const { TextArea } = Input;

const DeviceList = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [users, setUsers] = useState([]);
  const [mentorUsers, setMentorUsers] = useState([]);
  const [form] = Form.useForm();
  const [searchForm] = Form.useForm();
  const { user } = useAuth();

  // 搜索和筛选状态
  const [filters, setFilters] = useState({
    status: undefined,
    assignedUser: undefined,
    keyword: '',
    reviewer: undefined
  });

  useEffect(() => {
    fetchDevices();
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchUsers();
    fetchMentorUsers();
  }, []);

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

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };

      // 添加筛选条件
      if (filters.status) params.status = filters.status;
      if (filters.assignedUser) params.assignedUser = filters.assignedUser;
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.reviewer) params.reviewer = filters.reviewer;

      const response = await axios.get('/devices', { params });

      setDevices(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total
      }));
    } catch (error) {
      message.error('获取设备列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索和筛选
  const handleSearch = (values) => {
    setFilters({
      status: values.status,
      assignedUser: values.assignedUser,
      keyword: values.keyword,
      reviewer: values.reviewer
    });
    setPagination(prev => ({ ...prev, current: 1 })); // 重置到第一页
  };

  // 重置搜索
  const handleReset = () => {
    searchForm.resetFields();
    setFilters({
      status: undefined,
      assignedUser: undefined,
      keyword: '',
      reviewer: undefined
    });
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/devices/users/list');
      setUsers(response.data.data);
    } catch (error) {
      console.error('获取用户列表失败');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      online: 'green',
      offline: 'default',
      protected: 'orange',
      frozen: 'red',
      reviewing: 'blue'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status) => {
    const texts = {
      online: '在线',
      offline: '离线',
      protected: '保护',
      frozen: '冻结',
      reviewing: '审核中'
    };
    return texts[status] || status;
  };

  const getInfluenceColor = (influence) => {
    const colors = {
      new: 'blue',
      old: 'purple',
      real_name: 'cyan',
      opened_shop: 'gold'
    };
    return colors[influence] || 'default';
  };

  const getInfluenceText = (influence) => {
    const texts = {
      new: '新号',
      old: '老号',
      real_name: '实名',
      opened_shop: '开店'
    };
    return texts[influence] || influence;
  };

  // 根据影响力计算增加的积分数量
  const getPointsToAdd = (influence) => {
    if (!influence) return 1; // 默认1分

    // 如果influence是字符串，转换为数组
    const influenceArray = Array.isArray(influence) ? influence : [influence];

    // 根据影响力类型计算积分
    let totalPoints = 0;
    influenceArray.forEach(item => {
      switch (item) {
        case 'new':
          totalPoints += 1; // 新号1分
          break;
        case 'old':
          totalPoints += 2; // 老号2分
          break;
        case 'real_name':
          totalPoints += 1; // 实名1分
          break;
        case 'opened_shop':
          totalPoints += 3; // 开店3分
          break;
        default:
          totalPoints += 1; // 默认1分
      }
    });

    return totalPoints;
  };

  // 处理增加积分
  const handleAddPoints = async (device) => {
    const pointsToAdd = getPointsToAdd(device.influence);
    try {
      const response = await axios.put(`/devices/${device._id}/add-points`, {
        pointsToAdd
      });

      if (response.data.success) {
        message.success(`成功增加 ${pointsToAdd} 积分`);
        fetchDevices(); // 刷新数据
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '增加积分失败';
      message.error(errorMessage);
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    form.resetFields();
    // 设置新增设备的默认值
    form.setFieldsValue({
      status: 'online',
      influence: ['new'], // 默认选择新号
      onlineDuration: 0,
      points: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingDevice(record);
    form.setFieldsValue({
      phone: record.phone,
      accountId: record.accountId,
      accountName: record.accountName,
      assignedUser: record.assignedUser?._id,
      status: record.status,
      influence: Array.isArray(record.influence) ? record.influence : [record.influence], // 确保是数组格式
      onlineDuration: record.onlineDuration,
      points: record.points,
      remark: record.remark
    });
    setModalVisible(true);
  };

  const handleToggleLock = async (device) => {
    try {
      const response = await axios.put(`/devices/${device._id}/toggle-lock`);
      if (response.data.success) {
        message.success(`设备${response.data.data.isLocked ? '锁定' : '解锁'}成功`);
        fetchDevices(); // 刷新数据
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingDevice) {
        await axios.put(`/devices/${editingDevice._id}`, values);
        message.success('设备更新成功');
      } else {
        await axios.post('/devices', values);
        message.success('设备创建成功');
      }
      setModalVisible(false);
      fetchDevices();
    } catch (error) {
      const errorMessage = error.response?.data?.message || '操作失败';
      message.error(errorMessage);
    }
  };

  const columns = [
    {
      title: '小红书昵称',
      dataIndex: 'accountName',
      key: 'accountName',
      width: 120,
      ellipsis: true
    },
    {
      title: '账号ID',
      dataIndex: 'accountId',
      key: 'accountId',
      width: 100,
      ellipsis: true
    },
    {
      title: '审核图片',
      dataIndex: 'reviewImage',
      key: 'reviewImage',
      width: 90,
      render: (imageUrl) => imageUrl ? (
        <Image src={imageUrl} width={60} height={60} style={{ borderRadius: '4px' }} />
      ) : <span style={{ color: '#999', fontSize: '12px' }}>无图片</span>
    },
    {
      title: '兼职用户',
      dataIndex: 'assignedUser',
      key: 'assignedUser',
      width: 100,
      render: (assignedUser) => assignedUser ? assignedUser.nickname || assignedUser.username : '未分配',
      ellipsis: true
    },
    {
      title: '带教老师',
      dataIndex: 'assignedUser',
      key: 'assignedMentor',
      width: 100,
      render: (assignedUser) => {
        if (!assignedUser || !assignedUser.mentor_id) return '未分配';
        return assignedUser.mentor_id.nickname || assignedUser.mentor_id.username;
      },
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Tag color={getStatusColor(status)}>
            {getStatusText(status)}
          </Tag>
          {status === 'online' && (user?.role === 'manager' || user?.role === 'boss') && (
            <Button
              type="primary"
              size="small"
              icon={<PlusCircleOutlined />}
              onClick={() => handleAddPoints(record)}
              style={{ fontSize: '11px', padding: '0 6px', height: '22px' }}
            >
              +{getPointsToAdd(record.influence)}
            </Button>
          )}
        </div>
      )
    },
    {
      title: '影响力',
      dataIndex: 'influence',
      key: 'influence',
      width: 120,
      render: (influence) => {
        if (!influence) return '--';

        // 如果influence是字符串，转换为数组
        const influenceArray = Array.isArray(influence) ? influence : [influence];

        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
            {influenceArray.map((item, index) => (
              <Tag key={index} color={getInfluenceColor(item)} style={{ fontSize: '11px', padding: '0 4px' }}>
                {getInfluenceText(item)}
              </Tag>
            ))}
          </div>
        );
      }
    },
    {
      title: '时长',
      dataIndex: 'onlineDuration',
      key: 'onlineDuration',
      width: 70,
      render: (duration) => `${duration || 0}h`
    },
    {
      title: '积分',
      dataIndex: 'points',
      key: 'points',
      width: 60,
      render: (points) => (
        <span style={{ fontWeight: 'bold', color: '#1890ff', fontSize: '12px' }}>
          {points || 0}
        </span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ padding: '0 4px' }}
          >
            编辑
          </Button>
          {(user?.role === 'manager' || user?.role === 'boss') && (
            <Button
              type="link"
              size="small"
              danger
              icon={<LockOutlined />}
              onClick={() => handleToggleLock(record)}
              style={{ padding: '0 4px' }}
            >
              锁定
            </Button>
          )}
        </Space>
      )
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 150,
      ellipsis: true,
      render: (remark) => {
        if (!remark) return '--';
        return (
          <div style={{
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '12px'
          }}
          title={remark}
          >
            {remark}
          </div>
        );
      }
    },
    {
      title: '手机号码',
      dataIndex: 'phone',
      key: 'phone',
      width: 110
    }
  ];

  return (
    <div>
      <Card
        title="设备管理"
        extra={
          (user?.role === 'manager' || user?.role === 'boss' || user?.role === 'hr') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增设备
            </Button>
          )
        }
      >
        {/* 搜索和筛选区域 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '500' }}>设备状态:</span>
          <Select
            placeholder="选择设备状态"
            value={filters.status || undefined}
            onChange={(value) => {
              setFilters(prev => ({ ...prev, status: value }));
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="online">在线</Option>
            <Option value="offline">离线</Option>
            <Option value="protected">保护</Option>
            <Option value="frozen">冻结</Option>
            <Option value="reviewing">审核中</Option>
          </Select>

          <span style={{ fontWeight: '500' }}>带教老师:</span>
           <Select
             placeholder="选择带教老师"
             value={filters.reviewer || undefined}
             onChange={(value) => {
               setFilters(prev => ({ ...prev, reviewer: value }));
               setPagination(prev => ({ ...prev, current: 1 }));
             }}
             style={{ width: 120 }}
             allowClear
           >
             {mentorUsers.map(user => (
               <Option key={user._id} value={user._id}>
                 {user.nickname || user.username}
               </Option>
             ))}
           </Select>

          <span style={{ fontWeight: '500' }}>搜索:</span>
          <Input
            placeholder="小红书昵称"
            value={filters.keyword}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, keyword: e.target.value }));
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 200 }}
            allowClear
          />

          <span style={{ fontWeight: '500' }}>兼职用户:</span>
          <Select
            placeholder="选择兼职用户"
            value={filters.assignedUser || undefined}
            onChange={(value) => {
              setFilters(prev => ({ ...prev, assignedUser: value }));
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 140 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {users.map(u => (
              <Option key={u._id} value={u._id}>
                {u.nickname || u.username}
              </Option>
            ))}
          </Select>

          <Button onClick={handleReset}>
            重置
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={devices}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1300 }}
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
        title={editingDevice ? '编辑设备' : '新增设备'}
        width={700}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            {editingDevice ? '更新' : '创建'}
          </Button>
        ]}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            label="账号ID"
            name="accountId"
            rules={[{ required: true, message: '请输入账号ID' }]}
          >
            <Input placeholder="请输入账号ID" />
          </Form.Item>

          <Form.Item
            label="昵称"
            name="accountName"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input placeholder="请输入昵称" />
          </Form.Item>

          <Form.Item
            label="兼职用户"
            name="assignedUser"
          >
            <Select
              placeholder="选择兼职用户"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {users.map(user => (
                <Option key={user._id} value={user._id}>
                  {user.nickname || user.username}
                  {user.phone && ` (${user.phone})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="设备状态"
            name="status"
            rules={[{ required: true, message: '请选择设备状态' }]}
          >
            <Select placeholder="选择设备状态">
              <Option value="online">在线</Option>
              <Option value="offline">离线</Option>
              <Option value="protected">保护</Option>
              <Option value="frozen">冻结</Option>
              <Option value="reviewing">审核中</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="影响力"
            name="influence"
            rules={[
              { required: true, message: '请选择影响力' },
              {
                validator: (_, value) => {
                  if (!value || value.length === 0) {
                    return Promise.reject('请选择至少一个影响力');
                  }
                  // 检查老号和新号是否同时选择
                  if (value.includes('new') && value.includes('old')) {
                    return Promise.reject('新号和老号不能同时选择');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="选择影响力（新号和老号二选一，开店和实名可多选）"
              maxTagCount={2}
              style={{ width: '100%' }}
            >
              <Option value="new">新号</Option>
              <Option value="old">老号</Option>
              <Option value="real_name">实名</Option>
              <Option value="opened_shop">开店</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="上线时长(小时)"
            name="onlineDuration"
            rules={[{ required: true, message: '请输入上线时长' }]}
          >
            <InputNumber
              min={0}
              placeholder="请输入上线时长"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="积分"
            name="points"
            rules={[{ required: true, message: '请输入积分' }]}
          >
            <InputNumber
              min={0}
              placeholder="请输入积分"
              style={{ width: '100%' }}
              disabled={user?.role === 'mentor'} // 带教老师不能修改积分
            />
          </Form.Item>

          <Form.Item
            label="备注"
            name="remark"
          >
            <TextArea
              rows={3}
              placeholder="请输入备注信息"
            />
          </Form.Item>

          <Form.Item
            label="手机号码"
            name="phone"
          >
            <Input placeholder="请输入手机号码（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceList;
