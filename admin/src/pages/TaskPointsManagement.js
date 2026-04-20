import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  message,
  Card,
  Space,
  Tag,
  Popconfirm
} from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const TaskPointsManagement = () => {
  const [taskConfigs, setTaskConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm] = Form.useForm();
  const { user } = useAuth();

  // 检查用户权限
  const hasPermission = user?.role === 'boss' || user?.role === 'manager';

  useEffect(() => {
    if (hasPermission) {
      fetchTaskConfigs();
    }
  }, [hasPermission]);

  const fetchTaskConfigs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/client/task-configs');
      if (response.data.success) {
        setTaskConfigs(response.data.configs || []);
      }
    } catch (error) {
      message.error('获取任务配置失败');
      console.error('获取任务配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.type_key);
    editForm.setFieldsValue({
      price: record.price,
      commission_1: record.commission_1,
      commission_2: record.commission_2,
      daily_reward_points: record.daily_reward_points
    });
  };

  const handleSave = async () => {
    try {
      const values = await editForm.validateFields();
      const config = taskConfigs.find(c => c.type_key === editingId);

      if (!config) {
        message.error('未找到任务配置');
        return;
      }

      console.log('前端发送的数据:', {
        price: values.price,
        commission_1: values.commission_1,
        commission_2: values.commission_2,
        daily_reward_points: values.daily_reward_points
      });

      // 调用API更新任务配置
      const response = await axios.put(`/admin/task-points/${config._id}`, {
        price: values.price,
        commission_1: values.commission_1,
        commission_2: values.commission_2,
        daily_reward_points: values.daily_reward_points
      });

      if (response.data.success) {
        message.success('任务积分更新成功');
        setEditingId(null);
        fetchTaskConfigs(); // 刷新数据
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '更新失败';
      message.error(errorMessage);
      console.error('更新任务积分失败:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    editForm.resetFields();
  };

  const handleEditContinuous = (record) => {
    setEditingId(`continuous_${record.type_key}`);
    editForm.setFieldsValue({
      price: record.price, // 确保price也被设置，用于API调用
      daily_reward_points: record.daily_reward_points,
      commission_1: record.commission_1,
      commission_2: record.commission_2,
      continuous_check_days: record.continuous_check_days
    });
  };

  const handleSaveContinuous = async (record) => {
    try {
      const values = await editForm.validateFields();

      const response = await axios.put(`/admin/task-points/${record._id}`, {
        price: record.price,
        commission_1: values.commission_1,
        commission_2: values.commission_2,
        daily_reward_points: values.daily_reward_points,
        continuous_check_days: values.continuous_check_days
      });

      if (response.data.success) {
        message.success('持续检查参数更新成功');
        setEditingId(null);
        fetchTaskConfigs(); // 刷新数据
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || '更新失败';
      message.error(errorMessage);
      console.error('更新持续检查参数失败:', error);
    }
  };

  const getTaskTypeText = (typeKey) => {
    const typeMap = {
      'customer_resource': '客资',
      'note': '笔记',
      'comment': '评论'
    };
    return typeMap[typeKey] || typeKey;
  };

  const columns = [
    {
      title: '任务类型',
      dataIndex: 'type_key',
      key: 'type_key',
      width: 120,
      render: (typeKey) => (
        <Tag color="blue">{getTaskTypeText(typeKey)}</Tag>
      )
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      width: 150
    },
    {
      title: '任务积分',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price, record) => {
        if (editingId === record.type_key) {
          return (
            <Form.Item
              name="price"
              rules={[{ required: true, message: '请输入任务积分' }]}
              style={{ margin: 0 }}
            >
              <InputNumber
                min={0}
                step={1}
                placeholder="任务积分"
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        }
        return <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{price} 分</span>;
      }
    },
    {
      title: '一级分销积分',
      dataIndex: 'commission_1',
      key: 'commission_1',
      width: 140,
      render: (commission, record) => {
        if (editingId === record.type_key) {
          return (
            <Form.Item
              name="commission_1"
              rules={[{ required: true, message: '请输入一级分销积分' }]}
              style={{ margin: 0 }}
            >
              <InputNumber
                min={0}
                step={1}
                placeholder="一级分销积分"
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        }
        return <span style={{ color: '#52c41a' }}>{commission} 分</span>;
      }
    },
    {
      title: '二级分销积分',
      dataIndex: 'commission_2',
      key: 'commission_2',
      width: 140,
      render: (commission, record) => {
        if (editingId === record.type_key) {
          return (
            <Form.Item
              name="commission_2"
              rules={[{ required: true, message: '请输入二级分销积分' }]}
              style={{ margin: 0 }}
            >
              <InputNumber
                min={0}
                step={1}
                placeholder="二级分销积分"
                style={{ width: '100%' }}
              />
            </Form.Item>
          );
        }
        return <span style={{ color: '#722ed1' }}>{commission} 分</span>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (editingId === record.type_key) {
          return (
            <Space size="small">
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                onClick={handleSave}
                style={{ fontSize: '12px' }}
              >
                保存
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancel}
                style={{ fontSize: '12px' }}
              >
                取消
              </Button>
            </Space>
          );
        }

        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ padding: '0 4px' }}
          >
            编辑
          </Button>
        );
      }
    }
  ];

  // 如果没有权限，显示无权限提示
  if (!hasPermission) {
    return (
      <Card title="任务积分管理">
        <div style={{
          textAlign: 'center',
          padding: '50px 20px',
          color: '#999'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '10px' }}>无权限访问</p>
          <p>只有老板和主管可以访问任务积分管理页面</p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card
        title="任务积分管理"
        extra={
          <Button
            type="primary"
            onClick={fetchTaskConfigs}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#666', margin: 0 }}>
            💡 修改任务积分和分销积分设置。积分兑换规则：100积分 = 1元
          </p>
        </div>

        <Form form={editForm} component={false}>
          {/* 隐藏的表单字段，确保字段始终存在 */}
          <Form.Item name="price" style={{ display: 'none' }}>
            <InputNumber />
          </Form.Item>
          <Form.Item name="commission_1" style={{ display: 'none' }}>
            <InputNumber />
          </Form.Item>
          <Form.Item name="commission_2" style={{ display: 'none' }}>
            <InputNumber />
          </Form.Item>
          <Form.Item name="daily_reward_points" style={{ display: 'none' }}>
            <InputNumber />
          </Form.Item>

          <Table
            columns={columns}
            dataSource={taskConfigs}
            rowKey="type_key"
            loading={loading}
            pagination={false}
            scroll={{ x: 1000 }}
          />
        </Form>

        {/* 持续检查参数管理 */}
        <Card title="持续检查参数管理" style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: '#666', margin: 0 }}>
              💡 管理笔记持续检查的奖励参数。系统每天检查笔记是否存在，存在则发放奖励积分。
            </p>
          </div>

          <Table
            columns={[
              {
                title: '任务类型',
                dataIndex: 'type_key',
                key: 'type_key',
                width: 120,
                render: (typeKey) => (
                  <Tag color="blue">{getTaskTypeText(typeKey)}</Tag>
                )
              },
              {
                title: '每日奖励积分',
                dataIndex: 'daily_reward_points',
                key: 'daily_reward_points',
                width: 140,
                render: (dailyRewardPoints, record) => {
                  if (editingId === `continuous_${record.type_key}`) {
                    return (
                      <Form.Item
                        name="daily_reward_points"
                        rules={[{ type: 'number', min: 0, message: '每日奖励积分不能为负数' }]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber
                          min={0}
                          step={1}
                          placeholder="每日奖励积分"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    );
                  }
                  return <span style={{ color: '#fa8c16', fontWeight: 'bold' }}>{dailyRewardPoints} 分/天</span>;
                }
              },
              {
                title: '持续检查天数',
                dataIndex: 'continuous_check_days',
                key: 'continuous_check_days',
                width: 140,
                render: (days, record) => {
                  if (editingId === `continuous_${record.type_key}`) {
                    return (
                      <Form.Item
                        name="continuous_check_days"
                        rules={[
                          { type: 'number', min: 1, max: 365, message: '天数必须在1-365之间' }
                        ]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber
                          min={1}
                          max={365}
                          step={1}
                          placeholder="持续检查天数"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    );
                  }
                  return <span style={{ color: '#1890ff' }}>{days} 天</span>;
                }
              },
              // {
              //   title: '操作',
              //   key: 'action_continuous',
              //   width: 120,
              //   render: (_, record) => {
              //     if (editingId === `continuous_${record.type_key}`) {
              //       return (
              //         <Space size="small">
              //           <Button
              //             type="primary"
              //             size="small"
              //             icon={<SaveOutlined />}
              //             onClick={() => handleSaveContinuous(record)}
              //             style={{ fontSize: '12px' }}
              //           >
              //             保存
              //           </Button>
              //           <Button
              //             size="small"
              //             icon={<CloseOutlined />}
              //             onClick={() => setEditingId(null)}
              //             style={{ fontSize: '12px' }}
              //           >
              //             取消
              //           </Button>
              //         </Space>
              //       );
              //     }

              //     return (
              //       <Button
              //         type="link"
              //         size="small"
              //         icon={<EditOutlined />}
              //         onClick={() => handleEditContinuous(record)}
              //         style={{ padding: '0 4px' }}
              //       >
              //         编辑
              //       </Button>
              //     );
              //   }
              // }
            ]}
            dataSource={taskConfigs.filter(config => config.type_key === 'note')} // 只显示笔记配置
            rowKey="type_key"
            loading={loading}
            pagination={false}
            scroll={{ x: 800 }}
          />
        </Card>

        <div style={{ marginTop: 20, padding: '16px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#52c41a' }}>💰 积分兑换说明</h4>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            • 任务积分：用户完成任务获得的积分<br/>
            • 一级分销积分：直接邀请人获得的奖励积分<br/>
            • 二级分销积分：间接邀请人获得的奖励积分<br/>
            • 每日奖励积分：笔记持续存在性检查通过获得的每日积分<br/>
            • 兑换比例：100积分可兑换1元人民币
          </p>
        </div>
      </Card>
    </div>
  );
};

export default TaskPointsManagement;