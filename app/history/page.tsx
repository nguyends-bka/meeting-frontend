'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import type { MyHistoryItem } from '@/dtos/meeting.dto';
import {
  App,
  Button,
  Card,
  Table,
  Typography,
  Input,
  Row,
  Col,
  Empty,
} from 'antd';
import {
  HistoryOutlined, ReloadOutlined, SearchOutlined, CaretRightOutlined,
  EnvironmentOutlined, UserOutlined, LoginOutlined, LogoutOutlined,
  FieldTimeOutlined, TeamOutlined, VideoCameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getHostNameOnly, getVirtualRoom } from '@/app/_home/helpers';
import './history.css';

export default function HistoryPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { message } = App.useApp();
  const [history, setHistory] = useState<MyHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchText, setSearchText] = useState('');

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
      setHistory(result.data as MyHistoryItem[]);
    }
    if (result.error) {
      message.error(result.error);
    }
    setLoadingHistory(false);
  };

  const formatDuration = (duration: number | null) => {
    if (duration === null) return null;
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Thống kê tổng hợp
  const stats = useMemo(() => {
    const totalSessions = history.length;
    const uniqueMeetings = new Set(history.map((h) => h.meetingId)).size;
    const activeNow = history.filter((h) => h.leftAt === null).length;
    const totalMinutes = history.reduce((sum, h) => sum + (h.duration ?? 0), 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remMinutes = Math.round(totalMinutes % 60);
    const totalDurationLabel = totalHours > 0 ? `${totalHours}h ${remMinutes}m` : `${remMinutes}m`;
    return { totalSessions, uniqueMeetings, activeNow, totalDurationLabel };
  }, [history]);

  // Lọc theo tìm kiếm
  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return history;
    return history.filter((h) =>
      (h.meetingTitle || '').toLowerCase().includes(q) ||
      (h.meetingCode || '').toLowerCase().includes(q) ||
      (h.hostName || '').toLowerCase().includes(q)
    );
  }, [history, searchText]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 64,
      align: 'center' as const,
      render: (_: unknown, __: MyHistoryItem, index: number) => (
        <span style={{ color: '#94a3b8', fontWeight: 500 }}>{index + 1}</span>
      ),
    },
    {
      title: 'Cuộc họp',
      dataIndex: 'meetingTitle',
      key: 'meetingTitle',
      render: (text: string, record: MyHistoryItem) => {
        const title = text || 'Cuộc họp';
        return (
          <div className="h-row">
            <div className="h-avatar">{title.trim().charAt(0).toUpperCase() || 'M'}</div>
            <div style={{ minWidth: 0 }}>
              <div className="h-title">{title}</div>
              <div className="h-meta-line">
                <span className="h-meta-chip">Mã: <span className="h-code">{record.meetingCode}</span></span>
                <span className="h-meta-chip"><UserOutlined /> {record.location ? record.hostName : getHostNameOnly(record.hostName)}</span>
              </div>
              <div className="h-meta-line">
                <span className="h-meta-chip"><EnvironmentOutlined /> {record.location || getVirtualRoom(record.hostName, record.meetingId)}</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Tham gia',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      width: 150,
      render: (v: string) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="h-time"><LoginOutlined style={{ color: '#059669', marginRight: 5 }} />{dayjs(v).format('HH:mm')}</span>
          <span className="h-time-date">{dayjs(v).format('DD/MM/YYYY')}</span>
        </div>
      ),
    },
    {
      title: 'Rời',
      dataIndex: 'leftAt',
      key: 'leftAt',
      width: 150,
      render: (v: string | null) =>
        v ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="h-time"><LogoutOutlined style={{ color: '#f43f5e', marginRight: 5 }} />{dayjs(v).format('HH:mm')}</span>
            <span className="h-time-date">{dayjs(v).format('DD/MM/YYYY')}</span>
          </div>
        ) : (
          <span className="h-status h-status-active"><span className="h-live-dot" />Đang tham gia</span>
        ),
    },
    {
      title: 'Thời lượng',
      dataIndex: 'duration',
      key: 'duration',
      width: 130,
      align: 'center' as const,
      render: (v: number | null) => {
        const label = formatDuration(v);
        return label ? (
          <span className="h-duration"><FieldTimeOutlined />{label}</span>
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center' as const,
      render: (_: unknown, record: MyHistoryItem) => (
        <Button
          type="primary"
          size="small"
          onClick={() => router.push(`/history/${record.meetingId}`)}
          style={{ borderRadius: 8, fontWeight: 500 }}
        >
          Chi tiết <CaretRightOutlined />
        </Button>
      ),
    },
  ];

  const statItems = [
    { label: 'Tổng lượt tham gia', value: stats.totalSessions, icon: <TeamOutlined />, color: '#2563eb' },
    { label: 'Số cuộc họp', value: stats.uniqueMeetings, icon: <VideoCameraOutlined />, color: '#7c3aed' },
    { label: 'Tổng thời lượng', value: stats.totalDurationLabel, icon: <FieldTimeOutlined />, color: '#d97706' },
    { label: 'Đang tham gia', value: stats.activeNow, icon: <HistoryOutlined />, color: '#059669' },
  ];

  return (
    <MainLayout>
      <div className="history-container">
        {/* HEADER TRANG */}
        <div className="history-page-head">
          <div>
            <Typography.Title level={4} className="history-page-title">
              <HistoryOutlined /> Lịch sử tham gia
            </Typography.Title>
            <Typography.Text className="history-page-sub">
              Xem lại các cuộc họp bạn đã tham gia và thời lượng của từng phiên
            </Typography.Text>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void loadHistory()}
            loading={loadingHistory}
            style={{ borderRadius: 10, height: 38, fontWeight: 500 }}
          >
            Tải lại
          </Button>
        </div>

        {/* THẺ THỐNG KÊ */}
        <Row gutter={[14, 14]} className="history-stat-row">
          {statItems.map((s) => (
            <Col xs={12} lg={6} key={s.label} style={{ display: 'flex' }}>
              <div className="history-stat">
                <span className="history-stat-icon" style={{ color: s.color, background: `${s.color}14` }}>
                  {s.icon}
                </span>
                <div>
                  <div className="history-stat-count">{s.value}</div>
                  <div className="history-stat-label">{s.label}</div>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        {/* TÌM KIẾM */}
        <div className="history-search-wrap">
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tìm theo tên, mã phòng, host..."
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ borderRadius: 10, height: 40 }}
          />
        </div>

        {/* BẢNG */}
        <Card className="history-card" styles={{ body: { padding: 0 } }}>
          <Table<MyHistoryItem>
            rowKey="id"
            className="history-table"
            loading={loadingHistory}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ color: '#94a3b8' }}>
                      {searchText ? 'Không tìm thấy cuộc họp phù hợp' : 'Chưa có lịch sử tham gia cuộc họp'}
                    </span>
                  }
                  style={{ padding: '40px 0' }}
                />
              ),
            }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} trong số ${total}`,
            }}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
