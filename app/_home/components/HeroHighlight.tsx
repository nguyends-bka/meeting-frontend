import React from 'react';
import { Typography, Space, Tag, Button } from 'antd';
import { CalendarOutlined, UserOutlined, CaretRightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus } from '../helpers';

const { Title, Text } = Typography;

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
  const plannedEnd = meeting.startedAt ? dayjs(meeting.startedAt) : null;
  const end = meeting.endedAt
    ? dayjs(meeting.endedAt)
    : plannedEnd && plannedEnd.isValid()
      ? plannedEnd
      : start.add(1, 'hour');

  const now = dayjs();
  const minutesLeft = end.diff(now, 'minute');

  return (
    <div
      className="hover-scale premium-shadow"
      style={{
        borderRadius: 20,
        padding: isNarrow ? 20 : 28,
        marginBottom: 24,
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: isHeroLive ? '#22c55e' : '#3b82f6' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <Space wrap size={[8, 8]}>
          <Tag color={isHeroLive ? 'success' : 'processing'} style={{ margin: 0, fontWeight: 700, padding: '4px 10px', borderRadius: '6px', border: 'none', background: isHeroLive ? '#dcfce7' : '#dbeafe', color: isHeroLive ? '#166534' : '#1e40af' }}>
            {isHeroLive ? 'ĐANG DIỄN RA' : 'SẮP DIỄN RA'}
          </Tag>
          <Text style={{ color: '#64748b', fontSize: 14, fontWeight: 500 }}>
            {isHeroLive ? 'Hôm nay' : 'Dự kiến'}, {start.format('DD/MM/YYYY')}
          </Text>
        </Space>

        {isHeroLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
            <span className="pulse-dot" />
            {(meeting.activeParticipantCount ?? 0) > 0
              ? `${meeting.activeParticipantCount} người trong phòng`
              : 'Chưa có ai vào phòng'}
          </div>
        )}
      </div>
      <Title level={2} style={{ margin: 0, color: '#0f172a', fontWeight: 800, letterSpacing: '-0.02em' }}>
        {meeting.title}
      </Title>
      <div style={{ marginTop: 14, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 15, fontWeight: 500 }}>
           <CalendarOutlined style={{ color: '#3b82f6' }} />
           <span>{start.format('HH:mm')} – {end.format('HH:mm')}</span>
           {isHeroLive && minutesLeft > 0 && (
             <span style={{ color: '#e67e22', fontSize: 13, fontWeight: 600, marginLeft: 4 }}>
               (Còn {minutesLeft} phút)
             </span>
           )}
           {isHeroLive && minutesLeft <= 0 && (
             <span style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, marginLeft: 4 }}>
               (Quá {Math.abs(minutesLeft)} phút)
             </span>
           )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 15, fontWeight: 500 }}>
           <UserOutlined style={{ color: '#8b5cf6' }} />
           Host: <span style={{ color: '#1e293b', fontWeight: 600 }}>{meeting.hostName}</span>
        </div>
      </div>
      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 12,
          background: 'rgba(241, 245, 249, 0.7)',
          border: '1px dashed #cbd5e1',
          display: 'flex',
          gap: 32,
          alignItems: 'center'
        }}
      >
        <div>
          <Text style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>Mã phòng</Text>
          <Text strong style={{ color: '#0f172a', fontSize: 18, fontFamily: 'monospace', letterSpacing: '1px' }}>
            {meeting.meetingCode}
          </Text>
        </div>
        <div style={{ width: 1, height: 40, background: '#cbd5e1' }} />
        <div>
          <Text style={{ color: '#64748b', fontSize: 13, display: 'block', marginBottom: 4 }}>Passcode</Text>
          <Text strong style={{ color: '#0f172a', fontSize: 18, fontFamily: 'monospace', letterSpacing: '1px' }}>
            {meeting.passcode || '—'}
          </Text>
        </div>
      </div>
      <Space style={{ marginTop: 24 }} wrap size={16}>
        <Button
          type="primary"
          size="large"
          icon={<CaretRightOutlined />}
          onClick={onJoin}
          style={{ fontWeight: 600, background: 'linear-gradient(to right, #2563eb, #3b82f6)', border: 'none', height: 46, padding: '0 28px', borderRadius: 8, boxShadow: '0 4px 14px rgba(37,99,235,0.4)', animation: isHeroLive ? 'pulse-glow 2s infinite' : 'none' }}
        >
          Tham gia ngay
        </Button>
        <Button
          size="large"
          onClick={onDetail}
          style={{ fontWeight: 600, color: '#475569', height: 46, padding: '0 28px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        >
          Chi tiết
        </Button>
      </Space>
    </div>
  );
}
