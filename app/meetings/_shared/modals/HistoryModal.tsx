import React, { useEffect, useState } from 'react';
import { Modal, Table, Button, Space, Typography, Tag, App } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { apiService } from '@/services/api';
import type { MeetingListItem } from '@/dtos/meeting.dto';
import type { HistoryEntry } from '../helpers';
import { formatHistoryParticipationDuration } from '../helpers';

interface HistoryModalProps {
  meeting: MeetingListItem | null;
  onClose: () => void;
  isAdmin: boolean;
}

export function HistoryModal({ meeting, onClose, isAdmin }: HistoryModalProps) {
  const { message } = App.useApp();
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (meeting) {
      loadHistory();
      setPage(1);
    } else {
      setHistoryItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting]);

  const loadHistory = async () => {
    if (!meeting) return;
    setLoading(true);
    const res = await apiService.getMeetingHistory(meeting.id);
    if (res.error || !res.data) {
      setLoading(false);
      message.error(res.error || 'Không tải được lịch sử cuộc họp');
      setHistoryItems([]);
      return;
    }
    const items = (res.data as HistoryEntry[]) ?? [];

    if (isAdmin && items.length > 0) {
      const usersRes = await apiService.getAllUsers();
      if (usersRes.data && Array.isArray(usersRes.data)) {
        const byId = new Map<string, string>();
        for (const u of usersRes.data as any[]) {
          const id = String(u?.id ?? '');
          const fullName = String(u?.fullName ?? '').trim();
          if (id && fullName) byId.set(id, fullName);
        }
        setHistoryItems(items.map((h) => ({ ...h, fullName: byId.get(h.userId) ?? null })));
        setLoading(false);
        return;
      }
    }

    setHistoryItems(items);
    setLoading(false);
  };

  const exportExcel = () => {
    if (!meeting) return;
    if (historyItems.length === 0) {
      message.warning('Không có dữ liệu để xuất');
      return;
    }
    setExporting(true);
    try {
      const rows = historyItems.map((r, i) => ({
        STT: i + 1,
        'Người dùng': r.fullName?.trim() || r.username,
        Username: r.username,
        'Vào lúc': r.joinedAt ? dayjs(r.joinedAt).format('DD/MM/YYYY HH:mm:ss') : '',
        'Rời lúc': r.leftAt ? dayjs(r.leftAt).format('DD/MM/YYYY HH:mm:ss') : 'Đang tham gia',
        'Thời lượng tham gia': formatHistoryParticipationDuration(r),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử');
      const safeTitle = meeting.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const stamp = dayjs().format('YYYYMMDD-HHmm');
      XLSX.writeFile(wb, `lich-su-cuoc-hoc-${safeTitle}-${stamp}.xlsx`);
    } catch {
      message.error('Xuất Excel thất bại');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={
        <Space direction="vertical" size={2}>
          <Typography.Text style={{ fontSize: 16 }}>Lịch sử tham gia cuộc họp</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>
            {meeting?.title}
          </Typography.Text>
        </Space>
      }
      open={!!meeting}
      onCancel={onClose}
      footer={[
        <Button key="export" icon={<FileExcelOutlined />} onClick={exportExcel} loading={exporting}>
          Xuất Excel
        </Button>,
        <Button key="close" onClick={onClose} type="primary">
          Đóng
        </Button>,
      ]}
      width={800}
    >
      <Table
        dataSource={historyItems}
        loading={loading}
        rowKey="id"
        size="small"
        pagination={{
          current: page,
          pageSize,
          showSizeChanger: true,
          onChange: (p, s) => { setPage(p); setPageSize(s); },
        }}
        columns={[
          { title: 'STT', width: 60, align: 'center', render: (_: any, __: any, i) => (page - 1) * pageSize + i + 1 },
          { title: 'Người dùng', render: (_: any, r: HistoryEntry) => (
            <Space direction="vertical" size={0}>
              <Typography.Text strong>{r.fullName || r.username}</Typography.Text>
              {r.fullName && <Typography.Text type="secondary" style={{ fontSize: 12 }}>@{r.username}</Typography.Text>}
            </Space>
          )},
          { title: 'Thời gian tham gia', width: 140, render: (_: any, r: HistoryEntry) => dayjs(r.joinedAt).format('DD/MM/YYYY HH:mm') },
          { title: 'Thời lượng', width: 120, render: (_: any, r: HistoryEntry) => formatHistoryParticipationDuration(r) },
          { title: 'Trạng thái', width: 110, render: (_: any, r: HistoryEntry) => r.leftAt ? <Tag color="default">Đã rời</Tag> : <Tag color="processing">Đang tham gia</Tag> },
        ]}
      />
    </Modal>
  );
}
