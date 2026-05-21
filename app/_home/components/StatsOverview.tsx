import React from 'react';
import { Card, Row, Col, Typography, Grid } from 'antd';
import { VideoCameraOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface StatsOverviewProps {
  stats: {
    createdThisWeek: number;
    joinedSessionsTotal: number;
  };
  onRedirectHistory: () => void;
}

export default function StatsOverview({ stats, onRedirectHistory }: StatsOverviewProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  
  const isWideHome = Boolean(screens.xxl);
  const isCompactStats = !isWideHome && screens.lg;
  const statScale = isCompactStats ? 0.85 : 1;
  const ss = (n: number) => Math.round(n * statScale);

  return (
    <Card
      variant="borderless"
      className="premium-shadow"
      style={{ borderRadius: 24, marginBottom: 24, border: 'none' }}
      title={<span style={{ fontWeight: 800, fontSize: 18, color: '#1e293b' }}>Tổng quan cá nhân</span>}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <div
            className="hover-scale"
            style={{
              padding: ss(20),
              borderRadius: ss(16),
              background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
              border: '1px solid rgba(186, 230, 253, 0.5)',
              height: '100%',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1 }}>
              <VideoCameraOutlined style={{ fontSize: 80, color: '#0284c7' }} />
            </div>
            <VideoCameraOutlined style={{ fontSize: ss(28), color: '#0ea5e9' }} />
            <div style={{ fontSize: ss(36), fontWeight: 800, marginTop: ss(12), color: '#0369a1', lineHeight: 1 }}>
              {stats.createdThisWeek}
            </div>
            <Text style={{ fontSize: ss(13), display: 'block', marginTop: 8, color: '#0284c7', fontWeight: 600 }}>
              Đã tạo tuần này
            </Text>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div
            className="hover-scale"
            style={{
              padding: ss(20),
              borderRadius: ss(16),
              background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
              border: '1px solid rgba(187, 247, 208, 0.5)',
              height: '100%',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            role="button"
            tabIndex={0}
            onClick={onRedirectHistory}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onRedirectHistory();
            }}
          >
            <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.1 }}>
              <CheckCircleOutlined style={{ fontSize: 80, color: '#16a34a' }} />
            </div>
            <CheckCircleOutlined style={{ fontSize: ss(28), color: '#22c55e' }} />
            <div style={{ fontSize: ss(36), fontWeight: 800, marginTop: ss(12), color: '#14532d', lineHeight: 1 }}>
              {stats.joinedSessionsTotal}
            </div>
            <Text style={{ fontSize: ss(13), display: 'block', marginTop: 8, color: '#16a34a', fontWeight: 600 }}>
              Đã tham gia (lượt)
            </Text>
          </div>
        </Col>
      </Row>
    </Card>
  );
}
