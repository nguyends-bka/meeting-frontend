import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminApi, apiService } from '@/services/api';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { App, Form, Grid } from 'antd';
import { HomeMeetingRow, HistoryEntry } from './types';
import {
  isMeetingLive,
  pickHeroMeeting,
  formatDurationFromScheduleRange,
  formatHistoryParticipationDuration,
} from './helpers';

export function useHomePage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = !screens.lg;
  const isWideHome = Boolean(screens.xxl);
  const isCompactStats = !isWideHome && screens.lg;
  const statScale = isCompactStats ? 0.85 : 1;
  const ss = (n: number) => Math.round(n * statScale);

  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  // --- Core States ---
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

  const [allMeetings, setAllMeetings] = useState<HomeMeetingRow[]>([]);
  const [recentMeetings, setRecentMeetings] = useState<HomeMeetingRow[]>([]);
  const [liveHighlight, setLiveHighlight] = useState<HomeMeetingRow | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<HomeMeetingRow | null>(null);
  const [historyMeeting, setHistoryMeeting] = useState<HomeMeetingRow | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTablePage, setHistoryTablePage] = useState(1);
  const [historyTablePageSize, setHistoryTablePageSize] = useState(10);
  const [exportingHistoryExcel, setExportingHistoryExcel] = useState(false);

  // --- 1. Calendar Strip States ---
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());

  const [createForm] = Form.useForm();
  const scheduleRangeWatch = Form.useWatch('scheduleRange', createForm);
  const estimatedDurationLabel = useMemo(
    () => formatDurationFromScheduleRange(scheduleRangeWatch as [dayjs.Dayjs, dayjs.Dayjs] | undefined),
    [scheduleRangeWatch],
  );
  const [joinForm] = Form.useForm();

  const openJoinModal = useCallback(() => {
    setJoinOpen(true);
    queueMicrotask(() => {
      joinForm.setFieldsValue({ passcode: '' });
    });
  }, [joinForm]);

  const closeJoinModal = useCallback(() => {
    setJoinOpen(false);
    joinForm.resetFields();
  }, [joinForm]);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
    setCreatedMeeting(null);
    createForm.resetFields();
  }, [createForm]);

  const closeHistoryModal = useCallback(() => {
    setHistoryMeeting(null);
    setHistoryItems([]);
    setHistoryTablePage(1);
  }, []);

  const handleHistoryPageChange = useCallback((page: number, pageSize: number) => {
    setHistoryTablePage(page);
    setHistoryTablePageSize(pageSize);
  }, []);

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

      let rows: HomeMeetingRow[] = [];

      if (isAdmin) {
        const res = await adminApi.getAllMeetings();
        const meetings = (res.data ?? []) as any[];
        rows = meetings.map((m) => ({
          id: m.id,
          title: m.title,
          hostName: m.hostName,
          hostIdentity: m.hostIdentity ?? '',
          isMeetingHost: Boolean(m.isMeetingHost),
          meetingCode: m.meetingCode,
          passcode: m.passcode ?? '',
          createdAt: m.createdAt,
          activeParticipantCount: m.activeParticipantCount,
          startedAt: m.startedAt,
          endedAt: m.endedAt,
        }));
      } else {
        const result = await apiService.getMeetings();
        const meetings = (result.data ?? []) as any[];
        rows = meetings.map((m) => ({
          id: m.id,
          title: m.title,
          hostName: m.hostName,
          hostIdentity: m.hostIdentity ?? '',
          isMeetingHost: Boolean(m.isMeetingHost),
          meetingCode: m.meetingCode,
          passcode: m.passcode ?? '',
          createdAt: m.createdAt,
          startedAt: m.startedAt,
          endedAt: m.endedAt,
          activeParticipantCount: m.activeParticipantCount,
        }));
      }

      setAllMeetings(rows);

      // Sort and slice for recent meetings
      const sortedRows = [...rows].sort((a, b) => {
        const aEnded = Boolean(a.endedAt);
        const bEnded = Boolean(b.endedAt);
        const aLive = isMeetingLive(a);
        const bLive = isMeetingLive(b);
        if (aLive !== bLive) return aLive ? -1 : 1;
        if (aEnded !== bEnded) return aEnded ? 1 : -1;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
      setRecentMeetings(sortedRows.slice(0, 15));
      setLiveHighlight(pickHeroMeeting(rows));

      const weekStart = dayjs().startOf('isoWeek');
      const createdThisWeek = rows.filter((r) => !dayjs(r.createdAt).isBefore(weekStart)).length;

      const todayCount = rows.filter((r) => {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
          2,
          '0',
        )}`;
        return key === todayKey;
      }).length;

      const active = rows.filter((r) => isMeetingLive(r)).length;
      
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
      setCreatedMeeting({
        id: result.data.meetingId,
        code: result.data.meetingCode,
        passcode: result.data.passcode,
      });
      await loadStats();
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
        message.success(_successMsg);
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

  const refreshHistory = useCallback(() => {
    if (historyMeeting) {
      void openHistoryModal(historyMeeting);
    }
  }, [historyMeeting, openHistoryModal]);

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

  // --- 1. Filtered schedule based on calendar strip ---
  const selectedDaySchedule = useMemo(() => {
    return allMeetings
      .filter((m) => dayjs(m.createdAt).isSame(selectedDate, 'day'))
      .sort((a, b) => +dayjs(a.createdAt) - +dayjs(b.createdAt));
  }, [allMeetings, selectedDate]);

  const pendingForYou = useMemo(() => {
    if (!stats) return 0;
    const extra = allMeetings.filter(
      (r) => dayjs(r.createdAt).isSame(dayjs(), 'day') && !r.endedAt && !isMeetingLive(r)
    ).length;
    return (stats.activeMeetings ?? 0) + extra;
  }, [allMeetings, stats]);

  const greetingWord = useMemo(() => {
    const h = dayjs().hour();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }, []);

  return {
    screens,
    isNarrow,
    isWideHome,
    isCompactStats,
    statScale,
    ss,
    router,
    user,
    isAuthenticated,
    loading,
    isAdmin,
    createOpen,
    setCreateOpen,
    joinOpen,
    setJoinOpen,
    creating,
    loadingHome,
    createdMeeting,
    setCreatedMeeting,
    stats,
    allMeetings,
    recentMeetings,
    liveHighlight,
    selectedDaySchedule,
    detailMeeting,
    setDetailMeeting,
    historyMeeting,
    setHistoryMeeting,
    historyItems,
    historyLoading,
    historyTablePage,
    historyTablePageSize,
    exportingHistoryExcel,
    createForm,
    estimatedDurationLabel,
    joinForm,
    openJoinModal,
    closeJoinModal,
    closeCreateModal,
    closeHistoryModal,
    handleHistoryPageChange,
    refreshHistory,
    onCreateMeeting,
    buildMeetingLink,
    copyText,
    openHistoryModal,
    exportHistoryToExcel,
    onJoinMeeting,
    pendingForYou,
    greetingWord,
    selectedDate,
    setSelectedDate,
  };
}
