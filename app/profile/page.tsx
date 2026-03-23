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
  Select,
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

const AVATAR_SIZE = 256;

const fileToAvatarBase64 = async (file: File): Promise<string> => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được ảnh'));
      el.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ canvas');

    const side = Math.min(img.width, img.height);
    const sx = Math.floor((img.width - side) / 2);
    const sy = Math.floor((img.height - side) / 2);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1] || '';
    return base64;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const avatarBase64ToDataUrl = (avatarBase64: string): string | null => {
  try {
    if (!avatarBase64) return null;
    atob(avatarBase64); // validate base64
    return `data:image/jpeg;base64,${avatarBase64}`;
  } catch {
    return null;
  }
};

type ProfileData = {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  email: string | null;
  position: string | null;
  academicRank: 'GS' | 'PGS' | null;
  academicDegree: 'TS' | 'ThS' | 'CN' | 'KS' | null;
  organizationUnitId: string | null;
  organizationUnitName: string | null;
  faceTemplate: string | null;
  createdAt: string;
};

type OrganizationUnitOption = {
  id: string;
  name: string;
  level: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, loading, updateUser } = useAuth();
  const { message: messageApi } = App.useApp();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [orgUnits, setOrgUnits] = useState<OrganizationUnitOption[]>([]);
  const [loadingOrgUnits, setLoadingOrgUnits] = useState(false);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);

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
      void loadOrganizationUnits();
    }
  }, [isAuthenticated]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    const result = await apiService.getProfile();
    if (result.data) {
      setProfile(result.data as ProfileData);
      setFacePreviewUrl(result.data.faceTemplate ? avatarBase64ToDataUrl(result.data.faceTemplate) : null);
      profileForm.setFieldsValue({
        fullName: result.data.fullName || '',
        email: result.data.email || '',
        position: result.data.position || '',
        academicRank: result.data.academicRank || undefined,
        academicDegree: result.data.academicDegree || undefined,
        organizationUnitId: result.data.organizationUnitId || undefined,
        faceTemplate: result.data.faceTemplate || '',
      });
    }
    if (result.error) {
      messageApi.error(result.error);
    }
    setLoadingProfile(false);
  };

  const loadOrganizationUnits = async () => {
    setLoadingOrgUnits(true);
    const result = await apiService.getOrganizationUnits();
    setLoadingOrgUnits(false);
    if (result.data) {
      setOrgUnits(result.data as OrganizationUnitOption[]);
    }
  };

  const handleUpdateProfile = async () => {
    const values = await profileForm.validateFields();
    setUpdatingProfile(true);

    const result = await apiService.updateProfileExtended({
      fullName: values.fullName || undefined,
      email: values.email || undefined,
      position: values.position || null,
      academicRank: values.academicRank || null,
      academicDegree: values.academicDegree || null,
      organizationUnitId: values.organizationUnitId || null,
      faceTemplate: values.faceTemplate || null,
    });

    setUpdatingProfile(false);

    if (result.error) {
      messageApi.error(result.error);
      return;
    }

    messageApi.success('Cập nhật thông tin thành công');
    updateUser({
      fullName: values.fullName || null,
      faceTemplate: values.faceTemplate || null,
    });
    setShowUpdateForm(false);
    await loadProfile();
  };

  const onUploadFaceImage = async (file?: File) => {
    if (!file) return;
    try {
      const template = await fileToAvatarBase64(file);
      profileForm.setFieldValue('faceTemplate', template);
      const preview = avatarBase64ToDataUrl(template);
      setFacePreviewUrl(preview);
      messageApi.success('Đã xử lý ảnh đại diện');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Không thể xử lý ảnh');
    }
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
                    <Descriptions.Item label="Chức vụ">
                      {showUpdateForm ? (
                        <Form.Item
                          name="position"
                          style={{ margin: 0 }}
                          rules={[{ max: 100, message: 'Chức vụ không được quá 100 ký tự' }]}
                        >
                          <Input placeholder="Nhập chức vụ" />
                        </Form.Item>
                      ) : profile.position ? (
                        <Typography.Text>{profile.position}</Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Học hàm">
                      {showUpdateForm ? (
                        <Form.Item name="academicRank" style={{ margin: 0 }}>
                          <Select
                            allowClear
                            placeholder="Chọn học hàm"
                            options={[
                              { label: 'GS', value: 'GS' },
                              { label: 'PGS', value: 'PGS' },
                            ]}
                          />
                        </Form.Item>
                      ) : profile.academicRank ? (
                        <Typography.Text>{profile.academicRank}</Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Học vị">
                      {showUpdateForm ? (
                        <Form.Item name="academicDegree" style={{ margin: 0 }}>
                          <Select
                            allowClear
                            placeholder="Chọn học vị"
                            options={[
                              { label: 'TS', value: 'TS' },
                              { label: 'ThS', value: 'ThS' },
                              { label: 'CN', value: 'CN' },
                              { label: 'KS', value: 'KS' },
                            ]}
                          />
                        </Form.Item>
                      ) : profile.academicDegree ? (
                        <Typography.Text>{profile.academicDegree}</Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Đơn vị công tác">
                      {showUpdateForm ? (
                        <Form.Item name="organizationUnitId" style={{ margin: 0 }}>
                          <Select
                            allowClear
                            showSearch
                            loading={loadingOrgUnits}
                            placeholder="Chọn đơn vị công tác"
                            options={orgUnits.map((x) => ({
                              label: `${'— '.repeat(Math.max(0, x.level - 1))}${x.name}`,
                              value: x.id,
                            }))}
                            filterOption={(input, option) =>
                              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                          />
                        </Form.Item>
                      ) : profile.organizationUnitName ? (
                        <Typography.Text>{profile.organizationUnitName}</Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ảnh khuôn mặt">
                      {showUpdateForm ? (
                        <Space direction="vertical" size={8}>
                          <Form.Item
                            name="faceTemplate"
                            style={{ margin: 0, display: 'none' }}
                          >
                            <Input />
                          </Form.Item>
                          {facePreviewUrl ? (
                            <img
                              src={facePreviewUrl}
                              alt="face template preview"
                              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                            />
                          ) : (
                            <Typography.Text type="secondary">Chưa có ảnh khuôn mặt</Typography.Text>
                          )}
                          <Space>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                void onUploadFaceImage(file);
                                e.currentTarget.value = '';
                              }}
                            />
                            <Button
                              onClick={() => {
                                profileForm.setFieldValue('faceTemplate', '');
                                setFacePreviewUrl(null);
                              }}
                            >
                              Xóa ảnh
                            </Button>
                          </Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Ảnh được crop vuông, nén JPEG (256x256), lưu base64 trong DB.
                          </Typography.Text>
                        </Space>
                      ) : facePreviewUrl ? (
                        <img
                          src={facePreviewUrl}
                          alt="face template preview"
                          style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
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
