'use client';

import React, { useEffect, useState } from 'react';
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
  Statistic,
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
} from '@ant-design/icons';
import type { AdminCountry, AdminLanguage } from '@/services/catalog/catalogApi';

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

  // ── Users table columns ──────────────────────────────────────────
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: User, index: number) => index + 1,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 110,
      render: (role: string) => (
        <Tag color={role === 'Admin' ? 'red' : 'blue'}>
          {role === 'Admin' ? <SettingOutlined /> : <UserOutlined />} {role}
        </Tag>
      ),
    },
    {
      title: 'Thông tin',
      key: 'extraInfo',
      width: 280,
      render: (_: unknown, record: User) => (
        <Space direction="vertical" size={0}>
          <Typography.Text type="secondary">Chức vụ: {record.position || '-'}</Typography.Text>
          <Typography.Text type="secondary">
            Học hàm/vị: {record.academicRank || '-'} / {record.academicDegree || '-'}
          </Typography.Text>
          <Typography.Text type="secondary">Đơn vị: {record.organizationUnitName || '-'}</Typography.Text>
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
      width: 160,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
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

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Statistics */}
          {stats && (
            <Card title="Thống kê tổng quan">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="Tổng số User" value={stats.totalUsers} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Admin"
                    value={stats.totalAdmins}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="User" value={stats.totalUsersRole} />
                </Col>
                <Col span={6}>
                  <Statistic title="Tổng số Meeting" value={stats.totalMeetings} />
                </Col>
              </Row>
            </Card>
          )}

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
                    extra={
                      <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()} loading={loadingUsers}>
                        Tải lại
                      </Button>
                    }
                  >
                    <Table<User>
                      rowKey="id"
                      loading={loadingUsers}
                      columns={columns as any}
                      dataSource={users}
                      scroll={{ x: 1200 }}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: [10, 20, 50, 100],
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
                            extra={
                              <Space>
                                <Button icon={<ReloadOutlined />} onClick={() => void loadCatalog()} loading={loadingCatalog}>
                                  Tải lại
                                </Button>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCountryModal()}>
                                  Thêm quốc gia
                                </Button>
                              </Space>
                            }
                          >
                            <Table<AdminCountry>
                              rowKey="code"
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
                            extra={
                              <Space>
                                <Button icon={<ReloadOutlined />} onClick={() => void loadCatalog()} loading={loadingCatalog}>
                                  Tải lại
                                </Button>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => openLanguageModal()}>
                                  Thêm ngôn ngữ
                                </Button>
                              </Space>
                            }
                          >
                            <Table<AdminLanguage>
                              rowKey="code"
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
