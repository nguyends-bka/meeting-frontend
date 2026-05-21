import React from 'react';
import { Modal, Card, Space, Avatar, Input, Button, Typography } from 'antd';
import { UserOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';

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
          <Text type="secondary">
            Sắp diễn ra • {dayjs(meeting.createdAt).format('DD/MM/YYYY, HH:mm')}
          </Text>

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
              <Text type="secondary">Mã tham gia:</Text>
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

              <Text type="secondary">Host</Text>
              <Space>
                <Avatar size={24} icon={<UserOutlined />} />
                <Text strong>{meeting.hostName}</Text>
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
