import React from 'react';
import { Card, Button, Typography, Tag, Space, Grid, message } from 'antd';
import { CalendarOutlined, CaretRightOutlined, InfoCircleOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus } from '../helpers';

const { Text } = Typography;

interface TodayScheduleProps {
  loading: boolean;
  schedule: HomeMeetingRow[];
  onViewAll: () => void;
  onJoin?: (meeting: HomeMeetingRow) => void;
  onDetail?: (meeting: HomeMeetingRow) => void;
}

export default function TodaySchedule({ loading, schedule, onViewAll, onJoin, onDetail }: TodayScheduleProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = !screens.sm;

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
      style={{ borderRadius: 24, marginBottom: 24, border: 'none', background: '#ffffff' }}
      title={<span style={{ fontWeight: 800, fontSize: 18, color: '#1e293b' }}>Lịch trình hôm nay</span>}
      extra={
        <Button type="link" onClick={onViewAll} style={{ fontWeight: 600, color: '#3b82f6' }}>
          Xem lịch đầy đủ →
        </Button>
      }
    >
      {loading ? (
        <Text type="secondary" style={{ color: '#94a3b8' }}>Đang tải…</Text>
      ) : schedule.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
          <CalendarOutlined style={{ fontSize: 32, opacity: 0.4, display: 'block', marginBottom: 8 }} />
          <Text type="secondary">Chưa có cuộc họp nào được tạo hôm nay.</Text>
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

            const durationMinutes = end.diff(start, 'minute');
            const dot = isLive ? '#22c55e' : st === 'ended' ? '#94a3b8' : '#2563eb';
            
            const tag =
              isLive ? (
                <Tag color="success" style={{ margin: 0, fontWeight: 600 }}>Đang diễn ra</Tag>
              ) : st === 'no_show' ? (
                <Tag color="default" style={{ margin: 0 }}>Không diễn ra</Tag>
              ) : st === 'ended' ? (
                <Tag style={{ margin: 0 }}>Đã kết thúc</Tag>
              ) : (
                <Tag color="processing" style={{ margin: 0, fontWeight: 600 }}>Sắp diễn ra</Tag>
              );

            return (
              <div
                key={m.id}
                className={`schedule-row-hover ${isLive ? 'live-meeting' : ''}`}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'stretch',
                  padding: '14px 16px',
                  margin: '2px -16px',
                  borderRadius: 12,
                  background: isLive ? 'rgba(34, 197, 94, 0.04)' : 'transparent',
                  borderLeft: isLive ? '4px solid #22c55e' : '4px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <Text strong style={{ width: 52, flexShrink: 0, fontSize: 15, lineHeight: '24px', color: isLive ? '#15803d' : '#1e293b' }}>
                  {start.format('HH:mm')}
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
                  {index < schedule.length - 1 ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: 20,
                        bottom: -16,
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
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: dot,
                      marginTop: 5,
                      zIndex: 1,
                      border: '3px solid #fff',
                      boxShadow: `0 0 0 2px ${dot}30`,
                      flexShrink: 0,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Space wrap size={[8, 4]}>
                    <Text strong style={{ fontSize: 15, color: isLive ? '#15803d' : '#1e293b' }}>
                      {m.title}
                    </Text>
                    {tag}
                    {isLive && (
                      <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                    )}
                  </Space>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CalendarOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                      <span>{start.format('HH:mm')} – {end.format('HH:mm')} ({durationMinutes}m)</span>
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Host: <span style={{ color: '#475569', fontWeight: 600 }}>{m.hostName}</span>
                    </Text>
                    {isLive && m.activeParticipantCount !== undefined && m.activeParticipantCount > 0 && (
                      <Text type="success" style={{ fontSize: 13, fontWeight: 600 }}>
                        👥 {m.activeParticipantCount} người đang họp
                      </Text>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {onJoin && (isLive || st === 'upcoming') && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CaretRightOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoin(m);
                      }}
                      style={{
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 12,
                        height: 28,
                        padding: isNarrow ? '0 8px' : '0 12px',
                        background: isLive ? '#22c55e' : '#3b82f6',
                        border: 'none',
                        boxShadow: isLive ? '0 2px 8px rgba(34, 197, 94, 0.3)' : 'none',
                      }}
                    >
                      {!isNarrow && (isLive ? 'Vào họp' : 'Vào phòng')}
                    </Button>
                  )}

                  {onDetail && (
                    <Button
                      size="small"
                      icon={<InfoCircleOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDetail(m);
                      }}
                      style={{
                        borderRadius: 6,
                        height: 28,
                        fontSize: 12,
                        padding: isNarrow ? '0 8px' : '0 12px',
                        color: '#475569',
                        borderColor: '#cbd5e1',
                      }}
                    >
                      {!isNarrow && 'Chi tiết'}
                    </Button>
                  )}

                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyLink(m.meetingCode);
                    }}
                    style={{
                      borderRadius: 6,
                      height: 28,
                      width: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#475569',
                      borderColor: '#cbd5e1',
                    }}
                    title="Sao chép liên kết"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
