import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import { Modal, Input, message, Spin } from 'antd';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userMenus, setUserMenus] = useState([]);  // 用户菜单树
  const [flatMenus, setFlatMenus] = useState([]);    // 扁平菜单列表（用于权限判断）
  const [sessionExpiredModal, setSessionExpiredModal] = useState(false);  // 登录过期提示弹窗
  const [loginUsername, setLoginUsername] = useState('');  // 弹窗内登录用户名
  const [loginPassword, setLoginPassword] = useState('');  // 弹窗内登录密码
  const [loginLoading, setLoginLoading] = useState(false);  // 登录中状态
  const isHandledRef = useRef(false);  // 防止重复弹窗

  // 设置axios默认配置 - 使用相对路径，由Nginx代理转发
  axios.defaults.baseURL = process.env.REACT_APP_API_BASE_URL || '/xiaohongshu/api';

  // 获取用户权限配置
  const fetchUserPermissions = async () => {
    try {
      const response = await axios.get('/permissions/mine');
      if (response.data.success) {
        setUserMenus(response.data.menus || []);
        setFlatMenus(response.data.flatMenus || []);
      }
    } catch (error) {
      console.error('获取用户权限失败:', error);
      // 失败时使用空数组，确保应用仍可运行
      setUserMenus([]);
      setFlatMenus([]);
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (token && storedUser) {
          // 设置请求头
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // 从本地存储恢复用户信息
          setUser(JSON.parse(storedUser));
          // 获取用户权限配置
          await fetchUserPermissions();
        }
      } catch (error) {
        console.error('初始化认证状态失败:', error);
        // 清除可能损坏的数据
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 设置axios响应拦截器 - 处理401错误
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // 检测401未授权错误
        if (error.response?.status === 401) {
          // 防止重复弹窗
          if (isHandledRef.current) {
            return Promise.reject(error);
          }
          isHandledRef.current = true;

          console.log('检测到401响应，token已失效');

          // 清除认证信息
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);

          // 显示登录过期提示弹窗
          setSessionExpiredModal(true);
        }
        return Promise.reject(error);
      }
    );

    // 清理函数：组件卸载时移除拦截器
    return () => {
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // 登录函数
  const login = async (username, password) => {
    try {
      const response = await axios.post('/auth/admin-login', { username, password });

      if (response.data.success) {
        const { token, user: userData } = response.data;

        // 保存到localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));

        // 设置axios请求头
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // 更新状态
        setUser(userData);

        // 获取用户权限配置
        await fetchUserPermissions();

        // 重置401处理标志
        isHandledRef.current = false;

        return { success: true };
      } else {
        // 返回完整的错误响应（包括 remainingAttempts, locked, lockedUntil 等）
        return {
          success: false,
          message: response.data.message || '登录失败',
          remainingAttempts: response.data.remainingAttempts,
          locked: response.data.locked,
          lockedUntil: response.data.lockedUntil,
          remainingMinutes: response.data.remainingMinutes
        };
      }
    } catch (error) {
      console.error('登录错误:', error);
      return {
        success: false,
        message: error.response?.data?.message || '网络错误，请稍后重试',
        remainingAttempts: error.response?.data?.remainingAttempts,
        locked: error.response?.data?.locked,
        lockedUntil: error.response?.data?.lockedUntil,
        remainingMinutes: error.response?.data?.remainingMinutes
      };
    }
  };

  // 登出函数
  const logout = () => {
    // 清除本地存储
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // 清除axios请求头
    delete axios.defaults.headers.common['Authorization'];

    // 重置状态
    setUser(null);
    setUserMenus([]);
    setFlatMenus([]);

    // 重置401处理标志
    isHandledRef.current = false;
  };

  // 弹窗内登录处理
  const handleModalLogin = async () => {
    if (!loginUsername || !loginPassword) {
      message.warning('请输入用户名和密码');
      return;
    }

    setLoginLoading(true);
    const result = await login(loginUsername, loginPassword);
    setLoginLoading(false);

    if (result.success) {
      message.success('登录成功');
      setSessionExpiredModal(false);
      setLoginUsername('');
      setLoginPassword('');
      // 刷新页面以更新数据
      window.location.reload();
    } else {
      message.error(result.message || '登录失败，请重试');
    }
  };

  // 关闭弹窗
  const handleCloseModal = () => {
    setSessionExpiredModal(false);
    setLoginUsername('');
    setLoginPassword('');
    // 重置标志，允许下次401时再次弹窗
    isHandledRef.current = false;
  };

  const value = {
    user,
    loading,
    userMenus,
    flatMenus,
    login,
    logout,
    fetchUserPermissions,
    isAuthenticated: !!user,
    hasRole: (role) => user?.role === role,
    hasPermission: (path) => {
      // 检查是否有访问指定路径的权限
      if (!path || flatMenus.length === 0) return true;
      // 精确匹配或前缀匹配（对于子路由）
      return flatMenus.includes(path) || flatMenus.some(menu => path.startsWith(menu + '/'));
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* 登录过期提示弹窗 - 内嵌登录表单 */}
      <Modal
        title="登录已过期"
        open={sessionExpiredModal}
        onOk={handleModalLogin}
        onCancel={handleCloseModal}
        okText="登录"
        cancelText="关闭"
        centered
        maskClosable={false}
        keyboard={false}
        destroyOnClose={true}
        width={400}
        okButtonProps={{ loading: loginLoading }}
        cancelButtonProps={{ disabled: loginLoading }}
      >
        <div style={{ padding: '10px 0' }}>
          <p style={{ textAlign: 'center', marginBottom: '16px', color: '#666' }}>
            您的登录状态已过期，请重新登录
          </p>

          <div style={{ marginBottom: '12px' }}>
            <Input
              placeholder="请输入用户名"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              onPressEnter={handleModalLogin}
              disabled={loginLoading}
              autoComplete="username"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <Input.Password
              placeholder="请输入密码"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onPressEnter={handleModalLogin}
              disabled={loginLoading}
              autoComplete="current-password"
            />
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#999', marginTop: '12px' }}>
            {loginLoading && <span><Spin size="small" /> 登录中...</span>}
          </p>
        </div>
      </Modal>
    </AuthContext.Provider>
  );
};
