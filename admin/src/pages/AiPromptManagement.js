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
  Divider,
  Row,
  Col,
  Switch,
  InputNumber,
  Tabs,
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

const AiPromptManagement = () => {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [testingPrompt, setTestingPrompt] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const { user } = useAuth();

  const hasPermission = user?.role === 'boss' || user?.role === 'manager';

  useEffect(() => {
    if (hasPermission) {
      fetchPrompts();
    }
  }, [hasPermission]);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/admin/ai-prompts');
      if (response.data.success) {
        setPrompts(response.data.data);
      }
    } catch (error) {
      console.error('获取 AI 提示词失败:', error);
      message.error('获取 AI 提示词失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    addForm.resetFields();
    setAddModalVisible(true);
  };

  const handleAddSubmit = async () => {
    try {
      const values = await addForm.validateFields();
      await axios.post('/admin/ai-prompts', values);
      message.success('创建成功');
      setAddModalVisible(false);
      fetchPrompts();
    } catch (error) {
      console.error('创建失败:', error);
      message.error(error.response?.data?.message || '创建失败');
    }
  };

  const handleEdit = (record) => {
    setEditingPrompt(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      await axios.put(`/admin/ai-prompts/${editingPrompt.name}`, values);
      message.success('更新成功');
      setEditModalVisible(false);
      fetchPrompts();
    } catch (error) {
      console.error('更新失败:', error);
      message.error(error.response?.data?.message || '更新失败');
    }
  };

  const handleDelete = async (name) => {
    try {
      await axios.delete(`/admin/ai-prompts/${name}`);
      message.success('删除成功');
      fetchPrompts();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleTest = (record) => {
    setTestingPrompt(record);
    setTestResult(null);
    testForm.resetFields();
    setTestModalVisible(true);
  };

  const handleTestSubmit = async () => {
    setTestLoading(true);
    try {
      const values = await testForm.validateFields();
      const response = await axios.post(`/admin/ai-prompts/${testingPrompt.name}/test`, {
        testData: values
      });
      if (response.data.success) {
        setTestResult(response.data.data);
        message.success('测试完成');
      }
    } catch (error) {
      console.error('测试失败:', error);
      message.error(error.response?.data?.message || '测试失败');
      setTestResult({ error: error.message });
    } finally {
      setTestLoading(false);
    }
  };

  const getTypeTag = (type) => {
    const tags = {
      note_audit: { color: 'blue', text: '笔记审核' },
      comment_classification: { color: 'green', text: '评论分类' },
      other: { color: 'default', text: '其他' }
    };
    const tag = tags[type] || tags.other;
    return <Tag color={tag.color}>{tag.text}</Tag>;
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text) => <Text code>{text}</Text>
    },
    {
      title: '显示名称',
      dataIndex: 'displayName',
      key: 'displayName',
      width: 150
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => getTypeTag(type)
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '模型',
      dataIndex: ['apiConfig', 'model'],
      key: 'model',
      width: 120
    },
    {
      title: '温度',
      dataIndex: ['apiConfig', 'temperature'],
      key: 'temperature',
      width: 80,
      render: (val) => val?.toFixed(1) || '-'
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled) => (
        enabled
          ? <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="default">禁用</Tag>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (time) => time ? new Date(time).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleTest(record)}
          >
            测试
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个提示词吗？"
            onConfirm={() => handleDelete(record.name)}
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

  const renderPromptForm = (form) => (
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="提示词名称"
            name="name"
            rules={[{ required: true, message: '请输入提示词名称' }]}
          >
            <Input placeholder="如: note_audit_v1" disabled={!!editingPrompt} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="显示名称"
            name="displayName"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="如: 笔记文意审核" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label="类型"
            name="type"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="请选择类型">
              <Option value="note_audit">笔记审核</Option>
              <Option value="comment_classification">评论分类</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="状态"
            name="enabled"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="描述"
        name="description"
      >
        <Input placeholder="简要描述这个提示词的用途" />
      </Form.Item>

      <Divider orientation="left">系统提示词 (System)</Divider>
      <Form.Item
        label="系统提示词"
        name="systemPrompt"
        initialValue="你是一个专业的JSON API，只返回JSON格式的结果，不要包含其他任何文字。"
      >
        <TextArea rows={3} placeholder="系统提示词，定义 AI 的角色和行为" />
      </Form.Item>

      <Divider orientation="left">用户提示词模板 (User)</Divider>
      <Form.Item
        label="用户提示词模板"
        name="userPromptTemplate"
        rules={[{ required: true, message: '请输入用户提示词模板' }]}
        extra="使用 ${变量名} 表示可替换的变量，如 ${content}"
      >
        <TextArea rows={15} placeholder="用户提示词模板，使用 ${变量名} 作为占位符" />
      </Form.Item>

      <Divider orientation="left">输出格式说明</Divider>
      <Form.Item
        label="输出格式"
        name="outputFormat"
      >
        <TextArea
          rows={8}
          placeholder='JSON 输出格式说明，如: { "is_genuine_victim_post": boolean, "confidence_score": 0.0-1.0, "reason": "..." }'
        />
      </Form.Item>

      <Divider orientation="left">API 配置</Divider>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label="模型"
            name={['apiConfig', 'model']}
            initialValue="deepseek-chat"
          >
            <Select>
              <Option value="deepseek-chat">deepseek-chat</Option>
              <Option value="deepseek-v3">deepseek-v3</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Temperature"
            name={['apiConfig', 'temperature']}
            initialValue={0.3}
          >
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Max Tokens"
            name={['apiConfig', 'maxTokens']}
            initialValue={1000}
          >
            <InputNumber min={1} max={32000} step={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">变量说明</Divider>
      <Form.Item label="变量说明（可选）">
        <Form.List name="variables">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'name']}
                    rules={[{ required: true, message: '变量名' }]}
                  >
                    <Input placeholder="变量名 如: content" style={{ width: 120 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'description']}
                    rules={[{ required: true, message: '描述' }]}
                  >
                    <Input placeholder="描述" style={{ width: 200 }} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'example']}
                  >
                    <Input placeholder="示例值" style={{ width: 200 }} />
                  </Form.Item>
                  <DeleteOutlined onClick={() => remove(name)} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                添加变量
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <Space>
            <CodeOutlined />
            <span>AI 提示词管理</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchPrompts}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新建提示词
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={prompts}
          loading={loading}
          rowKey="name"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      {/* 新建提示词弹窗 */}
      <Modal
        title="新建 AI 提示词"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={handleAddSubmit}
        width={800}
        okText="创建"
        cancelText="取消"
      >
        {renderPromptForm(addForm)}
      </Modal>

      {/* 编辑提示词弹窗 */}
      <Modal
        title={`编辑提示词: ${editingPrompt?.displayName || ''}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditSubmit}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        {renderPromptForm(editForm)}
      </Modal>

      {/* 测试提示词弹窗 */}
      <Modal
        title={`测试提示词: ${testingPrompt?.displayName || ''}`}
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={null}
        width={900}
      >
        <Tabs
          defaultActiveKey="test"
          items={[
            {
              key: 'test',
              label: '测试',
              children: (
                <div>
                  {testingPrompt?.variables && testingPrompt.variables.length > 0 ? (
                    <>
                      <Paragraph type="secondary">
                        该提示词需要以下变量：
                      </Paragraph>
                      <Form form={testForm} layout="vertical">
                        {testingPrompt.variables.map((variable) => {
                          // 笔记审核提示词 - 提供预设测试用例
                          if (testingPrompt.name === 'note_audit' && variable.name === 'content') {
                            const presetCases = [
                              { label: '真实维权案例1', value: '祛斑骗局被骗了8000块，用了一个月没效果反而更严重了，商家说是排毒反应，后来查了下根本没备案，水都不知道哪里的，现在商家把我拉黑了怎么办？' },
                              { label: '真实维权案例2', value: '丰胸产品被骗了，花了5万一点效果都没有，说是纯中药没有副作用，结果用了三个月出现内分泌失调，去医院检查医生说是假的，现在联系商家退货不理我' },
                              { label: '真实维权案例3', value: '在微信上买了减肥药，说是韩国进口正品，结果吃了过敏起红疹，查了下是假药，商家不给退款还威胁我，这已经是第二次被骗了' },
                              { label: '非维权内容1', value: '今天去新开的火锅店吃饭，味道很不错，环境也很好，推荐大家去试试，特别是他们家的麻辣牛肉，非常嫩滑' },
                              { label: '非维权内容2', value: '分享一个超好用的面霜，保湿效果很棒，用了半个月皮肤变好了，性价比很高，学生党也可以入手' },
                              { label: '非维权内容3', value: '昨天和朋友去看电影，这部电影太精彩了，特效做得很好，剧情也很紧凑，强烈推荐大家去看' }
                            ];
                            return (
                              <Form.Item
                                key={variable.name}
                                label={variable.description}
                                name={variable.name}
                                initialValue={variable.example}
                                rules={[{ required: true, message: `请输入 ${variable.description}` }]}
                              >
                                <TextArea
                                  rows={6}
                                  placeholder="选择预设测试用例或输入自定义内容"
                                />
                                <div style={{ marginTop: 8 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>预设测试用例：</Text>
                                  <div style={{ marginTop: 4 }}>
                                    {presetCases.map((preset, index) => (
                                      <Tag
                                        key={index}
                                        style={{ cursor: 'pointer', marginBottom: 4 }}
                                        onClick={() => testForm.setFieldsValue({ [variable.name]: preset.value })}
                                      >
                                        {preset.label}
                                      </Tag>
                                    ))}
                                  </div>
                                </div>
                              </Form.Item>
                            );
                          }
                          // 其他变量 - 默认文本框
                          return (
                            <Form.Item
                              key={variable.name}
                              label={`${variable.name} - ${variable.description}`}
                              name={variable.name}
                              initialValue={variable.example}
                              rules={[{ required: true, message: `请输入 ${variable.name}` }]}
                            >
                              <TextArea
                                rows={variable.name === 'content' ? 6 : 2}
                                placeholder={variable.example}
                              />
                            </Form.Item>
                          );
                        })}
                        <Form.Item>
                          <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            onClick={handleTestSubmit}
                            loading={testLoading}
                            block
                          >
                            运行测试
                          </Button>
                        </Form.Item>
                      </Form>
                    </>
                  ) : (
                    <Paragraph type="secondary">
                      该提示词没有定义变量，将直接使用模板进行测试。
                    </Paragraph>
                  )}
                </div>
              )
            },
            {
              key: 'template',
              label: '模板预览',
              children: (
                <div>
                  <Paragraph strong>系统提示词：</Paragraph>
                  <TextArea
                    value={testingPrompt?.systemPrompt || ''}
                    readOnly
                    rows={3}
                    style={{ marginBottom: 16 }}
                  />
                  <Paragraph strong>用户提示词模板：</Paragraph>
                  <TextArea
                    value={testingPrompt?.userPromptTemplate || ''}
                    readOnly
                    rows={15}
                  />
                  {testingPrompt?.outputFormat && (
                    <>
                      <Paragraph strong style={{ marginTop: 16 }}>输出格式：</Paragraph>
                      <TextArea
                        value={testingPrompt.outputFormat}
                        readOnly
                        rows={8}
                      />
                    </>
                  )}
                </div>
              )
            },
            {
              key: 'result',
              label: '测试结果',
              children: (
                <div>
                  {testResult ? (
                    testResult.error ? (
                      <Paragraph type="danger">
                        <CloseCircleOutlined /> 测试失败: {testResult.error}
                      </Paragraph>
                    ) : (
                      <>
                        <Paragraph>
                          <CheckCircleOutlined /> 测试成功
                        </Paragraph>
                        <Divider />
                        <Paragraph strong>AI 响应：</Paragraph>
                        <TextArea
                          value={testResult.result?.content || testResult.content || ''}
                          readOnly
                          rows={15}
                        />
                        {testResult.result?.usage && (
                          <Paragraph type="secondary" style={{ marginTop: 8 }}>
                            Token 使用: {testResult.result.usage.total_tokens || '-'} |
                            输入: {testResult.result.usage.prompt_tokens || '-'} |
                            输出: {testResult.result.usage.completion_tokens || '-'}
                          </Paragraph>
                        )}
                      </>
                    )
                  ) : (
                    <Paragraph type="secondary">点击"运行测试"查看结果</Paragraph>
                  )}
                </div>
              )
            }
          ]}
        />
      </Modal>
    </div>
  );
};

export default AiPromptManagement;
