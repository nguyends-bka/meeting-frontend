'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import {
  App,
  Button,
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Input,
  Empty,
} from 'antd';
import {
  VideoCameraOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  TeamOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

type Meeting = {
  id: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  meetingCode: string;
  passcode: string;
  roomName: string;
  createdAt: string;
  participantCount: number;
  activeParticipantCount: number;
};

export default function AdminMeetingsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, loading, isAdmin, router]);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      void loadMeetings();
    }
  }, [isAuthenticated, isAdmin]);

  const loadMeetings = async () => {
    setLoadingMeetings(true);
    const result = await apiService.getAllMeetings();
    if (result.data) {
      setMeetings(result.data as Meeting[]);
    }
    if (result.error) {
      message.error(result.error);
    }
    setLoadingMeetings(false);
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    const result = await apiService.deleteMeeting(meetingId);

    if (result.error) {
      message.error(result.error);
      return;
    }

    message.success('Xóa meeting thành công');
    await loadMeetings();
  };

  const filteredMeetings = useMemo(() => {
    if (!searchText.trim()) return meetings;
    
    const lowerSearch = searchText.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(lowerSearch) ||
        m.hostName.toLowerCase().includes(lowerSearch) ||
        m.meetingCode.toLowerCase().includes(lowerSearch) ||
        m.passcode.toLowerCase().includes(lowerSearch)
    );
  }, [meetings, searchText]);

  const stats = useMemo(() => {
    const total = meetings.length;
    const active = meetings.filter((m) => m.activeParticipantCount > 0).length;
    const totalParticipants = meetings.reduce((sum, m) => sum + m.participantCount, 0);
    const activeParticipants = meetings.reduce((sum, m) => sum + m.activeParticipantCount, 0);
    return { total, active, totalParticipants, activeParticipants };
  }, [meetings]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated || !isAdmin) return null;

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, __: Meeting, index: number) => index + 1,
    },
    {
      title: 'Tên cuộc họp',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: 'Host',
      dataIndex: 'hostName',
      key: 'hostName',
      width: 150,
    },
    {
      title: 'Mã cuộc họp',
      dataIndex: 'meetingCode',
      key: 'meetingCode',
      width: 120,
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Passcode',
      dataIndex: 'passcode',
      key: 'passcode',
      width: 100,
      render: (code: string) => <Typography.Text code>{code}</Typography.Text>,
    },
    {
      title: 'Người tham gia',
      key: 'participants',
      width: 150,
      render: (_: unknown, record: Meeting) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <TeamOutlined />
            <span>Tổng: {record.participantCount}</span>
          </Space>
          {record.activeParticipantCount > 0 && (
            <Tag color="green">
              Đang tham gia: {record.activeParticipantCount}
            </Tag>
          )}
        </Space>
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
      render: (_: unknown, record: Meeting) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/history/${record.id}`)}
          >
            Xem lịch sử
          </Button>
          <Popconfirm
            title="Xác nhận xóa meeting"
            description={`Bạn có chắc chắn muốn xóa cuộc họp "${record.title}"? Tất cả dữ liệu liên quan sẽ bị xóa.`}
            onConfirm={() => void handleDeleteMeeting(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Statistics */}
          <Card title="Thống kê Meetings">
            <Row gutter={16}>
              <Col xs={24} sm={12} lg={6}>
                <Statistic title="Tổng số Meeting" value={stats.total} prefix={<VideoCameraOutlined />} />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Meeting đang diễn ra"
                  value={stats.active}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Tổng lượt tham gia"
                  value={stats.totalParticipants}
                  prefix={<TeamOutlined />}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Statistic
                  title="Đang tham gia"
                  value={stats.activeParticipants}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
            </Row>
          </Card>

          {/* Meetings Table */}
          <Card
            title={
              <Space>
                <VideoCameraOutlined />
                <Typography.Title level={4} style={{ margin: 0 }}>
                  Quản lý Meetings
                </Typography.Title>
                <Tag color="geekblue">{filteredMeetings.length}</Tag>
              </Space>
            }
            extra={
              <Space>
                <Input
                  placeholder="Tìm kiếm theo tên, host, mã..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 300 }}
                  allowClear
                />
                <Button icon={<ReloadOutlined />} onClick={() => void loadMeetings()} loading={loadingMeetings}>
                  Tải lại
                </Button>
              </Space>
            }
          >
            {filteredMeetings.length === 0 ? (
              <Empty
                description={searchText ? 'Không tìm thấy meeting nào' : 'Chưa có meeting nào'}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table<Meeting>
                rowKey="id"
                loading={loadingMeetings}
                columns={columns as any}
                dataSource={filteredMeetings}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: [10, 20, 50, 100],
                  showTotal: (total) => `Tổng ${total} meeting`,
                }}
              />
            )}
          </Card>
        </Space>
      </div>
    </MainLayout>
  );
}
