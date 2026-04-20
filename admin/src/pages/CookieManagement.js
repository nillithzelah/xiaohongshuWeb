import React, { useState, useEffect } from 'react';
import { Card, Button, message, Alert, Typography, Space, Tag, Progress, Statistic, Row, Col, Table, Divider, Modal, Form, Input, InputNumber, Switch, Select } from 'antd';
import axios from 'axios';
import { ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, SyncOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const CookieManagement = () => {
  const [loading, setLoading] = useState(false);
  const [cookiePoolStatus, setCookiePoolStatus] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [cookieStats, setCookieStats] = useState(null);

  // 搜索和筛选状态
  const [filters, setFilters] = useState({
    status: undefined,
    keyword: ''
  });

  // Modal 状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCookie, setEditingCookie] = useState(null);
  const [form] = Form.useForm();

  // 获取Cookie池统计
  const fetchCookieStats = async () => {
    try {
      const response = await axios.get('/admin/cookies/stats');
      if (response.data.success) {
        setCookieStats(response.data.data);
      }
    } catch (error) {
      console.error('获取Cookie池统计失败:', error);
    }
  };

  // 获取Cookie列表
  const fetchCookieList = async () => {
    try {
      const response = await axios.get('/admin/cookies');
      if (response.data.success) {
        const allCookies = response.data.data.map(c => ({
          id: c._id,
          name: c.metadata?.source === 'admin_api' ? c.metadata?.notes || `账号${c._id.toString().substring(0, 8)}` : '未知账号',
          value: c.cookie,
          loadts: c.metadata?.loadts || Date.now(),
          estimatedExpiry: c.metadata?.estimatedExpiry || 72,
          priority: c.priority || 0,
          enabled: c.status === 'active',
          isExpired: c.status === 'expired',
          status: c.status || 'unknown',
          usageCount: c.metadata?.useCount || 0,
          lastUsed: c.metadata?.lastUsed ? new Date(c.metadata.lastUsed).toLocaleString('zh-CN') : '未使用',
          notes: c.notes || ''
        }));

        // 应用筛选
        let filteredCookies = allCookies;

        // 状态筛选
        if (filters.status) {
          if (filters.status === 'normal') {
            filteredCookies = filteredCookies.filter(c => c.enabled && !c.isExpired);
          } else if (filters.status === 'disabled') {
            filteredCookies = filteredCookies.filter(c => !c.enabled);
          } else if (filters.status === 'expired') {
            filteredCookies = filteredCookies.filter(c => c.isExpired);
          }
        }

        // 关键词搜索
        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          filteredCookies = filteredCookies.filter(c =>
            c.name.toLowerCase().includes(keyword) ||
            (c.notes && c.notes.toLowerCase().includes(keyword))
          );
        }

        setCookiePoolStatus({
          total: response.data.data.total,
          cookies: filteredCookies
        });
      }
    } catch (error) {
      console.error('获取Cookie列表失败:', error);
    }
  };

  // 刷新所有状态
  const fetchAllStatus = async () => {
    try {
      setFetching(true);
      await fetchCookieStats();
      await fetchCookieList();
      message.success('状态已刷新');
    } catch (error) {
      message.error('刷新状态失败');
    } finally {
      setFetching(false);
    }
  };

  // 打开新增Modal
  const handleAdd = () => {
    setEditingCookie(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      priority: 5,
      estimatedExpiry: 72
    });
    setModalVisible(true);
  };

  // 打开编辑Modal
  const handleEdit = (record) => {
    setEditingCookie(record.id);
    form.setFieldsValue({
      id: record.id,
      name: record.name,
      value: '', // 不显示完整Cookie，需要重新输入
      loadts: record.loadts,
      estimatedExpiry: record.estimatedExpiry || 72,
      priority: record.priority || 0,
      enabled: record.enabled !== false
    });
    setModalVisible(true);
  };

  // 删除Cookie
  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 Cookie "${record.name}" 吗？`,
      onOk: async () => {
        try {
          setLoading(true);
          await axios.delete(`/admin/cookies/${record.id}`);
          message.success('删除成功');
          // 刷新列表
          await fetchCookieList();
        } catch (error) {
          message.error('删除失败: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 切换Cookie状态
  const handleToggle = async (record) => {
    try {
      setLoading(true);
      const response = await axios.put(`/admin/cookies/${record.id}/toggle`);
      if (response.data.success) {
        message.success(`Cookie已${response.data.data.status === 'active' ? '启用' : '禁用'}`);
        // 刷新列表
        await fetchCookieList();
      } else {
        message.error(response.data.message);
      }
    } catch (error) {
      message.error('切换状态失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 保存Cookie
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      setLoading(true);

      if (editingCookie) {
        // 编辑模式 - 如果value为空或太短，保留原值
        const existingCookie = cookiePoolStatus.cookies.find(c => c.id === editingCookie);
        if (!values.value || values.value.length < 100) {
          // 没有提供新Cookie，保留原有value
          values.value = existingCookie.value;
        } else {
          // 提供了新Cookie，从中提取loadts
          const loadtsMatch = values.value.match(/loadts=(\d{13})/);
          if (loadtsMatch) {
            values.loadts = parseInt(loadtsMatch[1]);
          } else if (!values.loadts) {
            values.loadts = Date.now();
          }
        }

        // 更新Cookie
        const response = await axios.put(`/admin/cookies/${editingCookie}`, {
          cookie: values.value,
          priority: values.priority || 0,
          notes: values.name
        });

        if (response.data.success) {
          message.success('修改成功');
          setModalVisible(false);
          // 刷新列表
          await fetchCookieList();
        } else {
          throw new Error(response.data.message);
        }
      } else {
        // 新增模式 - 必须提供完整的Cookie
        if (!values.value || values.value.length < 100) {
          message.error('请输入完整的Cookie字符串（至少100字符）');
          setLoading(false);
          return;
        }

        // 从Cookie中提取loadts
        const loadtsMatch = values.value.match(/loadts=(\d{13})/);
        if (loadtsMatch) {
          values.loadts = parseInt(loadtsMatch[1]);
        } else if (!values.loadts) {
          values.loadts = Date.now();
        }

        // 添加新Cookie
        const response = await axios.post('/admin/cookies', {
          cookie: values.value,
          priority: values.priority || 0,
          notes: values.name
        });

        if (response.data.success) {
          message.success('添加成功');
          setModalVisible(false);
          // 刷新列表
          await fetchCookieList();
        } else {
          throw new Error(response.data.message);
        }
      }
    } catch (error) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error('保存失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 从Cookie字符串解析loadts
  const parseLoadtsFromCookie = (cookieString) => {
    const match = cookieString.match(/loadts=(\d{13})/);
    if (match) {
      return parseInt(match[1]);
    }
    return null;
  };

  useEffect(() => {
    fetchAllStatus();
    const interval = setInterval(fetchAllStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // 当筛选条件变化时重新获取Cookie列表
  useEffect(() => {
    if (cookiePoolStatus) {
      fetchCookieList();
    }
  }, [filters]);

  // Cookie池表格列定义
  const poolColumns = [
    {
      title: '账号名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <Text strong>{text}</Text>
          {!record.enabled && <Tag color="red">已禁用</Tag>}
        </Space>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        if (!record.enabled) {
          return <Tag color="red">已禁用</Tag>;
        } else if (record.isExpired) {
          return <Tag color="red" icon={<CloseCircleOutlined />}>已过期</Tag>;
        } else {
          return <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>;
        }
      }
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (value) => <Tag color="blue">{value}</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'loadts',
      key: 'loadts',
      width: 180,
      render: (value) => value ? new Date(value).toLocaleString('zh-CN') : '-'
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      width: 180,
      render: (value) => value || '未使用'
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      render: (value) => <Tag color="purple">{value || 0}次</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={async () => {
              try {
                setLoading(true);
                await axios.post(`/admin/cookies/${record.id}/check`);
                message.success('检查完成');
                await fetchCookieList();
              } catch (error) {
                message.error('检查失败: ' + error.message);
              } finally {
                setLoading(false);
              }
            }}
          >
            检查
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>小红书Cookie管理</Title>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Cookie池统计 */}
        {cookieStats && (
          <Card title="Cookie池统计">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="总Cookie数"
                  value={cookieStats.total}
                  suffix="个"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="可用Cookie"
                  value={cookieStats.active}
                  suffix="个"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已失效"
                  value={cookieStats.expired}
                  suffix="个"
                  valueStyle={{ color: '#f5222d' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="被限流"
                  value={cookieStats.rateLimited}
                  suffix="个"
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
            </Row>
            <Divider />
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="总使用次数"
                  value={cookieStats.totalUsage}
                  suffix="次"
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="成功率"
                  value={cookieStats.successRate}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: cookieStats.successRate > 90 ? '#52c41a' : cookieStats.successRate > 70 ? '#faad14' : '#f5222d' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="平均响应时间"
                  value={cookieStats.avgResponseTime}
                  suffix="ms"
                  precision={0}
                />
              </Col>
            </Row>
          </Card>
        )}

        {/* Cookie池概览 */}
        {cookiePoolStatus && (
          <Card
            title={
              <Space>
                <span>Cookie池概览</span>
                <Tag color="blue">共 {cookiePoolStatus.total} 个</Tag>
                <Tag color="green">可用 {cookiePoolStatus.cookies.filter(c => c.enabled && !c.isExpired).length} 个</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleAdd}
                >
                  新增Cookie
                </Button>
                <Button
                  icon={<SyncOutlined />}
                  onClick={fetchAllStatus}
                  loading={fetching}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            {/* 搜索和筛选区域 */}
            <div style={{ marginBottom: 16, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '12px', background: '#fafafa', borderRadius: '8px' }}>
              <span style={{ fontWeight: '500' }}>状态:</span>
              <Select
                placeholder="选择状态"
                value={filters.status || undefined}
                onChange={(value) => {
                  setFilters(prev => ({ ...prev, status: value }));
                }}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="normal">正常</Option>
                <Option value="disabled">已禁用</Option>
                <Option value="expired">已过期</Option>
              </Select>

              <span style={{ fontWeight: '500' }}>搜索:</span>
              <Input
                placeholder="账号名称/备注"
                value={filters.keyword}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, keyword: e.target.value }));
                }}
                style={{ width: 180 }}
                allowClear
                prefix={<SearchOutlined />}
              />

              <Button onClick={() => setFilters({ status: undefined, keyword: '' })}>
                重置
              </Button>
            </div>

            <Table
              dataSource={cookiePoolStatus.cookies}
              columns={poolColumns}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>
        )}

        {/* 操作说明 */}
        <Card title="操作说明">
          <Alert
            message="获取Cookie方法"
            description={
              <div>
                <p><strong>方法一：使用Cookie-Editor插件（推荐）</strong></p>
                <ol>
                  <li>Chrome浏览器安装 <a href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer">Cookie-Editor</a></li>
                  <li>Edge浏览器安装 <a href="https://microsoftedge.microsoft.com/addons/detail/cookieeditor/neaplmfkghagebokkhpjpoebhdledlfi" target="_blank" rel="noopener noreferrer">Cookie-Editor</a></li>
                  <li>浏览器登录小红书账号</li>
                  <li>点击Cookie-Editor图标，找到 <code>xiaohongshu.com</code></li>
                  <li>勾选所有cookie，点击"Export"（导出为JSON格式）</li>
                  <li>复制导出的JSON内容，粘贴到下方Cookie字符串输入框</li>
                </ol>

                <p style={{marginTop: 16}}><strong>方法二：手动获取</strong></p>
                <ol>
                  <li>浏览器登录小红书账号</li>
                  <li>按 F12 打开开发者工具</li>
                  <li>切换到 Network 标签，刷新页面</li>
                  <li>点击任意请求 → Request Headers → Cookie</li>
                  <li>复制完整的 Cookie 字符串</li>
                </ol>
              </div>
            }
            type="info"
            showIcon
          />
        </Card>

        {/* 手动操作 */}
        <Card title="手动操作">
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAllStatus}
              loading={fetching}
            >
              刷新状态
            </Button>
          </Space>
        </Card>
      </Space>

      {/* 新增/编辑Modal */}
      <Modal
        title={editingCookie ? '编辑Cookie' : '新增Cookie'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        confirmLoading={loading}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="账号名称"
            rules={[{ required: true, message: '请输入账号名称' }]}
          >
            <Input placeholder="如：主账号、备用账号1" />
          </Form.Item>

          <Form.Item
            name="value"
            label="Cookie字符串"
            rules={[{ required: !editingCookie, message: '新增时必须输入Cookie' }]}
            extra={editingCookie ? "留空则保留原Cookie值。如需更换，请粘贴完整的新Cookie" : "从浏览器F12 → Network → Request Headers → Cookie 中复制"}
          >
            <TextArea
              rows={4}
              placeholder={editingCookie ? "留空保留原值，或在此粘贴新Cookie" : "粘贴完整的Cookie字符串，包含 a1, web_session, id_token, loadts 等"}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="priority"
                label="优先级"
                rules={[{ required: true, message: '请输入优先级' }]}
                extra="数字越大越优先使用"
              >
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="estimatedExpiry"
                label="有效期（小时）"
                rules={[{ required: true, message: '请输入有效期' }]}
                extra="默认72小时"
              >
                <InputNumber min={1} max={168} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CookieManagement;
