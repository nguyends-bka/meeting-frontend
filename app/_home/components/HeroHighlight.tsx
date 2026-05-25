import React from 'react';
import { Button } from 'antd';
import { 
  CalendarOutlined, 
  UserOutlined, 
  EnvironmentOutlined, 
  SyncOutlined,
  ClockCircleOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus, getVirtualRoom, getHostNameOnly } from '../helpers';

interface HeroHighlightProps {
  meeting: HomeMeetingRow;
  onJoin: () => void;
  onDetail: () => void;
  isNarrow: boolean;
}

export default function HeroHighlight({ meeting, onJoin, onDetail, isNarrow }: HeroHighlightProps) {
  const heroStatus = meetingRowStatus(meeting);
  const isHeroLive = heroStatus === 'live';
  const start = dayjs(meeting.createdAt);
  const plannedEnd = meeting.estimatedEndAt ? dayjs(meeting.estimatedEndAt) : (meeting.startedAt ? dayjs(meeting.startedAt) : null);
  const end = meeting.endedAt
    ? dayjs(meeting.endedAt)
    : plannedEnd && plannedEnd.isValid()
      ? plannedEnd
      : start.add(1, 'hour');

  const now = dayjs();
  let upcomingSubState: 'scheduled' | 'near' | 'delayed' = 'scheduled';
  if (heroStatus === 'upcoming') {
    const diffMinutes = start.diff(now, 'minute');
    if (diffMinutes > 60) {
      upcomingSubState = 'scheduled';
    } else if (diffMinutes > 0) {
      upcomingSubState = 'near';
    } else {
      upcomingSubState = 'delayed';
    }
  }

  const isJoinable = heroStatus === 'live' || (heroStatus === 'upcoming' && upcomingSubState !== 'scheduled');

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: isNarrow ? 16 : 20,
        border: '1px solid #bfdbfe',
        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.05)',
        padding: isNarrow ? '12px' : '16px',
        marginBottom: isNarrow ? 12 : 16,
        display: 'flex',
        flexDirection: 'column',
        gap: isNarrow ? 10 : 16
      }}
    >
      {/* Card Header Title */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f1f5f9',
        paddingBottom: isNarrow ? 6 : 8
      }}>
        <h3 style={{
          margin: 0,
          fontSize: isNarrow ? 13 : 14,
          fontWeight: 700,
          color: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span className="pulse-dot" style={{ background: '#3b82f6', width: isNarrow ? 6 : 8, height: isNarrow ? 6 : 8 }} />
          Cuộc họp tiếp theo của bạn
        </h3>
        {!isNarrow && (
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
            <SyncOutlined spin={isHeroLive} style={{ marginRight: 4 }} />
            Hệ thống tự động đồng bộ
          </span>
        )}
      </div>

      {/* Main Content Layout */}
      <div
        style={{
          display: 'flex',
          flexDirection: isNarrow ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isNarrow ? 'stretch' : 'center',
          gap: isNarrow ? 10 : 16
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: isNarrow ? 8 : 12 }}>
          {/* Status Badge & Date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isNarrow ? '6px 8px' : 10, flexWrap: 'wrap' }}>
            {isHeroLive ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#f0fdf4',
                color: '#15803d',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #bbf7d0'
              }}>
                ĐANG DIỄN RA
              </span>
            ) : heroStatus === 'upcoming' && upcomingSubState === 'scheduled' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#f3f4f6',
                color: '#6b7280',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #e5e7eb'
              }}>
                ĐÃ LÊN LỊCH
              </span>
            ) : heroStatus === 'upcoming' && upcomingSubState === 'near' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #bfdbfe'
              }}>
                SẮP DIỄN RA
              </span>
            ) : heroStatus === 'upcoming' && upcomingSubState === 'delayed' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#fff7ed',
                color: '#ea580c',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #ffedd5'
              }}>
                CHỜ BẮT ĐẦU
              </span>
            ) : heroStatus === 'cancelled' ? (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#f3f4f6',
                color: '#6b7280',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                border: '1px solid #e5e7eb'
              }}>
                ĐÃ HỦY
              </span>
            ) : (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 6px',
                borderRadius: '4px',
                background: '#f3f4f6',
                color: '#6b7280',
                fontSize: 9,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {heroStatus}
              </span>
            )}
            <span style={{ fontSize: isNarrow ? 11 : 12, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CalendarOutlined style={{ fontSize: 11, color: '#94a3b8' }} />
              <span>{start.format('D/M/YYYY')}</span>
            </span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ fontSize: isNarrow ? 11 : 12, color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClockCircleOutlined style={{ color: '#3b82f6', fontSize: 12 }} />
              <span>{start.format('HH:mm')} - {end.format('HH:mm')}</span>
            </span>
          </div>

          {/* Meeting Title */}
          <h4
            onClick={onDetail}
            style={{
              margin: 0,
              fontSize: isNarrow ? 14 : 18,
              fontWeight: 800,
              color: '#0f172a',
              cursor: 'pointer',
              transition: 'color 0.2s',
              lineHeight: 1.3
            }}
            className="hover-blue-text"
          >
            {meeting.title}
          </h4>

          {/* Metadata List */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            fontSize: isNarrow ? 11 : 12,
            color: '#64748b'
          }}>
            {/* Host & Location on 1 line, Host first */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserOutlined style={{ color: '#94a3b8', fontSize: 11 }} />
                <span>
                  Người chủ trì:{' '}
                  <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                    {meeting.location ? meeting.hostName : getHostNameOnly(meeting.hostName)}
                  </strong>
                </span>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <EnvironmentOutlined style={{ color: '#94a3b8', fontSize: 11 }} />
                <span>
                  Địa điểm:{' '}
                  <strong style={{ color: '#0f172a', fontWeight: 600 }}>
                    {meeting.location || getVirtualRoom(meeting.hostName, meeting.id)}
                  </strong>
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Action column */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: isNarrow ? 'stretch' : 'flex-end',
          minWidth: isNarrow ? undefined : 140,
          flexShrink: 0
        }}>
          <Button
            type="primary"
            icon={<VideoCameraOutlined />}
            onClick={onJoin}
            disabled={!isJoinable}
            style={{
              width: '100%',
              height: isNarrow ? 34 : 38,
              borderRadius: 8,
              fontWeight: 700,
              fontSize: isNarrow ? 11 : 12,
              boxShadow: !isJoinable ? 'none' : '0 4px 12px rgba(34, 197, 94, 0.25)',
              background: !isJoinable ? '#e2e8f0' : '#22c55e',
              borderColor: !isJoinable ? '#cbd5e1' : '#22c55e',
              color: !isJoinable ? '#94a3b8' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            Vào Phòng Ngay
          </Button>
        </div>
      </div>
    </div>
  );
}
