import React, { useState, useEffect } from 'react';
import { Card, Button, message, Table, Modal, Form, Input, Select, Switch, InputNumber, Space, Tag, Popconfirm, Row, Col } from 'antd';
import axios from 'axios';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import DOMPurify from 'dompurify';

const { TextArea } = Input;
const { Option } = Select;

// XSS防护：清理HTML内容，只允许安全的标签和属性
const sanitizeHTML = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    ALLOW_DATA_ATTR: false
  });
};

const AnnouncementManagement = () => {
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null);
  const [form] = Form.useForm();

  // 获取公告列表
  const fetchAnnouncements = async (currentPage = 1) => {
    try {
      setLoading(true);
      const response = await axios.get('/admin/announcements', {
        params: { page: currentPage, limit: 20 }
      });
      if (response.data.success) {
        setAnnouncements(response.data.data.list);
        setTotal(response.data.data.total);
        setPage(currentPage);
      }
    } catch (error) {
      console.error('获取公告列表失败:', error);
      message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // 刷新列表
  const handleRefresh = () => {
    fetchAnnouncements(page);
  };

  // 打开新增Modal
  const handleAdd = () => {
    setEditingAnnouncement(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      type: 'info',
      order: 0,
      isPinned: false,
      actionType: 'none',
      textColor: '#ffffff',
      fontSize: 28
    });
    setModalVisible(true);
  };

  // 打开编辑Modal
  const handleEdit = (record) => {
    setEditingAnnouncement(record._id);
    form.setFieldsValue({
      title: record.title,
      content: record.content,
      type: record.type,
      order: record.order,
      enabled: record.enabled,
      isPinned: record.isPinned,
      actionType: record.actionType,
      actionData: record.actionData,
      textColor: record.textColor || '#ffffff',
      fontSize: record.fontSize || 28
    });
    setModalVisible(true);
  };

  // 查看详情
  const handleView = (record) => {
    setViewingAnnouncement(record);
    setDetailModalVisible(true);
  };

  // 保存公告
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingAnnouncement) {
        // 更新
        await axios.put(`/admin/announcement/${editingAnnouncement}`, values);
        message.success('更新成功');
      } else {
        // 新增
        await axios.post('/admin/announcement', values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchAnnouncements(page);
    } catch (error) {
      if (error.errorFields) {
        return; // 表单验证错误
      }
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // 切换启用状态
  const handleToggle = async (record) => {
    try {
      await axios.put(`/admin/announcement/${record._id}/toggle`);
      message.success('状态已更新');
      fetchAnnouncements(page);
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 删除公告
  const handleDelete = async (record) => {
    try {
      await axios.delete(`/admin/announcement/${record._id}`);
      message.success('删除成功');
      fetchAnnouncements(page);
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      width: 70
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (type) => {
        const typeMap = {
          info: { color: 'blue', text: '信息' },
          success: { color: 'green', text: '成功' },
          warning: { color: 'orange', text: '警告' },
          error: { color: 'red', text: '错误' }
        };
        const config = typeMap[type] || typeMap.info;
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        <Space>
          {record.isPinned && <Tag color="purple">置顶</Tag>}
          <Tag color={record.enabled ? 'green' : 'red'}>
            {record.enabled ? '启用' : '禁用'}
          </Tag>
        </Space>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => date ? new Date(date).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            onClick={() => handleToggle(record)}
          >
            {record.enabled ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这条公告吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="公告管理"
        extra={
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增公告
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={announcements}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: (newPage) => fetchAnnouncements(newPage),
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 新增/编辑Modal */}
      <Modal
        title={editingAnnouncement ? '编辑公告' : '新增公告'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="公告标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="请输入标题（用于管理后台显示）" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="content"
            label="公告内容"
            rules={[{ required: true, message: '请输入内容' }]}
            extra="支持富文本格式，点击查看详情时显示完整内容"
          >
            <TextArea rows={6} placeholder="请输入公告内容（支持HTML标签）" />
          </Form.Item>

          <Form.Item
            name="type"
            label="公告类型"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value="info">信息</Option>
              <Option value="success">成功</Option>
              <Option value="warning">警告</Option>
              <Option value="error">错误</Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="textColor"
                label="字体颜色"
                extra="小程序显示的文字颜色"
              >
                <Input type="color" style={{ height: 40 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fontSize"
                label="字体大小"
                extra="单位：rpx，建议24-40"
              >
                <InputNumber min={20} max={60} style={{ width: '100%' }} placeholder="28" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="order"
                label="排序"
                rules={[{ required: true }]}
                extra="数字越小越靠前"
              >
                <InputNumber min={0} max={9999} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="actionType"
                label="点击动作"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="none">无操作</Option>
                  <Option value="link">跳转链接</Option>
                  <Option value="page">跳转页面</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.actionType !== currentValues.actionType}
          >
            {({ getFieldValue }) =>
              getFieldValue('actionType') !== 'none' ? (
                <Form.Item
                  name="actionData"
                  label="跳转目标"
                  rules={[{ required: true }]}
                  extra={getFieldValue('actionType') === 'link' ? '输入完整URL，如：https://example.com' : '输入小程序页面路径，如：/pages/upload/upload'}
                >
                  <Input placeholder={getFieldValue('actionType') === 'link' ? 'https://xxx' : '/pages/xxx'} />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="isPinned"
                label="置顶"
                valuePropName="checked"
              >
                <Switch checkedChildren="置顶" unCheckedChildren="普通" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="enabled"
                label="启用"
                valuePropName="checked"
              >
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 查看详情Modal */}
      <Modal
        title="公告详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {viewingAnnouncement && (
          <div>
            <p><strong>标题：</strong>{viewingAnnouncement.title}</p>
            <p><strong>类型：</strong>{
              viewingAnnouncement.type === 'info' ? '信息' :
              viewingAnnouncement.type === 'success' ? '成功' :
              viewingAnnouncement.type === 'warning' ? '警告' : '错误'
            }</p>
            <div style={{ marginTop: 16 }}>
              <strong>内容：</strong>
              <div
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(viewingAnnouncement.content || '') }}
                style={{
                  marginTop: 8,
                  padding: 12,
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  maxHeight: 300,
                  overflow: 'auto'
                }}
              />
            </div>
            {viewingAnnouncement.actionType !== 'none' && (
              <p style={{ marginTop: 16 }}>
                <strong>点击跳转：</strong>
                {viewingAnnouncement.actionType === 'link' ? '链接' : '页面'}
                - {viewingAnnouncement.actionData}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AnnouncementManagement;
