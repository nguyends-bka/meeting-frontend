import React from 'react';
import { Modal, Card, Space, Avatar, Input, Button, Typography } from 'antd';
import { UserOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus, getHostNameOnly, getVirtualRoom } from '../helpers';

const { Title, Text } = Typography;

interface MeetingDetailModalProps {
  meeting: HomeMeetingRow | null;
  onCancel: () => void;
  onCopy: (text: string, msg?: string) => void;
  buildLink: (id: string) => string;
  onJoin: (id: string) => void;
}

export default function MeetingDetailModal({
  meeting,
  onCancel,
  onCopy,
  buildLink,
  onJoin,
}: MeetingDetailModalProps) {
  const status = meeting ? meetingRowStatus(meeting) : 'upcoming';
  const isJoinable = status === 'live' || status === 'upcoming';

  return (
    <Modal
      open={Boolean(meeting)}
      onCancel={onCancel}
      footer={null}
      centered
      destroyOnHidden
      width={560}
    >
      {meeting && (
        <div style={{ padding: '4px 4px 0 4px' }}>
          <Title level={4} style={{ margin: 0 }}>
            {meeting.title}
          </Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            {status === 'live' && (
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
            {status === 'ended' && (
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
            {status === 'no_show' && (
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
            {status === 'upcoming' && (
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
            {status === 'cancelled' && (
              <span style={{
                background: '#f3f4f6',
                color: '#6b7280',
                fontWeight: 800,
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid #e5e7eb'
              }}>
                ĐÃ HỦY
              </span>
            )}
            <Text type="secondary">
              {dayjs(meeting.createdAt).format('DD/MM/YYYY, HH:mm')}
            </Text>
            {status === 'ended' && meeting.endedAt && (
              <span style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>
                • Kết thúc lúc: {dayjs(meeting.endedAt).format('HH:mm DD/MM/YYYY')}
              </span>
            )}
          </div>

          <Card
            style={{ marginTop: 14, borderRadius: 10, background: '#fafcff' }}
            styles={{ body: { padding: 14 } }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                rowGap: 14,
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text type="secondary">Mã cuộc họp:</Text>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  justifySelf: 'start',
                  background: '#fff',
                  border: '1px solid #d9e2f0',
                  borderRadius: 6,
                  padding: '4px 8px',
                }}
              >
                <Text strong>{meeting.meetingCode}</Text>
                <CopyOutlined
                  style={{ color: '#8c8c8c', cursor: 'pointer' }}
                  onClick={() => void onCopy(meeting.meetingCode)}
                />
              </div>

              <Text type="secondary">Mật khẩu phòng:</Text>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  justifySelf: 'start',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                  padding: '4px 8px',
                }}
              >
                <Text strong style={{ color: '#b45309', fontFamily: 'monospace' }}>{meeting.passcode || '—'}</Text>
                {meeting.passcode && (
                  <CopyOutlined
                    style={{ color: '#b45309', cursor: 'pointer' }}
                    onClick={() => void onCopy(meeting.passcode)}
                  />
                )}
              </div>

              <Text type="secondary">Địa điểm:</Text>
              <Text strong>{meeting.location || getVirtualRoom(meeting.hostName, meeting.id)}</Text>

              <Text type="secondary">Host:</Text>
              <Space>
                <Avatar size={24} icon={<UserOutlined />} />
                <Text strong>{meeting.location ? meeting.hostName : getHostNameOnly(meeting.hostName)}</Text>
              </Space>
            </div>

            <div style={{ borderTop: '1px solid #edf1f7', paddingTop: 12 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                Link tham gia trực tiếp:
              </Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input readOnly value={buildLink(meeting.id)} />
                <Button onClick={() => void onCopy(buildLink(meeting.id))}>Copy Link</Button>
              </Space.Compact>
            </div>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Button onClick={onCancel}>Đóng</Button>
            <Button
              type="primary"
              disabled={!isJoinable}
              onClick={() => onJoin(meeting.id)}
            >
              Tham gia ngay
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
