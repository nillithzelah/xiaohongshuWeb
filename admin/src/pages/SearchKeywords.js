import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Card,
  Space,
  Tag,
  Popconfirm,
  Select,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  SearchOutlined,
  AppstoreAddOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;
const { TextArea } = Input;

// 默认分类选项（当后端无分类时使用）
const DEFAULT_CATEGORIES = [
  '减肥诈骗',
  '护肤诈骗',
  '祛斑诈骗',
  '丰胸诈骗',
  '医美诈骗',
  '增高诈骗',
  '通用维权',
  '其他'
];

const SearchKeywords = () => {
  const [keywords, setKeywords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [searchText, setSearchText] = useState('');

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const { user } = useAuth();

  // 检查用户权限
  const hasPermission = user?.role === 'boss' || user?.role === 'manager';

  // 获取分类列表（从后端或使用默认）
  const categoryOptions = categories.length > 0
    ? categories.map(c => c.category)
    : DEFAULT_CATEGORIES;

  useEffect(() => {
    if (hasPermission) {
      fetchKeywords();
      initCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission]);

  useEffect(() => {
    if (hasPermission) {
      fetchKeywords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize, filters.status, filters.category, searchText]);

  // 从后端获取分类列表
  const fetchCategories = async () => {
    try {
      const response = await axios.get('/admin/keyword-categories');
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (error) {
      console.error('获取分类列表失败:', error);
      // 失败时使用默认分类
      setCategories(DEFAULT_CATEGORIES.map(cat => ({ category: cat, count: 0 })));
    }
  };

  // 初始化分类
  const initCategories = () => {
    fetchCategories();
  };

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize
      };
      if (filters.status) params.status = filters.status;
      if (filters.category && filters.category !== 'null') params.category = filters.category;
      if (filters.category === 'null') params.noCategory = 'true';
      if (searchText) params.search = searchText;

      const response = await axios.get('/admin/keywords', { params });
      if (response.data.success) {
        // 使用 _id 去重，防止显示重复
        const uniqueKeywords = [];
        const seenIds = new Set();
        for (const kw of response.data.data || []) {
          if (!seenIds.has(kw._id)) {
            seenIds.add(kw._id);
            uniqueKeywords.push(kw);
          }
        }
        setKeywords(uniqueKeywords);
        setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
      }
    } catch (error) {
      message.error('获取关键词列表失败');
      console.error('获取关键词列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();

      // 检查是否已存在相同关键词
      const existing = keywords.find(kw => kw.keyword === values.keyword);
      if (existing) {
        message.error(`关键词 "${values.keyword}" 已存在，请使用不同的关键词`);
        return;
      }

      const response = await axios.post('/admin/keywords', values);
      if (response.data.success) {
        message.success('添加成功');
        setAddModalVisible(false);
        addForm.resetFields();
        fetchKeywords();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '添加失败';
      message.error(errorMessage);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      keyword: record.keyword,
      category: record.category,
      status: record.status
    });
    setEditModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      const response = await axios.put(`/admin/keywords/${editingRecord._id}`, values);
      if (response.data.success) {
        message.success('更新成功');
        setEditModalVisible(false);
        setEditingRecord(null);
        editForm.resetFields();
        fetchKeywords();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '更新失败';
      message.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`/admin/keywords/${id}`);
      if (response.data.success) {
        message.success('删除成功');
        fetchKeywords();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleBatchImport = async () => {
    try {
      const values = await importForm.validateFields();
      // 解析输入的关键词
      const lines = values.keywords.split('\n').filter(line => line.trim());
      const keywordsToImport = [];

      for (const line of lines) {
        const trimmed = line.trim();
        // 支持格式：关键词 或 关键词,分类
        const parts = trimmed.split(/[，,]/).map(p => p.trim());
        const keyword = {
          keyword: parts[0],
          category: values.defaultCategory || '通用维权'
        };
        if (parts[1]) keyword.category = parts[1];
        keywordsToImport.push(keyword);
      }

      const response = await axios.post('/admin/keywords/batch-import', {
        keywords: keywordsToImport
      });
      if (response.data.success) {
        message.success(`成功导入 ${response.data.count} 个关键词`);
        setImportModalVisible(false);
        importForm.resetFields();
        fetchKeywords();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '导入失败';
      message.error(errorMessage);
    }
  };

  const handleStatusChange = async (record, newStatus) => {
    try {
      const response = await axios.put(`/admin/keywords/${record._id}`, {
        keyword: record.keyword,
        category: record.category,
        status: newStatus
      });
      if (response.data.success) {
        message.success('状态更新成功');
        fetchKeywords();
      }
    } catch (error) {
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleAddCategory = async () => {
    try {
      const values = await categoryForm.validateFields();
      const newCategory = values.category;

      // 检查是否已存在
      if (categoryOptions.includes(newCategory)) {
        message.error('该分类已存在');
        return;
      }

      // 调用后端 API 添加分类
      const response = await axios.post('/admin/keyword-categories', {
        category: newCategory
      });
      if (response.data.success) {
        message.success(response.data.message || '分类添加成功');
        setCategoryModalVisible(false);
        categoryForm.resetFields();
        fetchCategories(); // 刷新分类列表
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '添加失败';
      message.error(errorMessage);
    }
  };

  const columns = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      key: 'keyword',
      width: 150,
      render: (text) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (text) => {
        const colorMap = {
          '减肥诈骗': 'red',
          '护肤诈骗': 'orange',
          '祛斑诈骗': 'gold',
          '丰胸诈骗': 'pink',
          '医美诈骗': 'purple',
          '增高诈骗': 'cyan',
          '通用维权': 'blue',
          '其他': 'default'
        };
        return <Tag color={colorMap[text] || 'default'}>{text || '未分类'}</Tag>;
      },
      filters: categoryOptions.map(cat => ({ text: cat, value: cat }))
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status, record) => (
        <Select
          value={status}
          size="small"
          style={{ width: 90 }}
          onChange={(value) => handleStatusChange(record, value)}
        >
          <Option value="active">
            <Tag color="green">活跃</Tag>
          </Option>
          <Option value="inactive">
            <Tag color="default">停用</Tag>
          </Option>
        </Select>
      ),
      filters: [
        { text: '活跃', value: 'active' },
        { text: '停用', value: 'inactive' }
      ]
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个关键词吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 如果没有权限，显示无权限提示
  if (!hasPermission) {
    return (
      <Card title="搜索关键词管理">
        <div style={{
          textAlign: 'center',
          padding: '50px 20px',
          color: '#999'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '10px' }}>无权限访问</p>
          <p>请联系管理员获取访问权限</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card
        title="搜索关键词管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchKeywords} loading={loading}>
              刷新
            </Button>
            <Button
              icon={<AppstoreAddOutlined />}
              onClick={() => setCategoryModalVisible(true)}
            >
              新增分类
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              添加关键词
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              批量导入
            </Button>
          </Space>
        }
      >
        {/* 搜索和筛选 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索关键词"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => { setPagination(prev => ({ ...prev, current: 1 })); fetchKeywords(); }}
            allowClear
            style={{ width: 200 }}
          />
          <Button onClick={() => { setPagination(prev => ({ ...prev, current: 1 })); fetchKeywords(); }}>搜索</Button>
          <Button onClick={() => { setSearchText(''); setFilters({ status: '', category: '' }); setPagination(prev => ({ ...prev, current: 1 })); fetchKeywords(); }}>重置</Button>
          <Divider type="vertical" />
          <span>分类筛选：</span>
          <Select
            style={{ width: 150 }}
            value={filters.category}
            onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
          >
            <Option value="">全部分类</Option>
            {categoryOptions.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
            <Option value="null">未分类</Option>
          </Select>
          <span>状态筛选：</span>
          <Select
            placeholder="全部状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status || undefined}
            onChange={(value) => setFilters(prev => ({ ...prev, status: value || '' }))}
          >
            <Option value="active">活跃</Option>
            <Option value="inactive">停用</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={keywords}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize, total: pagination.total })
          }}
          scroll={{ x: 600 }}
        />
      </Card>

      {/* 添加关键词弹窗 */}
      <Modal
        title="添加关键词"
        open={addModalVisible}
        onOk={handleAdd}
        onCancel={() => {
          setAddModalVisible(false);
          addForm.resetFields();
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical">
          <Form.Item
            label="关键词"
            name="keyword"
            rules={[{ required: true, message: '请输入关键词' }]}
          >
            <Input placeholder="例如：减肥被骗" />
          </Form.Item>
          <Form.Item
            label="分类"
            name="category"
            initialValue="通用维权"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              {categoryOptions.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑关键词弹窗 */}
      <Modal
        title="编辑关键词"
        open={editModalVisible}
        onOk={handleUpdate}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRecord(null);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="关键词"
            name="keyword"
            rules={[{ required: true, message: '请输入关键词' }]}
          >
            <Input placeholder="例如：减肥被骗" />
          </Form.Item>
          <Form.Item
            label="分类"
            name="category"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              {categoryOptions.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select>
              <Option value="active">活跃</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入关键词"
        open={importModalVisible}
        onOk={handleBatchImport}
        onCancel={() => {
          setImportModalVisible(false);
          importForm.resetFields();
        }}
        okText="导入"
        cancelText="取消"
        width={600}
      >
        <Form form={importForm} layout="vertical">
          <Form.Item
            label="关键词列表"
            name="keywords"
            rules={[{ required: true, message: '请输入关键词' }]}
            extra={
              <div>
                <p>每行一个关键词，支持以下格式：</p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>关键词（使用默认分类）</li>
                  <li>关键词,分类</li>
                </ul>
                <p style={{ marginTop: 8, color: '#999' }}>示例：</p>
                <pre style={{ background: '#f5f5f5', padding: 8, marginTop: 4 }}>
                  减肥被骗,减肥诈骗{'\n'}
                  瘦身被骗,减肥诈骗{'\n'}
                  医美被骗,医美诈骗
                </pre>
              </div>
            }
          >
            <TextArea
              rows={10}
              placeholder="减肥被骗,减肥诈骗&#10;护肤被骗,护肤诈骗&#10;..."
            />
          </Form.Item>
          <Form.Item
            label="默认分类"
            name="defaultCategory"
            initialValue="通用维权"
          >
            <Select>
              {categoryOptions.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增分类弹窗 */}
      <Modal
        title="新增分类"
        open={categoryModalVisible}
        onOk={handleAddCategory}
        onCancel={() => {
          setCategoryModalVisible(false);
          categoryForm.resetFields();
        }}
        okText="添加"
        cancelText="取消"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            label="分类名称"
            name="category"
            rules={[
              { required: true, message: '请输入分类名称' },
              {
                validator: (_, value) => {
                  if (value && categoryOptions.includes(value)) {
                    return Promise.reject(new Error('该分类已存在'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input placeholder="例如：植发诈骗" />
          </Form.Item>
          <p style={{ color: '#999', fontSize: '12px' }}>
            提示：新增分类后会自动创建一个示例关键词，您可以稍后编辑或删除它。
          </p>
        </Form>
      </Modal>
    </div>
  );
};

export default SearchKeywords;
