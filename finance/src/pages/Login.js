import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      console.log('🔐 尝试登录:', values.username);

      const response = await axios.post('/auth/admin-login', {
        username: values.username,
        password: values.password
      });

      if (response.data.success) {
        console.log('✅ 登录成功:', response.data.user);
        message.success('登录成功！');

        // 保存token到localStorage
        localStorage.setItem('finance_token', response.data.token);
        localStorage.setItem('finance_user', JSON.stringify(response.data.user));

        // 设置axios默认header
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

        // 通知父组件登录成功
        if (onLogin) {
          onLogin(response.data.user, response.data.token);
        }
      } else {
        message.error(response.data.message || '登录失败');
      }
    } catch (error) {
      console.error('❌ 登录失败:', error);
      const errorMsg = error.response?.data?.message || '登录失败，请检查用户名和密码';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      <Card
        title="财务管理系统登录"
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
      >
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoFocus
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ height: 48, fontSize: 16 }}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: '#666', fontSize: 12, marginTop: 16 }}>
          <p>💡 提示：请使用管理员账号登录</p>
          <p>🔐 支持角色：boss、finance、manager</p>
        </div>
      </Card>
    </div>
  );
};

export default Login;