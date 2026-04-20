import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, Select, message, Space, Card, Popconfirm } from 'antd';
import { EditOutlined, UserAddOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const StaffList = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm] = Form.useForm();

  // 修改密码相关状态
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 搜索和筛选状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterRole, setFilterRole] = useState('');

  // 角色权限控制：定义每个角色可以创建哪些员工角色
  const getCreatableRoles = (userRole) => {
    const rolePermissions = {
      boss: ['manager', 'finance', 'mentor', 'hr', 'promoter'],
      manager: ['mentor', 'hr', 'promoter'],
      mentor: [],
      finance: [],
      hr: []
    };
    return rolePermissions[userRole] || [];
  };

  // 获取当前用户可以创建的角色选项
  const creatableRoles = getCreatableRoles(user?.role || '');

  // 获取当前用户可以分配的角色选项（编辑时使用）
  const getAssignableRoles = (userRole) => {
    const currentLevel = roleLevels[userRole] || 0;
    const staffRoles = ['hr', 'mentor', 'finance', 'manager', 'promoter'];

    // 返回所有级别低于当前用户的员工角色
    return staffRoles.filter(role => roleLevels[role] < currentLevel);
  };

  // 定义角色级别（员工专用）
  const roleLevels = {
    hr: 2,
    mentor: 2,
    promoter: 1,
    finance: 4,
    manager: 4,
    boss: 5
  };

  // 获取当前用户可以编辑的字段
  const getEditableFields = (userRole, targetUser, isEditing) => {
    if (!isEditing) {
      // 创建员工时的字段权限
      return ['username', 'password', 'role', 'nickname', 'phone', 'wechat', 'notes'];
    }

    // 编辑员工时的字段权限
    const fields = [];

    const currentUserLevel = roleLevels[userRole] || 0;
    const targetUserLevel = roleLevels[targetUser?.role] || 0;

    // 可以修改用户名和角色的条件：当前用户级别高于目标用户级别
    const canModifyUsernameAndRole = currentUserLevel > targetUserLevel;

    if (userRole === 'boss' || userRole === 'manager') {
      // 只有当前用户级别高于目标用户级别时，才能编辑
      if (canModifyUsernameAndRole) {
        fields.push('username', 'nickname', 'role', 'phone', 'wechat', 'notes');
      }
    } else if (user?.id === targetUser?._id) {
      // 员工可以编辑自己的基本信息
      fields.push('nickname', 'phone', 'wechat', 'notes');
    }

    return fields;
  };

  // 获取当前编辑的字段权限
  const editableFields = getEditableFields(user?.role, editingUser, !!editingUser);

  useEffect(() => {
    fetchUsers();
  }, [pagination.current, pagination.pageSize, searchKeyword, filterRole]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/users', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          keyword: searchKeyword || undefined,
          role: filterRole || undefined,
          viewType: 'staff'
        }
      });

      setUsers(response.data.users);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total
      }));
    } catch (error) {
      message.error('获取员工列表失败');
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      mentor: 'green',
      hr: 'cyan',
      manager: 'purple',
      boss: 'red',
      finance: 'orange',
      promoter: 'blue'
    };
    return colors[role] || 'default';
  };

  const getRoleText = (role) => {
    const texts = {
      mentor: '带教老师',
      hr: 'HR',
      manager: '主管',
      boss: '老板',
      finance: '财务',
      promoter: '引流人员'
    };
    return texts[role] || role;
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setUserModalVisible(true);
    userForm.resetFields();
  };

  const handleEditUser = (record) => {
    setEditingUser(record);
    setUserModalVisible(true);
    userForm.setFieldsValue({
      username: record.username,
      role: record.role,
      nickname: record.nickname,
      phone: record.phone,
      wechat: record.wechat,
      notes: record.notes
    });
  };

  const handleUserSubmit = async (values) => {
    try {
      if (editingUser) {
        // 更新员工
        await axios.put(`/users/${editingUser._id}`, values);
        message.success('员工更新成功');
      } else {
        // 创建员工
        await axios.post('/auth/register', values);
        message.success('员工创建成功');
      }

      setUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      const errorMsg = error.response?.data?.message || (editingUser ? '员工更新失败' : '员工创建失败');
      message.error(errorMsg);
    }
  };

  const handleDeleteUser = async (record) => {
    try {
      await axios.delete(`/users/${record._id}`);
      message.success('员工删除成功');
      fetchUsers();
    } catch (error) {
      const errorMessage = error.response?.data?.message || '员工删除失败';
      message.error(errorMessage);
    }
  };

  // 打开修改密码弹窗
  const handleChangePassword = (record) => {
    setPasswordUser(record);
    setPasswordModalVisible(true);
    passwordForm.resetFields();
  };

  // 提交修改密码
  const handlePasswordSubmit = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordLoading(true);

      await axios.put(`/users/${passwordUser._id}/change-password`, {
        newPassword: values.newPassword
      });

      message.success('密码修改成功');
      setPasswordModalVisible(false);
      setPasswordUser(null);
      passwordForm.resetFields();
    } catch (error) {
      const errorMessage = error.response?.data?.message || '密码修改失败';
      message.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  // 取消修改密码
  const handlePasswordCancel = () => {
    setPasswordModalVisible(false);
    setPasswordUser(null);
    passwordForm.resetFields();
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
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={getRoleColor(role)}>
          {getRoleText(role)}
        </Tag>
      )
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '微信号',
      dataIndex: 'wechat',
      key: 'wechat',
    },
    {
      title: '注册时间',
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
      title: '操作',
      key: 'action',
      render: (_, record) => {
        // 检查当前用户是否有权限编辑这个员工
        const canEditFields = getEditableFields(user?.role, record, true);
        const canEdit = canEditFields.length > 0;

        // 检查当前用户是否有权限删除这个员工
        const currentUserLevel = roleLevels[user?.role] || 0;
        const targetUserLevel = roleLevels[record.role] || 0;
        const canDelete = currentUserLevel > targetUserLevel && record.role !== 'boss';

        // 只有老板和经理可以修改密码
        const canChangePassword = user?.role === 'boss' || user?.role === 'manager';

        return (
          <Space>
            {canEdit && (
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEditUser(record)}
              >
                编辑
              </Button>
            )}
            {canChangePassword && (
              <Button
                type="link"
                icon={<KeyOutlined />}
                onClick={() => handleChangePassword(record)}
              >
                修改密码
              </Button>
            )}
            {canDelete && (
              <Popconfirm
                title="确认删除"
                description={`确定要删除员工 "${record.username}" 吗？`}
                onConfirm={() => handleDeleteUser(record)}
                okText="确认删除"
                cancelText="取消"
              >
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <Card
        title="公司员工管理"
        extra={
          creatableRoles.length > 0 ? (
            <Button type="primary" icon={<UserAddOutlined />} onClick={handleAddUser}>
              添加员工
            </Button>
          ) : null
        }
      >
        {/* 搜索和筛选区域 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '500' }}>搜索:</span>
          <Input
            placeholder="用户名/昵称/手机号"
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 250 }}
            allowClear
          />
          <span style={{ fontWeight: '500' }}>角色:</span>
          <Select
            placeholder="选择角色"
            value={filterRole || undefined}
            onChange={(value) => {
              setFilterRole(value);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 120 }}
            allowClear
          >

            <Option value="hr">HR</Option>
            <Option value="mentor">带教老师</Option>
            <Option value="finance">财务</Option>
            <Option value="manager">主管</Option>
            <Option value="boss">老板</Option>
            <Option value="promoter">引流人员</Option>
          </Select>
          <Button onClick={() => {
            setSearchKeyword('');
            setFilterRole('');
            setPagination(prev => ({ ...prev, current: 1 }));
          }}>重置</Button>
        </div>

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
        title={editingUser ? '编辑员工' : '添加员工'}
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
      >
        {editableFields.length > 0 ? (
          <Form
            form={userForm}
            onFinish={handleUserSubmit}
            layout="vertical"
          >
            {editableFields.includes('username') && (
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input placeholder="请输入用户名" disabled={!editableFields.includes('username')} />
              </Form.Item>
            )}

            {editableFields.includes('password') && !editingUser && (
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>
            )}

            {editableFields.includes('role') && (
              <Form.Item
                label="角色"
                name="role"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select placeholder="请选择角色" disabled={!editableFields.includes('role')}>
                  {(editingUser ? getAssignableRoles(user?.role) : creatableRoles).map(role => (
                    <Option key={role} value={role}>
                      {getRoleText(role)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {editableFields.includes('nickname') && (
              <Form.Item label="昵称" name="nickname">
                <Input placeholder="请输入昵称" />
              </Form.Item>
            )}

            {editableFields.includes('phone') && (
              <Form.Item label="手机号" name="phone">
                <Input placeholder="请输入手机号" />
              </Form.Item>
            )}

            {editableFields.includes('wechat') && (
              <Form.Item label="微信号" name="wechat">
                <Input placeholder="请输入微信号" />
              </Form.Item>
            )}

            {editableFields.includes('notes') && (
              <Form.Item label="备注" name="notes">
                <Input.TextArea placeholder="请输入备注信息" rows={3} />
              </Form.Item>
            )}

            <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
              <Space>
                <Button onClick={() => setUserModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  {editingUser ? '更新' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>您没有权限{editingUser ? '编辑' : '创建'}此员工</p>
            <p style={{ color: '#666', marginTop: '8px' }}>
              请联系管理员获取相应权限
            </p>
          </div>
        )}
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title={`修改密码 - ${passwordUser?.username || ''}`}
        open={passwordModalVisible}
        onOk={handlePasswordSubmit}
        onCancel={handlePasswordCancel}
        confirmLoading={passwordLoading}
        okText="确认修改"
        cancelText="取消"
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少需要6位字符' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StaffList;