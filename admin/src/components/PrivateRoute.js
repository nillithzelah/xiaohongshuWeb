import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>请稍候...</div>;
  }

  if (!isAuthenticated) {
    // 重要：使用相对路径 "login" 而非 "/login"
    // 配合 basename="/xiaohongshu"，会正确跳转到 /xiaohongshu/login
    return <Navigate to="login" state={{ from: location }} replace />;
  }

  // promoter 角色直接跳转到评论线索管理页面
  if (user?.role === 'promoter' && location.pathname === '/') {
    return <Navigate to="comment-leads" replace />;
  }

  return children;
};

export default PrivateRoute;