import React, { useState, useEffect } from 'react';
import { Layout, Avatar, Dropdown, message, Badge, List, Button, Drawer } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import DynamicMenu from './DynamicMenu';
import axios from 'axios';

const { Header, Sider, Content } = Layout;

// 移动端断点
const MOBILE_BREAKPOINT = 768;

const AppLayout = () => {
  const { user, logout, userMenus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // 移动端适配状态
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      // 移动端自动收起侧边栏
      if (mobile && !collapsed) {
        setCollapsed(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [collapsed]);

  // 获取通知
  const fetchNotifications = async () => {
    try {
      const response = await axios.get('/reviews/notifications');
      if (response.data.success) {
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('获取通知失败:', error);
    }
  };

  // 标记通知为已读
  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`/reviews/notifications/${notificationId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // 查找当前页面的标题（从动态菜单中查找）
  const findMenuLabel = (menus, pathname) => {
    for (const item of menus) {
      if (item.key === pathname) {
        return item.label;
      }
      if (item.children) {
        const childLabel = findMenuLabel(item.children, pathname);
        if (childLabel) return childLabel;
      }
    }
    return null;
  };

  const currentPageTitle = findMenuLabel(userMenus, location.pathname) || '仪表板';

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleOpenChange = (keys) => {
    // 动态菜单自己管理展开状态
  };

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 渲染菜单组件
  const renderMenu = () => (
    <>
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: isMobile ? 16 : 18,
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
      }}>
        素人分发系统
      </div>
      <DynamicMenu collapsed={collapsed} />
    </>
  );

  if (!user) {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* PC端侧边栏 */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0
          }}
        >
          {renderMenu()}
        </Sider>
      )}

      {/* 移动端抽屉菜单 */}
      {isMobile && (
        <Drawer
          title="菜单"
          placement="left"
          onClose={() => setMobileMenuVisible(false)}
          open={mobileMenuVisible}
          bodyStyle={{ padding: 0, backgroundColor: '#001529' }}
          width={250}
        >
          <DynamicMenu collapsed={false} />
        </Drawer>
      )}

      <Layout style={{
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 200),
        transition: 'margin-left 0.2s'
      }}>
        <Header style={{
          background: '#fff',
          padding: isMobile ? '0 16px' : '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 16 }}>
            {/* 移动端菜单按钮 */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMobileMenuVisible(true)}
                style={{ fontSize: '18px', padding: '0 8px' }}
              />
            )}

            {/* PC端折叠按钮 */}
            {!isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuOutlined /> : <MenuOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: '18px', marginRight: 8 }}
              />
            )}

            {/* 页面标题 */}
            <h2 style={{
              margin: 0,
              fontSize: isMobile ? 16 : 20,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: isMobile ? '150px' : '300px'
            }}>
              {currentPageTitle}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            {/* 通知图标 */}
            <Dropdown
              overlay={
                <div style={{
                  background: '#fff',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px',
                  width: isMobile ? '260px' : '300px',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}>
                  <List
                    size="small"
                    dataSource={notifications}
                    renderItem={item => (
                      <List.Item
                        style={{
                          padding: '12px 16px',
                          backgroundColor: item.read ? '#fff' : '#f0f8ff'
                        }}
                        actions={!item.read ? [
                          <Button
                            type="link"
                            size="small"
                            onClick={() => markAsRead(item.id)}
                          >
                            标记已读
                          </Button>
                        ] : []}
                      >
                        <List.Item.Meta
                          title={<span style={{ fontSize: '14px' }}>{item.message}</span>}
                          description={
                            <span style={{ fontSize: '12px', color: '#999' }}>
                              {new Date(item.createdAt).toLocaleString('zh-CN')}
                            </span>
                          }
                        />
                      </List.Item>
                    )}
                  />
                  {notifications.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      暂无通知
                    </div>
                  )}
                </div>
              }
              trigger={['click']}
              placement="bottomRight"
            >
              <Badge count={unreadCount} size="small" offset={[-4, 4]}>
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
              </Badge>
            </Dropdown>

            {/* 用户菜单 */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
            >
              <div style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px'
              }}>
                <Avatar style={{ marginRight: isMobile ? 4 : 8 }}>
                  {user.username?.charAt(0)?.toUpperCase()}
                </Avatar>
                {!isMobile && <span>{user.username}</span>}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{
          margin: isMobile ? '12px' : '24px 16px',
          padding: isMobile ? 16 : 24,
          background: '#fff',
          minHeight: 'calc(100vh - 64px)',
          overflowX: 'hidden'
        }}>
          <Outlet />
        </Content>
      </Layout>

      {/* 移动端全局样式 */}
      <style>{`
        @media (max-width: ${MOBILE_BREAKPOINT - 1}px) {
          .ant-table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .ant-table {
            min-width: 600px;
          }

          .ant-btn {
            min-height: 44px;
            min-width: 44px;
          }

          .ant-pagination {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }

          .ant-pagination-simple {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .ant-modal {
            margin: 16px;
            max-width: calc(100vw - 32px) !important;
          }

          .ant-modal-content {
            width: 100% !important;
          }

          .ant-form-item {
            margin-bottom: 16px;
          }

          .ant-form-item-label {
            text-align: left;
          }
        }
      `}</style>
    </Layout>
  );
};

export default AppLayout;
