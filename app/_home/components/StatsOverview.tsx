import React from 'react';
import { Card, Row, Col, Grid } from 'antd';
import { VideoCameraOutlined, CheckCircleOutlined, RightOutlined } from '@ant-design/icons';

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
  const isNarrow = !screens.lg;

  return (
    <Card
      variant="borderless"
      className="home-card"
      styles={{ body: { padding: isNarrow ? 16 : 20 } }}
      style={{ marginBottom: isNarrow ? 16 : 24 }}
      title={<span className="home-section-title">Tổng quan cá nhân</span>}
    >
      <Row gutter={[14, 14]}>
        <Col xs={24} sm={12}>
          <div className="home-stat">
            <span className="home-stat-icon" style={{ color: '#2563eb', background: 'rgba(37,99,235,0.1)' }}>
              <VideoCameraOutlined />
            </span>
            <div>
              <div className="home-stat-count">{stats.createdThisWeek}</div>
              <div className="home-stat-label">Đã tạo tuần này</div>
            </div>
          </div>
        </Col>
        <Col xs={24} sm={12}>
          <div
            className="home-stat is-clickable"
            role="button"
            tabIndex={0}
            onClick={onRedirectHistory}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onRedirectHistory();
            }}
          >
            <span className="home-stat-icon" style={{ color: '#059669', background: 'rgba(5,150,105,0.1)' }}>
              <CheckCircleOutlined />
            </span>
            <div style={{ flex: 1 }}>
              <div className="home-stat-count">{stats.joinedSessionsTotal}</div>
              <div className="home-stat-label">Đã tham gia (lượt)</div>
              <div className="home-stat-link">Xem lịch sử <RightOutlined style={{ fontSize: 10 }} /></div>
            </div>
          </div>
        </Col>
      </Row>
    </Card>
  );
}
