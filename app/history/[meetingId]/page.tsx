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
  Row,
  Col,
  Empty,
  Avatar,
} from 'antd';
import MainLayout from '@/components/MainLayout';
import {
  ReloadOutlined,
  TeamOutlined,
  LoginOutlined,
  LogoutOutlined,
  UserOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

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
        title: <Text type="secondary" style={{ fontSize: 12 }}>STT</Text>,
        key: 'stt',
        width: 60,
        align: 'center' as const,
        render: (_: unknown, __: HistoryEntry, index: number) => <Text type="secondary">{index + 1}</Text>,
      },
      {
        title: <Text type="secondary" style={{ fontSize: 12 }}>TÊN NGƯỜI DÙNG</Text>,
        dataIndex: 'username',
        key: 'username',
        render: (u: string) => (
          <Space>
            <Avatar 
              size="small" 
              style={{ backgroundColor: '#1890ff', color: '#fff' }}
              icon={!u ? <UserOutlined /> : undefined}
            >
              {u ? u.charAt(0).toUpperCase() : ''}
            </Avatar>
            <Text strong style={{ color: '#1e293b' }}>{u || 'Người dùng ẩn danh'}</Text>
          </Space>
        ),
      },
      {
        title: <Text type="secondary" style={{ fontSize: 12 }}>THỜI GIAN VÀO</Text>,
        dataIndex: 'joinedAt',
        key: 'joinedAt',
        width: 200,
        render: (v: string) => (
          <Space>
            <LoginOutlined style={{ color: '#52c41a' }} />
            <Text>{dayjs(v).format('HH:mm:ss DD/MM/YYYY')}</Text>
          </Space>
        ),
      },
      {
        title: <Text type="secondary" style={{ fontSize: 12 }}>THỜI GIAN RA</Text>,
        dataIndex: 'leftAt',
        key: 'leftAt',
        width: 200,
        render: (v: string | null) => 
          v ? (
            <Space>
              <LogoutOutlined style={{ color: '#8c8c8c' }} />
              <Text type="secondary">{dayjs(v).format('HH:mm:ss DD/MM/YYYY')}</Text>
            </Space>
          ) : (
            <Text type="secondary">—</Text>
          ),
      },
      {
        title: <Text type="secondary" style={{ fontSize: 12 }}>THỜI LƯỢNG</Text>,
        dataIndex: 'duration',
        key: 'duration',
        width: 150,
        render: (v: number | null) => (
          <Text strong={v !== null} style={{ color: v === null ? '#059669' : '#475569' }}>
            {formatDuration(v)}
          </Text>
        ),
      },
      {
        title: <Text type="secondary" style={{ fontSize: 12 }}>TRẠNG THÁI</Text>,
        key: 'status',
        width: 140,
        align: 'center' as const,
        render: (_: unknown, record: HistoryEntry) =>
          record.leftAt ? (
            <Tag 
              color="default" 
              style={{ borderRadius: 16, padding: '2px 10px', margin: 0 }}
            >
              Đã rời
            </Tag>
          ) : (
            <Tag 
              color="success" 
              style={{ 
                borderRadius: 16, 
                padding: '2px 10px', 
                margin: 0, 
                background: '#ecfdf5', 
                borderColor: '#a7f3d0', 
                color: '#059669' 
              }}
            >
              Đang tham gia
            </Tag>
          ),
      },
    ],
    []
  );

  if (authLoading || (loading && !isAuthenticated)) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Đang tải...</div>;
  }
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space align="center" size="middle">
            <div style={{ width: 40, height: 40, background: '#e6f4ff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1890ff' }}>
               <TeamOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, color: '#1e293b' }}>
                Lịch sử tham gia
              </Title>
              <Text type="secondary">Chi tiết người dùng tham gia cuộc họp</Text>
            </div>
          </Space>
          
          <Button
            size="large"
            icon={<ReloadOutlined />}
            onClick={() => void loadHistory()}
            loading={loading}
            style={{ borderRadius: 8 }}
          >
            Làm mới
          </Button>
        </div>

        {/* Thống kê nổi bật */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card 
              bordered={false} 
              style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}
              styles={{ body: { padding: '20px', width: '100%', display: 'flex', alignItems: 'center', gap: 16 } }}
            >
              <div style={{ width: 48, height: 48, background: '#f0f5ff', color: '#2f54eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                <TeamOutlined />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Tổng lượt tham gia</Text>
                <Title level={3} style={{ margin: 0, color: '#0f172a' }}>{stats.total}</Title>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card 
              bordered={false} 
              style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}
              styles={{ body: { padding: '20px', width: '100%', display: 'flex', alignItems: 'center', gap: 16 } }}
            >
              <div style={{ width: 48, height: 48, background: '#f6ffed', color: '#52c41a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                <CheckCircleOutlined />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Đang tham gia</Text>
                <Title level={3} style={{ margin: 0, color: '#52c41a' }}>{stats.active}</Title>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card 
              bordered={false} 
              style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}
              styles={{ body: { padding: '20px', width: '100%', display: 'flex', alignItems: 'center', gap: 16 } }}
            >
              <div style={{ width: 48, height: 48, background: '#f8fafc', color: '#64748b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                <MinusCircleOutlined />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Đã rời khỏi</Text>
                <Title level={3} style={{ margin: 0, color: '#64748b' }}>{stats.left}</Title>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Content Section (Table) */}
        <Card
          bordered={false} 
          style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}
          styles={{ body: { padding: '20px 24px' } }}
        >
          {history.length === 0 && !loading ? (
            <div style={{ padding: '60px 0' }}>
              <Empty
                description={<Text type="secondary" style={{ fontSize: 15 }}>Chưa có lịch sử tham gia nào cho cuộc họp này.</Text>}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <Table<HistoryEntry>
              rowKey="id"
              loading={loading}
              columns={columns as any}
              dataSource={history}
              size="middle"
              rowClassName={() => 'custom-table-row'}
              pagination={{ 
                pageSize: 10, 
                showSizeChanger: true, 
                pageSizeOptions: [10, 20, 50, 100],
                style: { marginTop: 24 }
              }}
            />
          )}
        </Card>
      </div>

      {/* Custom CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-table-row td {
          border-bottom: 1px solid #f0f0f0 !important;
        }
        .ant-table-wrapper .ant-table-container table > thead > tr:first-child > th:first-child {
          border-start-start-radius: 8px;
        }
        .ant-table-wrapper .ant-table-container table > thead > tr:first-child > th:last-child {
          border-start-end-radius: 8px;
        }
        .ant-table-thead > tr > th {
          background: #fafafa !important;
          border-bottom: 1px solid #f0f0f0 !important;
        }
        .ant-table-cell::before {
          display: none !important;
        }
        .custom-table-row:hover {
          background-color: #f0f5ff !important;
        }
      `}} />
    </MainLayout>
  );
}