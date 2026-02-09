'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  Descriptions,
  Tag,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SaveOutlined,
  ReloadOutlined,
  MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

type ProfileData = {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { message: messageApi } = App.useApp();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadProfile();
    }
  }, [isAuthenticated]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    const result = await apiService.getProfile();
    if (result.data) {
      setProfile(result.data as ProfileData);
      profileForm.setFieldsValue({
        fullName: result.data.fullName || '',
        email: result.data.email || '',
      });
    }
    if (result.error) {
      messageApi.error(result.error);
    }
    setLoadingProfile(false);
  };

  const handleUpdateProfile = async () => {
    const values = await profileForm.validateFields();
    setUpdatingProfile(true);

    const result = await apiService.updateProfile(
      values.fullName || undefined,
      values.email || undefined
    );

    setUpdatingProfile(false);

    if (result.error) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success('Cập nhật thông tin thành công');
    setShowUpdateForm(false);
    await loadProfile();
  };

  const handleChangePassword = async () => {
    const values = await passwordForm.validateFields();

    if (values.newPassword !== values.confirmPassword) {
      messageApi.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setChangingPassword(true);

    const result = await apiService.changePassword(values.oldPassword, values.newPassword);

    setChangingPassword(false);

    if (result.error) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success('Đổi mật khẩu thành công');
    passwordForm.resetFields();
    setShowPasswordForm(false);
  };

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      {/* Hidden Forms để kết nối form instances khi chưa hiển thị (tránh warning useForm) */}
      {!profile && (
        <Form form={profileForm} style={{ display: 'none' }}>
          <Form.Item hidden />
        </Form>
      )}
      {!showPasswordForm && (
        <Form form={passwordForm} style={{ display: 'none' }}>
          <Form.Item hidden />
        </Form>
      )}
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Profile Information or Change Password */}
          {showPasswordForm ? (
            <Card
              title={
                <Space>
                  <LockOutlined />
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Đổi mật khẩu
                  </Typography.Title>
                </Space>
              }
            >
              <Form
                form={passwordForm}
                layout="vertical"
                onFinish={() => void handleChangePassword()}
              >
                <Form.Item
                  label="Mật khẩu cũ"
                  name="oldPassword"
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu cũ' }]}
                >
                  <Input.Password
                    placeholder="Nhập mật khẩu cũ"
                    prefix={<LockOutlined />}
                  />
                </Form.Item>

                <Form.Item
                  label="Mật khẩu mới"
                  name="newPassword"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
                  ]}
                >
                  <Input.Password
                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                    prefix={<LockOutlined />}
                  />
                </Form.Item>

                <Form.Item
                  label="Xác nhận mật khẩu mới"
                  name="confirmPassword"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    placeholder="Nhập lại mật khẩu mới"
                    prefix={<LockOutlined />}
                  />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      htmlType="submit"
                      loading={changingPassword}
                    >
                      Đổi mật khẩu
                    </Button>
                    <Button onClick={() => {
                      passwordForm.resetFields();
                      setShowPasswordForm(false);
                    }}>
                      Hủy
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
          ) : (
            <Card
              title={
                <Space>
                  <UserOutlined />
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    Thông tin cá nhân
                  </Typography.Title>
                </Space>
              }
              extra={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => void loadProfile()}
                  loading={loadingProfile}
                >
                  Tải lại
                </Button>
              }
            >
              {profile ? (
                <Form
                  form={profileForm}
                  onFinish={() => void handleUpdateProfile()}
                >
                  <Descriptions column={1} bordered>
                    <Descriptions.Item label="Username">
                      <Typography.Text strong>{profile.username}</Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Họ và tên">
                      {showUpdateForm ? (
                        <Form.Item
                          name="fullName"
                          style={{ margin: 0 }}
                          rules={[
                            { max: 100, message: 'Họ và tên không được quá 100 ký tự' },
                          ]}
                        >
                          <Input
                            placeholder="Nhập họ và tên"
                            prefix={<UserOutlined />}
                          />
                        </Form.Item>
                      ) : (
                        profile.fullName ? (
                          <Typography.Text>{profile.fullName}</Typography.Text>
                        ) : (
                          <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                        )
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {showUpdateForm ? (
                        <Form.Item
                          name="email"
                          style={{ margin: 0 }}
                          rules={[
                            { type: 'email', message: 'Email không hợp lệ' },
                            { max: 100, message: 'Email không được quá 100 ký tự' },
                          ]}
                        >
                          <Input
                            placeholder="Nhập email"
                            prefix={<MailOutlined />}
                          />
                        </Form.Item>
                      ) : (
                        profile.email ? (
                          <Typography.Text>{profile.email}</Typography.Text>
                        ) : (
                          <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                        )
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Role">
                      <Tag color={profile.role === 'Admin' ? 'red' : 'blue'}>
                        {profile.role}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ngày tạo tài khoản">
                      {dayjs(profile.createdAt).format('DD/MM/YYYY HH:mm')}
                    </Descriptions.Item>
                  </Descriptions>
                  
                  {showUpdateForm && (
                    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        htmlType="submit"
                        loading={updatingProfile}
                      >
                        Cập nhật
                      </Button>
                      <Button onClick={() => {
                        profileForm.resetFields();
                        setShowUpdateForm(false);
                      }}>
                        Hủy
                      </Button>
                    </div>
                  )}
                </Form>
              ) : (
                <div>Đang tải thông tin...</div>
              )}
              
              {!showUpdateForm && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <Button
                    type="primary"
                    icon={<UserOutlined />}
                    onClick={() => setShowUpdateForm(true)}
                  >
                    Thay đổi thông tin
                  </Button>
                  <Button
                    icon={<LockOutlined />}
                    onClick={() => setShowPasswordForm(true)}
                  >
                    Đổi mật khẩu
                  </Button>
                </div>
              )}
            </Card>
          )}
        </Space>
      </div>
    </MainLayout>
  );
}
