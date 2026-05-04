import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Spin, Space, Typography, App } from 'antd';
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/api';
import type { MeetingListItem, MeetingMinutes } from '@/dtos/meeting.dto';
import { MeetingMinutesPreview } from '@/components/meeting/MeetingMinutesPreview';
import { buildMinutesText } from '@/lib/meetingMinutesFormat';
import { exportMeetingMinutesWord } from '@/lib/exportMeetingMinutesWord';

interface ReportModalProps {
  meeting: MeetingListItem | null;
  onClose: () => void;
}

export function ReportModal({ meeting, onClose }: ReportModalProps) {
  const { message } = App.useApp();
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (meeting) {
      loadMinutes();
    } else {
      setMinutes(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting]);

  const loadMinutes = async () => {
    if (!meeting) return;
    setLoading(true);
    const res = await meetingApi.getMinutes(meeting.id);
    setLoading(false);
    if (res.error || !res.data) {
      message.error(res.error || 'Không tải được biên bản');
      return;
    }
    setMinutes(res.data);
  };

  const copyReportText = async () => {
    if (!minutes) return;
    try {
      await navigator.clipboard.writeText(buildMinutesText(minutes));
      message.success('Đã sao chép');
    } catch {
      message.error('Không sao chép được');
    }
  };

  const exportWord = async () => {
    if (!minutes) return;
    setExporting(true);
    try {
      await exportMeetingMinutesWord(minutes);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={
        <Space direction="vertical" size={2}>
          <Typography.Text style={{ fontSize: 16 }}>Biên bản cuộc họp</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
            {meeting?.title}
          </Typography.Text>
        </Space>
      }
      open={!!meeting}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="copy" icon={<CopyOutlined />} onClick={copyReportText} disabled={!minutes}>
          Copy Text
        </Button>,
        <Button key="word" icon={<DownloadOutlined />} onClick={exportWord} loading={exporting} disabled={!minutes}>
          Xuất Word
        </Button>,
        <Button key="close" onClick={onClose} type="primary">
          Đóng
        </Button>,
      ]}
    >
      <div style={{ minHeight: 300, background: '#f8fafc', padding: '20px', borderRadius: 8 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spin tip="Đang tạo biên bản..." />
          </div>
        ) : minutes ? (
          <div style={{ background: '#fff', padding: '30px 40px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <MeetingMinutesPreview minutes={minutes} reportRef={reportRef as any} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: 60 }}>
            Chưa có biên bản hoặc cuộc họp chưa kết thúc.
          </div>
        )}
      </div>
    </Modal>
  );
}
