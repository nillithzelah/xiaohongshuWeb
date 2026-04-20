import React, { useState, useEffect } from 'react';
import {
  Card,
  Tabs,
  Tree,
  Button,
  message,
  Spin,
  Space,
  Tag,
  Descriptions
} from 'antd';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

// 角色显示名称映射
const ROLE_LABELS = {
  boss: '老板',
  manager: '主管',
  finance: '财务',
  mentor: '带教老师',
  hr: 'HR',
  promoter: '引流人员',
  part_time: '兼职用户',
  lead: '线索'
};

// 角色描述
const ROLE_DESCRIPTIONS = {
  boss: '最高权限，拥有所有菜单访问权限',
  manager: '高级管理权限，可管理审核、内容、用户、设备、财务等',
  hr: '人力管理权限，可审核和管理用户、设备',
  mentor: '带教老师，可审核和管理用户、设备',
  finance: '财务管理权限，可处理提现和财务统计',
  promoter: '引流人员，只能管理评论线索和黑名单',
  part_time: '兼职用户，最低权限',
  lead: '线索角色'
};

/**
 * 权限管理页面
 * 允许 boss 角色配置各角色可访问的菜单
 */
const PermissionManagement = () => {
  const { user: currentUser } = useAuth();
  const [menuTree, setMenuTree] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState('boss');

  // 可配置的角色列表（排除 part_time 和 lead）
  const configurableRoles = Object.keys(ROLE_LABELS).filter(
    role => role !== 'part_time' && role !== 'lead'
  );

  useEffect(() => {
    fetchMenuTree();
    fetchAllRolePermissions();
  }, []);

  // 获取完整菜单树
  const fetchMenuTree = async () => {
    try {
      const response = await axios.get('/permissions/menu-tree');
      if (response.data.success) {
        setMenuTree(formatMenuTreeData(response.data.menus));
      }
    } catch (error) {
      console.error('获取菜单树失败:', error);
      message.error('获取菜单树失败');
    }
  };

  // 获取所有角色权限
  const fetchAllRolePermissions = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/permissions/overview');
      if (response.data.success) {
        const permissions = {};
        response.data.roles.forEach(rp => {
          permissions[rp.role] = rp.allowedMenus || [];
        });
        setRolePermissions(permissions);
      }
    } catch (error) {
      console.error('获取角色权限失败:', error);
      message.error('获取角色权限失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化菜单树数据为 Ant Design Tree 组件所需格式
  const formatMenuTreeData = (menus) => {
    return menus.map(menu => ({
      title: menu.label,
      key: menu.key,
      children: menu.children ? formatMenuTreeData(menu.children) : undefined
    }));
  };

  // 保存角色权限
  const handleSavePermissions = async (role) => {
    setSaving(true);
    try {
      await axios.put(`/permissions/role/${role}`, {
        allowedMenus: rolePermissions[role] || []
      });
      message.success(`${ROLE_LABELS[role]}权限配置已保存`);
    } catch (error) {
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  // 树节点勾选变化
  const onCheck = (role, checkedKeys) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: checkedKeys
    }));
  };

  // 获取当前角色的权限统计
  const getPermissionStats = (role) => {
    const menus = rolePermissions[role] || [];
    const totalMenus = countTotalMenus(menuTree);
    return { granted: menus.length, total: totalMenus };
  };

  // 递归计算菜单总数
  const countTotalMenus = (menus) => {
    let count = 0;
    menus.forEach(menu => {
      count++;
      if (menu.children) {
        count += countTotalMenus(menu.children);
      }
    });
    return count;
  };

  // 只有 boss 可以访问此页面
  if (currentUser?.role !== 'boss') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2>权限不足</h2>
        <p>只有老板角色可以访问权限管理页面</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="加载权限配置..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card title="权限管理" extra={
        <Tag color="blue">仅老板可配置</Tag>
      }>
        <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="菜单总数">{countTotalMenus(menuTree)}</Descriptions.Item>
          <Descriptions.Item label="可配置角色">{configurableRoles.length}</Descriptions.Item>
          <Descriptions.Item label="说明">勾选表示该角色可访问对应菜单</Descriptions.Item>
        </Descriptions>

        <Tabs
          activeKey={activeRole}
          onChange={setActiveRole}
          items={configurableRoles.map(role => {
            const stats = getPermissionStats(role);
            return {
              key: role,
              label: `${ROLE_LABELS[role]} (${stats.granted}/${stats.total})`,
              children: (
                <div>
                  <p style={{ marginBottom: 16, color: '#666' }}>
                    {ROLE_DESCRIPTIONS[role]}
                  </p>

                  <Space style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      onClick={() => handleSavePermissions(role)}
                      loading={saving}
                    >
                      保存{ROLE_LABELS[role]}权限
                    </Button>
                    <Button onClick={() => fetchAllRolePermissions()}>
                      重置
                    </Button>
                  </Space>

                  <Tree
                    checkable
                    checkedKeys={rolePermissions[role] || []}
                    onCheck={(keys) => onCheck(role, keys)}
                    treeData={menuTree}
                    defaultExpandAll
                    style={{ backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px' }}
                  />
                </div>
              )
            };
          })}
        />
      </Card>
    </div>
  );
};

export default PermissionManagement;
