'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { Card, Row, Col, Typography, Button, Input, Tag, Empty, Grid, Form, App, DatePicker, Tooltip } from 'antd';
import {
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  SearchOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService, adminApi } from '@/services/api';
import { HomeMeetingRow } from '@/app/_home/types';
import { meetingRowStatus, formatDurationFromScheduleRange, getHostNameOnly, getVirtualRoom } from '@/app/_home/helpers';
import CreateMeetingModal from '@/app/_home/components/CreateMeetingModal';
import MeetingDetailModal from '@/app/_home/components/MeetingDetailModal';
import './calendar.css';

const { Title, Text } = Typography;

const STAT_CARDS = [
  { key: 'all', label: 'Tất cả cuộc họp', unit: 'phiên họp', color: '#2563eb', icon: <CalendarOutlined /> },
  { key: 'ongoing', label: 'Đang diễn ra', unit: 'đang họp', color: '#059669', icon: <VideoCameraOutlined /> },
  { key: 'upcoming', label: 'Lên lịch sắp tới', unit: 'chờ diễn ra', color: '#2563eb', icon: <ClockCircleOutlined /> },
  { key: 'completed', label: 'Đã hoàn thành', unit: 'đã xong', color: '#d97706', icon: <CheckCircleOutlined /> },
] as const;

export default function CalendarPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, isAdmin } = useAuth();
  const { message } = App.useApp();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = !screens.md;

  // --- States ---
  const [currentDate, setCurrentDate] = useState<dayjs.Dayjs>(dayjs());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, ongoing, upcoming, completed
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [listMode, setListMode] = useState<'all' | 'date'>('date'); // Danh sách: Tất cả | Theo ngày
  const [listDate, setListDate] = useState<dayjs.Dayjs>(dayjs());     // ngày đang xem (khi listMode='date')
  const [meetings, setMeetings] = useState<HomeMeetingRow[]>([]);
  const [loading, setLoading] = useState(false);

  // --- Modals State ---
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<{
    id: string;
    code: string;
    passcode: string;
  } | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<HomeMeetingRow | null>(null);

  const [createForm] = Form.useForm();
  const scheduleRangeWatch = Form.useWatch('scheduleRange', createForm);
  const estimatedDurationLabel = useMemo(
    () => formatDurationFromScheduleRange(scheduleRangeWatch as [dayjs.Dayjs, dayjs.Dayjs] | undefined),
    [scheduleRangeWatch],
  );

  // --- Check Auth ---
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // --- Fetch Meetings ---
  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      let rows: HomeMeetingRow[] = [];
      if (isAdmin) {
        const res = await adminApi.getAllMeetings();
        const meetingsData = (res.data ?? []) as any[];
        rows = meetingsData.map((m) => ({
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
          location: m.location,
          status: m.status,
          estimatedEndAt: m.estimatedEndAt,
        }));
      } else {
        const result = await apiService.getMeetings();
        const meetingsData = (result.data ?? []) as any[];
        rows = meetingsData.map((m) => ({
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
          location: m.location,
          status: m.status,
          estimatedEndAt: m.estimatedEndAt,
        }));
      }
      setMeetings(rows);
    } catch (e) {
      console.error(e);
      message.error('Không thể tải danh sách cuộc họp');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, message]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchMeetings();
    }
  }, [isAuthenticated, fetchMeetings]);

  // --- Helpers ---
  const copyText = useCallback(
    async (text: string, successMsg = 'Đã copy') => {
      try {
        await navigator.clipboard.writeText(text);
        message.success(successMsg);
      } catch {
        message.error('Không thể sao chép. Vui lòng thử lại.');
      }
    },
    [message],
  );

  const buildMeetingLink = useCallback((meetingId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/meeting/${meetingId}`;
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateOpen(false);
    setCreatedMeeting(null);
    createForm.resetFields();
  }, [createForm]);

  const onCreateMeeting = async () => {
    const values = await createForm.validateFields();
    const title = String(values.title || '').trim();
    const baseHostName = String(values.hostName || '').trim() || user?.username || 'Host';
    const roomName = values.selectedRoom === 'Khác' ? String(values.customRoom || '').trim() : values.selectedRoom;
    const scheduleRange = values.scheduleRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
    const startAt = scheduleRange?.[0]?.valueOf();
    const estimatedEndAt = scheduleRange?.[1]?.valueOf();

    setCreating(true);
    const result = await apiService.createMeeting(
      title,
      baseHostName,
      roomName,
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
      void fetchMeetings();
    }
  };

  // --- Filtering & Stats ---
  const filteredMeetings = useMemo(() => {
    return meetings.filter((meet) => {
      const matchSearch =
        meet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meet.hostName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meet.meetingCode.toLowerCase().includes(searchTerm.toLowerCase());

      const status = meetingRowStatus(meet);
      let matchStatus = true;
      if (statusFilter === 'ongoing') {
        matchStatus = status === 'live';
      } else if (statusFilter === 'upcoming') {
        matchStatus = status === 'upcoming';
      } else if (statusFilter === 'completed') {
        matchStatus = status === 'ended';
      }

      return matchSearch && matchStatus;
    });
  }, [meetings, searchTerm, statusFilter]);

  // Danh sách cho List view: 'all' = tất cả, 'date' = lọc theo ngày; sắp xếp mới nhất trước
  const listMeetings = useMemo(() => {
    const base = listMode === 'date'
      ? filteredMeetings.filter((m) => dayjs(m.createdAt).isSame(listDate, 'day'))
      : filteredMeetings;
    return [...base].sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
  }, [filteredMeetings, listMode, listDate]);

  // Nhãn động cho nút giữa ở Danh sách (theo ngày)
  const dayOffsetLabel = useMemo(() => {
    const diff = listDate.startOf('day').diff(dayjs().startOf('day'), 'day');
    if (diff === 0) return 'Hôm nay';
    if (diff === -1) return 'Hôm qua';
    if (diff === 1) return 'Ngày mai';
    return diff < 0 ? `${diff} ngày` : `+${diff} ngày`;
  }, [listDate]);

  const stats = useMemo(() => {
    return {
      all: meetings.length,
      ongoing: meetings.filter((m) => meetingRowStatus(m) === 'live').length,
      upcoming: meetings.filter((m) => meetingRowStatus(m) === 'upcoming').length,
      completed: meetings.filter((m) => meetingRowStatus(m) === 'ended').length,
    };
  }, [meetings]);

  // --- Calendar Grid computation ---
  const calendarGridDays = useMemo(() => {
    const startOfMonth = currentDate.startOf('month');
    
    // Dayjs weekday: 0 is Sunday, 1 is Monday ... 6 is Saturday.
    // Shift Sunday to 7 so: Mon=1, Tue=2 ... Sun=7
    let startDayOfWeek: number = startOfMonth.day();
    if (startDayOfWeek === 0) startDayOfWeek = 7;

    const days = [];

    // Fill previous month trailing days
    const prevMonth = currentDate.subtract(1, 'month');
    const daysInPrevMonth = prevMonth.daysInMonth();
    const prevDaysCount = startDayOfWeek - 1;

    for (let i = prevDaysCount - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const date = prevMonth.date(dayNum);
      days.push({
        dayNumber: dayNum,
        isCurrentMonth: false,
        dateString: date.format('YYYY-MM-DD'),
      });
    }

    // Fill current month days
    const daysInCurrentMonth = currentDate.daysInMonth();
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const date = currentDate.date(i);
      days.push({
        dayNumber: i,
        isCurrentMonth: true,
        dateString: date.format('YYYY-MM-DD'),
      });
    }

    // Fill next month leading days to complete grid cells (multiple of 7)
    const totalCells = Math.ceil(days.length / 7) * 7;
    const nextDaysCount = totalCells - days.length;
    const nextMonth = currentDate.add(1, 'month');

    for (let i = 1; i <= nextDaysCount; i++) {
      const date = nextMonth.date(i);
      days.push({
        dayNumber: i,
        isCurrentMonth: false,
        dateString: date.format('YYYY-MM-DD'),
      });
    }

    return days;
  }, [currentDate]);

  // --- Day click to schedule ---
  const handleDayClick = (dateString: string) => {
    const dateVal = dayjs(dateString);
    createForm.setFieldsValue({
      scheduleRange: [dateVal.hour(9).minute(0), dateVal.hour(10).minute(0)],
    });
    setCreateOpen(true);
  };

  const handlePrevMonth = () => {
    setCurrentDate((prev) => prev.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => prev.add(1, 'month'));
  };

  const handleToday = () => {
    setCurrentDate(dayjs());
  };

  // Nhãn động cho nút giữa ở Lịch tháng
  const monthOffsetLabel = useMemo(() => {
    const now = dayjs();
    const diff = (currentDate.year() - now.year()) * 12 + (currentDate.month() - now.month());
    if (diff === 0) return 'Tháng này';
    if (diff === -1) return 'Tháng trước';
    if (diff === 1) return 'Tháng sau';
    return diff < 0 ? `${diff} tháng` : `+${diff} tháng`;
  }, [currentDate]);

  // Điều hướng tuần (đầu tuần = Thứ Hai)
  const startOfWeek = useMemo(() => {
    const dow = currentDate.day(); // 0=CN..6=T7
    const diffToMonday = dow === 0 ? 6 : dow - 1;
    return currentDate.subtract(diffToMonday, 'day').startOf('day');
  }, [currentDate]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, 'day')),
    [startOfWeek],
  );

  const handlePrevWeek = () => setCurrentDate((prev) => prev.subtract(1, 'week'));
  const handleNextWeek = () => setCurrentDate((prev) => prev.add(1, 'week'));

  // Nhãn động cho nút giữa: cho biết tuần đang xem cách tuần hiện tại bao xa
  const weekOffsetLabel = useMemo(() => {
    // Thứ Hai của tuần hiện tại (cùng logic với startOfWeek)
    const today = dayjs();
    const dow = today.day(); // 0=CN..6=T7
    const thisWeekStart = today.subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
    const diff = startOfWeek.diff(thisWeekStart, 'week');
    if (diff === 0) return 'Tuần này';
    if (diff === -1) return 'Tuần trước';
    if (diff === 1) return 'Tuần sau';
    return diff < 0 ? `${diff} tuần` : `+${diff} tuần`;
  }, [startOfWeek]);

  // Khi vào chế độ tuần, cuộn tới ~7h sáng cho khỏi mở ở vùng nửa đêm trống
  const weekBodyRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (viewMode === 'week' && weekBodyRef.current) {
      weekBodyRef.current.scrollTop = 7 * 48; // 7 giờ * 48px
    }
  }, [viewMode]);

  // Đặt lịch khi bấm vào một ô giờ trong tuần
  const handleSlotClick = (day: dayjs.Dayjs, hour: number) => {
    const startVal = day.hour(hour).minute(0).second(0);
    createForm.setFieldsValue({ scheduleRange: [startVal, startVal.add(1, 'hour')] });
    setCreateOpen(true);
  };

  if (authLoading) return <div style={{ padding: 24, textAlign: 'center' }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div className="cal-container">
        {/* HEADER TRANG */}
        <div className="cal-page-head">
          <div>
            <Title level={4} className="cal-page-title">
              <CalendarOutlined /> Lịch cuộc họp
            </Title>
            <Text className="cal-page-sub">
              Xem lịch theo tháng, lọc theo trạng thái và lập lịch cuộc họp mới
            </Text>
          </div>
        </div>

        {/* THẺ THỐNG KÊ */}
        <Row gutter={[14, 14]} className="cal-stat-row">
          {STAT_CARDS.map((c) => {
            const active = statusFilter === c.key;
            const value = stats[c.key as keyof typeof stats];
            return (
              <Col xs={12} sm={6} key={c.key} style={{ display: 'flex' }}>
                <button
                  type="button"
                  className={`cal-stat ${active ? 'active' : ''}`}
                  style={{ '--c': c.color } as React.CSSProperties}
                  onClick={() => setStatusFilter(c.key)}
                >
                  <div className="cal-stat-top">
                    <span className="cal-stat-label">{c.label}</span>
                    {c.key === 'ongoing' && value > 0 ? (
                      <span className="pulse-dot-green-custom" style={{ width: 10, height: 10, background: '#22c55e' }} />
                    ) : (
                      <span className="cal-stat-icon" style={{ color: c.color, background: `${c.color}14` }}>{c.icon}</span>
                    )}
                  </div>
                  <div className="cal-stat-bottom">
                    <span className="cal-stat-count" style={{ color: active ? c.color : undefined }}>{value}</span>
                    <span className="cal-stat-unit">{c.unit}</span>
                  </div>
                </button>
              </Col>
            );
          })}
        </Row>

        {/* MAIN CALENDAR PANEL */}
        <Card
          variant="borderless"
          className="cal-panel"
          styles={{
            body: { padding: 0 }
          }}
        >
          {/* TOOLBAR */}
          <div className="cal-toolbar">
            <div className="cal-toolbar-row">
            {/* Left: điều hướng theo chế độ xem */}
            {viewMode === 'month' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cal-nav-group">
                  <Tooltip title="Tháng trước">
                    <Button
                      type="text"
                      size="small"
                      icon={<LeftOutlined />}
                      onClick={handlePrevMonth}
                      style={{ height: 32, width: 32 }}
                    />
                  </Tooltip>
                  <Tooltip title="Về tháng hiện tại">
                    <Button
                      type="text"
                      size="small"
                      onClick={handleToday}
                      style={{ height: 32, padding: '0 14px', fontWeight: 600, minWidth: 96 }}
                    >
                      {monthOffsetLabel}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Tháng sau">
                    <Button
                      type="text"
                      size="small"
                      icon={<RightOutlined />}
                      onClick={handleNextMonth}
                      style={{ height: 32, width: 32 }}
                    />
                  </Tooltip>
                </div>
                <Title level={4} className="cal-month-label">
                  Tháng {currentDate.month() + 1}, {currentDate.year()}
                </Title>
              </div>
            ) : viewMode === 'week' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="cal-nav-group">
                  <Tooltip title="Tuần trước">
                    <Button type="text" size="small" icon={<LeftOutlined />} onClick={handlePrevWeek} style={{ height: 32, width: 32 }} />
                  </Tooltip>
                  <Tooltip title="Về tuần hiện tại">
                    <Button type="text" size="small" onClick={handleToday} style={{ height: 32, padding: '0 14px', fontWeight: 600, minWidth: 96 }}>
                      {weekOffsetLabel}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Tuần sau">
                    <Button type="text" size="small" icon={<RightOutlined />} onClick={handleNextWeek} style={{ height: 32, width: 32 }} />
                  </Tooltip>
                </div>
                <Title level={4} className="cal-month-label" style={{ minWidth: 'auto' }}>
                  {startOfWeek.format('DD/MM')} – {startOfWeek.add(6, 'day').format('DD/MM/YYYY')}
                </Title>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Điều hướng ngày: ← [nhãn động] → (chỉ tác dụng ở chế độ Theo ngày) */}
                <div className="cal-nav-group">
                  <Tooltip title="Ngày trước">
                    <Button
                      type="text"
                      size="small"
                      icon={<LeftOutlined />}
                      disabled={listMode === 'all'}
                      onClick={() => setListDate((d) => d.subtract(1, 'day'))}
                      style={{ height: 32, width: 32 }}
                    />
                  </Tooltip>
                  <Tooltip title="Về hôm nay">
                    <Button
                      type="text"
                      size="small"
                      disabled={listMode === 'all'}
                      onClick={() => setListDate(dayjs())}
                      style={{ height: 32, padding: '0 12px', fontWeight: 600, minWidth: 92 }}
                    >
                      {listMode === 'all' ? 'Hôm nay' : dayOffsetLabel}
                    </Button>
                  </Tooltip>
                  <Tooltip title="Ngày sau">
                    <Button
                      type="text"
                      size="small"
                      icon={<RightOutlined />}
                      disabled={listMode === 'all'}
                      onClick={() => setListDate((d) => d.add(1, 'day'))}
                      style={{ height: 32, width: 32 }}
                    />
                  </Tooltip>
                </div>
                {/* Chỉ hiện nhãn khi 'Tất cả' — ở 'Theo ngày' ngày đã có trong chip lịch */}
                {listMode === 'all' && (
                  <Title level={4} className="cal-month-label" style={{ minWidth: 'auto' }}>
                    Tất cả cuộc họp
                  </Title>
                )}
                <span className="cal-list-count">{listMeetings.length}</span>

                {/* Segment loại trừ: Tất cả | Theo ngày */}
                <div className="cal-list-seg">
                  <button
                    type="button"
                    className={`cal-seg-btn ${listMode === 'all' ? 'active' : ''}`}
                    onClick={() => setListMode('all')}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={`cal-seg-btn ${listMode === 'date' ? 'active' : ''}`}
                    onClick={() => setListMode('date')}
                  >
                    Theo ngày
                  </button>
                </div>

                {/* Chip ngày (click mở lịch) — chỉ hiện khi chọn "Theo ngày" */}
                {listMode === 'date' && (
                  <DatePicker
                    className="cal-inline-date"
                    value={listDate}
                    onChange={(d) => d && setListDate(d)}
                    format="DD/MM/YYYY"
                    allowClear={false}
                    variant="borderless"
                    suffixIcon={null}
                    prefix={<CalendarOutlined />}
                  />
                )}
              </div>
            )}

            {/* Right View Switcher */}
            <div className="cal-toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
              <div className="cal-view-switch">
                <Button
                  type={viewMode === 'month' ? 'primary' : 'text'}
                  icon={<AppstoreOutlined />}
                  onClick={() => setViewMode('month')}
                  style={{ borderRadius: 8, height: 32, fontSize: 12, fontWeight: 600, boxShadow: viewMode === 'month' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none' }}
                >
                  Lịch tháng
                </Button>
                <Button
                  type={viewMode === 'week' ? 'primary' : 'text'}
                  icon={<CalendarOutlined />}
                  onClick={() => setViewMode('week')}
                  style={{ borderRadius: 8, height: 32, fontSize: 12, fontWeight: 600, boxShadow: viewMode === 'week' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'week' ? '#ffffff' : '#475569' }}
                >
                  Tuần
                </Button>
                <Button
                  type={viewMode === 'list' ? 'primary' : 'text'}
                  icon={<UnorderedListOutlined />}
                  onClick={() => setViewMode('list')}
                  style={{ borderRadius: 8, height: 32, fontSize: 12, fontWeight: 600, boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'list' ? '#ffffff' : '#475569' }}
                >
                  Danh sách
                </Button>
              </div>

              {statusFilter !== 'all' && (
                <Tag
                  color="blue"
                  closable
                  onClose={() => setStatusFilter('all')}
                  style={{ margin: 0, padding: '4px 10px', borderRadius: 8, fontWeight: 600 }}
                >
                  Lọc: {statusFilter === 'ongoing' ? 'Đang họp' : statusFilter === 'upcoming' ? 'Sắp tới' : 'Đã xong'}
                </Tag>
              )}
            </div>
            </div>

            {/* Hàng 2: ô tìm kiếm full-width */}
            <div className="cal-toolbar-search">
              <Input
                placeholder="Tìm chủ đề, chủ trì hoặc mã phòng..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderRadius: 10, height: 40 }}
                allowClear
              />
            </div>
          </div>

          {/* MAIN CALENDAR CONTENT AREA */}
          <div style={{ padding: 16 }}>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <ClockCircleOutlined spin style={{ fontSize: 32, color: '#3b82f6', marginBottom: 12 }} />
                <div style={{ color: '#94a3b8', fontSize: 14 }}>Đang cập nhật lịch họp...</div>
              </div>
            ) : viewMode === 'month' ? (
              /* MONTH GRID VIEW */
              <div>
                {/* Day Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8 }}>
                  {['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'].map((day) => (
                    <div key={day} className="cal-weekday">{day}</div>
                  ))}
                </div>

                {/* Day Cells Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                  {calendarGridDays.map((day, idx) => {
                    const isToday = day.dateString === dayjs().format('YYYY-MM-DD');
                    const dayMeetings = filteredMeetings.filter(
                      (m) => dayjs(m.createdAt).format('YYYY-MM-DD') === day.dateString
                    );

                    return (
                      <div
                        key={`${day.dateString}-${idx}`}
                        onClick={() => handleDayClick(day.dateString)}
                        className={`cal-cell ${isToday ? 'is-today' : ''} ${day.isCurrentMonth ? '' : 'is-outside'}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span className="cal-cell-daynum">{day.dayNumber}</span>
                          <button
                            type="button"
                            className="cal-add-btn"
                            aria-label="Tạo cuộc họp"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayClick(day.dateString);
                            }}
                          >
                            <PlusOutlined style={{ fontSize: 10 }} />
                          </button>
                        </div>

                        {/* Meetings list inside day cell */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                          {dayMeetings.slice(0, 3).map((meet) => {
                            const status = meetingRowStatus(meet);
                            const evClass =
                              status === 'live' ? 'ev-live'
                                : status === 'ended' ? 'ev-ended'
                                  : status === 'upcoming' ? 'ev-upcoming'
                                    : 'ev-other';

                            return (
                              <div
                                key={meet.id}
                                className={`cal-event ${evClass}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailMeeting(meet);
                                }}
                              >
                                {status === 'live' && <span className="pulse-dot-green-custom" style={{ width: 6, height: 6, background: '#22c55e', flexShrink: 0 }} />}
                                <span className="cal-event-time">{dayjs(meet.createdAt).format('HH:mm')}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{meet.title}</span>
                              </div>
                            );
                          })}

                          {dayMeetings.length > 3 && (
                            <div className="cal-event-more">+ {dayMeetings.length - 3} cuộc họp khác</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : viewMode === 'week' ? (
              /* WEEK GRID VIEW (lưới giờ kiểu Outlook) */
              <div className="cal-week">
                {/* Header: cột giờ trống + 7 ngày */}
                <div className="cal-week-head">
                  <div className="cal-week-gutter-head" />
                  {weekDays.map((d) => {
                    const isToday = d.isSame(dayjs(), 'day');
                    return (
                      <div key={d.format('YYYY-MM-DD')} className={`cal-week-dayhead ${isToday ? 'is-today' : ''}`}>
                        <span className="cal-week-dow">{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.day()]}</span>
                        <span className="cal-week-daynum">{d.date()}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Body: cuộn dọc, cột giờ + 7 cột ngày */}
                <div className="cal-week-body" ref={weekBodyRef}>
                  {/* Cột nhãn giờ */}
                  <div className="cal-week-gutter">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="cal-week-hourlabel">
                        {h === 0 ? '12 SA' : h < 12 ? `${h} SA` : h === 12 ? '12 CH' : `${h - 12} CH`}
                      </div>
                    ))}
                  </div>

                  {/* 7 cột ngày */}
                  {weekDays.map((d) => {
                    const dayEvents = filteredMeetings.filter((m) => dayjs(m.createdAt).isSame(d, 'day'));
                    return (
                      <div key={d.format('YYYY-MM-DD')} className="cal-week-daycol">
                        {/* Ô giờ nền (click để tạo) */}
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className="cal-week-slot" onClick={() => handleSlotClick(d, h)} />
                        ))}

                        {/* Khối sự kiện định vị theo giờ */}
                        {dayEvents.map((meet) => {
                          const start = dayjs(meet.createdAt);
                          const plannedEnd = meet.estimatedEndAt ? dayjs(meet.estimatedEndAt) : (meet.startedAt ? dayjs(meet.startedAt) : null);
                          const end = meet.endedAt
                            ? dayjs(meet.endedAt)
                            : plannedEnd && plannedEnd.isValid() && plannedEnd.isAfter(start)
                              ? plannedEnd
                              : start.add(1, 'hour');
                          const HOUR = 48; // px mỗi giờ (đồng bộ với CSS)
                          const top = (start.hour() + start.minute() / 60) * HOUR;
                          const height = Math.max(22, (end.diff(start, 'minute') / 60) * HOUR - 2);
                          const status = meetingRowStatus(meet);
                          const evClass =
                            status === 'live' ? 'ev-live'
                              : status === 'ended' ? 'ev-ended'
                                : status === 'upcoming' ? 'ev-upcoming'
                                  : 'ev-other';
                          return (
                            <div
                              key={meet.id}
                              className={`cal-week-event ${evClass}`}
                              style={{ top, height }}
                              onClick={(e) => { e.stopPropagation(); setDetailMeeting(meet); }}
                              title={`${meet.title} — ${start.format('HH:mm')}-${end.format('HH:mm')}`}
                            >
                              <div className="cal-week-event-time">
                                {status === 'live' && <span className="pulse-dot-green-custom" style={{ width: 6, height: 6, background: '#22c55e', flexShrink: 0 }} />}
                                {start.format('HH:mm')}
                              </div>
                              <div className="cal-week-event-title">{meet.title}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* LIST VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {listMeetings.length === 0 ? (
                  <Empty
                    description={
                      listMode === 'date'
                        ? `Không có cuộc họp nào trong ngày ${listDate.format('DD/MM/YYYY')}.`
                        : searchTerm || statusFilter !== 'all'
                          ? 'Không tìm thấy cuộc họp nào phù hợp với bộ lọc.'
                          : 'Chưa có cuộc họp nào.'
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: '40px 0' }}
                  />
                ) : (
                  listMeetings.map((meet) => {
                    const status = meetingRowStatus(meet);
                    const isLive = status === 'live';
                    const isEnded = status === 'ended';
                    const isNoShow = status === 'no_show';
                    const isCancelled = status === 'cancelled';
                    const isJoinable = (isLive || status === 'upcoming') && !isCancelled;
                    const start = dayjs(meet.createdAt);
                    const plannedEnd = meet.estimatedEndAt ? dayjs(meet.estimatedEndAt) : (meet.startedAt ? dayjs(meet.startedAt) : null);
                    const end = meet.endedAt
                      ? dayjs(meet.endedAt)
                      : plannedEnd && plannedEnd.isValid()
                        ? plannedEnd
                        : start.add(1, 'hour');

                    let dateBg = '#eff6ff';
                    let dateBorder = '#bfdbfe';
                    let monthColor = '#1d4ed8';
                    let dayColor = '#2563eb';
                    
                    if (isLive) {
                      dateBg = '#f0fdf4';
                      dateBorder = '#bbf7d0';
                      monthColor = '#16a34a';
                      dayColor = '#22c55e';
                    } else if (isEnded) {
                      dateBg = '#fffbeb';
                      dateBorder = '#fde68a';
                      monthColor = '#b45309';
                      dayColor = '#d97706';
                    } else if (isNoShow) {
                      dateBg = '#fef2f2';
                      dateBorder = '#fecaca';
                      monthColor = '#b91c1c';
                      dayColor = '#ef4444';
                    } else if (isCancelled) {
                      dateBg = '#f3f4f6';
                      dateBorder = '#e5e7eb';
                      monthColor = '#6b7280';
                      dayColor = '#9ca3af';
                    }

                    return (
                      <div
                        key={meet.id}
                        onClick={() => setDetailMeeting(meet)}
                        className={`cal-list-row ${isLive ? 'is-live' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                          {/* Left calendar icon card */}
                          <div className="cal-date-badge" style={{ background: dateBg, borderColor: dateBorder }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: monthColor, textTransform: 'uppercase' }}>
                              {start.format('ddd')}
                            </span>
                            <span style={{ fontSize: 20, fontWeight: 900, color: dayColor, lineHeight: 1 }}>
                              {start.date()}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 600, color: monthColor }}>
                              T{start.month() + 1}
                            </span>
                          </div>

                          {/* Center info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Title level={5} className="cal-list-title" style={{ color: isLive ? '#15803d' : undefined }}>
                              {meet.title}
                            </Title>
                            <div className="cal-list-meta">
                              <span style={{ fontWeight: 700, color: isLive ? '#15803d' : '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ClockCircleOutlined style={{ color: isLive ? '#22c55e' : '#3b82f6' }} />
                                {start.format('HH:mm')} - {end.format('HH:mm')}
                              </span>
                              <span>Host: <strong>{meet.location ? meet.hostName : getHostNameOnly(meet.hostName)}</strong></span>
                              <span>Phòng: <strong>{meet.location || getVirtualRoom(meet.hostName, meet.id)}</strong></span>
                              <span>Mã phòng: <strong style={{ fontFamily: 'monospace' }}>{meet.meetingCode}</strong></span>
                              {isEnded && meet.endedAt && (
                                <span style={{ color: '#d97706', fontWeight: 700 }}>
                                  Kết thúc lúc: {dayjs(meet.endedAt).format('HH:mm DD/MM/YYYY')}
                                </span>
                              )}
                              {meet.passcode && (
                                <span>
                                  Passcode: <strong style={{
                                    fontFamily: 'monospace',
                                    background: '#fffbeb',
                                    color: '#b45309',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 12
                                  }}>{meet.passcode}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right CTA and status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', flexShrink: 0 }}>
                          {isLive ? (
                            <Tag color="success" style={{ margin: 0, padding: '4px 10px', borderRadius: 6, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span className="pulse-dot-green-custom" style={{ width: 8, height: 8, background: '#22c55e' }} />
                              ĐANG DIỄN RA
                            </Tag>
                          ) : isEnded ? (
                            <Tag color="warning" style={{ margin: 0, padding: '4px 10px', borderRadius: 6, fontWeight: 600, background: '#fffbeb', color: '#d97706', borderColor: '#fde68a' }}>
                              ĐÃ KẾT THÚC
                            </Tag>
                          ) : isNoShow ? (
                            <Tag color="error" style={{ margin: 0, padding: '4px 10px', borderRadius: 6, fontWeight: 600, background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}>
                              KHÔNG DIỄN RA
                            </Tag>
                          ) : isCancelled ? (
                            <Tag color="default" style={{ margin: 0, padding: '4px 10px', borderRadius: 6, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', borderColor: '#e5e7eb' }}>
                              ĐÃ HỦY
                            </Tag>
                          ) : (
                            <Tag color="processing" style={{ margin: 0, padding: '4px 10px', borderRadius: 6, fontWeight: 600, background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}>
                              SẮP DIỄN RA
                            </Tag>
                          )}

                          {isJoinable ? (
                            <Button
                              type="primary"
                              icon={<VideoCameraOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/meeting/${meet.id}`);
                              }}
                              style={{
                                borderRadius: 8,
                                fontWeight: 700,
                                background: isLive ? '#22c55e' : '#3b82f6',
                                borderColor: isLive ? '#22c55e' : '#3b82f6',
                                boxShadow: isLive ? '0 2px 8px rgba(34, 197, 94, 0.25)' : 'none'
                              }}
                            >
                              Vào họp
                            </Button>
                          ) : (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailMeeting(meet);
                              }}
                              style={{ borderRadius: 8, fontWeight: 600, color: '#475569', borderColor: '#cbd5e1' }}
                            >
                              Chi tiết
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* FOOTER LEGEND */}
          <div className="cal-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#eff6ff', border: '1px solid #bfdbfe' }} />
                <span>Sắp diễn ra</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ecfdf5', border: '1px solid #a7f3d0' }} />
                <span>Đang họp</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#fff7ed', border: '1px solid #fed7aa' }} />
                <span>Đã kết thúc</span>
              </span>
            </div>
            <div>
              {viewMode === 'month'
                ? <>💡 Click vào một ngày để lập lịch, hoặc nhấn <span style={{ fontWeight: 700, color: '#3b82f6' }}>+ Tạo cuộc họp</span> ở header.</>
                : viewMode === 'week'
                  ? <>💡 Click vào một ô giờ để lập lịch nhanh vào khung giờ đó.</>
                  : <>💡 <span style={{ fontWeight: 700, color: '#3b82f6' }}>Tất cả</span>: xem mọi cuộc họp (mới nhất trước). <span style={{ fontWeight: 700, color: '#3b82f6' }}>Theo ngày</span>: dùng mũi tên hoặc ô ngày để lọc theo từng ngày.</>}
            </div>
          </div>
        </Card>
      </div>

      {/* CREATE MEETING MODAL */}
      <CreateMeetingModal
        open={createOpen}
        creating={creating}
        createdMeeting={createdMeeting}
        form={createForm}
        estimatedDuration={estimatedDurationLabel}
        onCancel={closeCreateModal}
        onSubmit={onCreateMeeting}
        onCopy={copyText}
        buildLink={buildMeetingLink}
        onJoinCreated={(id) => {
          closeCreateModal();
          router.push(`/meeting/${id}`);
        }}
      />

      {/* MEETING DETAIL MODAL */}
      <MeetingDetailModal
        meeting={detailMeeting}
        onCancel={() => setDetailMeeting(null)}
        onCopy={copyText}
        buildLink={buildMeetingLink}
        onJoin={(id) => router.push(`/meeting/${id}`)}
        onViewDetail={(id) => {
          setDetailMeeting(null);
          router.push(`/meetings/${id}`);
        }}
      />
    </MainLayout>
  );
}
