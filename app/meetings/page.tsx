'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Descriptions,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  CopyOutlined,
  HistoryOutlined,
  RightCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

type Meeting = {
  id: string;
  title: string;
  hostName: string;
  meetingCode: string;
  passcode: string;
  createdAt: string;
};

export default function MeetingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadMeetings();
    }
  }, [isAuthenticated]);

  const loadMeetings = async () => {
    setLoadingMeetings(true);
    const result = await apiService.getMeetings();
    if (result.data) setMeetings(result.data as Meeting[]);
    if (result.error) message.error(result.error);
    setLoadingMeetings(false);
  };

  const copyText = async (text: string, successMsg = 'Đã copy') => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successMsg);
    } catch {
      message.error('Không thể copy. Vui lòng thử lại.');
    }
  };

  const buildMeetingLink = (meetingId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/meeting/${meetingId}`;
  };

  const columns = useMemo(
    () => [
      {
        title: 'STT',
        key: 'stt',
        width: 80,
        align: 'center' as const,
        render: (_: unknown, __: Meeting, index: number) =>
          (tablePage - 1) * tablePageSize + index + 1,
      },
      {
        title: 'Tên cuộc họp',
        dataIndex: 'title',
        key: 'title',
        render: (t: string) => <Typography.Text strong>{t}</Typography.Text>,
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
        width: 150,
        render: (_: unknown, record: Meeting) => (
          <Button
            type="primary"
            icon={<RightCircleOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/meeting/${record.id}`);
            }}
          >
            Tham gia
          </Button>
        ),
      },
    ],
    [router, tablePage, tablePageSize]
  );

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <Typography.Text strong>
                {isAdmin ? 'Tất cả cuộc họp' : 'Cuộc họp của tôi'}
              </Typography.Text>
              <Tag color="geekblue">{meetings.length}</Tag>
            </Space>
          }
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => void loadMeetings()} loading={loadingMeetings}>
              Tải lại
            </Button>
          }
        >
          <Table<Meeting>
            rowKey="id"
            loading={loadingMeetings}
            columns={columns as any}
            dataSource={meetings}
            pagination={{
              current: tablePage,
              pageSize: tablePageSize,
              total: meetings.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onChange: (p, ps) => {
                setTablePage(p);
                setTablePageSize(ps);
              },
            }}
            onRow={(record) => ({
              onClick: () => {
                const isExpanded = expandedRowKeys.includes(record.id);
                if (isExpanded) {
                  setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
                } else {
                  setExpandedRowKeys([...expandedRowKeys, record.id]);
                }
              },
              style: { cursor: 'pointer' },
            })}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
              showExpandColumn: false, // Ẩn icon expand mặc định
              expandedRowRender: (record) => {
                const link = buildMeetingLink(record.id);
                return (
                  <Card size="small">
                    <Space style={{ marginBottom: 12 }} wrap>
                      <Button
                        icon={<HistoryOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/history/${record.id}`);
                        }}
                      >
                        Xem lịch sử
                      </Button>
                      <Button
                        type="primary"
                        icon={<RightCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/meeting/${record.id}`);
                        }}
                      >
                        Tham gia
                      </Button>
                    </Space>

                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="Mã cuộc họp / Passcode">
                        <Space wrap>
                          <Space size={6}>
                            <Typography.Text>Mã:</Typography.Text>
                            <Typography.Text code>{record.meetingCode}</Typography.Text>
                            <Tooltip title="Copy mã">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyText(record.meetingCode, 'Đã copy mã cuộc họp');
                                }}
                              />
                            </Tooltip>
                          </Space>

                          <Space size={6}>
                            <Typography.Text>Passcode:</Typography.Text>
                            <Typography.Text code>{record.passcode}</Typography.Text>
                            <Tooltip title="Copy passcode">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyText(record.passcode, 'Đã copy passcode');
                                }}
                              />
                            </Tooltip>
                          </Space>
                        </Space>
                      </Descriptions.Item>

                      <Descriptions.Item label="Host">
                        <Typography.Text>{record.hostName}</Typography.Text>
                      </Descriptions.Item>

                      <Descriptions.Item label="Link chia sẻ">
                        <Space style={{ width: '100%' }} wrap>
                          <input
                            value={link}
                            readOnly
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              maxWidth: 520,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            icon={<CopyOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              void copyText(link, 'Đã copy link');
                            }}
                          >
                            Copy link
                          </Button>
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                );
              },
            }}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
