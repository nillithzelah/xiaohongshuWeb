import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Spin, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    setLoginError(null);
    try {
      const result = await login(values.username, values.password);

      if (result.success) {
        message.success('登录成功');
        // AuthContext 会自动处理状态更新和导航
        setRemainingAttempts(null);
        setLockedUntil(null);
      } else {
        // 处理登录失败
        setLoginError(result.message);
        setRemainingAttempts(result.remainingAttempts);

        // 如果账户被锁定
        if (result.locked && result.remainingMinutes) {
          setLockedUntil(result.remainingMinutes);
          message.error(result.message);
        } else if (result.remainingAttempts !== undefined) {
          message.warning(result.message);
        } else {
          message.error(result.message);
        }
      }
    } catch (error) {
      message.error('登录失败，请稍后重试');
      setLoginError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 如果正在初始化认证状态，显示加载中
  if (authLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f0f2f5'
      }}>
        <Spin size="large" tip="正在初始化..." />
      </div>
    );
  }

  // 警告区域 - 显示剩余尝试次数或锁定状态
  const warningSection = lockedUntil ? (
    <Alert
      message="账户已锁定"
      description={`登录失败次数过多，请等待 ${lockedUntil} 分钟后再试`}
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
    />
  ) : remainingAttempts !== null && remainingAttempts < 5 ? (
    <Alert
      message="登录失败"
      description={
        <div>
          <div>{loginError || '用户名或密码错误'}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
            剩余尝试次数: <strong style={{ color: remainingAttempts <= 2 ? '#ff4d4f' : '#faad14' }}>
              {remainingAttempts}/5
            </strong>
          </div>
        </div>
      }
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
  ) : loginError ? (
    <Alert
      message={loginError}
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
    />
  ) : null;

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f0f2f5'
    }}>
      <Card
        title="素人分发系统"
        style={{ width: 400 }}
      >
        {warningSection}
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
              disabled={lockedUntil !== null}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
              disabled={lockedUntil !== null}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              disabled={lockedUntil !== null}
            >
              {lockedUntil !== null ? `账户已锁定，请${lockedUntil}分钟后再试` : '登录'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;