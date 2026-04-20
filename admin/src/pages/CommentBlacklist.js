import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Button,
  Card,
  Space,
  Tag,
  message,
  Tooltip,
  Empty,
  Popconfirm,
  Input
} from 'antd';
import {
  ReloadOutlined,
  UserOutlined,
  SearchOutlined,
  FireOutlined,
  BulbOutlined,
  StarOutlined,
  LinkOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';

const { Search } = Input;

// 黑名单原因配置
const REASON_CONFIG = {
  '引流': { color: 'red', icon: <FireOutlined /> },
  '同行': { color: 'orange', icon: <UserOutlined /> },
  '帮助者': { color: 'blue', icon: <BulbOutlined /> },
  '广告': { color: 'purple', icon: <StarOutlined /> }
};

const CommentBlacklist = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [blacklist, setBlacklist] = useState([]);
  const [filteredBlacklist, setFilteredBlacklist] = useState([]);
  const [searchValue, setSearchValue] = useState('');

  // 判断是否有解封权限（只有老板和主管可以解封）
  const canUnban = user?.role === 'boss' || user?.role === 'manager';

  // 获取黑名单
  const fetchBlacklist = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get('/client/comments/blacklist');
      if (response.data.success) {
        setBlacklist(response.data.data);
        setFilteredBlacklist(response.data.data);
      }
    } catch (error) {
      console.error('获取黑名单失败:', error);
      message.error('获取黑名单失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化时获取数据
  useEffect(() => {
    fetchBlacklist();
  }, [fetchBlacklist]);

  // 搜索
  useEffect(() => {
    let filtered = [...blacklist];

    // 按昵称、链接ID或评论内容搜索
    if (searchValue) {
      const keyword = searchValue.toLowerCase();
      filtered = filtered.filter(item =>
        (item.nickname && item.nickname.toLowerCase().includes(keyword)) ||
        (item.userId && item.userId.toLowerCase().includes(keyword)) ||
        (item.commentContent && item.commentContent.toLowerCase().includes(keyword))
      );
    }

    setFilteredBlacklist(filtered);
  }, [searchValue, blacklist]);

  // 从黑名单移除
  const handleRemoveFromBlacklist = useCallback(async (nickname) => {
    try {
      const response = await axios.delete(`/client/comments/blacklist/${encodeURIComponent(nickname)}`);
      if (response.data.success) {
        message.success('已从黑名单移除');
        fetchBlacklist();
      }
    } catch (error) {
      console.error('移除失败:', error);
      message.error('移除失败');
    }
  }, [fetchBlacklist]);

  // 黑名单表格列
  const blacklistColumns = useMemo(() => [
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 180,
      render: (name, record) => (
        <Space size={4}>
          <UserOutlined style={{ color: '#ff4d4f' }} />
          <span style={{ color: '#ff4d4f', fontWeight: 500 }}>{name}</span>
          {record.userId && (
            <Tooltip title="跳转到用户主页">
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => window.open(`https://www.xiaohongshu.com/user/profile/${record.userId}`, '_blank')}
                style={{ padding: '0 4px' }}
              />
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: '用户主页链接ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 280,
      ellipsis: { showTitle: true },
      render: (userId) => (
        <Space size={4}>
          <Tooltip title={userId}>
            <span style={{ fontSize: '12px', color: '#595959', fontFamily: 'monospace' }}>
              {userId || '--'}
            </span>
          </Tooltip>
          {userId && (
            <Tooltip title="跳转到小红书用户主页">
              <Button
                type="primary"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => window.open(`https://www.xiaohongshu.com/user/profile/${userId}`, '_blank')}
              >
                跳转主页
              </Button>
            </Tooltip>
          )}
        </Space>
      )
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 100,
      render: (reason) => {
        const config = REASON_CONFIG[reason] || { color: 'default', icon: null };
        return (
          <Tag color={config.color} icon={config.icon} style={{ margin: 0 }}>
            {reason || '未知'}
          </Tag>
        );
      }
    },
    {
      title: '评论内容',
      dataIndex: 'commentContent',
      key: 'commentContent',
      width: 350,
      ellipsis: { showTitle: true },
      render: (content) => (
        <Tooltip title={content}>
          <span style={{ fontSize: '12px', color: '#595959' }}>{content || '--'}</span>
        </Tooltip>
      )
    },
    {
      title: '被举报次数',
      dataIndex: 'reportCount',
      key: 'reportCount',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.reportCount || 1) - (b.reportCount || 1),
      render: (count) => <Tag color="orange">{count || 1}</Tag>
    },
    {
      title: '添加时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (time) => (
        <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
          {time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '--'}
        </span>
      )
    },
    {
      title: '过期时间',
      dataIndex: 'expireAt',
      key: 'expireAt',
      width: 130,
      sorter: (a, b) => new Date(a.expireAt || 9999) - new Date(b.expireAt || 9999),
      render: (time) => {
        const isExpired = time && new Date(time) < new Date();
        return (
          <span style={{ fontSize: '12px', color: isExpired ? '#ff4d4f' : '#8c8c8c' }}>
            {time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '--'}
            {isExpired && <Tag color="red" size="small" style={{ marginLeft: 4 }}>已过期</Tag>}
          </span>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        canUnban ? (
          <Popconfirm
            title="确定要解封该用户吗？"
            description="解封后该用户的评论将不再被自动过滤"
            onConfirm={() => handleRemoveFromBlacklist(record.nickname)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger>
              解封
            </Button>
          </Popconfirm>
        ) : null
      )
    }
  ], [handleRemoveFromBlacklist, canUnban]);

  // 统计信息
  const stats = useMemo(() => {
    const expiredCount = blacklist.filter(item =>
      item.expireAt && new Date(item.expireAt) < new Date()
    ).length;

    const reasonCounts = blacklist.reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {});

    return {
      total: blacklist.length,
      expired: expiredCount,
      reasonCounts
    };
  }, [blacklist]);

  return (
    <div>
      <Card bordered={false} title="评论黑名单管理">
        {/* 统计信息 */}
        <Space wrap style={{ marginBottom: 16 }}>
          <Tag color="red" style={{ fontSize: '14px', padding: '4px 12px' }}>
            总计: {stats.total} 人
          </Tag>
          {stats.expired > 0 && (
            <Tag color="orange" style={{ fontSize: '14px', padding: '4px 12px' }}>
              已过期: {stats.expired} 人
            </Tag>
          )}
          {Object.entries(stats.reasonCounts).map(([reason, count]) => (
            <Tag key={reason} color={REASON_CONFIG[reason]?.color || 'default'} style={{ fontSize: '13px' }}>
              {reason}: {count}
            </Tag>
          ))}
        </Space>

        {/* 操作栏 */}
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: '#fafafa',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <Space wrap size={8}>
            <Search
              placeholder="搜索昵称、链接ID或评论内容..."
              allowClear
              style={{ width: 280 }}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              prefix={<SearchOutlined />}
            />
            {filteredBlacklist.length !== blacklist.length && (
              <Tag color="blue">
                搜索结果: {filteredBlacklist.length} / {blacklist.length}
              </Tag>
            )}
          </Space>

          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBlacklist}
            loading={loading}
          >
            刷新
          </Button>
        </div>

        {/* 黑名单表格 */}
        <Table
          rowKey="_id"
          columns={blacklistColumns}
          dataSource={filteredBlacklist}
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total, range) => (
              <span style={{ color: '#8c8c8c' }}>
                显示 {range[0]}-{range[1]} 条，共 {total} 条
              </span>
            ),
            pageSizeOptions: [10, 20, 50, 100]
          }}
          scroll={{ x: 1200 }}
          size="small"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <div style={{ color: '#8c8c8c', marginBottom: 8 }}>
                      {searchValue ? '没有符合条件的黑名单记录' : '暂无黑名单记录'}
                    </div>
                  </div>
                }
              />
            )
          }}
        />
      </Card>
    </div>
  );
};

export default CommentBlacklist;
