import React from 'react';
import { Card, Space, Typography, Input, Table, Tag, Button, Dropdown, Row, Col, Pagination, Empty, Modal } from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined, SettingOutlined, CalendarOutlined, MoreOutlined, CaretRightOutlined,
  HistoryOutlined, FormOutlined, AppstoreOutlined, ClockCircleOutlined, PlayCircleOutlined,
  CheckCircleOutlined, StopOutlined, VideoCameraOutlined, EnvironmentOutlined, UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MeetingListItem } from '@/dtos/meeting.dto';
import { getMeetingStatus, isHostForMeeting } from './helpers';
import { getHostNameOnly, getVirtualRoom } from '@/app/_home/helpers';

interface MeetingsListViewProps {
  statTotal: number;
  statUpcoming: number;
  statLive: number;
  statDone: number;
  statNoShow: number;
  filterStatus: 'all' | 'upcoming' | 'live' | 'done' | 'no_show';
  setFilterStatus: (val: 'all' | 'upcoming' | 'live' | 'done' | 'no_show') => void;
  searchText: string;
  setSearchText: (val: string) => void;
  paginatedMeetings: MeetingListItem[];
  loadingMeetings: boolean;
  tablePage: number;
  tablePageSize: number;
  totalPages: number;
  filteredMeetings: MeetingListItem[];
  setTablePage: (page: number) => void;
  setTablePageSize: (size: number) => void;
  openDetailModal: (meeting: MeetingListItem) => void;
  openHistoryModal: (meeting: MeetingListItem) => void;
  openEditMeetingModal: (meeting: MeetingListItem) => void;
  openPollListModal: (meeting: MeetingListItem) => void;
  handleCancelMeeting: (id: string) => void;
  user: any;
  router: any;
  isAdmin: boolean;
}

const STAT_ITEMS = [
  { key: 'all', title: 'Tất cả', color: '#2563eb', icon: <AppstoreOutlined /> },
  { key: 'upcoming', title: 'Sắp tới', color: '#d97706', icon: <ClockCircleOutlined /> },
  { key: 'live', title: 'Đang diễn ra', color: '#059669', icon: <PlayCircleOutlined />, isBlink: true },
  { key: 'done', title: 'Đã xong', color: '#475569', icon: <CheckCircleOutlined /> },
  { key: 'no_show', title: 'Không diễn ra', color: '#94a3b8', icon: <StopOutlined /> },
] as const;

export function MeetingsListView({
  statTotal, statUpcoming, statLive, statDone, statNoShow,
  filterStatus, setFilterStatus,
  searchText, setSearchText,
  paginatedMeetings, loadingMeetings,
  tablePage, tablePageSize, totalPages, filteredMeetings,
  setTablePage, setTablePageSize,
  openDetailModal, openHistoryModal, openEditMeetingModal, openPollListModal,
  handleCancelMeeting,
  user, router, isAdmin
}: MeetingsListViewProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const counts: Record<string, number> = {
    all: statTotal, upcoming: statUpcoming, live: statLive, done: statDone, no_show: statNoShow,
  };

  const getStatusBadge = (status: string, record?: MeetingListItem) => {
    switch (status) {
      case 'upcoming': {
        if (record) {
          const now = dayjs();
          const start = dayjs(record.createdAt);
          const diffMinutes = start.diff(now, 'minute');
          if (diffMinutes > 60) {
            return <span className="status-pill status-pill-cancelled">Đã lên lịch</span>;
          } else if (diffMinutes > 0) {
            return <span className="status-pill status-pill-upcoming">Sắp diễn ra</span>;
          } else {
            return <span className="status-pill status-pill-upcoming" style={{ background: '#fff7ed', color: '#ea580c', borderColor: '#ffedd5' }}>Chờ bắt đầu</span>;
          }
        }
        return <span className="status-pill status-pill-upcoming">Sắp diễn ra</span>;
      }
      case 'live': return <span className="status-pill status-pill-live"><span className="live-dot" />Đang diễn ra</span>;
      case 'done': return <span className="status-pill status-pill-done">Đã kết thúc</span>;
      case 'no_show': return <span className="status-pill status-pill-no_show">Không diễn ra</span>;
      case 'cancelled': return <span className="status-pill status-pill-cancelled">Đã hủy</span>;
      default: return null;
    }
  };

  // Màu avatar theo trạng thái để mắt dễ quét
  const avatarStyleFor = (status: string): React.CSSProperties => {
    switch (status) {
      case 'live': return { background: '#ecfdf5', color: '#059669' };
      case 'upcoming': return { background: '#fff7ed', color: '#d97706' };
      case 'no_show': return { background: '#fef2f2', color: '#dc2626' };
      default: return { background: '#f1f5f9', color: '#64748b' };
    }
  };

  return (
    <>
      {/* HEADER TRANG */}
      <div className="meetings-page-head">
        <div>
          <Typography.Title level={4} className="meetings-page-title">Tất cả cuộc họp</Typography.Title>
          <Typography.Text className="meetings-page-sub">
            Quản lý, theo dõi và truy cập nhanh các cuộc họp của bạn
          </Typography.Text>
        </div>
        <div className="meetings-total-badge">
          <VideoCameraOutlined />
          <span><strong>{statTotal}</strong> cuộc họp</span>
        </div>
      </div>

      {/* CỘT THỐNG KÊ */}
      <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
        {STAT_ITEMS.map(item => {
          const active = filterStatus === item.key;
          const isBlink = 'isBlink' in item && item.isBlink;
          return (
            <Col xs={12} sm={8} lg={Math.floor(24 / STAT_ITEMS.length) || 4} key={item.key} style={{ display: 'flex' }}>
              <button
                type="button"
                className={`stat-card ${active ? 'active' : ''}`}
                onClick={() => setFilterStatus(item.key as any)}
                style={{
                  '--stat-color': item.color,
                } as React.CSSProperties}
              >
                <div className="stat-card-top">
                  <span className="stat-icon" style={{ color: item.color, background: `${item.color}14` }}>
                    {item.icon}
                  </span>
                  {isBlink && counts[item.key] > 0 && <span className="stat-live-dot" />}
                </div>
                <div className="stat-count">{counts[item.key]}</div>
                <div className="stat-title">{item.title}</div>
              </button>
            </Col>
          );
        })}
      </Row>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tìm theo tên, mã phòng, host..."
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ borderRadius: 10, height: 40 }}
          />
        </div>
        <div className="filter-chip-row">
          <div className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>
            Tất cả
          </div>
          <div className={`filter-chip ${filterStatus === 'live' ? 'active' : ''}`} onClick={() => setFilterStatus('live')}>
            <span className="chip-live-dot" /> Đang diễn ra
          </div>
          <div className={`filter-chip ${filterStatus === 'upcoming' ? 'active' : ''}`} onClick={() => setFilterStatus('upcoming')}>
            <CalendarOutlined /> Sắp tới
          </div>
          <div className={`filter-chip ${filterStatus === 'done' ? 'active' : ''}`} onClick={() => setFilterStatus('done')}>
            Đã xong
          </div>
          <div className={`filter-chip ${filterStatus === 'no_show' ? 'active' : ''}`} onClick={() => setFilterStatus('no_show')}>
            Không diễn ra
          </div>
        </div>
      </div>

      {/* DANH SÁCH BẢNG / CARDS */}
      <Card className="table-card" styles={{ body: { padding: 0 } }}>
        <Table<MeetingListItem>
          rowKey="id"
          dataSource={paginatedMeetings}
          loading={loadingMeetings}
          pagination={false}
          scroll={{ x: 'max-content' }}
          className="meetings-table"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ color: '#94a3b8' }}>
                    {searchText ? 'Không tìm thấy cuộc họp phù hợp' : 'Chưa có cuộc họp nào'}
                  </span>
                }
                style={{ padding: '40px 0' }}
              />
            ),
          }}
          columns={[
            {
              title: 'Tên cuộc họp',
              key: 'info',
              render: (_: any, record: MeetingListItem) => {
                const s = getMeetingStatus(record);
                const title = record.title || 'Cuộc họp';
                return (
                  <div className="mtg-row">
                    <div className="mtg-avatar" style={avatarStyleFor(s)}>
                      {title.trim().charAt(0).toUpperCase() || 'M'}
                    </div>
                    <Space direction="vertical" size={3} style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Typography.Text strong style={{ fontSize: 15, color: 'var(--color-body, #1e293b)' }}>{title}</Typography.Text>
                        {isHostForMeeting(record, user) && (
                          <Tag color="blue" style={{ border: 0, borderRadius: 12, margin: 0, fontWeight: 500, fontSize: 11, lineHeight: '18px' }}>Host</Tag>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="mtg-meta-label">Mã:</span>
                        <Typography.Text code copyable={{ text: record.meetingCode, tooltips: ['Sao chép mã', 'Đã sao chép'] }} style={{ fontSize: 12, padding: '1px 6px', margin: 0 }}>
                          {record.meetingCode}
                        </Typography.Text>
                        <span className="mtg-dot">•</span>
                        <span className="mtg-meta-label">Mật khẩu:</span>
                        <Typography.Text code copyable={{ text: record.passcode, tooltips: ['Sao chép mật khẩu', 'Đã sao chép'] }} style={{ fontSize: 12, padding: '1px 6px', margin: 0 }}>
                          {record.passcode}
                        </Typography.Text>
                      </div>
                      <div className="mtg-meta-line">
                        <span className="mtg-meta-chip"><EnvironmentOutlined /> {record.location || getVirtualRoom(record.hostName, record.id)}</span>
                        <span className="mtg-meta-chip"><UserOutlined /> {record.location ? record.hostName : getHostNameOnly(record.hostName)}</span>
                      </div>
                      <div className="mtg-meta-line mtg-time">
                        <CalendarOutlined />
                        <span>
                          {dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}
                          {record.startedAt && ` → ${dayjs(record.startedAt).format('HH:mm')}`}
                          {record.endedAt && (
                            <span style={{ marginLeft: 6, color: '#f43f5e', fontWeight: 500 }}>
                              (Kết thúc: {dayjs(record.endedAt).format('HH:mm')})
                            </span>
                          )}
                        </span>
                      </div>
                    </Space>
                  </div>
                );
              },
            },
            {
              title: 'Trạng thái',
              key: 'status',
              width: 170,
              align: 'center',
              render: (_: any, record: MeetingListItem) => {
                const s = getMeetingStatus(record);
                return (
                  <Space direction="vertical" size={4} align="center" style={{ width: '100%' }}>
                    {getStatusBadge(s, record)}
                    {(record.activeParticipantCount ?? 0) > 0 && (
                      <Typography.Text style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>
                        {record.activeParticipantCount} người đang họp
                      </Typography.Text>
                    )}
                  </Space>
                );
              },
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 170,
              align: 'center',
              render: (_: any, record: MeetingListItem) => {
                const s = getMeetingStatus(record);
                const isHost = isHostForMeeting(record, user);
                const items: MenuProps['items'] = [
                  {
                    key: 'history',
                    icon: <HistoryOutlined />,
                    label: 'Xem lịch sử',
                    onClick: () => openHistoryModal(record),
                  },
                ];
                if (isHost && s === 'upcoming') {
                  items.unshift({
                    key: 'edit',
                    icon: <FormOutlined />,
                    label: 'Sửa cuộc họp',
                    onClick: () => openEditMeetingModal(record),
                  });
                  items.push({
                    key: 'cancel',
                    icon: <span style={{ color: '#ef4444', fontWeight: 'bold' }}>✕</span>,
                    label: <span style={{ color: '#ef4444' }}>Hủy cuộc họp</span>,
                    danger: true,
                    onClick: () => {
                      Modal.confirm({
                        title: 'Xác nhận hủy cuộc họp',
                        content: `Bạn có chắc chắn muốn hủy cuộc họp "${record.title}" không? Hành động này không thể hoàn tác.`,
                        okText: 'Hủy cuộc họp',
                        okType: 'danger',
                        cancelText: 'Quay lại',
                        onOk: () => {
                          handleCancelMeeting(record.id);
                        },
                      });
                    },
                  });
                }
                if (record.canManagePoll || isHost) {
                  items.push({
                    key: 'polls',
                    icon: <SettingOutlined />,
                    label: 'Quản lý biểu quyết',
                    onClick: () => openPollListModal(record),
                  });
                }

                return (
                  <Space size={8} align="center" style={{ justifyContent: 'center', width: '100%' }}>
                    <Button
                      type="primary"
                      onClick={() => openDetailModal(record)}
                      style={{ borderRadius: 8, fontWeight: 500 }}
                    >
                      Chi tiết <CaretRightOutlined />
                    </Button>
                    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                      <Button
                        icon={<MoreOutlined />}
                        style={{
                          color: '#64748b',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      />
                    </Dropdown>
                  </Space>
                );
              },
            },
          ]}
        />
        {filteredMeetings.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <Typography.Text style={{ color: '#64748b', fontSize: 13 }}>
              Hiển thị {(tablePage - 1) * tablePageSize + 1} - {Math.min(tablePage * tablePageSize, filteredMeetings.length)} trong số {filteredMeetings.length}
            </Typography.Text>
            <Pagination
              className="meetings-pagination"
              current={tablePage}
              pageSize={tablePageSize}
              total={filteredMeetings.length}
              onChange={(p, s) => { setTablePage(p); setTablePageSize(s); }}
              showSizeChanger
              pageSizeOptions={[10, 20, 50]}
              size={isMobile ? "small" : "default"}
            />
          </div>
        )}
      </Card>
    </>
  );
}
