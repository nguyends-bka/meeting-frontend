'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminApi, apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/vi';
import * as XLSX from 'xlsx';
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
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
  BellOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

dayjs.extend(isoWeek);
dayjs.locale('vi');

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

function isMeetingLive(r: HomeMeetingRow): boolean {
  return !r.endedAt && (r.activeParticipantCount ?? 0) > 0;
}

function meetingRowStatus(r: HomeMeetingRow): 'live' | 'ended' | 'upcoming' {
  if (isMeetingLive(r)) return 'live';
  if (r.endedAt) return 'ended';
  return 'upcoming';
}

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
  /** Màn rộng (vd. 1920×1200): tận dụng gần hết vùng content sau sidebar */
  const isWideHome = Boolean(screens.xxl);
  // "Thu nhỏ" = không phải màn hình lớn (xxl), nhưng vẫn >= lg (vd tablet/desktop nhỏ).
  // Khi thu nhỏ vẫn hiển thị 3 thẻ thống kê trên 1 hàng (không chuyển sang 1 cột).
  const isCompactStats = !isWideHome && screens.lg;
  const statScale = isCompactStats ? 0.85 : 1;
  const ss = (n: number) => Math.round(n * statScale);

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
    createdThisWeek: number;
    joinedSessionsTotal: number;
  } | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<HomeMeetingRow[]>([]);
  const [liveHighlight, setLiveHighlight] = useState<HomeMeetingRow | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<HomeMeetingRow[]>([]);
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

  const openJoinModal = useCallback(
    () => {
      setJoinOpen(true);
      queueMicrotask(() => {
        joinForm.setFieldsValue({ passcode: '' });
      });
    },
    [joinForm],
  );

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
          const aLive = isMeetingLive(a);
          const bLive = isMeetingLive(b);
          if (aLive !== bLive) return aLive ? -1 : 1;
          if (aEnded !== bEnded) return aEnded ? 1 : -1;
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        });
        setRecentMeetings(rows.slice(0, 15));
        const weekStart = dayjs().startOf('isoWeek');
        const createdThisWeek = rows.filter((r) => !dayjs(r.createdAt).isBefore(weekStart)).length;
        setTodaySchedule(
          rows
            .filter((r) => dayjs(r.createdAt).isSame(dayjs(), 'day'))
            .sort((a, b) => +dayjs(a.createdAt) - +dayjs(b.createdAt)),
        );
        setLiveHighlight(rows.find((r) => isMeetingLive(r)) ?? null);

        const active = rows.filter((r) => isMeetingLive(r)).length;
        const todayCount = rows.filter((r) => {
          const d = new Date(r.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
            2,
            '0',
          )}`;
          return key === todayKey;
        }).length;
        let joinedSessionsTotal = 0;
        const histRes = await apiService.getMyHistory();
        if (histRes.data && Array.isArray(histRes.data)) {
          joinedSessionsTotal = histRes.data.length;
        }
        setStats({
          totalMeetings: rows.length,
          activeMeetings: active,
          todayMeetings: todayCount,
          createdThisWeek,
          joinedSessionsTotal,
        });
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
        const aLive = isMeetingLive(a);
        const bLive = isMeetingLive(b);
        if (aLive !== bLive) return aLive ? -1 : 1;
        if (aEnded !== bEnded) return aEnded ? 1 : -1;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
      setRecentMeetings(rows.slice(0, 15));
      const weekStart = dayjs().startOf('isoWeek');
      const createdThisWeek = rows.filter((r) => !dayjs(r.createdAt).isBefore(weekStart)).length;
      setTodaySchedule(
        rows
          .filter((r) => dayjs(r.createdAt).isSame(dayjs(), 'day'))
          .sort((a, b) => +dayjs(a.createdAt) - +dayjs(b.createdAt)),
      );
      setLiveHighlight(rows.find((r) => isMeetingLive(r)) ?? null);

      const todayCount = rows.filter((r) => {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
          2,
          '0',
        )}`;
        return key === todayKey;
      }).length;
      const activeUser = rows.filter((r) => isMeetingLive(r)).length;
      let joinedSessionsTotal = 0;
      const histRes = await apiService.getMyHistory();
      if (histRes.data && Array.isArray(histRes.data)) {
        joinedSessionsTotal = histRes.data.length;
      }
      setStats({
        totalMeetings: rows.length,
        activeMeetings: activeUser,
        todayMeetings: todayCount,
        createdThisWeek,
        joinedSessionsTotal,
      });
    } finally {
      setLoadingHome(false);
    }
  };

  const onCreateMeeting = async () => {
    const values = await createForm.validateFields();
    const title = String(values.title || '').trim();
    const finalHostName = String(values.hostName || '').trim() || user?.username || 'Host';
    const scheduleRange = values.scheduleRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const startAt = scheduleRange?.[0]?.valueOf();
    const estimatedEndAt = scheduleRange?.[1]?.valueOf();

    setCreating(true);
    const result = await apiService.createMeeting(
      title,
      finalHostName,
      undefined,
      typeof startAt === 'number' ? startAt : undefined,
      typeof estimatedEndAt === 'number' ? estimatedEndAt : null,
    );
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

  const pendingForYou = useMemo(() => {
    if (!stats) return 0;
    const extra = todaySchedule.filter((r) => !r.endedAt && !isMeetingLive(r)).length;
    return (stats.activeMeetings ?? 0) + extra;
  }, [todaySchedule, stats]);

  const homeNotifications = useMemo(() => {
    const items: {
      key: string;
      title: string;
      desc: string;
      time: string;
      kind: 'info' | 'success' | 'warn';
    }[] = [];
    for (const r of recentMeetings) {
      const st = meetingRowStatus(r);
      const t = dayjs(r.createdAt);
      if (st === 'live') {
        items.push({
          key: `live-${r.id}`,
          title: 'Cuộc họp đang diễn ra',
          desc: `"${r.title}" có người trong phòng.`,
          time: t.format('HH:mm'),
          kind: 'info',
        });
      } else if (st === 'ended') {
        items.push({
          key: `end-${r.id}`,
          title: 'Đã kết thúc',
          desc: `"${r.title}" đã hoàn tất.`,
          time: t.format('DD/MM HH:mm'),
          kind: 'success',
        });
      } else if (t.isSame(dayjs(), 'day')) {
        items.push({
          key: `up-${r.id}`,
          title: 'Sắp diễn ra',
          desc: `"${r.title}" — dự kiến ${t.format('HH:mm')}.`,
          time: t.format('HH:mm'),
          kind: 'warn',
        });
      }
    }
    if (items.length === 0) {
      items.push({
        key: 'empty',
        title: 'Chưa có hoạt động gần đây',
        desc: 'Khi có cuộc họp mới, thông báo sẽ hiển thị tại đây.',
        time: '',
        kind: 'info',
      });
    }
    return items.slice(0, 6);
  }, [recentMeetings]);

  const greetingWord = (() => {
    const h = dayjs().hour();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  const heroSection = useMemo(() => {
    if (!liveHighlight) return null;
    const start = dayjs(liveHighlight.startedAt || liveHighlight.createdAt);
    const end = liveHighlight.endedAt ? dayjs(liveHighlight.endedAt) : start.add(1, 'hour');
    return (
      <div
        style={{
          borderRadius: 16,
          padding: isNarrow ? 18 : 24,
          marginBottom: 16,
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
          border: '1px solid #e5e7eb',
        }}
      >
        <Space style={{ marginBottom: 10 }} wrap size={[8, 8]}>
          <Tag color="success" style={{ margin: 0, fontWeight: 700, border: 'none' }}>
            ĐANG DIỄN RA
          </Tag>
          <Text style={{ color: '#64748b', fontSize: 13 }}>
            Hôm nay, {dayjs().format('DD/MM/YYYY')}
          </Text>
        </Space>
        <Title level={3} style={{ margin: 0, color: '#0f172a' }}>
          {liveHighlight.title}
        </Title>
        <div style={{ marginTop: 12, opacity: 0.95, fontSize: 14 }}>
          <div>
            {start.format('HH:mm')} – {end.format('HH:mm')}
          </div>
          <div style={{ marginTop: 4 }}>Host: {liveHighlight.hostName}</div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 12,
            background: '#ffffff',
            border: '1px solid #dbe2ea',
          }}
        >
          <div style={{ fontSize: 13 }}>
            <Text style={{ color: '#64748b' }}>Mã phòng: </Text>
            <Text strong style={{ color: '#0f172a' }}>
              {liveHighlight.meetingCode}
            </Text>
          </div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            <Text style={{ color: '#64748b' }}>Passcode: </Text>
            <Text strong style={{ color: '#0f172a' }}>
              {liveHighlight.passcode || '—'}
            </Text>
          </div>
        </div>
        <Space style={{ marginTop: 18 }} wrap>
          <Button
            type="default"
            size="large"
            icon={<CaretRightOutlined />}
            onClick={() => router.push(`/meeting/${liveHighlight.id}`)}
            style={{ fontWeight: 600, color: '#1e3a8a' }}
          >
            Tham gia ngay
          </Button>
          <Button
            size="large"
            onClick={() => setDetailMeeting(liveHighlight)}
            style={{ borderColor: '#cbd5e1', color: '#334155' }}
          >
            Chi tiết
          </Button>
        </Space>
      </div>
    );
  }, [liveHighlight, isNarrow, router]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div
        style={{
          width: '100%',
          maxWidth: isNarrow ? undefined : 'min(1720px, 100%)',
          margin: '0 auto',
          padding: isNarrow ? 16 : isWideHome ? 28 : 24,
          boxSizing: 'border-box',
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card
              bordered={false}
              style={{
                borderRadius: 12,
                marginBottom: 16,
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                  <Title level={3} style={{ margin: 0 }}>
                    {greetingWord}, {user?.fullName}! 👋
                  </Title>
                  <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 15 }}>
                    Hôm nay là {dayjs().format('dddd')}, {dayjs().format('D')} tháng {dayjs().format('MM')} năm{' '}
                    {dayjs().format('YYYY')}. Bạn có <Text strong>{pendingForYou}</Text> cuộc họp đang chờ.
                  </Text>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    gap: 10,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    flex: '0 0 auto',
                  }}
                >
                  <Button size="large" icon={<RightCircleOutlined />} onClick={openJoinModal}>
                    Tham gia
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => setCreateOpen(true)}
                    icon={<PlusOutlined />}
                    style={{ fontWeight: 600, background: '#2563eb', borderColor: '#2563eb' }}
                  >
                    Tạo cuộc họp mới
                  </Button>
                </div>
              </div>
            </Card>

            {heroSection}

            <Card
              bordered={false}
              style={{ borderRadius: 12, marginBottom: 16, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)' }}
              title={<span style={{ fontWeight: 700 }}>Lịch trình hôm nay</span>}
              extra={
                <Button type="link" onClick={() => router.push('/meetings')} style={{ padding: 0 }}>
                  Xem lịch đầy đủ →
                </Button>
              }
            >
              {loadingHome ? (
                <Text type="secondary">Đang tải…</Text>
              ) : todaySchedule.length === 0 ? (
                <Text type="secondary">Chưa có cuộc họp nào được tạo hôm nay.</Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {todaySchedule.map((m, index) => {
                    const st = meetingRowStatus(m);
                    const when = dayjs(m.createdAt);
                    const dot =
                      st === 'live' ? '#22c55e' : st === 'ended' ? '#94a3b8' : '#2563eb';
                    const tag =
                      st === 'live' ? (
                        <Tag color="success">Đang diễn ra</Tag>
                      ) : st === 'ended' ? (
                        <Tag>Đã kết thúc</Tag>
                      ) : (
                        <Tag color="processing">Sắp diễn ra</Tag>
                      );
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          gap: 14,
                          alignItems: 'stretch',
                          padding: '14px 0',
                          borderBottom: index < todaySchedule.length - 1 ? '1px solid #f1f5f9' : undefined,
                        }}
                      >
                        <Text strong style={{ width: 52, flexShrink: 0, fontSize: 15, lineHeight: '24px' }}>
                          {when.format('HH:mm')}
                        </Text>
                        <div
                          style={{
                            position: 'relative',
                            width: 20,
                            flexShrink: 0,
                            display: 'flex',
                            justifyContent: 'center',
                          }}
                        >
                          {index < todaySchedule.length - 1 ? (
                            <div
                              style={{
                                position: 'absolute',
                                top: 18,
                                bottom: -14,
                                left: '50%',
                                width: 2,
                                marginLeft: -1,
                                background: '#e2e8f0',
                                borderRadius: 1,
                              }}
                            />
                          ) : null}
                          <div
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: dot,
                              marginTop: 6,
                              zIndex: 1,
                              border: '2px solid #fff',
                              boxShadow: `0 0 0 1px ${dot}`,
                              flexShrink: 0,
                            }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Space wrap size={[8, 4]}>
                            <Text strong style={{ fontSize: 15 }}>
                              {m.title}
                            </Text>
                            {tag}
                          </Space>
                          <div style={{ marginTop: 6 }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                              Host: {m.hostName}
                            </Text>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            {stats && (
              <Card
                bordered={false}
                style={{ borderRadius: 12, marginBottom: 16, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)' }}
                title={<span style={{ fontWeight: 700 }}>Tổng quan cá nhân</span>}
              >
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={12}>
                    <div
                      style={{
                        padding: ss(14),
                        borderRadius: ss(12),
                        background: '#f0f7ff',
                        border: '1px solid #dbeafe',
                        height: '100%',
                      }}
                    >
                      <VideoCameraOutlined style={{ fontSize: ss(22), color: '#2563eb' }} />
                      <div style={{ fontSize: ss(26), fontWeight: 800, marginTop: ss(8), color: '#0f172a' }}>
                        {stats.createdThisWeek}
                      </div>
                      <Text type="secondary" style={{ fontSize: ss(12), display: 'block', marginTop: 4 }}>
                        Đã tạo tuần này
                      </Text>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <div
                      style={{
                        padding: ss(14),
                        borderRadius: ss(12),
                        background: '#ecfdf5',
                        border: '1px solid #bbf7d0',
                        height: '100%',
                        cursor: 'pointer',
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push('/history')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') router.push('/history');
                      }}
                    >
                      <CheckCircleOutlined style={{ fontSize: ss(22), color: '#16a34a' }} />
                      <div style={{ fontSize: ss(26), fontWeight: 800, marginTop: ss(8), color: '#0f172a' }}>
                        {stats.joinedSessionsTotal}
                      </div>
                      <Text type="secondary" style={{ fontSize: ss(12), display: 'block', marginTop: 4 }}>
                        Đã tham gia (lượt)
                      </Text>
                    </div>
                  </Col>
                </Row>
              </Card>
            )}

            <Card
              bordered={false}
              style={{ borderRadius: 12, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)' }}
              title={
                <Space>
                  <BellOutlined />
                  <span style={{ fontWeight: 700 }}>Thông báo mới</span>
                </Space>
              }
              extra={
                <Button type="link" onClick={() => router.push('/history')} style={{ padding: 0 }}>
                  Xem tất cả
                </Button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {homeNotifications.map((n) => {
                  const icon =
                    n.kind === 'success' ? (
                      <FolderOpenOutlined style={{ color: '#16a34a', fontSize: 18 }} />
                    ) : n.kind === 'warn' ? (
                      <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 18 }} />
                    ) : (
                      <InfoCircleOutlined style={{ color: '#2563eb', fontSize: 18 }} />
                    );
                  return (
                    <div key={n.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>
                          {n.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
                          {n.desc}
                        </Text>
                        {n.time ? (
                          <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                            {n.time}
                          </Text>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </Col>
        </Row>
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