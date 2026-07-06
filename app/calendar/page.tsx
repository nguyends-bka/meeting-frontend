'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { Card, Row, Col, Typography, Button, Input, Tag, Empty, Grid, Form, App } from 'antd';
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
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
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
            {/* Left Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="cal-nav-group">
                <Button
                  type="text"
                  size="small"
                  icon={<LeftOutlined />}
                  onClick={handlePrevMonth}
                  style={{ height: 32, width: 32 }}
                />
                <Button
                  type="text"
                  size="small"
                  onClick={handleToday}
                  style={{ height: 32, padding: '0 12px', fontWeight: 600 }}
                >
                  Hôm nay
                </Button>
                <Button
                  type="text"
                  size="small"
                  icon={<RightOutlined />}
                  onClick={handleNextMonth}
                  style={{ height: 32, width: 32 }}
                />
              </div>
              <Title level={4} className="cal-month-label">
                Tháng {currentDate.month() + 1}, {currentDate.year()}
              </Title>
            </div>

            {/* Center Search Input */}
            <div style={{ flex: 1, maxWidth: isNarrow ? '100%' : 380 }}>
              <Input
                placeholder="Tìm chủ đề, chủ trì hoặc mã phòng..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ borderRadius: 10, height: 40 }}
                allowClear
              />
            </div>

            {/* Right View Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="cal-view-switch">
                <Button
                  type={viewMode === 'month' ? 'primary' : 'text'}
                  icon={<AppstoreOutlined />}
                  onClick={() => setViewMode('month')}
                  style={{
                    borderRadius: 8,
                    height: 32,
                    fontSize: 12,
                    fontWeight: 600,
                    boxShadow: viewMode === 'month' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Lịch tháng
                </Button>
                <Button
                  type={viewMode === 'list' ? 'primary' : 'text'}
                  icon={<UnorderedListOutlined />}
                  onClick={() => setViewMode('list')}
                  style={{
                    borderRadius: 8,
                    height: 32,
                    fontSize: 12,
                    fontWeight: 600,
                    boxShadow: viewMode === 'list' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    color: viewMode === 'list' ? '#ffffff' : '#475569'
                  }}
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
            ) : (
              /* LIST VIEW */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredMeetings.length === 0 ? (
                  <Empty
                    description="Không tìm thấy cuộc họp nào phù hợp với bộ lọc."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: '40px 0' }}
                  />
                ) : (
                  filteredMeetings.map((meet) => {
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
              💡 Click vào một ngày hoặc nhấn nút <span style={{ fontWeight: 700, color: '#3b82f6' }}>+ Tạo cuộc họp</span> ở header để lập lịch.
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
      />
    </MainLayout>
  );
}
