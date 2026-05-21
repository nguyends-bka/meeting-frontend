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
  Radio,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SaveOutlined,
  ReloadOutlined,
  MailOutlined,
  GlobalOutlined,
  TranslationOutlined,
  StarFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CountryOption, LanguageOption, UserCountryItem, UserLanguageItem } from '@/dtos/user.dto';

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
  avatar: string | null;
  hasFaceEmbedding?: boolean;
  createdAt: string;
  countries: UserCountryItem[] | null;
  languages: UserLanguageItem[] | null;
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

  // ── Catalog state ──────────────────────────────────────────────
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  // ── Language selection state ────────────────────────────────────
  // selectedLangCodes: danh sách codes đã chọn trong multi-select
  const [selectedLangCodes, setSelectedLangCodes] = useState<string[]>([]);
  // primaryLangCode: ngôn ngữ ưu tiên được chọn
  const [primaryLangCode, setPrimaryLangCode] = useState<string | null>(null);

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
      void loadCatalogs();
    }
  }, [isAuthenticated]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    const result = await apiService.getProfile();
    if (result.data) {
      const data = result.data as ProfileData;
      setProfile(data);
      setFacePreviewUrl(data.avatar ? avatarBase64ToDataUrl(data.avatar) : null);

      // Khởi tạo state ngôn ngữ từ profile
      const langCodes = (data.languages ?? []).map((l) => l.code);
      setSelectedLangCodes(langCodes);
      const primary = (data.languages ?? []).find((l) => l.isPrimary);
      setPrimaryLangCode(primary?.code ?? null);

      profileForm.setFieldsValue({
        fullName: data.fullName || '',
        email: data.email || '',
        position: data.position || '',
        academicRank: data.academicRank || undefined,
        academicDegree: data.academicDegree || undefined,
        organizationUnitId: data.organizationUnitId || undefined,
        avatar: data.avatar || '',
        // countryCodes: array of codes
        countryCodes: (data.countries ?? []).map((c) => c.code),
        // languages: chỉ codes, primaryLang xử lý riêng bằng state
        languageCodes: langCodes,
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

  const loadCatalogs = async () => {
    setLoadingCatalogs(true);
    const [cResult, lResult] = await Promise.all([
      apiService.getCountries(),
      apiService.getLanguages(),
    ]);
    setLoadingCatalogs(false);
    if (cResult.data) setCountries(cResult.data as CountryOption[]);
    if (lResult.data) setLanguages(lResult.data as LanguageOption[]);
  };

  const trimOrNull = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s : null;
  };

  const handleUpdateProfile = async () => {
    const values = await profileForm.validateFields();
    setUpdatingProfile(true);

    const avatarRaw = values.avatar;
    const avatar =
      avatarRaw != null && String(avatarRaw).trim() !== '' ? String(avatarRaw).trim() : null;
    const emailVal = trimOrNull(values.email);

    // Validate ngôn ngữ ưu tiên nếu có chọn ngôn ngữ
    if (selectedLangCodes.length > 0 && !primaryLangCode) {
      messageApi.error('Vui lòng chọn ngôn ngữ ưu tiên');
      setUpdatingProfile(false);
      return;
    }
    if (primaryLangCode && !selectedLangCodes.includes(primaryLangCode)) {
      messageApi.error('Ngôn ngữ ưu tiên phải nằm trong danh sách ngôn ngữ đã chọn');
      setUpdatingProfile(false);
      return;
    }

    const languagesPayload = selectedLangCodes.map((code) => ({
      code,
      isPrimary: code === primaryLangCode,
    }));

    const result = await apiService.updateProfileExtended({
      fullName: trimOrNull(values.fullName),
      email: emailVal ? emailVal.toLowerCase() : null,
      position: trimOrNull(values.position),
      academicRank: values.academicRank ?? null,
      academicDegree: values.academicDegree ?? null,
      organizationUnitId: values.organizationUnitId ?? null,
      avatar,
      countryCodes: values.countryCodes ?? [],
      languages: languagesPayload,
    });

    setUpdatingProfile(false);

    if (result.error) {
      messageApi.error(result.error);
      return;
    }

    updateUser({
      fullName: trimOrNull(values.fullName),
      position: trimOrNull(values.position),
      academicRank: values.academicRank ?? null,
      academicDegree: values.academicDegree ?? null,
      organizationUnitId: values.organizationUnitId ?? null,
      avatar,
    });
    setShowUpdateForm(false);
    await loadProfile();
  };

  const onUploadFaceImage = async (file?: File) => {
    if (!file) return;
    try {
      const template = await fileToAvatarBase64(file);
      profileForm.setFieldValue('avatar', template);
      const preview = avatarBase64ToDataUrl(template);
      setFacePreviewUrl(preview);
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
                          required
                          rules={[
                            { required: true, whitespace: true, message: 'Vui lòng nhập họ và tên' },
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
                          required
                          rules={[
                            { required: true, whitespace: true, message: 'Vui lòng nhập email' },
                            {
                              validator: async (_, v) => {
                                const s = String(v ?? '').trim();
                                if (!s) return;
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
                                  throw new Error('Email không hợp lệ');
                                }
                              },
                            },
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

                    {/* ── Quốc tịch / Quốc gia ─────────────────────────── */}
                    <Descriptions.Item label={<Space><GlobalOutlined />Quốc tịch / Quốc gia</Space>}>
                      {showUpdateForm ? (
                        <Form.Item name="countryCodes" style={{ margin: 0 }}>
                          <Select
                            mode="multiple"
                            allowClear
                            showSearch
                            loading={loadingCatalogs}
                            placeholder="Chọn quốc tịch / quốc gia"
                            options={countries.map((c) => ({
                              label: c.countryName,
                              value: c.code,
                            }))}
                            filterOption={(input, option) =>
                              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      ) : (profile.countries ?? []).length > 0 ? (
                        <Space wrap>
                          {(profile.countries ?? []).map((c) => (
                            <Tag key={c.code} icon={<GlobalOutlined />} color="blue">
                              {c.countryName}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                      )}
                    </Descriptions.Item>

                    {/* ── Ngôn ngữ ─────────────────────────────────────── */}
                    <Descriptions.Item label={<Space><TranslationOutlined />Ngôn ngữ</Space>}>
                      {showUpdateForm ? (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Form.Item name="languageCodes" style={{ margin: 0 }}>
                            <Select
                              mode="multiple"
                              allowClear
                              showSearch
                              loading={loadingCatalogs}
                              placeholder="Chọn ngôn ngữ"
                              options={languages.map((l) => ({
                                label: l.languageName,
                                value: l.code,
                              }))}
                              filterOption={(input, option) =>
                                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                              }
                              style={{ width: '100%' }}
                              onChange={(codes: string[]) => {
                                setSelectedLangCodes(codes);
                                // Nếu ngôn ngữ ưu tiên hiện tại bị xóa khỏi danh sách → reset
                                if (primaryLangCode && !codes.includes(primaryLangCode)) {
                                  setPrimaryLangCode(null);
                                }
                              }}
                            />
                          </Form.Item>
                          {/* Chọn ngôn ngữ ưu tiên */}
                          {selectedLangCodes.length > 0 && (
                            <div>
                              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                <StarFilled style={{ color: '#faad14', marginRight: 4 }} />
                                Ngôn ngữ ưu tiên (bắt buộc chọn 1):
                              </Typography.Text>
                              <Radio.Group
                                value={primaryLangCode}
                                onChange={(e) => setPrimaryLangCode(e.target.value as string)}
                              >
                                <Space direction="vertical">
                                  {selectedLangCodes.map((code) => {
                                    const lang = languages.find((l) => l.code === code);
                                    return (
                                      <Radio key={code} value={code}>
                                        {lang?.languageName ?? code}
                                      </Radio>
                                    );
                                  })}
                                </Space>
                              </Radio.Group>
                            </div>
                          )}
                          {selectedLangCodes.length > 0 && !primaryLangCode && (
                            <Typography.Text type="danger" style={{ fontSize: 12 }}>
                              Vui lòng chọn 1 ngôn ngữ ưu tiên
                            </Typography.Text>
                          )}
                        </Space>
                      ) : (profile.languages ?? []).length > 0 ? (
                        <Space wrap>
                          {(profile.languages ?? []).map((l) => (
                            <Tag
                              key={l.code}
                              icon={l.isPrimary ? <StarFilled style={{ color: '#faad14' }} /> : <TranslationOutlined />}
                              color={l.isPrimary ? 'gold' : 'default'}
                            >
                              {l.languageName}
                              {l.isPrimary && ' (Ưu tiên)'}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Typography.Text type="secondary">Chưa cập nhật</Typography.Text>
                      )}
                    </Descriptions.Item>

                    <Descriptions.Item label="Ảnh đại diện">
                      {showUpdateForm ? (
                        <Space direction="vertical" size={8}>
                          <Form.Item
                            name="avatar"
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
                                profileForm.setFieldValue('avatar', '');
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
                    <Descriptions.Item label="Đăng ký sinh trắc học">
                      {profile.hasFaceEmbedding ? (
                        <Tag color="success">Đã đăng ký</Tag>
                      ) : (
                        <Tag color="warning">Chưa đăng ký</Tag>
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
                        // Reset lại state ngôn ngữ về giá trị từ profile
                        if (profile) {
                          const langCodes = (profile.languages ?? []).map((l) => l.code);
                          setSelectedLangCodes(langCodes);
                          const primary = (profile.languages ?? []).find((l) => l.isPrimary);
                          setPrimaryLangCode(primary?.code ?? null);
                          profileForm.setFieldValue('languageCodes', langCodes);
                          profileForm.setFieldValue('countryCodes', (profile.countries ?? []).map((c) => c.code));
                        }
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
                  <Button
                    onClick={() => {
                      try {
                        sessionStorage.removeItem('bk_face_reg_skipped');
                        sessionStorage.setItem('bk_face_reg_force_open', '1');
                      } catch {
                        // ignore
                      }
                      window.location.reload();
                    }}
                  >
                    {profile?.hasFaceEmbedding
                      ? 'Cập nhật sinh trắc học'
                      : 'Đăng ký sinh trắc học'}
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
