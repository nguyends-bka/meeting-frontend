'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { Card, Row, Col, Typography, Button, Input, Space, Tag, Badge, Empty, Grid, Form, App } from 'antd';
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
  UserOutlined,
  LockOutlined,
  CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService, adminApi } from '@/services/api';
import { HomeMeetingRow } from '@/app/_home/types';
import { isMeetingLive, meetingRowStatus, formatDurationFromScheduleRange, getHostNameOnly, getVirtualRoom } from '@/app/_home/helpers';
import CreateMeetingModal from '@/app/_home/components/CreateMeetingModal';
import MeetingDetailModal from '@/app/_home/components/MeetingDetailModal';

const { Title, Text } = Typography;

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
      <div style={{ padding: isNarrow ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
        <style>{`
          @keyframes pulse-amber {
            0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
            50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
            100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
          }
          .pulse-dot-amber-custom {
            border-radius: 50%;
            animation: pulse-amber 1.8s infinite ease-in-out;
          }
          @keyframes pulse-green {
            0% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
            50% { transform: scale(1.15); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
            100% { transform: scale(0.85); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
          }
          .pulse-dot-green-custom {
            border-radius: 50%;
            animation: pulse-green 1.8s infinite ease-in-out;
          }
          .calendar-grid-cell {
            position: relative;
            transition: all 0.2s ease-in-out;
          }
          .calendar-grid-cell:hover {
            border-color: #cbd5e1 !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          }
          .calendar-grid-cell .cell-add-btn {
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
          }
          .calendar-grid-cell:hover .cell-add-btn {
            opacity: 1;
          }
        `}</style>
        
        {/* TOP SUMMARY STATS CARDS */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <div 
              onClick={() => setStatusFilter('all')}
              className={`hover-scale`}
              style={{
                background: statusFilter === 'all' ? '#f8fafc' : '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                border: `1.5px solid ${statusFilter === 'all' ? '#3b82f6' : '#e2e8f0'}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: statusFilter === 'all' ? '#3b82f6' : '#64748b' }}>Tất cả cuộc họp</Text>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  <CalendarOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{stats.all}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>phiên họp</span>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div 
              onClick={() => setStatusFilter('ongoing')}
              className={`hover-scale`}
              style={{
                background: statusFilter === 'ongoing' ? '#f0fdf4' : '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                border: `1.5px solid ${statusFilter === 'ongoing' ? '#22c55e' : '#e2e8f0'}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: statusFilter === 'ongoing' ? '#16a34a' : '#64748b' }}>Đang diễn ra</Text>
                <div className="pulse-dot-green-custom" style={{ width: 10, height: 10, background: '#22c55e' }} />
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#22c55e' }}>{stats.ongoing}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>đang họp</span>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div 
              onClick={() => setStatusFilter('upcoming')}
              className={`hover-scale`}
              style={{
                background: statusFilter === 'upcoming' ? '#eff6ff' : '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                border: `1.5px solid ${statusFilter === 'upcoming' ? '#3b82f6' : '#e2e8f0'}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: statusFilter === 'upcoming' ? '#3b82f6' : '#64748b' }}>Lên lịch sắp tới</Text>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                  <ClockCircleOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6' }}>{stats.upcoming}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>chờ diễn ra</span>
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div 
              onClick={() => setStatusFilter('completed')}
              className={`hover-scale`}
              style={{
                background: statusFilter === 'completed' ? '#fffbeb' : '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                border: `1.5px solid ${statusFilter === 'completed' ? '#f59e0b' : '#e2e8f0'}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, fontWeight: 600, color: statusFilter === 'completed' ? '#b45309' : '#64748b' }}>Đã hoàn thành</Text>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                  <CheckCircleOutlined style={{ fontSize: 16 }} />
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{stats.completed}</span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>đã xong</span>
              </div>
            </div>
          </Col>
        </Row>

        {/* MAIN CALENDAR PANEL */}
        <Card
          variant="borderless"
          style={{
            borderRadius: 24,
            boxShadow: '0 10px 30px -10px rgba(0,0,0,0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}
          styles={{
            body: { padding: 0 }
          }}
        >
          {/* TOOLBAR */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid #edf2f7',
            background: '#f8fafc',
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isNarrow ? 'stretch' : 'center',
            gap: 16
          }}>
            {/* Left Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'inline-flex', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
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
                  style={{ height: 32, padding: '0 12px', fontWeight: 600, color: '#334155' }}
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
              <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#0f172a', minWidth: 150 }}>
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
                style={{ borderRadius: 10, height: 38 }}
                allowClear
              />
            </div>

            {/* Right View Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#e2e8f0', padding: 2, borderRadius: 10, display: 'inline-flex', border: '1px solid rgba(0,0,0,0.05)' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 8 }}>
                  {['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'].map((day) => (
                    <div key={day} style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', padding: '8px 0', letterSpacing: '0.05em' }}>
                      {day}
                    </div>
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
                        style={{
                          minHeight: 110,
                          background: isToday ? 'rgba(59, 130, 246, 0.02)' : '#ffffff',
                          border: isToday ? '2px solid #3b82f6' : '1px solid #f1f5f9',
                          borderRadius: 12,
                          padding: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative',
                          cursor: 'pointer',
                          opacity: day.isCurrentMonth ? 1 : 0.4,
                          boxShadow: isToday ? '0 4px 12px rgba(59, 130, 246, 0.08)' : 'none',
                        }}
                        className="calendar-grid-cell"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isToday ? '#3b82f6' : 'transparent',
                            color: isToday ? '#ffffff' : '#334155'
                          }}>
                            {day.dayNumber}
                          </span>
                          
                          <Button
                            type="text"
                            size="small"
                            icon={<PlusOutlined style={{ fontSize: 10 }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayClick(day.dateString);
                            }}
                            className="cell-add-btn"
                            style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}
                          />
                        </div>

                        {/* Meetings list inside day cell */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                          {dayMeetings.slice(0, 3).map((meet) => {
                            const status = meetingRowStatus(meet);
                            const isLive = status === 'live';
                            const isEnded = status === 'ended';
                            
                            let color = '#1d4ed8'; // upcoming blue
                            let bg = '#eff6ff';
                            let border = '#bfdbfe';
                            if (isLive) {
                              color = '#15803d'; // ongoing green
                              bg = '#f0fdf4';
                              border = '#bbf7d0';
                            } else if (isEnded) {
                              color = '#b45309'; // completed amber
                              bg = '#fffbeb';
                              border = '#fde68a';
                            }

                            return (
                              <div
                                key={meet.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailMeeting(meet);
                                }}
                                style={{
                                  padding: '2px 6px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: bg,
                                  border: `1px solid ${border}`,
                                  borderRadius: 6,
                                  color: color,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {isLive && <span className="pulse-dot-green-custom" style={{ width: 6, height: 6, background: '#22c55e', flexShrink: 0 }} />}
                                <span style={{ fontWeight: 800, fontSize: 9 }}>{dayjs(meet.createdAt).format('HH:mm')}</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{meet.title}</span>
                              </div>
                            );
                          })}

                          {dayMeetings.length > 3 && (
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textAlign: 'right', marginTop: 2 }}>
                              + {dayMeetings.length - 3} cuộc họp khác
                            </div>
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
                        className="hover-scale"
                        style={{
                          display: 'flex',
                          flexDirection: isNarrow ? 'column' : 'row',
                          alignItems: isNarrow ? 'stretch' : 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          padding: '16px 20px',
                          border: `1px solid ${isLive ? '#fde68a' : '#e2e8f0'}`,
                          borderRadius: 16,
                          background: isLive ? 'rgba(245, 158, 11, 0.02)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0 }}>
                          {/* Left calendar icon card */}
                          <div style={{
                            width: 60,
                            height: 60,
                            borderRadius: 12,
                            background: dateBg,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            border: `1px solid ${dateBorder}`
                          }}>
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
                            <Title level={5} style={{ margin: 0, fontWeight: 700, color: isLive ? '#15803d' : '#0f172a' }}>
                              {meet.title}
                            </Title>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6, fontSize: 13, color: '#64748b' }}>
                              <span style={{ fontWeight: 700, color: isLive ? '#15803d' : '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <ClockCircleOutlined style={{ color: isLive ? '#22c55e' : '#3b82f6' }} />
                                {start.format('HH:mm')} - {end.format('HH:mm')}
                              </span>
                              <span>
                                Host: <strong style={{ color: '#475569' }}>{meet.location ? meet.hostName : getHostNameOnly(meet.hostName)}</strong>
                              </span>
                              <span>
                                Phòng: <strong style={{ color: '#475569' }}>{meet.location || getVirtualRoom(meet.hostName, meet.id)}</strong>
                              </span>
                              <span>
                                Mã phòng: <strong style={{ color: '#475569', fontFamily: 'monospace' }}>{meet.meetingCode}</strong>
                              </span>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: isNarrow ? 'flex-end' : 'flex-end', flexShrink: 0 }}>
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
          <div style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #edf2f7',
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: '#64748b',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#eff6ff', border: '1px solid #bfdbfe' }} />
                <span>Sắp diễn ra</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f0fdf4', border: '1px solid #bbf7d0' }} />
                <span>Đang họp</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#fffbeb', border: '1px solid #fde68a' }} />
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
