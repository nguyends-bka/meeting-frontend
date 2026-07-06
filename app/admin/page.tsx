'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService, catalogApi } from '@/services/api';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Space,
  Table,
  Tag,
  Typography,
  Modal,
  Form,
  Select,
  Popconfirm,
  Row,
  Col,
  Tabs,
  Input,
  Switch,
} from 'antd';
import MainLayout from '@/components/MainLayout';
import {
  UserOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  SettingOutlined,
  GlobalOutlined,
  TranslationOutlined,
  PlusOutlined,
  StarFilled,
  SearchOutlined,
  SafetyCertificateOutlined,
  VideoCameraOutlined,
  BankOutlined,
} from '@ant-design/icons';
import type { AdminCountry, AdminLanguage } from '@/services/catalog/catalogApi';
import './admin.css';

type User = {
  id: string;
  username: string;
  role: string;
  fullName?: string | null;
  email?: string | null;
  position?: string | null;
  academicRank?: string | null;
  academicDegree?: string | null;
  organizationUnitName?: string | null;
  hasAvatar?: boolean;
  createdAt: string;
  countries: { code: string; countryName: string }[] | null;
  languages: { code: string; languageName: string; isPrimary: boolean }[] | null;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  // ── Users state ─────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'Admin' | 'User'>('all');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);

  // ── Catalog state ────────────────────────────────────────────────
  const [countries, setCountries] = useState<AdminCountry[]>([]);
  const [languages, setLanguages] = useState<AdminLanguage[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Country modal
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<AdminCountry | null>(null);
  const [countryForm] = Form.useForm();
  const [savingCountry, setSavingCountry] = useState(false);

  // Language modal
  const [languageModalOpen, setLanguageModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState<AdminLanguage | null>(null);
  const [languageForm] = Form.useForm();
  const [savingLanguage, setSavingLanguage] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, loading, isAdmin, router]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      void loadUsers();
      void loadStats();
      void loadCatalog();
    }
  }, [isAuthenticated, isAdmin]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    const result = await apiService.getAllUsers();
    if (result.data) setUsers(result.data as User[]);
    if (result.error) message.error(result.error);
    setLoadingUsers(false);
  };

  const loadStats = async () => {
    setLoadingStats(true);
    const result = await apiService.getAdminStats();
    if (result.data) setStats(result.data);
    if (result.error) message.error(result.error);
    setLoadingStats(false);
  };

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    const [cResult, lResult] = await Promise.all([
      catalogApi.getAllCountries(),
      catalogApi.getAllLanguages(),
    ]);
    setLoadingCatalog(false);
    if (cResult.data) setCountries(cResult.data);
    if (lResult.data) setLanguages(lResult.data);
    if (cResult.error) message.error(cResult.error);
    if (lResult.error) message.error(lResult.error);
  };

  // ── Role edit ────────────────────────────────────────────────────
  const handleEditRole = (userRecord: User) => {
    setEditingUser(userRecord);
    form.setFieldsValue({ role: userRecord.role });
    setEditModalOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    const values = await form.validateFields();
    const result = await apiService.updateUserRole(editingUser.id, values.role);
    if (result.error) { message.error(result.error); return; }
    setEditModalOpen(false);
    setEditingUser(null);
    form.resetFields();
    await loadUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await apiService.deleteUser(userId);
    if (result.error) { message.error(result.error); return; }
    await loadUsers();
    await loadStats();
  };

  // ── Country CRUD ─────────────────────────────────────────────────
  const openCountryModal = (country?: AdminCountry) => {
    setEditingCountry(country ?? null);
    countryForm.setFieldsValue(
      country
        ? { code: country.code, countryName: country.countryName, isActive: country.isActive }
        : { code: '', countryName: '', isActive: true }
    );
    setCountryModalOpen(true);
  };

  const handleSaveCountry = async () => {
    const values = await countryForm.validateFields();
    setSavingCountry(true);
    const req = { code: values.code, countryName: values.countryName, isActive: values.isActive };
    const result = editingCountry
      ? await catalogApi.updateCountry(editingCountry.code, req)
      : await catalogApi.createCountry(req);
    setSavingCountry(false);
    if (result.error) { message.error(result.error); return; }
    message.success(editingCountry ? 'Cập nhật quốc gia thành công' : 'Thêm quốc gia thành công');
    setCountryModalOpen(false);
    void loadCatalog();
  };

  // ── Language CRUD ────────────────────────────────────────────────
  const openLanguageModal = (lang?: AdminLanguage) => {
    setEditingLanguage(lang ?? null);
    languageForm.setFieldsValue(
      lang
        ? { code: lang.code, languageName: lang.languageName, isActive: lang.isActive }
        : { code: '', languageName: '', isActive: true }
    );
    setLanguageModalOpen(true);
  };

  const handleSaveLanguage = async () => {
    const values = await languageForm.validateFields();
    setSavingLanguage(true);
    const req = { code: values.code, languageName: values.languageName, isActive: values.isActive };
    const result = editingLanguage
      ? await catalogApi.updateLanguage(editingLanguage.code, req)
      : await catalogApi.createLanguage(req);
    setSavingLanguage(false);
    if (result.error) { message.error(result.error); return; }
    message.success(editingLanguage ? 'Cập nhật ngôn ngữ thành công' : 'Thêm ngôn ngữ thành công');
    setLanguageModalOpen(false);
    void loadCatalog();
  };

  // ── Lọc + tìm kiếm user ──────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        (u.username || '').toLowerCase().includes(q) ||
        (u.fullName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.organizationUnitName || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearch, roleFilter]);

  const initialsOf = (u: User) => {
    const base = (u.fullName || u.username || '?').trim();
    return base.charAt(0).toUpperCase();
  };

  // ── Users table columns ──────────────────────────────────────────
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: User, index: number) => (
        <span style={{ color: '#94a3b8' }}>{(userPage - 1) * userPageSize + index + 1}</span>
      ),
    },
    {
      title: 'Người dùng',
      dataIndex: 'username',
      key: 'username',
      render: (_: string, record: User) => (
        <div className="au-row">
          <div className="au-avatar">{initialsOf(record)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="au-name">{record.fullName || record.username}</div>
            <div className="au-username">@{record.username}</div>
            {record.email && <div className="au-email">{record.email}</div>}
          </div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <span className={`role-pill ${role === 'Admin' ? 'role-pill-admin' : 'role-pill-user'}`}>
          {role === 'Admin' ? <SafetyCertificateOutlined /> : <UserOutlined />} {role}
        </span>
      ),
    },
    {
      title: 'Thông tin',
      key: 'extraInfo',
      width: 280,
      render: (_: unknown, record: User) => (
        <Space direction="vertical" size={4}>
          <span className="au-meta-chip">Chức vụ: <strong>{record.position || '—'}</strong></span>
          <span className="au-meta-chip">Học hàm/vị: <strong>{record.academicRank || '—'} / {record.academicDegree || '—'}</strong></span>
          <span className="au-meta-chip"><BankOutlined /> <strong>{record.organizationUnitName || 'Chưa gán đơn vị'}</strong></span>
        </Space>
      ),
    },
    {
      title: 'Quốc tịch',
      key: 'countries',
      width: 180,
      render: (_: unknown, record: User) =>
        (record.countries ?? []).length > 0 ? (
          <Space wrap size={2}>
            {(record.countries ?? []).map((c) => (
              <Tag key={c.code} icon={<GlobalOutlined />} color="blue" style={{ marginBottom: 2 }}>
                {c.countryName}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: 'Ngôn ngữ',
      key: 'languages',
      width: 200,
      render: (_: unknown, record: User) =>
        (record.languages ?? []).length > 0 ? (
          <Space wrap size={2}>
            {(record.languages ?? []).map((l) => (
              <Tag
                key={l.code}
                icon={l.isPrimary ? <StarFilled style={{ color: '#faad14' }} /> : <TranslationOutlined />}
                color={l.isPrimary ? 'gold' : 'default'}
                style={{ marginBottom: 2 }}
              >
                {l.languageName}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (v: string) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{dayjs(v).format('DD/MM/YYYY')}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{dayjs(v).format('HH:mm')}</span>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      render: (_: unknown, record: User) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditRole(record)}
            disabled={record.id === user?.id}
            style={{ borderRadius: 8 }}
          >
            Đổi role
          </Button>
          <Popconfirm
            title="Xác nhận xóa user"
            description="Bạn có chắc chắn muốn xóa user này?"
            onConfirm={() => void handleDeleteUser(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            disabled={record.id === user?.id}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.id === user?.id}
              style={{ borderRadius: 8 }}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Countries catalog table columns ─────────────────────────────
  const countryColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 80 },
    { title: 'Tên quốc gia', dataIndex: 'countryName', key: 'countryName' },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Hoạt động' : 'Tắt'}</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AdminCountry) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openCountryModal(record)}>
          Sửa
        </Button>
      ),
    },
  ];

  // ── Languages catalog table columns ─────────────────────────────
  const languageColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 80 },
    { title: 'Tên ngôn ngữ', dataIndex: 'languageName', key: 'languageName' },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      render: (v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'Hoạt động' : 'Tắt'}</Tag>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: AdminLanguage) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openLanguageModal(record)}>
          Sửa
        </Button>
      ),
    },
  ];

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated || !isAdmin) return null;

  const statItems = stats
    ? [
        { label: 'Tổng số người dùng', value: stats.totalUsers, icon: <TeamOutlined />, color: '#2563eb' },
        { label: 'Quản trị viên', value: stats.totalAdmins, icon: <SafetyCertificateOutlined />, color: '#dc2626' },
        { label: 'Người dùng', value: stats.totalUsersRole, icon: <UserOutlined />, color: '#059669' },
        { label: 'Tổng cuộc họp', value: stats.totalMeetings, icon: <VideoCameraOutlined />, color: '#7c3aed' },
      ]
    : [];

  return (
    <MainLayout>
      <div className="admin-container">
        {/* HEADER TRANG */}
        <div className="admin-page-head">
          <div>
            <Typography.Title level={4} className="admin-page-title">
              <TeamOutlined /> Quản trị hệ thống
            </Typography.Title>
            <Typography.Text className="admin-page-sub">
              Quản lý người dùng, phân quyền và danh mục dùng chung của hệ thống
            </Typography.Text>
          </div>
        </div>

        {/* THẺ THỐNG KÊ */}
        {stats && (
          <Row gutter={[14, 14]} className="admin-stat-row">
            {statItems.map((s) => (
              <Col xs={12} lg={6} key={s.label} style={{ display: 'flex' }}>
                <div className="admin-stat">
                  <span className="admin-stat-icon" style={{ color: s.color, background: `${s.color}14` }}>
                    {s.icon}
                  </span>
                  <div>
                    <div className="admin-stat-count">{s.value}</div>
                    <div className="admin-stat-label">{s.label}</div>
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        )}

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Main Tabs */}
          <Tabs
            defaultActiveKey="users"
            items={[
              {
                key: 'users',
                label: (
                  <Space>
                    <TeamOutlined />
                    Quản lý Users
                    <Tag color="geekblue">{users.length}</Tag>
                  </Space>
                ),
                children: (
                  <Card
                    className="admin-card"
                    styles={{ body: { padding: 20 } }}
                    extra={
                      <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()} loading={loadingUsers} style={{ borderRadius: 10 }}>
                        Tải lại
                      </Button>
                    }
                  >
                    <div className="admin-toolbar">
                      <Input
                        className="admin-search"
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        placeholder="Tìm theo tên, username, email, đơn vị..."
                        allowClear
                        value={userSearch}
                        onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                        style={{ borderRadius: 10, height: 40 }}
                      />
                      <Select
                        value={roleFilter}
                        onChange={(v) => { setRoleFilter(v); setUserPage(1); }}
                        style={{ width: 170, height: 40 }}
                        options={[
                          { value: 'all', label: 'Tất cả vai trò' },
                          { value: 'Admin', label: 'Quản trị viên' },
                          { value: 'User', label: 'Người dùng' },
                        ]}
                      />
                      <Typography.Text style={{ color: '#94a3b8', fontSize: 13, marginLeft: 'auto' }}>
                        {filteredUsers.length} người dùng
                      </Typography.Text>
                    </div>
                    <Table<User>
                      rowKey="id"
                      className="admin-table"
                      loading={loadingUsers}
                      columns={columns as any}
                      dataSource={filteredUsers}
                      scroll={{ x: 'max-content' }}
                      locale={{
                        emptyText: (
                          <div style={{ padding: '32px 0', color: '#94a3b8' }}>
                            {userSearch || roleFilter !== 'all' ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người dùng nào'}
                          </div>
                        ),
                      }}
                      pagination={{
                        current: userPage,
                        pageSize: userPageSize,
                        onChange: (p, s) => { setUserPage(p); setUserPageSize(s); },
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
                        showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} trong số ${total}`,
                      }}
                    />
                  </Card>
                ),
              },
              {
                key: 'catalog',
                label: (
                  <Space>
                    <SettingOutlined />
                    Quản lý danh mục
                  </Space>
                ),
                children: (
                  <Tabs
                    defaultActiveKey="countries"
                    items={[
                      {
                        key: 'countries',
                        label: <Space><GlobalOutlined />Quốc gia ({countries.length})</Space>,
                        children: (
                          <Card
                            className="admin-card"
                            styles={{ body: { padding: 20 } }}
                            extra={
                              <Space>
                                <Button icon={<ReloadOutlined />} onClick={() => void loadCatalog()} loading={loadingCatalog} style={{ borderRadius: 10 }}>
                                  Tải lại
                                </Button>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCountryModal()} style={{ borderRadius: 10 }}>
                                  Thêm quốc gia
                                </Button>
                              </Space>
                            }
                          >
                            <Table<AdminCountry>
                              rowKey="code"
                              className="admin-table"
                              loading={loadingCatalog}
                              columns={countryColumns}
                              dataSource={countries}
                              pagination={{ pageSize: 20 }}
                            />
                          </Card>
                        ),
                      },
                      {
                        key: 'languages',
                        label: <Space><TranslationOutlined />Ngôn ngữ ({languages.length})</Space>,
                        children: (
                          <Card
                            className="admin-card"
                            styles={{ body: { padding: 20 } }}
                            extra={
                              <Space>
                                <Button icon={<ReloadOutlined />} onClick={() => void loadCatalog()} loading={loadingCatalog} style={{ borderRadius: 10 }}>
                                  Tải lại
                                </Button>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => openLanguageModal()} style={{ borderRadius: 10 }}>
                                  Thêm ngôn ngữ
                                </Button>
                              </Space>
                            }
                          >
                            <Table<AdminLanguage>
                              rowKey="code"
                              className="admin-table"
                              loading={loadingCatalog}
                              columns={languageColumns}
                              dataSource={languages}
                              pagination={{ pageSize: 20 }}
                            />
                          </Card>
                        ),
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </Space>
      </div>

      {/* Edit Role Modal */}
      <Modal
        title="Cập nhật Role"
        open={editModalOpen}
        onOk={() => void handleUpdateRole()}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingUser(null);
          form.resetFields();
        }}
        okText="Cập nhật"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Username">
            <Typography.Text strong>{editingUser?.username}</Typography.Text>
          </Form.Item>
          <Form.Item
            label="Role"
            name="role"
            rules={[{ required: true, message: 'Vui lòng chọn role' }]}
          >
            <Select>
              <Select.Option value="Admin">Admin</Select.Option>
              <Select.Option value="User">User</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Country Modal */}
      <Modal
        title={editingCountry ? `Sửa quốc gia: ${editingCountry.code}` : 'Thêm quốc gia mới'}
        open={countryModalOpen}
        onOk={() => void handleSaveCountry()}
        onCancel={() => { setCountryModalOpen(false); countryForm.resetFields(); }}
        okText={editingCountry ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        confirmLoading={savingCountry}
      >
        <Form form={countryForm} layout="vertical">
          <Form.Item
            label="Code (ISO)"
            name="code"
            rules={[
              { required: true, message: 'Vui lòng nhập Code' },
              { max: 10, message: 'Code tối đa 10 ký tự' },
            ]}
          >
            <Input
              placeholder="Ví dụ: VN, US, JP"
              disabled={!!editingCountry}
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>
          <Form.Item
            label="Tên quốc gia"
            name="countryName"
            rules={[{ required: true, message: 'Vui lòng nhập tên quốc gia' }]}
          >
            <Input placeholder="Ví dụ: Việt Nam, United States" />
          </Form.Item>
          <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Tắt" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Language Modal */}
      <Modal
        title={editingLanguage ? `Sửa ngôn ngữ: ${editingLanguage.code}` : 'Thêm ngôn ngữ mới'}
        open={languageModalOpen}
        onOk={() => void handleSaveLanguage()}
        onCancel={() => { setLanguageModalOpen(false); languageForm.resetFields(); }}
        okText={editingLanguage ? 'Cập nhật' : 'Thêm'}
        cancelText="Hủy"
        confirmLoading={savingLanguage}
      >
        <Form form={languageForm} layout="vertical">
          <Form.Item
            label="Code (BCP 47)"
            name="code"
            rules={[
              { required: true, message: 'Vui lòng nhập Code' },
              { max: 10, message: 'Code tối đa 10 ký tự' },
            ]}
          >
            <Input
              placeholder="Ví dụ: vi, en, ja"
              disabled={!!editingLanguage}
            />
          </Form.Item>
          <Form.Item
            label="Tên ngôn ngữ"
            name="languageName"
            rules={[{ required: true, message: 'Vui lòng nhập tên ngôn ngữ' }]}
          >
            <Input placeholder="Ví dụ: Tiếng Việt, English, Japanese" />
          </Form.Item>
          <Form.Item label="Trạng thái" name="isActive" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Tắt" />
          </Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  );
}
