import React from 'react';
import { Modal, Space, Button, Card, Table, Empty, Typography } from 'antd';
import { FileExcelOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HomeMeetingRow, HistoryEntry } from '../types';
import { formatHistoryParticipationDuration } from '../helpers';

const { Title, Text } = Typography;

interface MeetingHistoryModalProps {
  meeting: HomeMeetingRow | null;
  items: HistoryEntry[];
  loading: boolean;
  exporting: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onRefresh: () => void;
  onExport: () => void;
  onCancel: () => void;
}

export default function MeetingHistoryModal({
  meeting,
  items,
  loading,
  exporting,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  onExport,
  onCancel,
}: MeetingHistoryModalProps) {
  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <Title level={5} style={{ margin: 0 }}>
              Lịch sử cuộc họp
            </Title>
            <Text type="secondary" style={{ display: 'block' }}>
              {meeting ? meeting.title : 'Xem lịch sử tham gia'}
            </Text>
          </div>
          <Space>
            <Button
              icon={<FileExcelOutlined />}
              onClick={onExport}
              loading={exporting}
              disabled={loading || items.length === 0}
            >
              Xuất Excel
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              loading={loading}
            >
              Làm mới
            </Button>
          </Space>
        </div>
      }
      open={Boolean(meeting)}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>Đóng</Button>
        </div>
      }
      destroyOnHidden
      width={1200}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      styles={{ body: { background: '#f5f7fb' } }}
    >
      <Card variant="borderless" style={{ borderRadius: 14 }}>
        <Table<HistoryEntry>
          rowKey="id"
          loading={loading}
          dataSource={items}
          tableLayout="fixed"
          pagination={{
            current: page,
            pageSize: pageSize,
            total: items.length,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: onPageChange,
          }}
          locale={{
            emptyText: loading ? 'Đang tải...' : <Empty description="Chưa có lịch sử cuộc họp" />,
          }}
          columns={[
            {
              title: 'STT',
              key: 'stt',
              width: 70,
              align: 'center',
              render: (_v, _r, index) =>
                (page - 1) * pageSize + index + 1,
            },
            {
              title: 'Người dùng',
              dataIndex: 'username',
              key: 'username',
              render: (_v: string, r: HistoryEntry) => r.fullName?.trim() || r.username,
            },
            {
              title: 'Vào lúc',
              dataIndex: 'joinedAt',
              key: 'joinedAt',
              width: 170,
              render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '-'),
            },
            {
              title: 'Rời lúc',
              dataIndex: 'leftAt',
              key: 'leftAt',
              width: 170,
              render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : 'Đang tham gia'),
            },
            {
              title: 'Thời lượng',
              dataIndex: 'duration',
              key: 'duration',
              width: 240,
              align: 'right',
              ellipsis: false,
              render: (_v: number | null, r: HistoryEntry) => (
                <span style={{ whiteSpace: 'nowrap' }}>{formatHistoryParticipationDuration(r)}</span>
              ),
            },
          ]}
        />
      </Card>
    </Modal>
  );
}
