'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Layout,
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
  message as antdMessage,
} from 'antd';
import MainLayout from '@/components/MainLayout';
import {
  UserOutlined,
  LogoutOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons';

type User = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

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

  const handleEditRole = (userRecord: User) => {
    setEditingUser(userRecord);
    form.setFieldsValue({ role: userRecord.role });
    setEditModalOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;

    const values = await form.validateFields();
    const result = await apiService.updateUserRole(editingUser.id, values.role);

    if (result.error) {
      message.error(result.error);
      return;
    }

    message.success('Cập nhật role thành công');
    setEditModalOpen(false);
    setEditingUser(null);
    form.resetFields();
    await loadUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    const result = await apiService.deleteUser(userId);

    if (result.error) {
      message.error(result.error);
      return;
    }

    message.success('Xóa user thành công');
    await loadUsers();
    await loadStats();
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 80,
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
      width: 120,
      render: (role: string) => (
        <Tag color={role === 'Admin' ? 'red' : 'blue'}>
          {role === 'Admin' ? <SettingOutlined /> : <UserOutlined />} {role}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
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

          {/* Users Table */}
          <Card
            title={
              <Space>
                <Typography.Text strong>Quản lý Users</Typography.Text>
                <Tag color="geekblue">{users.length}</Tag>
              </Space>
            }
          >
            <Table<User>
              rowKey="id"
              loading={loadingUsers}
              columns={columns as any}
              dataSource={users}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
              }}
            />
          </Card>
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
    </MainLayout>
  );
}
