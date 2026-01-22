'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Space,
  Table,
  Tag,
  Typography,
  Statistic,
  Row,
  Col,
  Empty,
} from 'antd';
import MainLayout from '@/components/MainLayout';
import {
  HistoryOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';

type HistoryEntry = {
  id: string;
  username: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null; // minutes
};

const formatDuration = (duration: number | null | undefined) => {
  if (duration === null || duration === undefined) return 'Đang tham gia';
  const hours = Math.floor(duration / 60);
  const minutes = Math.round(duration % 60);
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${minutes} phút`;
};

export default function MeetingHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { message } = App.useApp();

  const meetingId = params.meetingId as string;
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (isAuthenticated && meetingId) {
      void loadHistory();
    }
  }, [meetingId, isAuthenticated, authLoading, router]);

  const loadHistory = async () => {
    setLoading(true);
    const result = await apiService.getMeetingHistory(meetingId);
    if (result.error) {
      message.error(result.error);
      setHistory([]);
      setLoading(false);
      return;
    }
    setHistory((result.data || []) as HistoryEntry[]);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = history.length;
    const active = history.filter((h) => !h.leftAt).length;
    const left = total - active;
    return { total, active, left };
  }, [history]);

  const columns = useMemo(
    () => [
      {
        title: 'STT',
        key: 'stt',
        width: 80,
        align: 'center' as const,
        render: (_: unknown, __: HistoryEntry, index: number) => index + 1,
      },
      {
        title: 'Tên người dùng',
        dataIndex: 'username',
        key: 'username',
        render: (u: string) => <Typography.Text strong>{u}</Typography.Text>,
      },
      {
        title: 'Thời gian vào',
        dataIndex: 'joinedAt',
        key: 'joinedAt',
        width: 200,
        render: (v: string) => dayjs(v).format('HH:mm:ss DD/MM/YYYY'),
      },
      {
        title: 'Thời gian ra',
        dataIndex: 'leftAt',
        key: 'leftAt',
        width: 200,
        render: (v: string | null) => (v ? dayjs(v).format('HH:mm:ss DD/MM/YYYY') : '—'),
      },
      {
        title: 'Thời lượng',
        dataIndex: 'duration',
        key: 'duration',
        width: 140,
        render: (v: number | null) => formatDuration(v),
      },
      {
        title: 'Trạng thái',
        key: 'status',
        width: 140,
        render: (_: unknown, record: HistoryEntry) =>
          record.leftAt ? <Tag color="default">Đã rời</Tag> : <Tag color="green">Đang tham gia</Tag>,
      },
    ],
    []
  );

  if (authLoading || (loading && !isAuthenticated)) {
    return <div style={{ padding: 24 }}>Đang tải...</div>;
  }
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <TeamOutlined />
              <Typography.Text strong>Lịch sử tham gia cuộc họp</Typography.Text>
              <Tag color="geekblue">{stats.total}</Tag>
            </Space>
          }
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => void loadHistory()} loading={loading}>
              Làm mới
            </Button>
          }
        >
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic title="Tổng lượt tham gia" value={stats.total} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic title="Đang tham gia" value={stats.active} valueStyle={{ color: '#389e0d' }} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Statistic title="Đã rời" value={stats.left} />
              </Card>
            </Col>
          </Row>

          {history.length === 0 ? (
            <Empty description="Chưa có lịch sử tham gia nào cho cuộc họp này." />
          ) : (
            <Table<HistoryEntry>
              rowKey="id"
              loading={loading}
              columns={columns as any}
              dataSource={history}
              pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
              size="middle"
            />
          )}
        </Card>
      </div>
    </MainLayout>
  );
}

