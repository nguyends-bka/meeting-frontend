import React from 'react';
import { Card, Typography, Grid } from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface GreetingBannerProps {
  user: any;
  pendingCount: number;
}

export default function GreetingBanner({
  user,
  pendingCount,
}: GreetingBannerProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = !screens.lg;

  const greetingWord = (() => {
    const h = dayjs().hour();
    if (h < 12) return 'Chào buổi sáng';
    if (h < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  })();

  return (
    <Card
      variant="borderless"
      styles={{
        body: { padding: isNarrow ? '16px 20px' : '24px' }
      }}
      style={{
        borderRadius: isNarrow ? 20 : 24,
        marginBottom: isNarrow ? 16 : 24,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.4)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: -100, right: -50, width: 300, height: 300,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none', filter: 'blur(20px)'
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: 150, width: 250, height: 250,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(0,0,0,0) 70%)', pointerEvents: 'none', filter: 'blur(20px)'
      }} />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '0px'
        }}
      >
        <Title
          level={2}
          className="animated-gradient-text"
          style={{
            margin: 0,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            fontSize: isNarrow ? 18 : 28,
            lineHeight: 1.2
          }}
        >
          {greetingWord}, {user?.fullName}! 👋
        </Title>
        <Text
          style={{
            display: 'block',
            marginTop: isNarrow ? 6 : 12,
            fontSize: isNarrow ? 13 : 16,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 500
          }}
        >
          Hôm nay là <span style={{ color: '#fff', fontWeight: 600 }}>{dayjs().format('dddd, D [tháng] MM, YYYY')}</span>. Bạn có <Text style={{ color: '#60a5fa', fontWeight: 800, fontSize: isNarrow ? 15 : 18 }}>{pendingCount}</Text> cuộc họp đang chờ.
        </Text>
      </div>
    </Card>
  );
}

