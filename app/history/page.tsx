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
  Table,
  Tag,
  Typography,
  Space,
  Empty,
} from 'antd';
import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

type HistoryItem = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  username: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
  meetingCode: string;
  hostName: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { message } = App.useApp();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadHistory();
    }
  }, [isAuthenticated]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const result = await apiService.getMyHistory();
    if (result.data) {
      setHistory(result.data as HistoryItem[]);
    }
    if (result.error) {
      message.error(result.error);
    }
    setLoadingHistory(false);
  };

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  const formatDuration = (duration: number | null) => {
    if (duration === null) return 'Đang tham gia';
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, __: HistoryItem, index: number) => index + 1,
    },
    {
      title: 'Tên cuộc họp',
      dataIndex: 'meetingTitle',
      key: 'meetingTitle',
      render: (text: string, record: HistoryItem) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{text}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Mã: {record.meetingCode} | Host: {record.hostName}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Thời gian tham gia',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      width: 180,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      title: 'Thời gian rời',
      dataIndex: 'leftAt',
      key: 'leftAt',
      width: 180,
      render: (v: string | null) => 
        v ? dayjs(v).format('DD/MM/YYYY HH:mm') : <Tag color="processing">Đang tham gia</Tag>,
    },
    {
      title: 'Thời lượng',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (v: number | null) => formatDuration(v),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: HistoryItem) => (
        <Button
          type="link"
          onClick={() => router.push(`/history/${record.meetingId}`)}
        >
          Xem chi tiết
        </Button>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <HistoryOutlined />
              <Typography.Title level={4} style={{ margin: 0 }}>
                Lịch sử tham gia
              </Typography.Title>
            </Space>
          }
          extra={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void loadHistory()}
              loading={loadingHistory}
            >
              Tải lại
            </Button>
          }
        >
          {history.length === 0 ? (
            <Empty
              description="Chưa có lịch sử tham gia cuộc họp"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <Table
              rowKey="id"
              loading={loadingHistory}
              columns={columns}
              dataSource={history}
              pagination={{ 
                pageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
              }}
            />
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
