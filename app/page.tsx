'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminApi, apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import dayjs from 'dayjs';
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Table,
  Typography,
  Descriptions,
  Result,
  Grid,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  RightCircleOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
  UserOutlined,
  CaretRightOutlined,
  ReloadOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

type HomeMeetingRow = {
  id: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  meetingCode: string;
  passcode: string;
  createdAt: string;
  activeParticipantCount?: number;
  startedAt?: string | null;
  endedAt?: string | null;
};

type HistoryEntry = {
  id: string;
  username: string;
  fullName?: string | null;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
};

/** Thời lượng = kết thúc − bắt đầu (chỉ hiển thị, không có nút gợi ý). */
function formatDurationFromScheduleRange(
  range: [dayjs.Dayjs, dayjs.Dayjs] | undefined | null,
): string {
  if (!range?.[0] || !range?.[1]) return '—';
  const minutes = Math.max(0, range[1].diff(range[0], 'minute'));
  if (minutes === 0) return '0 phút';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

function formatHistoryParticipationDuration(r: HistoryEntry): string {
  if (!r.leftAt) return 'Đang tham gia';
  const start = dayjs(r.joinedAt);
  const end = dayjs(r.leftAt);
  if (start.isValid() && end.isValid()) {
    const totalSec = Math.max(0, end.diff(start, 'second'));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return m > 0 ? `${h} giờ ${m} phút ${s} giây` : `${h} giờ ${s} giây`;
    if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
    return `${s} giây`;
  }
  if (r.duration != null && r.duration !== undefined) {
    const totalSec = Math.max(0, Math.round(Number(r.duration) * 60));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return m > 0 ? `${h} giờ ${m} phút ${s} giây` : `${h} giờ ${s} giây`;
    if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
    return `${s} giây`;
  }
  return '—';
}

export default function HomePage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = !screens.lg;

  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingHome, setLoadingHome] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<{
    id: string;
    code: string;
    passcode: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    totalMeetings: number;
    activeMeetings: number;
    todayMeetings: number;
  } | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<HomeMeetingRow[]>([]);
  const [detailMeeting, setDetailMeeting] = useState<HomeMeetingRow | null>(null);
  const [historyMeeting, setHistoryMeeting] = useState<HomeMeetingRow | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTablePage, setHistoryTablePage] = useState(1);
  const [historyTablePageSize, setHistoryTablePageSize] = useState(10);
  const [exportingHistoryExcel, setExportingHistoryExcel] = useState(false);

  const [createForm] = Form.useForm();
  const scheduleRangeWatch = Form.useWatch('scheduleRange', createForm);
  const estimatedDurationLabel = useMemo(
    () => formatDurationFromScheduleRange(scheduleRangeWatch as [dayjs.Dayjs, dayjs.Dayjs] | undefined),
    [scheduleRangeWatch],
  );
  const [joinForm] = Form.useForm();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStats();
    }
  }, [isAuthenticated]);

  const loadStats = async () => {
    setLoadingHome(true);
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`;

      if (isAdmin) {
        const res = await adminApi.getAllMeetings();
        const meetings = (res.data ?? []) as any[];
        const rows: HomeMeetingRow[] = meetings.map((m) => ({
          id: m.id,
          title: m.title,
          hostName: m.hostName,
          hostIdentity: m.hostIdentity ?? '',
          meetingCode: m.meetingCode,
          passcode: m.passcode ?? '',
          createdAt: m.createdAt,
          activeParticipantCount: m.activeParticipantCount,
          startedAt: m.startedAt,
          endedAt: m.endedAt,
        }));
        rows.sort((a, b) => {
          const aEnded = Boolean(a.endedAt);
          const bEnded = Boolean(b.endedAt);
          const aLive = !aEnded && (a.activeParticipantCount ?? 0) > 0;
          const bLive = !bEnded && (b.activeParticipantCount ?? 0) > 0;
          if (aLive !== bLive) return aLive ? -1 : 1;
          if (aEnded !== bEnded) return aEnded ? 1 : -1;
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        });
        setRecentMeetings(rows.slice(0, 5));

        const active = rows.filter((r) => (r.activeParticipantCount ?? 0) > 0).length;
        const todayCount = rows.filter((r) => {
          const d = new Date(r.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
            2,
            '0',
          )}`;
          return key === todayKey;
        }).length;
        setStats({ totalMeetings: rows.length, activeMeetings: active, todayMeetings: todayCount });
        return;
      }

      const result = await apiService.getMeetings();
      const meetings = (result.data ?? []) as any[];
      const rows: HomeMeetingRow[] = meetings.map((m) => ({
        id: m.id,
        title: m.title,
        hostName: m.hostName,
        hostIdentity: m.hostIdentity ?? '',
        meetingCode: m.meetingCode,
        passcode: m.passcode ?? '',
        createdAt: m.createdAt,
        startedAt: m.startedAt,
        endedAt: m.endedAt,
        activeParticipantCount: m.activeParticipantCount,
      }));
      rows.sort((a, b) => {
        const aEnded = Boolean(a.endedAt);
        const bEnded = Boolean(b.endedAt);
        const aLive = !aEnded && (a.activeParticipantCount ?? 0) > 0;
        const bLive = !bEnded && (b.activeParticipantCount ?? 0) > 0;
        if (aLive !== bLive) return aLive ? -1 : 1;
        if (aEnded !== bEnded) return aEnded ? 1 : -1;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
      setRecentMeetings(rows.slice(0, 5));

      const todayCount = rows.filter((r) => {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
          2,
          '0',
        )}`;
        return key === todayKey;
      }).length;
      setStats({
        totalMeetings: rows.length,
        activeMeetings: 0,
        todayMeetings: todayCount,
      });
    } finally {
      setLoadingHome(false);
    }
  };

  const onCreateMeeting = async () => {
    const values = await createForm.validateFields();
    const title = String(values.title || '').trim();
    const finalHostName = String(values.hostName || '').trim() || user?.username || 'Host';

    setCreating(true);
    const result = await apiService.createMeeting(title, finalHostName);
    setCreating(false);

    if (result.error) {
      message.error(result.error);
      return;
    }
    if (result.data) {
      message.success('Tạo cuộc họp thành công');
      setCreatedMeeting({
        id: result.data.meetingId,
        code: result.data.meetingCode,
        passcode: result.data.passcode,
      });
      await loadStats();
      // Không tự động tham gia, chỉ hiển thị thông tin
    }
  };

  const buildMeetingLink = useCallback((meetingId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/meeting/${meetingId}`;
  }, []);

  const copyText = useCallback(
    async (text: string, _successMsg = 'Đã copy') => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        message.error('Không thể copy. Vui lòng thử lại.');
      }
    },
    [message],
  );

  const openHistoryModal = useCallback(
    async (meeting: HomeMeetingRow) => {
      setHistoryTablePage(1);
      setHistoryMeeting(meeting);
      setHistoryLoading(true);
      const res = await apiService.getMeetingHistory(meeting.id);
      if (res.error || !res.data) {
        message.error(res.error || 'Không tải được lịch sử cuộc họp');
        setHistoryItems([]);
        setHistoryLoading(false);
        return;
      }
      const items = (res.data as HistoryEntry[]) ?? [];
      if (isAdmin && items.length > 0) {
        const usersRes = await apiService.getAllUsers();
        if (usersRes.data && Array.isArray(usersRes.data)) {
          const byId = new Map<string, string>();
          for (const u of usersRes.data as any[]) {
            const id = String(u?.id ?? '');
            const fullName = String(u?.fullName ?? '').trim();
            if (id && fullName) byId.set(id, fullName);
          }
          setHistoryItems(items.map((h) => ({ ...h, fullName: byId.get(h.userId) ?? null })));
          setHistoryLoading(false);
          return;
        }
      }
      setHistoryItems(items);
      setHistoryLoading(false);
    },
    [isAdmin, message],
  );

  const exportHistoryToExcel = useCallback(() => {
    if (!historyMeeting) return;
    if (historyItems.length === 0) {
      message.warning('Không có dữ liệu để xuất');
      return;
    }
    setExportingHistoryExcel(true);
    try {
      const rows = historyItems.map((r, i) => ({
        STT: i + 1,
        'Người dùng': r.fullName?.trim() || r.username,
        Username: r.username,
        'Vào lúc': r.joinedAt ? dayjs(r.joinedAt).format('DD/MM/YYYY HH:mm:ss') : '',
        'Rời lúc': r.leftAt ? dayjs(r.leftAt).format('DD/MM/YYYY HH:mm:ss') : 'Đang tham gia',
        'Thời lượng tham gia': formatHistoryParticipationDuration(r),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử');
      const safeTitle = historyMeeting.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const stamp = dayjs().format('YYYYMMDD-HHmm');
      XLSX.writeFile(wb, `lich-su-cuoc-hop-${safeTitle}-${stamp}.xlsx`);
    } catch {
      message.error('Xuất Excel thất bại');
    } finally {
      setExportingHistoryExcel(false);
    }
  }, [historyItems, historyMeeting, message]);

  const homeScheduleColumns = useMemo(
    () => [
      {
        title: 'STT',
        key: 'stt',
        width: 60,
        align: 'center' as const,
        render: (_: unknown, __: HomeMeetingRow, index: number) => (
          <Text type="secondary">{index + 1}</Text>
        ),
      },
      {
        title: 'THÔNG TIN CUỘC HỌP',
        key: 'info',
        width: 480,
        render: (_: unknown, record: HomeMeetingRow) => (
          <Space align="start" size="middle">
            <div
              style={{
                fontSize: '20px',
                color: '#1677ff',
                padding: '8px 12px',
                border: '1px solid #e6f4ff',
                borderRadius: '8px',
              }}
            >
              <CalendarOutlined />
            </div>
            <Space direction="vertical" size={0}>
              <Text strong style={{ fontSize: '15px' }}>
                {record.title}
              </Text>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}
              </Text>
              <Space style={{ marginTop: 4 }}>
                <UserOutlined style={{ color: '#8c8c8c' }} />
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  Host: {record.hostName}
                </Text>
              </Space>
            </Space>
          </Space>
        ),
      },
      {
        title: 'TRẠNG THÁI',
        key: 'status',
        width: 200,
        responsive: ['md'] as const,
        render: (_: unknown, record: HomeMeetingRow) => {
          const isEnded = Boolean(record.endedAt);
          const isLive = !isEnded && (record.activeParticipantCount ?? 0) > 0;
          const when = dayjs(record.createdAt);
          const timeDateLine = (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              <Text strong>{when.format('HH:mm')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {when.format('DD/MM/YYYY')}
              </Text>
            </div>
          );
          if (isLive) {
            return (
              <div>
                <Tag color="success">Đang diễn ra</Tag>
                {timeDateLine}
              </div>
            );
          }
          if (isEnded) {
            const endWhen = record.endedAt ? dayjs(record.endedAt) : when;
            return (
              <div>
                <Tag>Đã kết thúc</Tag>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Kết thúc: {endWhen.format('HH:mm DD/MM/YYYY')}
                  </Text>
                </div>
              </div>
            );
          }
          return (
            <div>
              <Tag color="processing">Chưa diễn ra</Tag>
              {timeDateLine}
            </div>
          );
        },
      },
      {
        title: 'TRUY CẬP',
        key: 'access',
        width: 450,
        align: 'left' as const,
        responsive: ['lg'] as const,
        render: (_: unknown, record: HomeMeetingRow) => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr',
              rowGap: 8,
              columnGap: 8,
              width: 'fit-content',
              maxWidth: '100%',
              minWidth: 0,
              alignItems: 'center',
            }}
          >
            <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
              Mã:
            </Text>
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: '110px 12px 44px 8px 110px',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  gridColumn: 1,
                  background: '#f5f5f5',
                  padding: '4px 12px',
                  borderRadius: 4,
                  width: 110,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <Typography.Text strong style={{ flex: 1, minWidth: 0 }} ellipsis>
                  {record.meetingCode}
                </Typography.Text>
                <CopyOutlined
                  style={{ color: '#8c8c8c', cursor: 'pointer', flex: '0 0 auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyText(record.meetingCode);
                  }}
                />
              </div>

              <Text type="secondary" style={{ gridColumn: 3, whiteSpace: 'nowrap', width: 44 }}>
                Pass:
              </Text>

              <div
                style={{
                  gridColumn: 5,
                  background: '#f5f5f5',
                  padding: '4px 12px',
                  borderRadius: 4,
                  width: 110,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <Typography.Text strong style={{ flex: 1, minWidth: 0 }}>
                  {record.passcode}
                </Typography.Text>
                <CopyOutlined
                  style={{ color: '#8c8c8c', cursor: 'pointer', flex: '0 0 auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyText(record.passcode);
                  }}
                />
              </div>
            </div>

            <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
              Link:
            </Text>
            <div
              style={{
                background: '#f5f5f5',
                padding: '4px 12px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                width: 110 + 12 + 44 + 8 + 110,
              }}
            >
              <Typography.Text
                style={{ color: '#1677ff', flex: 1, minWidth: 0 }}
                ellipsis={{ tooltip: buildMeetingLink(record.id) }}
              >
                {buildMeetingLink(record.id)}
              </Typography.Text>
              <CopyOutlined
                style={{ color: '#8c8c8c', cursor: 'pointer', flex: '0 0 auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  void copyText(buildMeetingLink(record.id));
                }}
              />
            </div>
          </div>
        ),
      },
      {
        title: 'THAO TÁC',
        key: 'actions',
        width: 160,
        fixed: 'right' as const,
        render: (_: unknown, record: HomeMeetingRow) => {
          const isEnded = Boolean(record.endedAt);
          const isLive = !isEnded && (record.activeParticipantCount ?? 0) > 0;
          const actionLabel = isLive ? 'Tham gia' : isEnded ? 'Xem lịch sử' : 'Chi tiết';
          return (
            <Button
              type={isLive ? 'primary' : 'default'}
              icon={isLive ? <CaretRightOutlined /> : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (isLive) {
                  router.push(`/meeting/${record.id}`);
                  return;
                }
                if (isEnded) {
                  void openHistoryModal(record);
                  return;
                }
                setDetailMeeting(record);
              }}
              style={{ fontWeight: 500, width: 112, justifyContent: 'center' }}
              className="meeting-action-main-btn"
            >
              {actionLabel}
            </Button>
          );
        },
      },
    ],
    [router, copyText, buildMeetingLink, openHistoryModal]
  );

  const onJoinMeeting = async () => {
    const values = await joinForm.validateFields();
    const meetingIdOrCode = String(values.meetingIdOrCode || '').trim();
    const passcode = String(values.passcode || '').trim();

    const isGuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        meetingIdOrCode
      );

    const result = isGuid
      ? await apiService.joinMeeting(meetingIdOrCode, passcode)
      : await apiService.joinMeetingByCode(meetingIdOrCode.toUpperCase(), passcode);

    if (result.error) {
      message.error(result.error);
      return;
    }
    if (result.data) {
      setJoinOpen(false);
      joinForm.resetFields();
      router.push(`/meeting/${result.data.meetingId}`);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isNarrow ? 16 : 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 260 }}>
            <Title level={3} style={{ margin: 0 }}>
              Chào mừng trở lại, {user?.fullName}
            </Title>
            <Text type="secondary">
              Hôm nay bạn có {stats?.activeMeetings ?? 0} cuộc họp đang diễn ra. Chúc một ngày làm việc hiệu quả!
            </Text>
          </div>

          <Space wrap>
            <Button onClick={() => setJoinOpen(true)} icon={<RightCircleOutlined />}>
              Nhập mã tham gia
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)} icon={<PlusOutlined />}>
              Tạo cuộc họp mới
            </Button>
          </Space>
        </div>

        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#e6f4ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1677ff',
                    fontSize: 18,
                  }}
                >
                  <VideoCameraOutlined />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">Tổng cuộc họp đã tạo</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: '28px' }}>{stats.totalMeetings}</div>
                </div>
              </div>
            </Card>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#eafff2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#22c55e',
                    fontSize: 18,
                  }}
                >
                  <span style={{ fontWeight: 800 }}>👥</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">Đang diễn ra</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, lineHeight: '28px' }}>{stats.activeMeetings}</div>
                    {stats.activeMeetings > 0 && <Tag color="green">Live</Tag>}
                  </div>
                </div>
              </div>
            </Card>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                    fontSize: 18,
                  }}
                >
                  <CalendarOutlined />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">Sắp diễn ra hôm nay</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: '28px' }}>{stats.todayMeetings}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card
          bodyStyle={{ padding: 0 }}
          bordered={false}
          style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)' }}
          title={<span style={{ fontWeight: 700 }}>Lịch trình &amp; Gần đây</span>}
          extra={
            <Button type="link" onClick={() => router.push('/meetings')} style={{ padding: 0 }}>
              Xem tất cả →
            </Button>
          }
        >
          <Table<HomeMeetingRow>
            rowKey="id"
            loading={loadingHome}
            dataSource={recentMeetings}
            pagination={false}
            tableLayout="fixed"
            scroll={{ x: isNarrow ? 860 : undefined }}
            columns={homeScheduleColumns as any}
            locale={{
              emptyText: <div style={{ padding: 16 }}><Text type="secondary">Chưa có dữ liệu.</Text></div>,
            }}
          />
        </Card>
      </div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Lịch sử cuộc họp
              </Typography.Title>
              <Typography.Text type="secondary" style={{ display: 'block' }}>
                {historyMeeting ? historyMeeting.title : 'Xem lịch sử tham gia'}
              </Typography.Text>
            </div>
            <Space>
              <Button
                icon={<FileExcelOutlined />}
                onClick={() => exportHistoryToExcel()}
                loading={exportingHistoryExcel}
                disabled={historyLoading || historyItems.length === 0}
              >
                Xuất Excel
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => historyMeeting && void openHistoryModal(historyMeeting)}
                loading={historyLoading}
              >
                Làm mới
              </Button>
            </Space>
          </div>
        }
        open={Boolean(historyMeeting)}
        onCancel={() => {
          setHistoryMeeting(null);
          setHistoryItems([]);
          setHistoryTablePage(1);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setHistoryMeeting(null);
                setHistoryItems([]);
                setHistoryTablePage(1);
              }}
            >
              Đóng
            </Button>
          </div>
        }
        destroyOnHidden
        width={1200}
        style={{ maxWidth: 'calc(100vw - 32px)' }}
        styles={{ body: { background: '#f5f7fb' } }}
      >
        <Card bordered={false} style={{ borderRadius: 14 }}>
          <Table<HistoryEntry>
            rowKey="id"
            loading={historyLoading}
            dataSource={historyItems}
            tableLayout="fixed"
            pagination={{
              current: historyTablePage,
              pageSize: historyTablePageSize,
              total: historyItems.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              onChange: (page, pageSize) => {
                setHistoryTablePage(page);
                setHistoryTablePageSize(pageSize);
              },
            }}
            locale={{
              emptyText: historyLoading ? 'Đang tải...' : <Empty description="Chưa có lịch sử cuộc họp" />,
            }}
            columns={[
              {
                title: 'STT',
                key: 'stt',
                width: 70,
                align: 'center',
                render: (_v, _r, index) =>
                  (historyTablePage - 1) * historyTablePageSize + index + 1,
              },
              {
                title: 'Người dùng',
                dataIndex: 'username',
                key: 'username',
                render: (_v: string, r: HistoryEntry) => r.fullName?.trim() || r.username,
              },
              {
                title: 'Vào lúc',
                dataIndex: 'joinedAt',
                key: 'joinedAt',
                width: 170,
                render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '-'),
              },
              {
                title: 'Rời lúc',
                dataIndex: 'leftAt',
                key: 'leftAt',
                width: 170,
                render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : 'Đang tham gia'),
              },
              {
                title: 'Thời lượng',
                dataIndex: 'duration',
                key: 'duration',
                width: 240,
                align: 'right',
                ellipsis: false,
                render: (_v: number | null, r: HistoryEntry) => (
                  <span style={{ whiteSpace: 'nowrap' }}>{formatHistoryParticipationDuration(r)}</span>
                ),
              },
            ]}
          />
        </Card>
      </Modal>

      <Modal
        open={Boolean(detailMeeting)}
        onCancel={() => setDetailMeeting(null)}
        footer={null}
        centered
        destroyOnHidden
        width={560}
      >
        {detailMeeting && (
          <div style={{ padding: '4px 4px 0 4px' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {detailMeeting.title}
            </Typography.Title>
            <Typography.Text type="secondary">
              Sắp diễn ra • {dayjs(detailMeeting.createdAt).format('DD/MM/YYYY, HH:mm')}
            </Typography.Text>

            <Card
              style={{ marginTop: 14, borderRadius: 10, background: '#fafcff' }}
              bodyStyle={{ padding: 14 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  rowGap: 14,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Typography.Text type="secondary">Mã tham gia:</Typography.Text>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    justifySelf: 'start',
                    background: '#fff',
                    border: '1px solid #d9e2f0',
                    borderRadius: 6,
                    padding: '4px 8px',
                  }}
                >
                  <Typography.Text strong>{detailMeeting.meetingCode}</Typography.Text>
                  <CopyOutlined
                    style={{ color: '#8c8c8c', cursor: 'pointer' }}
                    onClick={() => void copyText(detailMeeting.meetingCode)}
                  />
                </div>

                <Typography.Text type="secondary">Host</Typography.Text>
                <Space>
                  <Avatar size={24} icon={<UserOutlined />} />
                  <Typography.Text strong>{detailMeeting.hostName}</Typography.Text>
                </Space>
              </div>

              <div style={{ borderTop: '1px solid #edf1f7', paddingTop: 12 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  Link tham gia trực tiếp:
                </Typography.Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input readOnly value={buildMeetingLink(detailMeeting.id)} />
                  <Button onClick={() => void copyText(buildMeetingLink(detailMeeting.id))}>Copy Link</Button>
                </Space.Compact>
              </div>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button onClick={() => setDetailMeeting(null)}>Đóng</Button>
              <Button
                type="primary"
                onClick={() => {
                  router.push(`/meeting/${detailMeeting.id}`);
                }}
              >
                Tham gia ngay
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Meeting Modal - Nâng cấp Success State */}
      <Modal
        title={!createdMeeting ? 'Lên lịch cuộc họp mới' : null}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreatedMeeting(null);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        width={720}
        centered
      >
        {createdMeeting ? (
          <Result
            status="success"
            title="Tạo cuộc họp thành công!"
            subTitle="Phòng họp của bạn đã sẵn sàng. Hãy chia sẻ thông tin dưới đây cho người tham gia."
            style={{ padding: '24px 0 0 0' }}
            extra={
              <div style={{ textAlign: 'left', background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginTop: 24 }}>
                <Descriptions column={1} size="small" labelStyle={{ fontWeight: 600, width: '100px' }}>
                  <Descriptions.Item label="Mã phòng">
                    <Space>
                      <Text copyable={{ text: createdMeeting.code }} style={{ fontSize: 16, color: '#1890ff', fontWeight: 600 }}>
                        {createdMeeting.code}
                      </Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Passcode">
                    <Space>
                      <Text copyable={{ text: createdMeeting.passcode }} style={{ fontSize: 16, fontWeight: 600 }}>
                        {createdMeeting.passcode}
                      </Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Link chia sẻ">
                    <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                      <Input
                        value={buildMeetingLink(createdMeeting.id)}
                        readOnly
                        style={{ background: '#fff' }}
                      />
                      <Button
                        type="primary"
                        icon={<CopyOutlined />}
                        onClick={() => void copyText(buildMeetingLink(createdMeeting.id), 'Đã copy link')}
                      />
                    </Space.Compact>
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                  <Button
                    size="large"
                    onClick={() => {
                      setCreateOpen(false);
                      setCreatedMeeting(null);
                      createForm.resetFields();
                    }}
                  >
                    Đóng
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<RightCircleOutlined />}
                    onClick={() => {
                      setCreateOpen(false);
                      setCreatedMeeting(null);
                      createForm.resetFields();
                      router.push(`/meeting/${createdMeeting.id}`);
                    }}
                  >
                    Tham gia phòng ngay
                  </Button>
                </div>
              </div>
            }
          />
        ) : (
          <Form
            form={createForm}
            layout="vertical"
            initialValues={{
              hostName: user?.username || '',
              scheduleRange: [dayjs(), dayjs().add(1, 'hour')],
              allowJoinBeforeHost: false,
              muteOnJoin: true,
              recordOnServer: false,
            }}
            onFinish={() => void onCreateMeeting()}
            style={{ marginTop: 8 }}
          >
            <Form.Item
              label={<Text strong>Tiêu đề cuộc họp</Text>}
              name="title"
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề cuộc họp' }]}
            >
              <Input
                size="large"
                placeholder="Nhập tiêu đề cuộc họp"
                prefix={<VideoCameraOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Form.Item>

            <Form.Item label={<Text strong>Thời gian cuộc họp dự kiến</Text>} name="scheduleRange">
              <DatePicker.RangePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
                allowClear={false}
              />
            </Form.Item>
            <div style={{ marginTop: -4, marginBottom: 8 }}>
              <Text type="secondary">Thời lượng dự kiến: </Text>
              <Text strong>{estimatedDurationLabel}</Text>
            </div>

            <Divider style={{ margin: '12px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Tuỳ chọn khác
            </Text>
            <Form.Item name="allowJoinBeforeHost" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Cho phép người tham gia vào trước Host</Checkbox>
            </Form.Item>
            <Form.Item name="muteOnJoin" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Tắt micro của người tham gia khi vào phòng</Checkbox>
            </Form.Item>
            <Form.Item name="recordOnServer" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Tự động ghi hình cuộc họp trên máy chủ</Checkbox>
            </Form.Item>

            {/* giữ hostName để không đổi API, nhưng ẩn đi */}
            <Form.Item name="hostName" hidden>
              <Input />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 32 }}>
              <Button
                size="large"
                onClick={() => {
                  setCreateOpen(false);
                  createForm.resetFields();
                }}
              >
                Hủy
              </Button>
              <Button type="primary" size="large" htmlType="submit" loading={creating} icon={<CalendarOutlined />}>
                Lên lịch
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* Join Meeting Modal - UI tinh chỉnh mượt mà hơn */}
      <Modal
        title={null}
        open={joinOpen}
        onCancel={() => {
          setJoinOpen(false);
          joinForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        centered
        width={450}
      >
        <div style={{ textAlign: 'center', marginBottom: 24, marginTop: 12 }}>
          <div style={{ background: '#f0f5ff', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
             <RightCircleOutlined style={{ fontSize: 32, color: '#2f54eb' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>Tham gia cuộc họp</Title>
          <Text type="secondary">Nhập thông tin phòng họp được chia sẻ với bạn</Text>
        </div>

        <Form
          form={joinForm}
          layout="vertical"
          onFinish={() => void onJoinMeeting()}
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="meetingIdOrCode"
            rules={[{ required: true, message: 'Vui lòng nhập Meeting ID hoặc Code' }]}
          >
            <Input
              placeholder="Nhập Mã phòng (Code) hoặc Link ID"
              prefix={<VideoCameraOutlined style={{ color: '#bfbfbf' }}/>}
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item
            name="passcode"
            rules={[{ required: true, message: 'Vui lòng nhập passcode' }]}
          >
            <Input
              placeholder="Nhập Passcode (6 chữ số)"
              maxLength={6}
              autoComplete="new-password"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" style={{ marginTop: 8 }}>
            Tham gia ngay
          </Button>
        </Form>
      </Modal>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .dark-theme .ant-card {
            background: rgba(15, 23, 42, 0.65);
            border: 1px solid rgba(148, 163, 184, 0.16);
          }
          `,
        }}
      />
    </MainLayout>
  );
}