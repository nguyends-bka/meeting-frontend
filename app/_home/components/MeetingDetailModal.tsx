import React from 'react';
import { Modal, Space, Avatar, Input, Button, Typography, Tooltip } from 'antd';
import { UserOutlined, CopyOutlined, NumberOutlined, KeyOutlined, EnvironmentOutlined, LinkOutlined, RightCircleOutlined, ProfileOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow } from '../types';
import { meetingRowStatus, getHostNameOnly, getVirtualRoom } from '../helpers';

const { Title, Text } = Typography;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  live: { label: 'ĐANG DIỄN RA', cls: 'mdm-pill-live' },
  ended: { label: 'ĐÃ KẾT THÚC', cls: 'mdm-pill-ended' },
  no_show: { label: 'KHÔNG DIỄN RA', cls: 'mdm-pill-noshow' },
  upcoming: { label: 'SẮP DIỄN RA', cls: 'mdm-pill-upcoming' },
  cancelled: { label: 'ĐÃ HỦY', cls: 'mdm-pill-cancelled' },
};

interface MeetingDetailModalProps {
  meeting: HomeMeetingRow | null;
  onCancel: () => void;
  onCopy: (text: string, msg?: string) => void;
  buildLink: (id: string) => string;
  onJoin: (id: string) => void;
  /** Mở trang xem chi tiết đầy đủ của cuộc họp (/meetings/[id]). */
  onViewDetail?: (id: string) => void;
}

export default function MeetingDetailModal({
  meeting,
  onCancel,
  onCopy,
  buildLink,
  onJoin,
  onViewDetail,
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
        <div className="mdm">
          {/* Tiêu đề + trạng thái */}
          <Title level={4} className="mdm-title">{meeting.title}</Title>
          <div className="mdm-subrow">
            {STATUS_META[status] && (
              <span className={`mdm-pill ${STATUS_META[status].cls}`}>
                {status === 'live' && <span className="pulse-dot-green-custom" style={{ width: 6, height: 6, background: '#22c55e' }} />}
                {STATUS_META[status].label}
              </span>
            )}
            <Text type="secondary" style={{ fontSize: 13 }}>
              {dayjs(meeting.createdAt).format('DD/MM/YYYY, HH:mm')}
            </Text>
            {status === 'ended' && meeting.endedAt && (
              <span style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>
                • Kết thúc: {dayjs(meeting.endedAt).format('HH:mm DD/MM/YYYY')}
              </span>
            )}
          </div>

          {/* Mã phòng + Passcode */}
          <div className="cmr-info-grid" style={{ marginTop: 16 }}>
            <div className="cmr-info-card">
              <div className="cmr-info-label"><NumberOutlined /> Mã cuộc họp</div>
              <div className="cmr-info-value-row">
                <span className="cmr-info-value cmr-accent">{meeting.meetingCode}</span>
                <Tooltip title="Sao chép mã">
                  <Button type="text" size="small" icon={<CopyOutlined />} className="cmr-copy-btn"
                    onClick={() => void onCopy(meeting.meetingCode, 'Đã copy mã phòng')} />
                </Tooltip>
              </div>
            </div>
            <div className="cmr-info-card">
              <div className="cmr-info-label"><KeyOutlined /> Mật khẩu phòng</div>
              <div className="cmr-info-value-row">
                <span className="cmr-info-value">{meeting.passcode || '—'}</span>
                {meeting.passcode && (
                  <Tooltip title="Sao chép passcode">
                    <Button type="text" size="small" icon={<CopyOutlined />} className="cmr-copy-btn"
                      onClick={() => void onCopy(meeting.passcode, 'Đã copy passcode')} />
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* Địa điểm + Host */}
          <div className="mdm-meta-row">
            <div className="mdm-meta">
              <div className="cmr-info-label"><EnvironmentOutlined /> Địa điểm</div>
              <Text strong style={{ fontSize: 14 }}>{meeting.location || getVirtualRoom(meeting.hostName, meeting.id)}</Text>
            </div>
            <div className="mdm-meta">
              <div className="cmr-info-label"><UserOutlined /> Host</div>
              <Space size={8}>
                <Avatar size={26} icon={<UserOutlined />} style={{ background: '#dbeafe', color: '#2563eb' }} />
                <Text strong style={{ fontSize: 14 }}>{meeting.location ? meeting.hostName : getHostNameOnly(meeting.hostName)}</Text>
              </Space>
            </div>
          </div>

          {/* Link */}
          <div className="cmr-link-block" style={{ marginBottom: 20 }}>
            <div className="cmr-info-label"><LinkOutlined /> Link tham gia trực tiếp</div>
            <Space.Compact style={{ width: '100%', marginTop: 6 }}>
              <Input readOnly value={buildLink(meeting.id)} className="cmr-link-input" />
              <Button type="primary" icon={<CopyOutlined />} onClick={() => void onCopy(buildLink(meeting.id), 'Đã copy link')}>
                Sao chép
              </Button>
            </Space.Compact>
          </div>

          <div className="cmr-actions" style={{ justifyContent: 'space-between' }}>
            {onViewDetail ? (
              <Button size="large" icon={<ProfileOutlined />} onClick={() => onViewDetail(meeting.id)}>
                Xem chi tiết
              </Button>
            ) : <span />}
            <Space size={8}>
              <Button size="large" onClick={onCancel}>Đóng</Button>
              <Button type="primary" size="large" icon={<RightCircleOutlined />} disabled={!isJoinable} onClick={() => onJoin(meeting.id)}>
                Tham gia ngay
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}
