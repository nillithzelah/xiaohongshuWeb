import React, { useState, useEffect } from 'react';
import { Table, Button, Image, Modal, message, Space, Input } from 'antd';
import axios from 'axios';

const DeviceReview = () => {
  const [devices, setDevices] = useState([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [devicePagination, setDevicePagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [currentId, setCurrentId] = useState(null);

  const fetchDevices = async (page = 1, pageSize = 10) => {
    setDeviceLoading(true);
    try {
      const response = await axios.get('/devices/pending-review', {
        params: { page, limit: pageSize }
      });

      setDevices(response.data.data);
      setDevicePagination({
        ...devicePagination,
        current: page,
        pageSize,
        total: response.data.pagination.total
      });
    } catch (error) {
      message.error('获取待审核设备失败');
    } finally {
      setDeviceLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleDeviceReview = async (deviceId, action) => {
    if (action === 'reject') {
      setCurrentId(deviceId);
      setRejectModalVisible(true);
      return;
    }

    try {
      await axios.put(`/devices/${deviceId}/review`, { action });
      message.success('审核通过');
      fetchDevices(devicePagination.current, devicePagination.pageSize);
    } catch (error) {
      message.error(error.response?.data?.message || '审核失败');
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      message.error('请输入拒绝原因');
      return;
    }

    try {
      await axios.put(`/devices/${currentId}/review`, {
        action: 'reject',
        reason: rejectReason
      });
      fetchDevices(devicePagination.current, devicePagination.pageSize);
      message.success('已拒绝');
      setRejectModalVisible(false);
      setRejectReason('');
      setCurrentId(null);
    } catch (error) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  const handleRejectCancel = () => {
    setRejectModalVisible(false);
    setRejectReason('');
    setCurrentId(null);
  };

  const deviceColumns = [
    {
      title: '账号名称',
      dataIndex: 'accountName',
      key: 'accountName'
    },
    {
      title: '账号ID',
      dataIndex: 'accountId',
      key: 'accountId'
    },
    {
      title: '申请用户',
      dataIndex: 'assignedUser',
      key: 'assignedUser',
      render: (user) => user ? user.nickname || user.username : '-'
    },
    {
      title: '审核图片',
      dataIndex: 'reviewImage',
      key: 'reviewImage',
      render: (imageUrl) => imageUrl ? (
        <Image src={imageUrl} width={80} height={80} />
      ) : '无图片'
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => handleDeviceReview(record._id, 'approve')}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            onClick={() => handleDeviceReview(record._id, 'reject')}
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <h2>设备审核管理</h2>
      <Table
        columns={deviceColumns}
        dataSource={devices}
        rowKey="_id"
        loading={deviceLoading}
        pagination={{
          ...devicePagination,
          onChange: (page, pageSize) => fetchDevices(page, pageSize)
        }}
      />

      <Modal
        title="审核拒绝"
        open={rejectModalVisible}
        onOk={handleRejectConfirm}
        onCancel={handleRejectCancel}
        okText="确定"
        cancelText="取消"
      >
        <p>请输入拒绝原因：</p>
        <Input.TextArea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="请输入拒绝原因"
          rows={4}
        />
      </Modal>
    </div>
  );
};

export default DeviceReview;
