import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Modal, Form, Input, InputNumber, Select, message, Space, Card, Popconfirm, Upload } from 'antd';
import { EditOutlined, UserAddOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, DollarOutlined, PlusOutlined, WalletOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const ClientList = () => {
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
  const [hrUsers, setHrUsers] = useState([]);
  const [mentorUsers, setMentorUsers] = useState([]);
  const [parentUsers, setParentUsers] = useState([]);
  const [userForm] = Form.useForm();

  // 支付宝二维码上传相关状态
  const [alipayQrCodeUrl, setAlipayQrCodeUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // 积分兑换相关状态
  const [exchangeModalVisible, setExchangeModalVisible] = useState(false);
  const [exchangingUser, setExchangingUser] = useState(null);
  const [exchangeForm] = Form.useForm();
  const [exchanging, setExchanging] = useState(false);

  // 提现相关状态
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawingUser, setWithdrawingUser] = useState(null);

  // 二维码预览相关状态
  const [qrCodePreviewVisible, setQrCodePreviewVisible] = useState(false);
  const [qrCodePreviewUrl, setQrCodePreviewUrl] = useState('');

  // 修改密码相关状态
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 锁定用户相关状态
  const [lockModalVisible, setLockModalVisible] = useState(false);
  const [lockingUser, setLockingUser] = useState(null);
  const [lockLoading, setLockLoading] = useState(false);
  const [lockForm] = Form.useForm();

  // 搜索和筛选状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterMentor, setFilterMentor] = useState('');
  const [filterTrainingStatus, setFilterTrainingStatus] = useState('');

  // 待打款金额数据
  const [pendingPayments, setPendingPayments] = useState({});

  // 角色权限控制：boss, manager, mentor, hr 可以访问此页面
  const canAccess = ['boss', 'manager', 'mentor', 'hr'].includes(user?.role);

  // 培训状态顺序定义（用于升级降级）
  const trainingStatusOrder = [
    '已筛选',
    '培训中',
    '业务实操',
    '评论能力培养',
    '发帖能力培养',
    '素人已申请发帖内容',
    '持续跟进',
    '已结业'
  ];

  // 不能通过升级降级修改的状态（只能编辑）
  const nonUpgradableStatuses = ['未通过', '中止'];

  // 获取当前用户可以编辑的字段
  const getEditableFields = (userRole, targetUser, isEditing) => {
    if (!isEditing) {
      // 创建普通用户时的字段权限
      return ['username', 'password', 'nickname', 'phone', 'wechat', 'parent_id', 'notes'];
    }

    // 编辑普通用户时的字段权限
    const fields = [];

    if (userRole === 'boss' || userRole === 'manager') {
      // 老板和主管可以编辑所有字段，包括分配HR和带教老师，以及上级用户和培训状态
      fields.push('username', 'nickname', 'phone', 'wechat', 'integral_w', 'integral_z', 'invitationCode', 'hr_id', 'mentor_id', 'parent_id', 'training_status', 'notes');
    } else if (userRole === 'mentor' && targetUser?.mentor_id?.username === user?.username) {
      // 带教老师可以编辑自己名下的用户，包括积分、上级用户和培训状态
      fields.push('nickname', 'phone', 'wechat', 'integral_w', 'integral_z', 'parent_id', 'training_status', 'notes');
    } else if (userRole === 'hr' && targetUser?.hr_id?.username === user?.username) {
      // HR可以编辑自己创建的用户，包括基本信息和培训状态
      fields.push('nickname', 'phone', 'wechat', 'parent_id', 'training_status', 'notes');
    } else if (user?.id === targetUser?._id) {
      // 用户可以编辑自己的基本信息
      fields.push('nickname', 'phone', 'wechat', 'notes');
    }

    return fields;
  };

  // 获取当前编辑的字段权限
  const editableFields = getEditableFields(user?.role, editingUser, !!editingUser);

  // 调试日志：打印权限检查信息
  console.log('🔍 [权限检查] 当前用户:', user);
  console.log('🔍 [权限检查] 编辑用户:', editingUser);
  console.log('🔍 [权限检查] mentor_id 值:', editingUser?.mentor_id);
  console.log('🔍 [权限检查] mentor_id 类型:', typeof editingUser?.mentor_id);
  console.log('🔍 [权限检查] mentor_id.username:', editingUser?.mentor_id?.username);
  console.log('🔍 [权限检查] 可编辑字段:', editableFields);

  // 获取待打款金额数据
  const fetchPendingPayments = async () => {
    try {
      const response = await axios.get('/admin/finance/pending', {
        params: { page: 1, limit: 1000 } // 获取所有待打款数据
      });

      if (response.data.success) {
        // 将待打款数据转换为以用户ID为键的对象
        const paymentsMap = {};
        response.data.transactions.forEach(item => {
          paymentsMap[item.user._id] = {
            totalAmount: item.totalAmount,
            transactionCount: item.transactionCount,
            types: item.types
          };
        });
        setPendingPayments(paymentsMap);
      }
    } catch (error) {
      console.error('获取待打款数据失败:', error);
    }
  };

  useEffect(() => {
    if (canAccess) {
      fetchUsers();
      fetchSalesAndCsUsers();
      fetchPendingPayments();
    }
  }, [pagination.current, pagination.pageSize, searchKeyword, filterMentor, filterTrainingStatus]);

  const fetchSalesAndCsUsers = async () => {
    try {
      // 获取HR用户列表
      const salesResponse = await axios.get('/users', {
        params: { role: 'hr', limit: 1000 }
      });
      setHrUsers(salesResponse.data.users || []);

      // 获取带教老师和主管用户列表（主管也可以作为带教老师）
      const [mentorResponse, managerResponse] = await Promise.all([
        axios.get('/users', { params: { role: 'mentor', limit: 1000 } }),
        axios.get('/users', { params: { role: 'manager', limit: 1000 } })
      ]);
      const allMentors = [
        ...(mentorResponse.data.users || []),
        ...(managerResponse.data.users || [])
      ];
      setMentorUsers(allMentors);

      // 获取兼职用户列表（上级用户）
      const parentResponse = await axios.get('/users', {
        params: { role: 'part_time', limit: 1000 }
      });
      setParentUsers(parentResponse.data.users || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/users', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          keyword: searchKeyword || undefined,
          managed_by: filterMentor || undefined,
          training_status: filterTrainingStatus || undefined,
          viewType: 'client'
        }
      });

      // 过滤掉培训状态为未设置的用户
      const filteredUsers = (response.data.users || []).filter(user => user.training_status);

      setUsers(filteredUsers);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total
      }));
    } catch (error) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setUserModalVisible(true);
    userForm.resetFields();
    setAlipayQrCodeUrl(''); // 清空二维码URL
    // 设置默认值
    userForm.setFieldsValue({
      role: 'part_time', // 兼职用户固定角色
      training_status: '已筛选' // 默认培训状态
    });
  };

  const handleEditUser = (record) => {
    setEditingUser(record);
    setUserModalVisible(true);
    // 设置支付宝二维码URL：如果用户已有二维码则使用，否则清空
    setAlipayQrCodeUrl(record.alipay_qr_code || '');
    userForm.setFieldsValue({
      username: record.username,
      role: record.role,
      nickname: record.nickname,
      phone: record.phone,
      wechat: record.wechat,
      notes: record.notes,
      integral_w: record.integral_w,
      integral_z: record.integral_z,
      invitationCode: record.invitationCode,
      hr_id: record.hr_id?._id || record.hr_id,
      mentor_id: record.mentor_id?._id || record.mentor_id,
      parent_id: record.parent_id?._id || record.parent_id,
      training_status: record.training_status,
      assigned_to_mentor_at: record.assigned_to_mentor_at
    });
  };

  const handleUserSubmit = async (values) => {
    try {
      // 添加支付宝二维码URL到提交数据
      const submitData = {
        ...values,
        alipay_qr_code: alipayQrCodeUrl
      };

      if (editingUser) {
        // 更新用户
        await axios.put(`/users/${editingUser._id}`, submitData);
        message.success('用户更新成功');
      } else {
        // 创建用户
        await axios.post('/auth/register', submitData);
        message.success('用户创建成功');
      }

      setUserModalVisible(false);
      fetchUsers();
    } catch (error) {
      const errorMsg = error.response?.data?.message || (editingUser ? '用户更新失败' : '用户创建失败');
      message.error(errorMsg);
    }
  };

  // 处理支付宝二维码上传
  const handleAlipayQrCodeUpload = async (info) => {
    const { file } = info;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setAlipayQrCodeUrl(response.data.data.url);
        message.success('支付宝二维码上传成功');
      } else {
        message.error(response.data.message || '上传失败');
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('支付宝二维码上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUser = async (record) => {
    try {
      await axios.delete(`/users/${record._id}`);
      message.success('用户锁定成功');
      fetchUsers();
    } catch (error) {
      const errorMessage = error.response?.data?.message || '用户锁定失败';
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

  // 锁定/解锁用户处理
  const handleLockUser = (record) => {
    setLockingUser(record);
    setLockModalVisible(true);
  };

  const handleLockConfirm = async () => {
    try {
      const values = await lockForm.validateFields();
      setLockLoading(true);

      await axios.put(`/users/${lockingUser._id}/lock`, {
        isLocked: true,
        lockedReason: values.lockedReason
      });

      message.success('用户已锁定');
      setLockModalVisible(false);
      setLockingUser(null);
      lockForm.resetFields();
      fetchUsers();
    } catch (error) {
      const errorMessage = error.response?.data?.message || '操作失败';
      message.error(errorMessage);
    } finally {
      setLockLoading(false);
    }
  };

  const handleUnlockUser = async (record) => {
    try {
      await axios.put(`/users/${record._id}/lock`, {
        isLocked: false
      });
      message.success('用户已解锁');
      fetchUsers();
    } catch (error) {
      const errorMessage = error.response?.data?.message || '操作失败';
      message.error(errorMessage);
    }
  };

  const handleLockCancel = () => {
    setLockModalVisible(false);
    setLockingUser(null);
    lockForm.resetFields();
  };

  // 积分兑换处理
  const handleExchangePoints = (record) => {
    setExchangingUser(record);
    setExchangeModalVisible(true);
    exchangeForm.setFieldsValue({
      pointsToExchange: Math.min(record.points || 0, 100) // 默认兑换积分，最多100
    });
  };

  const handleExchangeSubmit = async (values) => {
    if (!exchangingUser) return;

    setExchanging(true);
    try {
      const response = await axios.post(`/users/${exchangingUser._id}/exchange-points`, {
        pointsToExchange: values.pointsToExchange
      });

      message.success(response.data.message);
      setExchangeModalVisible(false);
      exchangeForm.resetFields();
      fetchUsers(); // 刷新用户列表
      fetchPendingPayments(); // 刷新待打款数据
    } catch (error) {
      const errorMessage = error.response?.data?.message || '积分兑换失败';
      message.error(errorMessage);
    } finally {
      setExchanging(false);
    }
  };

  // 提现处理
  const handleWithdraw = (record) => {
    const paymentData = pendingPayments[record._id];
    if (!paymentData || paymentData.totalAmount <= 0) {
      message.warning('该用户没有待打款金额');
      return;
    }
    setWithdrawingUser(record);
    setWithdrawModalVisible(true);
  };

  const handleWithdrawSubmit = async () => {
    if (!withdrawingUser) return;

    setWithdrawing(true);
    try {
      const response = await axios.post(`/admin/withdraw/${withdrawingUser._id}`);

      message.success(response.data.message);
      setWithdrawModalVisible(false);
      setWithdrawingUser(null);
      fetchUsers(); // 刷新用户列表
      fetchPendingPayments(); // 刷新待打款数据
    } catch (error) {
      const errorMessage = error.response?.data?.message || '提现失败';
      message.error(errorMessage);
    } finally {
      setWithdrawing(false);
    }
  };

  // 升级培训状态
  const handleUpgradeStatus = async (record) => {
    const currentIndex = trainingStatusOrder.indexOf(record.training_status);
    if (currentIndex === -1 || currentIndex >= trainingStatusOrder.length - 1) {
      message.warning('当前状态已是最高级');
      return;
    }

    const newStatus = trainingStatusOrder[currentIndex + 1];

    try {
      await axios.put(`/users/${record._id}/training-status`, {
        training_status: newStatus
      });
      message.success(`培训状态已升级为：${newStatus}`);
      fetchUsers();
    } catch (error) {
      message.error('升级失败');
    }
  };

  // 降级培训状态
  const handleDowngradeStatus = async (record) => {
    const currentIndex = trainingStatusOrder.indexOf(record.training_status);
    if (currentIndex <= 0) {
      message.warning('当前状态已是最低级');
      return;
    }

    const newStatus = trainingStatusOrder[currentIndex - 1];

    try {
      await axios.put(`/users/${record._id}/training-status`, {
        training_status: newStatus
      });
      message.success(`培训状态已降级为：${newStatus}`);
      fetchUsers();
    } catch (error) {
      message.error('降级失败');
    }
  };

  // 筛选处理函数
  const handleMentorFilter = (value) => {
    setFilterMentor(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleReset = () => {
    setSearchKeyword('');
    setFilterMentor('');
    setFilterTrainingStatus('');
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const columns = [
    {
      title: '用户ID',
      dataIndex: 'username',
      key: 'username',
      width: 100,
      ellipsis: true
    },
    {
      title: '培训状态',
      dataIndex: 'training_status',
      key: 'training_status',
      width: 120,
      render: (status) => {
        const statusMap = {
          '已筛选': { color: '#1890ff', text: '已筛选' },
          '培训中': { color: '#faad14', text: '培训中' },
          '业务实操': { color: '#722ed1', text: '业务实操' },
          '评论能力培养': { color: '#13c2c2', text: '评论能力培养' },
          '发帖能力培养': { color: '#36cfc9', text: '发帖能力培养' },
          '素人已申请发帖内容': { color: '#95de64', text: '素人已申请发帖内容' },
          '持续跟进': { color: '#52c41a', text: '持续跟进' },
          '已结业': { color: '#fa8c16', text: '已结业' },
          '未通过': { color: '#f5222d', text: '未通过' },
          '中止': { color: '#820014', text: '中止' }
        };

        const statusInfo = statusMap[status] || { color: '#d9d9d9', text: status || '未设置' };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      }
    },
    {
      title: '状态操作',
      key: 'status_actions',
      width: 120,
      render: (_, record) => {
        // 检查是否有权限操作状态
        const canEditFields = getEditableFields(user?.role, record, true);
        const canEditStatus = canEditFields.includes('training_status');

        // 检查是否可以升级降级（排除未通过和中止状态）
        const canUpgradeDowngrade = canEditStatus && !nonUpgradableStatuses.includes(record.training_status);

        if (!canUpgradeDowngrade) {
          return <span style={{ color: '#999', fontSize: '12px' }}>仅编辑</span>;
        }

        const currentIndex = trainingStatusOrder.indexOf(record.training_status);
        const canUpgrade = currentIndex !== -1 && currentIndex < trainingStatusOrder.length - 1;
        const canDowngrade = currentIndex > 0;

        return (
          <Space size="small">
            {canUpgrade && (
              <Button
                type="link"
                size="small"
                icon={<ArrowUpOutlined />}
                onClick={() => handleUpgradeStatus(record)}
                style={{ padding: '0 4px', color: '#52c41a' }}
                title="升级状态"
              />
            )}
            {canDowngrade && (
              <Button
                type="link"
                size="small"
                icon={<ArrowDownOutlined />}
                onClick={() => handleDowngradeStatus(record)}
                style={{ padding: '0 4px', color: '#faad14' }}
                title="降级状态"
              />
            )}
          </Space>
        );
      }
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 100,
      ellipsis: true
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 110,
      render: (phone) => (
        <span style={{ whiteSpace: 'nowrap' }}>{phone || '-'}</span>
      )
    },
    {
      title: '积分',
      dataIndex: 'points',
      key: 'points',
      width: 70,
      render: (points) => (
        <span style={{ fontWeight: 'bold', color: '#722ed1' }}>
          {points || 0}
        </span>
      )
    },
    {
      title: '待打款',
      key: 'pendingAmount',
      width: 80,
      render: (_, record) => {
        const paymentData = pendingPayments[record._id];
        if (!paymentData) {
          return <span style={{ color: '#999' }}>0</span>;
        }
        return (
          <span style={{ fontWeight: 'bold', color: '#faad14' }}>
            ¥{(paymentData.totalAmount || 0) / 100}
          </span>
        );
      }
    },
    {
      title: '已提现',
      dataIndex: ['wallet', 'total_withdrawn'],
      key: 'totalWithdrawn',
      width: 80,
      render: (totalWithdrawn, record) => (
        <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
          ¥{(record.wallet?.total_withdrawn || 0) / 100}
        </span>
      )
    },
    {
      title: '上级用户',
      dataIndex: 'parent_id',
      key: 'parent_id',
      width: 140,
      ellipsis: true,
      render: (parentId) => {
        if (!parentId) return '-';

        const directParent = parentId.nickname || parentId.username;
        const grandParent = parentId.parent_id ? (parentId.parent_id.nickname || parentId.parent_id.username) : null;

        if (grandParent) {
          return `直属: ${directParent} | 顶层: ${grandParent}`;
        }
        return `直属: ${directParent}`;
      }
    },
    {
      title: '邀请码',
      dataIndex: 'invitationCode',
      key: 'invitationCode',
      width: 120,
      render: (invitationCode) => invitationCode || '-'
    },
    {
      title: '支付宝二维码',
      dataIndex: 'alipay_qr_code',
      key: 'alipay_qr_code',
      width: 100,
      render: (qrCode) => {
        if (!qrCode) {
          return <span style={{ color: '#999' }}>未上传</span>;
        }
        return (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setQrCodePreviewUrl(qrCode);
              setQrCodePreviewVisible(true);
            }}
            style={{ color: '#1890ff', textDecoration: 'none', cursor: 'pointer' }}
          >
            查看二维码
          </span>
        );
      }
    },
    {
      title: '带教老师',
      dataIndex: 'mentor_id',
      key: 'mentor_id',
      width: 100,
      ellipsis: true,
      render: (mentorId) => mentorId ? (mentorId.nickname || mentorId.username) : '-'
    },
    {
      title: 'HR',
      dataIndex: 'hr_id',
      key: 'hr_id',
      width: 80,
      ellipsis: true,
      render: (hrId) => hrId ? (hrId.nickname || hrId.username) : '-'
    },
    {
      title: '分配时间',
      dataIndex: 'assigned_to_mentor_at',
      key: 'assigned_to_mentor_at',
      width: 120,
      render: (date) => {
        if (!date) return '-';
        try {
          const d = new Date(date);
          return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        } catch {
          return '-';
        }
      }
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (date) => {
        if (!date) return '-';
        try {
          const d = new Date(date);
          return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
        } catch {
          return '-';
        }
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        // 检查当前用户是否有权限编辑这个用户
        const canEditFields = getEditableFields(user?.role, record, true);
        const canEdit = canEditFields.length > 0;

        // 检查当前用户是否有权限锁定/解锁这个用户（HR、经理、老板）
        const canLock = ['hr', 'manager', 'boss'].includes(user?.role);

        // 检查是否有待打款金额
        const hasPendingPayment = pendingPayments[record._id] && pendingPayments[record._id].totalAmount > 0;
        // 提现按钮只有老板和主管可以操作
        const canWithdraw = ['boss', 'manager'].includes(user?.role) && hasPendingPayment;

        // 只有老板和经理可以修改密码
        const canChangePassword = ['boss', 'manager'].includes(user?.role);

        return (
          <Space size="small" direction="vertical">
            {canEdit && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditUser(record)}
                style={{ padding: '0 4px' }}
              >
                编辑
              </Button>
            )}
            {canChangePassword && (
              <Button
                type="link"
                size="small"
                icon={<KeyOutlined />}
                onClick={() => handleChangePassword(record)}
                style={{ padding: '0 4px' }}
              >
                修改密码
              </Button>
            )}
            {/* 积分兑换按钮 - 只有老板和主管可以操作，且当用户有积分时才显示 */}
            {(record.points > 0) && ['boss', 'manager'].includes(user?.role) && (
              <Button
                type="link"
                size="small"
                icon={<DollarOutlined />}
                onClick={() => handleExchangePoints(record)}
                style={{ padding: '0 4px', color: '#52c41a' }}
                title="积分兑换"
              >
                兑换
              </Button>
            )}
            {/* 提现按钮 - 只有老板和主管可以操作，且用户有待打款金额时才显示 */}
            {canWithdraw && (
              <Button
                type="link"
                size="small"
                icon={<WalletOutlined />}
                style={{ padding: '0 4px', color: '#1890ff' }}
                title="提现"
                onClick={() => handleWithdraw(record)}
              >
                提现
              </Button>
            )}
            {/* 锁定/解锁按钮 - HR、经理、老板可以操作 */}
            {canLock && (
              record.isLocked ? (
                <Popconfirm
                  title="确认解锁"
                  description={`确定要解锁用户 "${record.username}" 吗？`}
                  onConfirm={() => handleUnlockUser(record)}
                  okText="确认解锁"
                  cancelText="取消"
                >
                  <Button
                    type="link"
                    size="small"
                    icon={<LockOutlined />}
                    style={{ padding: '0 4px', color: '#52c41a' }}
                    title="解锁用户"
                  >
                    解锁
                  </Button>
                </Popconfirm>
              ) : (
                <Button
                  type="link"
                  size="small"
                  icon={<LockOutlined />}
                  onClick={() => handleLockUser(record)}
                  style={{ padding: '0 4px', color: '#faad14' }}
                  title="锁定用户"
                >
                  锁定
                </Button>
              )
            )}
          </Space>
        );
      }
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      width: 150,
      ellipsis: true,
      render: (notes) => {
        if (!notes) return '--';
        return (
          <div style={{
            maxWidth: '140px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '12px'
          }}
          title={notes}
          >
            {notes}
          </div>
        );
      }
    }
  ];

  // 如果用户没有权限访问此页面
  if (!canAccess) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>权限不足</h2>
        <p>您没有权限访问普通用户管理页面</p>
      </div>
    );
  }

  return (
    <div>
      <Card
        title="兼职用户管理"
        extra={
          user?.role !== 'mentor' && (
            <Button type="primary" icon={<UserAddOutlined />} onClick={handleAddUser}>
              添加用户
            </Button>
          )
        }
      >
        {/* 搜索和筛选区域 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: '500' }}>搜索:</span>
          <Input
            placeholder="用户ID/昵称/手机号"
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 250 }}
            allowClear
          />
          <span style={{ fontWeight: '500' }}>培训状态:</span>
          <Select
            placeholder="选择培训状态"
            value={filterTrainingStatus || undefined}
            onChange={(value) => {
              setFilterTrainingStatus(value);
              setPagination(prev => ({ ...prev, current: 1 }));
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
            value={filterMentor || undefined}
            onChange={handleMentorFilter}
            style={{ width: 120 }}
            allowClear
          >
            {mentorUsers.map(user => (
              <Option key={user._id} value={user._id}>
                {user.nickname || user.username}
              </Option>
            ))}
          </Select>
          <Button onClick={handleReset}>重置</Button>
        </div>

        <Table
          columns={columns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1150 }}
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
        title={editingUser ? '编辑用户' : '添加用户'}
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
        width={600}
      >
        {editableFields.length > 0 ? (
          <Form
            form={userForm}
            onFinish={handleUserSubmit}
            layout="vertical"
          >
            {editableFields.includes('username') && (
              <Form.Item
                label="用户ID"
                name="username"
                rules={[{ required: true, message: '请输入用户ID' }]}
              >
                <Input placeholder="请输入用户ID" disabled={!editableFields.includes('username')} />
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

            {/* 角色固定为兼职用户，不显示选择器 */}
            <Form.Item label="角色" name="role" style={{ display: 'none' }}>
              <Input value="part_time" />
            </Form.Item>

            {editableFields.includes('nickname') && (
              <Form.Item label="昵称" name="nickname">
                <Input placeholder="请输入昵称" />
              </Form.Item>
            )}

            {editableFields.includes('phone') && (
              <Form.Item
                label="手机号"
                name="phone"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      // 检查手机号是否已存在（排除当前编辑的用户）
                      const duplicateUser = users.find(u =>
                        u.phone === value && u._id !== editingUser?._id
                      );
                      if (duplicateUser) {
                        return Promise.reject(
                          `该手机号已被用户"${duplicateUser.nickname || duplicateUser.username || '未知'}"使用`
                        );
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input placeholder="请输入手机号" />
              </Form.Item>
            )}

            {editableFields.includes('wechat') && (
              <Form.Item label="微信号" name="wechat">
                <Input placeholder="请输入微信号" />
              </Form.Item>
            )}

            {editableFields.includes('integral_w') && (
              <Form.Item label="支付宝账号" name="integral_w">
                <Input placeholder="请输入支付宝账号" />
              </Form.Item>
            )}

            {editableFields.includes('integral_z') && (
              <Form.Item label="真实姓名" name="integral_z">
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
            )}

            {/* 支付宝二维码上传 */}
            <Form.Item label="支付宝二维码">
              <Upload
                name="alipay_qr_code"
                listType="picture-card"
                className="avatar-uploader"
                showUploadList={false}
                beforeUpload={(file) => {
                  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                  if (!isJpgOrPng) {
                    message.error('只能上传 JPG/PNG 格式的图片!');
                    return Upload.LIST_IGNORE;
                  }
                  const isLt2M = file.size / 1024 / 1024 < 2;
                  if (!isLt2M) {
                    message.error('图片大小不能超过 2MB!');
                    return Upload.LIST_IGNORE;
                  }
                  return true;
                }}
                customRequest={handleAlipayQrCodeUpload}
              >
                {alipayQrCodeUrl ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={alipayQrCodeUrl}
                      alt="支付宝二维码"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(0, 0, 0, 0)',
                      opacity: 0,
                      transition: 'opacity 0.3s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                    >
                      <div style={{ color: '#fff', fontSize: '14px', textAlign: 'center' }}>
                        <div>点击重新上传</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传二维码</div>
                  </div>
                )}
              </Upload>
            </Form.Item>

            {editableFields.includes('invitationCode') && (
              <Form.Item label="邀请码" name="invitationCode">
                <Input placeholder="请输入邀请码" />
              </Form.Item>
            )}

            {editableFields.includes('hr_id') && (
              <Form.Item label="分配HR" name="hr_id">
                <Select placeholder="请选择HR" allowClear>
                  {hrUsers.map(user => (
                    <Option key={user._id} value={user._id}>
                      {user.nickname || user.username}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {editableFields.includes('mentor_id') && (
              <Form.Item label="分配带教老师" name="mentor_id">
                <Select placeholder="请选择带教老师" allowClear>
                  {mentorUsers.map(user => (
                    <Option key={user._id} value={user._id}>
                      {user.nickname || user.username}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {editableFields.includes('parent_id') && (
              <Form.Item label="上级用户" name="parent_id">
                <Select placeholder="请选择上级用户" allowClear>
                  {parentUsers.map(user => (
                    <Option key={user._id} value={user._id}>
                      {user.nickname || user.username}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {editableFields.includes('training_status') && (
              <Form.Item label="培训状态" name="training_status">
                <Select placeholder="请选择培训状态" allowClear>
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
            <p>您没有权限{editingUser ? '编辑' : '创建'}此用户</p>
            <p style={{ color: '#666', marginTop: '8px' }}>
              请联系管理员获取相应权限
            </p>
          </div>
        )}
      </Modal>

      {/* 积分兑换Modal */}
      <Modal
        title="积分兑换余额"
        open={exchangeModalVisible}
        onCancel={() => {
          setExchangeModalVisible(false);
          exchangeForm.resetFields();
        }}
        footer={null}
        width={400}
      >
        {exchangingUser && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>用户:</strong> {exchangingUser.username} ({exchangingUser.nickname})</p>
            <p><strong>当前积分:</strong> <span style={{ color: '#722ed1', fontWeight: 'bold' }}>{exchangingUser.points || 0}</span></p>
            <p><strong>待打款金额:</strong> <span style={{ color: '#1890ff', fontWeight: 'bold' }}>¥{(pendingPayments[exchangingUser._id]?.totalAmount || 0) / 100}</span></p>
            <p style={{ color: '#666', fontSize: '12px', marginTop: '8px' }}>
              兑换比例: 100积分 = 1元人民币
            </p>
          </div>
        )}

        <Form
          form={exchangeForm}
          onFinish={handleExchangeSubmit}
          layout="vertical"
        >
          <Form.Item
            label="兑换积分数量"
            name="pointsToExchange"
            rules={[
              { required: true, message: '请输入兑换积分数量' },
              { type: 'number', min: 0.01, message: '兑换积分必须大于0' },
              {
                validator: (_, value) => {
                  if (value > (exchangingUser?.points || 0)) {
                    return Promise.reject('兑换积分不能超过用户当前积分');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <InputNumber
              placeholder="请输入要兑换的积分数量"
              min={0.01}
              max={exchangingUser?.points || 0}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => {
                setExchangeModalVisible(false);
                exchangeForm.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={exchanging}>
                确认兑换
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 提现Modal */}
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
          <div style={{ marginBottom: 16 }}>
            <p><strong>用户:</strong> {withdrawingUser.username} ({withdrawingUser.nickname})</p>
            <p><strong>待打款金额:</strong> <span style={{ color: '#1890ff', fontWeight: 'bold' }}>¥{(pendingPayments[withdrawingUser._id]?.totalAmount || 0) / 100}</span></p>
            <p><strong>已提现金额:</strong> <span style={{ color: '#52c41a', fontWeight: 'bold' }}>¥{(withdrawingUser.wallet?.total_withdrawn || 0) / 100}</span></p>
            {withdrawingUser.alipay_qr_code && (
              <div style={{ marginTop: 16, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 'bold', marginBottom: 12 }}>支付宝收款二维码：</p>
                <img
                  src={withdrawingUser.alipay_qr_code}
                  alt="支付宝二维码"
                  style={{ width: 400, height: 400, display: 'block', margin: '0 auto' }}
                />
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => {
              setWithdrawModalVisible(false);
              setWithdrawingUser(null);
            }}>
              取消
            </Button>
            <Button type="primary" onClick={handleWithdrawSubmit} loading={withdrawing}>
              确认提现
            </Button>
          </Space>
        </div>
      </Modal>

      {/* 二维码预览弹窗 */}
      <Modal
        open={qrCodePreviewVisible}
        title="支付宝收款二维码"
        onCancel={() => {
          setQrCodePreviewVisible(false);
          setQrCodePreviewUrl('');
        }}
        footer={[
          <Button key="close" onClick={() => setQrCodePreviewVisible(false)}>
            关闭
          </Button>
        ]}
        centered
        width={450}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <img
            src={qrCodePreviewUrl}
            alt="支付宝收款二维码"
            style={{
              width: 400,
              height: 400,
              objectFit: 'contain',
              border: '1px solid #d9d9d9',
              borderRadius: '4px'
            }}
            onError={(e) => {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9"MTAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE0IiBmaWxsPSIjOTk5Ij7liqDovb3kuK08L3RleHQ+PC9zdmc+';
            }}
          />
          <p style={{ marginTop: 16, color: '#666' }}>请使用支付宝扫一扫</p>
        </div>
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

      {/* 锁定用户弹窗 */}
      <Modal
        title={`锁定用户 - ${lockingUser?.username || ''}`}
        open={lockModalVisible}
        onOk={handleLockConfirm}
        onCancel={handleLockCancel}
        confirmLoading={lockLoading}
        okText="确认锁定"
        cancelText="取消"
      >
        <Form form={lockForm} layout="vertical">
          <Form.Item label="锁定原因">
            <span style={{ color: '#666' }}>锁定后，该用户将无法登录系统</span>
          </Form.Item>
          <Form.Item
            label="原因说明"
            name="lockedReason"
            rules={[
              { required: true, message: '请输入锁定原因' },
              { max: 500, message: '原因说明不能超过500字' }
            ]}
          >
            <Input.TextArea
              placeholder="请输入锁定该用户的原因（必填）"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientList;