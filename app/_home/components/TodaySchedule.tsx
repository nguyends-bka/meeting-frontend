import React from 'react';
import { Card, Button, Typography, Tag, Space, Grid, message } from 'antd';
import { CalendarOutlined, CaretRightOutlined, InfoCircleOutlined, CopyOutlined, ClockCircleOutlined, EnvironmentOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus, getVirtualRoom, getHostNameOnly } from '../helpers';
import CalendarStrip from './CalendarStrip';

const { Text } = Typography;

interface TodayScheduleProps {
  loading: boolean;
  schedule: HomeMeetingRow[];
  onViewAll: () => void;
  onJoin?: (meeting: HomeMeetingRow) => void;
  onDetail?: (meeting: HomeMeetingRow) => void;
  selectedDate?: dayjs.Dayjs;
  onSelectDate?: (date: dayjs.Dayjs) => void;
  isNarrow?: boolean;
}

export default function TodaySchedule({
  loading,
  schedule,
  onViewAll,
  onJoin,
  onDetail,
  selectedDate,
  onSelectDate,
  isNarrow: isNarrowProp,
}: TodayScheduleProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = isNarrowProp !== undefined ? isNarrowProp : !screens.sm;

  const dateToUse = selectedDate || dayjs();
  const isToday = dateToUse.isSame(dayjs(), 'day');

  const getWeekdayName = (date: dayjs.Dayjs) => {
    const day = date.day();
    if (day === 0) return 'Chủ Nhật';
    return `Thứ ${day + 1}`;
  };

  const titleText = isToday
    ? 'Timeline hôm nay'
    : `Timeline ${getWeekdayName(dateToUse)}, ngày ${dateToUse.format('DD/MM/YYYY')}`;

  const emptyText = isToday
    ? 'Chưa có cuộc họp nào được tạo hôm nay.'
    : `Chưa có cuộc họp nào được tạo trong ngày ${dateToUse.format('DD/MM/YYYY')}.`;

  const handleCopyLink = async (meetingCode: string) => {
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/join?code=${meetingCode}`;
    try {
      await navigator.clipboard.writeText(link);
      message.success('Đã sao chép liên kết mời họp');
    } catch {
      message.error('Sao chép thất bại');
    }
  };

  return (
    <Card
      variant="borderless"
      className="premium-shadow"
      styles={{
        body: { padding: isNarrow ? '12px' : '16px 20px' }
      }}
      style={{ borderRadius: 20, marginBottom: isNarrow ? 12 : 16, border: 'none', background: '#ffffff' }}
      title={
        isNarrow ? undefined : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: '#2563eb', fontSize: 18 }} />
            <span style={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>{titleText}</span>
            {isToday && (
              <span style={{
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 9999,
                fontWeight: 800,
                marginLeft: 4
              }}>
                {dateToUse.format('DD/MM')}
              </span>
            )}
          </div>
        )
      }
    >
      {isNarrow && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: 6
        }}>
          {/* Left: Mobile Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <CalendarOutlined style={{ color: '#2563eb', fontSize: 15.5 }} />
            <span style={{ fontWeight: 800, fontSize: 14.5, color: '#1e293b', whiteSpace: 'nowrap' }}>
              {isToday 
                ? `Timeline hôm nay, ngày ${dateToUse.format('DD/MM/YYYY')}`
                : `Timeline ${getWeekdayName(dateToUse)}, ngày ${dateToUse.format('DD/MM/YYYY')}`
              }
            </span>
          </div>

          {/* Right: Calendar Strip */}
          {onSelectDate && (
            <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
              <CalendarStrip
                selectedDate={dateToUse}
                onSelectDate={onSelectDate}
                isNarrow={true}
              />
            </div>
          )}
        </div>
      )}

      {!isNarrow && onSelectDate && (
        <div style={{
          marginBottom: 12,
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: 8
        }}>
          <CalendarStrip
            selectedDate={dateToUse}
            onSelectDate={onSelectDate}
            isNarrow={false}
          />
        </div>
      )}
      {loading ? (
        <Text type="secondary" style={{ color: '#94a3b8' }}>Đang tải…</Text>
      ) : schedule.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
          <CalendarOutlined style={{ fontSize: 32, opacity: 0.4, display: 'block', marginBottom: 8 }} />
          <Text type="secondary">{emptyText}</Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {schedule.map((m, index) => {
            const st = meetingRowStatus(m);
            const isLive = st === 'live';
            const start = dayjs(m.createdAt);
            const plannedEnd = m.startedAt ? dayjs(m.startedAt) : null;
            const end = m.endedAt
              ? dayjs(m.endedAt)
              : plannedEnd && plannedEnd.isValid()
                ? plannedEnd
                : start.add(1, 'hour');

            const dotColor =
              st === 'live'
                ? '#22c55e'
                : st === 'ended'
                  ? '#f59e0b'
                  : st === 'no_show'
                    ? '#ef4444'
                    : '#2563eb';

            const ringColor =
              st === 'live'
                ? 'rgba(34, 197, 94, 0.2)'
                : st === 'ended'
                  ? 'rgba(245, 158, 11, 0.2)'
                  : st === 'no_show'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(37, 99, 235, 0.2)';

            return (
              <div
                key={m.id}
                className={`schedule-row-hover ${isLive ? 'live-meeting' : ''}`}
                onClick={() => onDetail && onDetail(m)}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: isNarrow ? '8px 12px' : '10px 20px',
                  margin: isNarrow ? '2px -12px' : '2px -20px',
                  borderRadius: 12,
                  background: isLive ? 'rgba(34, 197, 94, 0.04)' : 'transparent',
                  borderLeft: isLive ? '4px solid #22c55e' : '4px solid transparent',
                  transition: 'all 0.2s ease',
                  cursor: onDetail ? 'pointer' : 'default',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 16,
                    alignSelf: 'stretch',
                    display: 'flex',
                    justifyContent: 'center',
                    minHeight: 40,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      bottom: index === schedule.length - 1 ? 'calc(100% - 18px)' : -12,
                      left: '50%',
                      width: 2,
                      marginLeft: -1,
                      background: '#e2e8f0',
                    }}
                  />
                  <div
                    className={isLive ? 'timeline-dot-pulse-green' : ''}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: dotColor,
                      marginTop: 4,
                      zIndex: 1,
                      border: '2px solid #fff',
                      boxShadow: `0 0 0 2px ${ringColor}`,
                      flexShrink: 0,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ 
                      fontSize: 13, 
                      fontWeight: 700, 
                      color: '#64748b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <ClockCircleOutlined style={{ color: '#2563eb', fontSize: 13 }} />
                      <span>{start.format('HH:mm')} - {end.format('HH:mm')}</span>
                    </span>
                    {st === 'live' && (
                      <span style={{
                        background: '#f0fdf4',
                        color: '#15803d',
                        fontWeight: 800,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid #bbf7d0'
                      }}>
                        ĐANG DIỄN RA
                      </span>
                    )}
                    {st === 'ended' && (
                      <span style={{
                        background: '#fffbeb',
                        color: '#d97706',
                        fontWeight: 800,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid #fde68a'
                      }}>
                        ĐÃ KẾT THÚC
                      </span>
                    )}
                    {st === 'no_show' && (
                      <span style={{
                        background: '#fef2f2',
                        color: '#b91c1c',
                        fontWeight: 800,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid #fecaca'
                      }}>
                        KHÔNG DIỄN RA
                      </span>
                    )}
                    {st === 'upcoming' && (
                      <span style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontWeight: 800,
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        border: '1px solid #bfdbfe'
                      }}>
                        SẮP DIỄN RA
                      </span>
                    )}
                  </div>

                  <h4 style={{
                    margin: '4px 0 0 0',
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#1f2937',
                    lineHeight: 1.4
                  }}>
                    {m.title}
                  </h4>

                  <div style={{
                    fontSize: 12,
                    color: '#64748b',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <UserOutlined style={{ fontSize: 12, color: '#64748b' }} />
                      <span>{m.location ? m.hostName : getHostNameOnly(m.hostName)}</span>
                    </span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <EnvironmentOutlined style={{ fontSize: 12, color: '#64748b' }} />
                      <span>{m.location || getVirtualRoom(m.hostName, m.id)}</span>
                    </span>
                    {st === 'ended' && m.endedAt && (
                      <>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: '#d97706', fontWeight: 600 }}>Kết thúc lúc: {dayjs(m.endedAt).format('HH:mm DD/MM/YYYY')}</span>
                      </>
                    )}
                    {isLive && m.activeParticipantCount !== undefined && m.activeParticipantCount > 0 && (
                      <>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>👥 {m.activeParticipantCount} người đang họp</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 12, textAlign: 'center' }}>
            <Button
              type="link"
              onClick={onViewAll}
              style={{
                fontWeight: 700,
                color: '#2563eb',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Xem toàn bộ lịch biểu tháng →
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
