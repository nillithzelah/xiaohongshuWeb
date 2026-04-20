import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 设置基础URL
  axios.defaults.baseURL = 'http://localhost:5000/xiaohongshu/api';

  // 初始化时检查本地存储的认证信息
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem('finance_token');
      const userData = localStorage.getItem('finance_user');

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('✅ 从本地存储恢复登录状态:', parsedUser.username);
        } catch (error) {
          console.error('❌ 解析本地用户数据失败:', error);
          localStorage.removeItem('finance_token');
          localStorage.removeItem('finance_user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // 登录方法
  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('finance_token', token);
    localStorage.setItem('finance_user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('✅ 用户登录成功:', userData.username);
  };

  // 登出方法
  const logout = () => {
    setUser(null);
    localStorage.removeItem('finance_token');
    localStorage.removeItem('finance_user');
    delete axios.defaults.headers.common['Authorization'];
    console.log('👋 用户已登出');
  };

  // 检查是否有指定角色
  const hasRole = (role) => {
    if (!user) return false;
    // 财务相关的角色都可以访问财务系统
    const financeRoles = ['boss', 'finance', 'manager'];
    return financeRoles.includes(user.role) && user.role === role;
  };

  // 检查是否可以访问财务系统
  const canAccessFinance = () => {
    if (!user) return false;
    const financeRoles = ['boss', 'finance', 'manager'];
    return financeRoles.includes(user.role);
  };

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    hasRole,
    canAccessFinance
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};