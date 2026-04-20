import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Select,
  message,
  Tag,
  Space,
  Input,
  Row,
  Col,
  Statistic,
  Spin
} from 'antd';
import { UserSwitchOutlined, SearchOutlined, TeamOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const ManagerDashboard = () => {
  const [leads, setLeads] = useState([]);
  const [mentorList, setMentorList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [currentLead, setCurrentLead] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [stats, setStats] = useState({
    totalLeads: 0,
    assignedLeads: 0
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchMentorList();
  }, [pagination.current, pagination.pageSize, searchText]);

  const fetchDashboardData = async () => {
    try {
      setStatsLoading(true);
      // 获取主管负责的线索统计
      const leadsResponse = await axios.get('/manager/leads', {
        params: { page: 1, limit: 1000 } // 获取所有线索来统计
      });
      const totalLeads = leadsResponse.data.leads?.length || 0;
      const assignedLeads = leadsResponse.data.leads?.filter(lead => lead.role === 'part_time').length || 0;

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

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.current,
        limit: pagination.pageSize
      };
      if (searchText) {
        params.search = searchText;
      }

      const response = await axios.get('/manager/leads', { params });
      if (response.data.success) {
        setLeads(response.data.leads);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination.total
        }));
      }
    } catch (error) {
      message.error('获取待分配线索失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchMentorList = async () => {
    try {
      const response = await axios.get('/manager/mentor-list');
      if (response.data.success) {
        setMentorList(response.data.mentorList);
      }
    } catch (error) {
      message.error('获取带教老师列表失败');
    }
  };

  const handleAssignMentor = (lead) => {
    setCurrentLead(lead);
    setSelectedMentor(null);
    setAssignModalVisible(true);
  };

  const handleAssignConfirm = async () => {
    if (!selectedMentor) {
      message.warning('请选择要分配的带教老师');
      return;
    }

    try {
      const response = await axios.put(`/manager/assign-mentor/${currentLead.id}`, {
        mentor_id: selectedMentor
      });

      if (response.data.success) {
        message.success('线索分配成功');
        setAssignModalVisible(false);
        setCurrentLead(null);
        setSelectedMentor(null);
        fetchLeads();
      }
    } catch (error) {
      message.error('分配失败');
    }
  };

  const handleSearch = (value) => {
    setSearchText(value);
    setPagination(prev => ({ ...prev, current: 1 }));
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
            fetchLeads();
            fetchDashboardData();
          }
        } catch (error) {
          message.error('删除线索失败');
        }
      }
    });
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
      title: 'HR',
      dataIndex: ['hr_id', 'username'],
      key: 'hr_id',
      render: (hr) => hr || '未知'
    },
    {
      title: '小红书账号',
      key: 'xiaohongshu_accounts',
      render: (_, record) => {
        // 检查是否有xiaohongshuAccounts字段
        if (record.xiaohongshuAccounts && record.xiaohongshuAccounts.length > 0) {
          return (
            <div>
              {record.xiaohongshuAccounts.map((account, index) => (
                <div key={index} style={{ marginBottom: 4 }}>
                  <Tag color="blue" style={{ fontSize: '12px' }}>
                    {account.account} ({account.nickname})
                  </Tag>
                </div>
              ))}
            </div>
          );
        }
        return <span style={{ color: '#999' }}>无账号信息</span>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            size="small"
            icon={<UserSwitchOutlined />}
            onClick={() => handleAssignMentor(record)}
          >
            分配带教老师
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteLead(record.id)}
            disabled={record.role === 'part_time'} // 已分配的用户不能删除
          >
            删除
          </Button>
        </Space>
      )
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
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
                title="待分配线索"
                value={stats.totalLeads - stats.assignedLeads}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#faad14' }}
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
                prefix={<UserSwitchOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <UserSwitchOutlined />
            待分配线索管理
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索姓名搜索姓名、电话或微信"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={() => handleSearch(searchText)}
            style={{ width: 300 }}
          />
          <Button type="primary" onClick={() => handleSearch(searchText)}>
            搜索
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={leads}
          rowKey="id"
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
        title="分配带教老师"
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false);
          setCurrentLead(null);
          setSelectedMentor(null);
        }}
        onOk={handleAssignConfirm}
        okText="确认分配"
        cancelText="取消"
      >
        {currentLead && (
          <div style={{ marginBottom: 16 }}>
            <p><strong>客户信息：</strong></p>
            <p>姓名：{currentLead.nickname}</p>
            <p>电话：{currentLead.phone}</p>
            {currentLead.wechat && <p>微信：{currentLead.wechat}</p>}
            {currentLead.notes && <p>备注：{currentLead.notes}</p>}
          </div>
        )}

        <div>
          <p><strong>选择带教老师：</strong></p>
          <Select
            placeholder="请选择要分配的带教老师"
            style={{ width: '100%' }}
            value={selectedMentor}
            onChange={setSelectedMentor}
          >
            {mentorList.map(mentor => (
              <Option key={mentor.id} value={mentor.id}>
                {mentor.nickname} ({mentor.username}) - {mentor.phone}
              </Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};

export default ManagerDashboard;