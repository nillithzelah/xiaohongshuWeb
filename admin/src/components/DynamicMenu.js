import React, { useMemo } from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UserOutlined,
  MobileOutlined,
  TeamOutlined,
  RobotOutlined,
  SettingOutlined,
  AppstoreOutlined,
  FundOutlined,
  StarOutlined,
  StopOutlined,
  CloudOutlined,
  SearchOutlined,
  LinkOutlined,
  CodeOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

// 图标映射
const ICON_MAP = {
  DashboardOutlined,
  UserOutlined,
  MobileOutlined,
  TeamOutlined,
  RobotOutlined,
  SettingOutlined,
  AppstoreOutlined,
  FundOutlined,
  StarOutlined,
  StopOutlined,
  CloudOutlined,
  SearchOutlined,
  LinkOutlined,
  CodeOutlined,
  SafetyOutlined
};

// 获取图标组件
const getIconComponent = (iconName) => {
  if (!iconName) return null;
  const IconComponent = ICON_MAP[iconName];
  return IconComponent ? React.createElement(IconComponent) : null;
};

/**
 * 递归构建 Ant Design Menu 所需的菜单项格式
 */
const buildMenuItems = (menus) => {
  if (!menus || menus.length === 0) return [];

  return menus.map(menu => {
    const item = {
      key: menu.key,
      label: menu.label,
      icon: getIconComponent(menu.icon),
    };

    // 如果有子菜单，递归构建
    if (menu.children && menu.children.length > 0) {
      item.children = buildMenuItems(menu.children);
    }

    return item;
  });
};

/**
 * 动态菜单组件
 * 根据后端返回的权限配置动态生成导航菜单
 */
const DynamicMenu = ({ collapsed }) => {
  const { userMenus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 构建菜单项
  const menuItems = useMemo(() => buildMenuItems(userMenus), [userMenus]);

  // 菜单点击处理
  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 获取默认展开的菜单键（包含当前路由的父菜单）
  const getDefaultOpenKeys = () => {
    if (!userMenus) return [];
    const path = location.pathname;
    return userMenus
      .filter(menu => {
        // 检查是否为父菜单且当前路径在其子菜单中
        if (!menu.children || menu.children.length === 0) return false;
        return menu.children.some(child =>
          path === child.key || path.startsWith(child.key + '/')
        );
      })
      .map(menu => menu.key);
  };

  // 如果没有菜单数据，返回空
  if (!menuItems || menuItems.length === 0) {
    return null;
  }

  return (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      defaultOpenKeys={getDefaultOpenKeys()}
      items={menuItems}
      onClick={handleMenuClick}
      inlineCollapsed={collapsed}
    />
  );
};

export default DynamicMenu;
