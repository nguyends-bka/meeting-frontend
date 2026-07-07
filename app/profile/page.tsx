'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import {
  App,
  Button,
  Form,
  Input,
  Select,
  Space,
  Typography,
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
  EditOutlined,
  IdcardOutlined,
  BankOutlined,
  SolutionOutlined,
  ScanOutlined,
  CalendarOutlined,
  ReadOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { CountryOption, LanguageOption, UserCountryItem, UserLanguageItem } from '@/dtos/user.dto';
import './profile.css';

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
    const actualPrimaryLangCode = selectedLangCodes.length === 1 ? selectedLangCodes[0] : primaryLangCode;

    if (selectedLangCodes.length > 1 && !actualPrimaryLangCode) {
      messageApi.error('Vui lòng chọn ngôn ngữ ưu tiên');
      setUpdatingProfile(false);
      return;
    }
    if (actualPrimaryLangCode && !selectedLangCodes.includes(actualPrimaryLangCode)) {
      messageApi.error('Ngôn ngữ ưu tiên phải nằm trong danh sách ngôn ngữ đã chọn');
      setUpdatingProfile(false);
      return;
    }

    const languagesPayload = selectedLangCodes.map((code) => ({
      code,
      isPrimary: code === actualPrimaryLangCode,
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

  const academicRankLabel: Record<string, string> = { GS: 'Giáo sư (GS)', PGS: 'Phó giáo sư (PGS)' };
  const academicDegreeLabel: Record<string, string> = {
    TS: 'Tiến sĩ (TS)', ThS: 'Thạc sĩ (ThS)', CN: 'Cử nhân (CN)', KS: 'Kỹ sư (KS)',
  };

  // Field ở chế độ xem
  const ViewField = ({ label, icon, value, empty }: { label: string; icon?: React.ReactNode; value?: React.ReactNode; empty?: boolean }) => (
    <div className="profile-field">
      <span className="profile-field-label">{icon}{label}</span>
      {empty
        ? <span className="profile-field-empty">Chưa cập nhật</span>
        : <span className="profile-field-value">{value}</span>}
    </div>
  );

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
      <div className="profile-container">
        {/* ===== HERO ===== */}
        {profile && (
          <div className="profile-hero">
            <div className="profile-hero-band" />
            <div className="profile-hero-inner">
              {facePreviewUrl ? (
                <img src={facePreviewUrl} alt="avatar" className="profile-avatar" />
              ) : (
                <span className="profile-avatar">
                  {(profile.fullName || profile.username || 'U').trim().charAt(0).toUpperCase()}
                </span>
              )}
              <div className="profile-hero-main">
                <Typography.Title level={4} className="profile-name">
                  {profile.fullName || profile.username}
                </Typography.Title>
                <div className="profile-username"><UserOutlined /> @{profile.username}</div>
                <div className="profile-badges">
                  <span className={`profile-pill profile-pill-role ${profile.role === 'Admin' ? 'is-admin' : ''}`}>
                    <IdcardOutlined /> {profile.role}
                  </span>
                  {profile.hasFaceEmbedding ? (
                    <span className="profile-pill profile-pill-ok"><ScanOutlined /> Đã đăng ký sinh trắc học</span>
                  ) : (
                    <span className="profile-pill profile-pill-warn"><ScanOutlined /> Chưa đăng ký sinh trắc học</span>
                  )}
                  <span className="profile-pill" style={{ background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
                    <CalendarOutlined /> Tham gia {dayjs(profile.createdAt).format('DD/MM/YYYY')}
                  </span>
                </div>
              </div>
              {!showUpdateForm && !showPasswordForm && (
                <div className="profile-hero-actions">
                  <Button type="primary" icon={<EditOutlined />} onClick={() => setShowUpdateForm(true)}>
                    Chỉnh sửa
                  </Button>
                  <Button icon={<LockOutlined />} onClick={() => setShowPasswordForm(true)}>
                    Đổi mật khẩu
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => void loadProfile()} loading={loadingProfile} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== ĐỔI MẬT KHẨU ===== */}
        {showPasswordForm ? (
          <div className="profile-card">
            <div className="profile-card-head">
              <LockOutlined />
              <h3 className="profile-card-title">Đổi mật khẩu</h3>
            </div>
            <div className="profile-card-body">
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
                  <Input.Password placeholder="Nhập mật khẩu cũ" prefix={<LockOutlined />} size="large" />
                </Form.Item>

                <Form.Item
                  label="Mật khẩu mới"
                  name="newPassword"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
                  ]}
                >
                  <Input.Password placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)" prefix={<LockOutlined />} size="large" />
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
                  <Input.Password placeholder="Nhập lại mật khẩu mới" prefix={<LockOutlined />} size="large" />
                </Form.Item>

                <div className="profile-form-actions">
                  <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={changingPassword} size="large">
                    Đổi mật khẩu
                  </Button>
                  <Button size="large" onClick={() => {
                    passwordForm.resetFields();
                    setShowPasswordForm(false);
                  }}>
                    Hủy
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        ) : profile ? (
          <Form form={profileForm} onFinish={() => void handleUpdateProfile()}>
            {/* ===== NHÓM: THÔNG TIN CƠ BẢN ===== */}
            <div className="profile-card">
              <div className="profile-card-head">
                <UserOutlined />
                <h3 className="profile-card-title">Thông tin cơ bản</h3>
              </div>
              <div className="profile-card-body">
                {showUpdateForm ? (
                  <div className="profile-form-grid">
                    <Form.Item className="full" label="Họ và tên" name="fullName" required
                      rules={[
                        { required: true, whitespace: true, message: 'Vui lòng nhập họ và tên' },
                        { max: 100, message: 'Họ và tên không được quá 100 ký tự' },
                      ]}>
                      <Input placeholder="Nhập họ và tên" prefix={<UserOutlined />} size="large" />
                    </Form.Item>
                    <Form.Item className="full" label="Email" name="email" required
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
                      ]}>
                      <Input placeholder="Nhập email" prefix={<MailOutlined />} size="large" />
                    </Form.Item>
                    <Form.Item label="Chức vụ" name="position"
                      rules={[{ max: 100, message: 'Chức vụ không được quá 100 ký tự' }]}>
                      <Input placeholder="Nhập chức vụ" prefix={<SolutionOutlined />} size="large" />
                    </Form.Item>
                    <Form.Item label="Đơn vị công tác" name="organizationUnitId">
                      <Select
                        allowClear showSearch loading={loadingOrgUnits} size="large"
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
                    <Form.Item label="Học hàm" name="academicRank">
                      <Select allowClear size="large" placeholder="Chọn học hàm"
                        options={[{ label: 'GS', value: 'GS' }, { label: 'PGS', value: 'PGS' }]} />
                    </Form.Item>
                    <Form.Item label="Học vị" name="academicDegree">
                      <Select allowClear size="large" placeholder="Chọn học vị"
                        options={[
                          { label: 'TS', value: 'TS' }, { label: 'ThS', value: 'ThS' },
                          { label: 'CN', value: 'CN' }, { label: 'KS', value: 'KS' },
                        ]} />
                    </Form.Item>
                  </div>
                ) : (
                  <div className="profile-info-grid">
                    <ViewField label="Họ và tên" icon={<UserOutlined />} value={profile.fullName} empty={!profile.fullName} />
                    <ViewField label="Email" icon={<MailOutlined />} value={profile.email} empty={!profile.email} />
                    <ViewField label="Chức vụ" icon={<SolutionOutlined />} value={profile.position} empty={!profile.position} />
                    <ViewField label="Đơn vị công tác" icon={<BankOutlined />} value={profile.organizationUnitName} empty={!profile.organizationUnitName} />
                    <ViewField label="Học hàm" icon={<ReadOutlined />} value={profile.academicRank ? academicRankLabel[profile.academicRank] : undefined} empty={!profile.academicRank} />
                    <ViewField label="Học vị" icon={<ReadOutlined />} value={profile.academicDegree ? academicDegreeLabel[profile.academicDegree] : undefined} empty={!profile.academicDegree} />
                  </div>
                )}
              </div>
            </div>

            {/* ===== NHÓM: QUỐC TỊCH & NGÔN NGỮ ===== */}
            <div className="profile-card">
              <div className="profile-card-head">
                <GlobalOutlined />
                <h3 className="profile-card-title">Quốc tịch & Ngôn ngữ</h3>
              </div>
              <div className="profile-card-body">
                {showUpdateForm ? (
                  <div className="profile-form-grid">
                    <Form.Item className="full" label={<span><GlobalOutlined /> Quốc tịch / Quốc gia</span>} name="countryCodes">
                      <Select
                        mode="multiple" allowClear showSearch loading={loadingCatalogs} size="large"
                        placeholder="Chọn quốc tịch / quốc gia"
                        options={countries.map((c) => ({ label: c.countryName, value: c.code }))}
                        filterOption={(input, option) =>
                          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>
                    <Form.Item className="full" label={<span><TranslationOutlined /> Ngôn ngữ</span>} name="languageCodes" style={{ marginBottom: 4 }}>
                      <Select
                        mode="multiple" allowClear showSearch loading={loadingCatalogs} size="large"
                        placeholder="Chọn ngôn ngữ"
                        options={languages.map((l) => ({ label: l.languageName, value: l.code }))}
                        filterOption={(input, option) =>
                          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        onChange={(codes: string[]) => {
                          setSelectedLangCodes(codes);
                          if (codes.length === 1) {
                            setPrimaryLangCode(codes[0]);
                          } else if (primaryLangCode && !codes.includes(primaryLangCode)) {
                            setPrimaryLangCode(null);
                          }
                        }}
                      />
                    </Form.Item>
                    {selectedLangCodes.length > 1 && (
                      <div className="full" style={{ marginBottom: 8 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                          <StarFilled style={{ color: '#faad14', marginRight: 4 }} />
                          Ngôn ngữ ưu tiên (bắt buộc chọn 1):
                        </Typography.Text>
                        <Radio.Group value={primaryLangCode} onChange={(e) => setPrimaryLangCode(e.target.value as string)}>
                          <Space direction="vertical">
                            {selectedLangCodes.map((code) => {
                              const lang = languages.find((l) => l.code === code);
                              return <Radio key={code} value={code}>{lang?.languageName ?? code}</Radio>;
                            })}
                          </Space>
                        </Radio.Group>
                        {!primaryLangCode && (
                          <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                            Vui lòng chọn 1 ngôn ngữ ưu tiên
                          </Typography.Text>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="profile-info-grid one-col">
                    <div className="profile-field">
                      <span className="profile-field-label"><GlobalOutlined /> Quốc tịch / Quốc gia</span>
                      {(profile.countries ?? []).length > 0 ? (
                        <div className="profile-tag-row">
                          {(profile.countries ?? []).map((c) => (
                            <Tag key={c.code} icon={<GlobalOutlined />} color="blue" style={{ margin: 0 }}>{c.countryName}</Tag>
                          ))}
                        </div>
                      ) : <span className="profile-field-empty">Chưa cập nhật</span>}
                    </div>
                    <div className="profile-field">
                      <span className="profile-field-label"><TranslationOutlined /> Ngôn ngữ</span>
                      {(profile.languages ?? []).length > 0 ? (
                        <div className="profile-tag-row">
                          {(profile.languages ?? []).map((l) => (
                            <Tag key={l.code}
                              icon={l.isPrimary ? <StarFilled style={{ color: '#faad14' }} /> : <TranslationOutlined />}
                              color={l.isPrimary ? 'gold' : 'default'} style={{ margin: 0 }}>
                              {l.languageName}{l.isPrimary && ' (Ưu tiên)'}
                            </Tag>
                          ))}
                        </div>
                      ) : <span className="profile-field-empty">Chưa cập nhật</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ===== NHÓM: ẢNH ĐẠI DIỆN (chỉ khi edit) ===== */}
            {showUpdateForm && (
              <div className="profile-card">
                <div className="profile-card-head">
                  <ScanOutlined />
                  <h3 className="profile-card-title">Ảnh đại diện</h3>
                </div>
                <div className="profile-card-body">
                  <Form.Item name="avatar" style={{ margin: 0, display: 'none' }}><Input /></Form.Item>
                  <div className="profile-avatar-edit">
                    {facePreviewUrl ? (
                      <img src={facePreviewUrl} alt="avatar preview" className="profile-avatar-preview" />
                    ) : (
                      <span className="profile-avatar-placeholder"><UserOutlined /></span>
                    )}
                    <div>
                      <div style={{ marginBottom: 10 }}>
                        <input className="profile-file-input" type="file" accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            void onUploadFaceImage(file);
                            e.currentTarget.value = '';
                          }} />
                      </div>
                      <Space>
                        <Button size="small" onClick={() => {
                          profileForm.setFieldValue('avatar', '');
                          setFacePreviewUrl(null);
                        }}>Xóa ảnh</Button>
                      </Space>
                      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
                        Ảnh được crop vuông, nén JPEG (256×256), lưu base64 trong DB.
                      </Typography.Paragraph>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== ACTIONS EDIT ===== */}
            {showUpdateForm && (
              <div className="profile-form-actions" style={{ marginBottom: 8 }}>
                <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={updatingProfile} size="large">
                  Lưu thay đổi
                </Button>
                <Button size="large" icon={<CloseOutlined />} onClick={() => {
                  profileForm.resetFields();
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

            {/* Nút phụ ở chế độ xem: sinh trắc học */}
            {!showUpdateForm && (
              <div className="profile-card">
                <div className="profile-card-head">
                  <ScanOutlined />
                  <h3 className="profile-card-title">Bảo mật & Xác thực</h3>
                </div>
                <div className="profile-card-body">
                  <div className="profile-security-row">
                    <div className="profile-security-info">
                      <span className="profile-field-label"><ScanOutlined /> Sinh trắc học khuôn mặt</span>
                      <span className="profile-field-value">
                        {profile?.hasFaceEmbedding
                          ? 'Bạn đã đăng ký khuôn mặt để đăng nhập nhanh.'
                          : 'Chưa đăng ký. Đăng ký để đăng nhập bằng khuôn mặt.'}
                      </span>
                    </div>
                    <Button icon={<ScanOutlined />} onClick={() => {
                      try {
                        sessionStorage.removeItem('bk_face_reg_skipped');
                        sessionStorage.setItem('bk_face_reg_force_open', '1');
                      } catch { /* ignore */ }
                      window.location.reload();
                    }}>
                      {profile?.hasFaceEmbedding ? 'Cập nhật sinh trắc học' : 'Đăng ký sinh trắc học'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Form>
        ) : (
          <div className="profile-card"><div className="profile-card-body">Đang tải thông tin...</div></div>
        )}
      </div>
    </MainLayout>
  );
}
