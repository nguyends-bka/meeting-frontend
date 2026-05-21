import React from 'react';
import { Card, Button, Typography, Tag, Space } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus, isMeetingLive } from '../helpers';

const { Text } = Typography;

interface TodayScheduleProps {
  loading: boolean;
  schedule: HomeMeetingRow[];
  onViewAll: () => void;
}

export default function TodaySchedule({ loading, schedule, onViewAll }: TodayScheduleProps) {
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
            const when = dayjs(m.createdAt);
            const dot =
              st === 'live' ? '#22c55e' : st === 'ended' ? '#94a3b8' : '#2563eb';
            const tag =
              st === 'live' ? (
                <Tag color="success">Đang diễn ra</Tag>
              ) : st === 'no_show' ? (
                <Tag color="default">Không diễn ra</Tag>
              ) : st === 'ended' ? (
                <Tag>Đã kết thúc</Tag>
              ) : (
                <Tag color="processing">Sắp diễn ra</Tag>
              );
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'stretch',
                  padding: '14px 0',
                  borderBottom: index < schedule.length - 1 ? '1px solid #f1f5f9' : undefined,
                }}
              >
                <Text strong style={{ width: 52, flexShrink: 0, fontSize: 15, lineHeight: '24px' }}>
                  {when.format('HH:mm')}
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
                        top: 18,
                        bottom: -14,
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
                      boxShadow: `0 0 0 2px ${dot}40`,
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space wrap size={[8, 4]}>
                    <Text strong style={{ fontSize: 15 }}>
                      {m.title}
                    </Text>
                    {tag}
                  </Space>
                  <div style={{ marginTop: 6 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Host: {m.hostName}
                    </Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
