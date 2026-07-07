import React, { useState, useEffect } from 'react';
import { Card, Typography, Grid } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface GreetingBannerProps {
  user: any;
  pendingCount: number;
  isNarrow?: boolean;
}

export default function GreetingBanner({
  user,
  pendingCount,
  isNarrow: isNarrowProp,
}: GreetingBannerProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = isNarrowProp !== undefined ? isNarrowProp : !screens.lg;

  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const getVietnameseDate = (narrow: boolean) => {
    const days = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    if (narrow) {
      return `${dayName}, ${date}/${month}/${year}`;
    }
    return `${dayName}, ngày ${date} tháng ${month} năm ${year}`;
  };

  return (
    <Card
      variant="borderless"
      styles={{
        body: { padding: isNarrow ? '12px 16px' : '20px 28px' }
      }}
      style={{
        borderRadius: 16,
        marginBottom: isNarrow ? 12 : 16,
        background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 55%, #3b82f6 100%)',
        boxShadow: '0 8px 24px -8px rgba(37, 99, 235, 0.35)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Decorative circles */}
      <div style={{
        position: 'absolute', top: -100, right: -50, width: 300, height: 300,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)', pointerEvents: 'none', filter: 'blur(20px)'
      }} />
      <div style={{
        position: 'absolute', bottom: -100, right: 150, width: 250, height: 250,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', pointerEvents: 'none', filter: 'blur(20px)'
      }} />

      {isNarrow ? (
        /* Mobile Layout */
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Row 1: Date Pill + Clock Pill */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              letterSpacing: '0.02em',
            }}>
              ✨ {getVietnameseDate(true)}
            </span>

            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: 20,
              padding: '4px 10px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <ClockCircleOutlined style={{ fontSize: 13, color: '#93c5fd' }} className="spin-slow" />
              <span style={{
                fontSize: 14,
                fontFamily: 'monospace',
                fontWeight: 900,
                letterSpacing: '1px',
                color: '#ffffff'
              }}>
                {time}
              </span>
            </div>
          </div>

          {/* Row 2: Single line greeting info */}
          <div
            style={{
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            Xin chào, <span style={{ fontWeight: 800 }}>{user?.fullName || user?.username}</span>! 👋 Hôm nay bạn có <span style={{ color: '#fff', fontWeight: 800, textDecoration: 'underline' }}>{pendingCount} cuộc họp</span> cần tham gia.
          </div>
        </div>
      ) : (
        /* Desktop Layout */
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ flex: 1 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              marginBottom: 8,
              letterSpacing: '0.02em',
              maxWidth: 'calc(100% - 140px)',
            }}>
              ✨ Hôm nay là {getVietnameseDate(false)}
            </span>
            <Title
              level={2}
              style={{
                margin: 0,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                fontSize: 28,
                color: '#ffffff',
                lineHeight: 1.2,
                paddingRight: 140,
              }}
            >
              Xin chào, {user?.fullName || user?.username}! 👋
            </Title>
            <Text
              style={{
                display: 'block',
                marginTop: 6,
                fontSize: 15,
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 500
              }}
            >
              <span>Chào mừng bạn trở lại hệ thống. Hôm nay bạn có <span style={{ color: '#fff', fontWeight: 800, textDecoration: 'underline' }}>{pendingCount} cuộc họp</span> được lên lịch cần tham gia.</span>
            </Text>
          </div>

          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: 20,
            padding: '8px 16px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
            <ClockCircleOutlined style={{ fontSize: 16, color: '#93c5fd' }} className="spin-slow" />
            <span style={{
              fontSize: 18,
              fontFamily: 'monospace',
              fontWeight: 900,
              letterSpacing: '1px',
              color: '#ffffff'
            }}>
              {time}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
