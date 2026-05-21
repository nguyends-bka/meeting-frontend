import React from 'react';
import { Card, Space, Typography, Select, Input, Table, Tag, Button, Dropdown, Row, Col, Pagination, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { SearchOutlined, SettingOutlined, CalendarOutlined, PlusOutlined, MoreOutlined, CaretRightOutlined, HistoryOutlined, FormOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MeetingListItem } from '@/dtos/meeting.dto';
import { getMeetingStatus, isHostForMeeting } from './helpers';

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
  user: any;
  router: any;
  isAdmin: boolean;
}

export function MeetingsListView({
  statTotal, statUpcoming, statLive, statDone, statNoShow,
  filterStatus, setFilterStatus,
  searchText, setSearchText,
  paginatedMeetings, loadingMeetings,
  tablePage, tablePageSize, totalPages, filteredMeetings,
  setTablePage, setTablePageSize,
  openDetailModal, openHistoryModal, openEditMeetingModal, openPollListModal,
  user, router, isAdmin
}: MeetingsListViewProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'upcoming': return <span className="status-pill status-pill-upcoming">Sắp diễn ra</span>;
      case 'live': return <span className="status-pill status-pill-live">Đang diễn ra</span>;
      case 'done': return <span className="status-pill status-pill-done">Đã kết thúc</span>;
      case 'no_show': return <span className="status-pill status-pill-done" style={{ opacity: 0.8 }}>Không diễn ra</span>;
      default: return null;
    }
  };

  return (
    <>
      {/* CỘT THỐNG KÊ (Thay thế media query grid bằng Row/Col) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {[
          { key: 'all', title: 'Tất cả', count: statTotal, color: '#2563eb' },
          { key: 'upcoming', title: 'Sắp tới', count: statUpcoming, color: '#d97706' },
          { key: 'live', title: 'Đang diễn ra', count: statLive, color: '#059669', isBlink: true },
          { key: 'done', title: 'Đã xong', count: statDone, color: '#475569' },
          { key: 'no_show', title: 'Không diễn ra', count: statNoShow, color: '#94a3b8' },
        ].map(item => (
          <Col xs={12} sm={8} lg={4} key={item.key} style={{ display: 'flex' }}>
            <Card
              className="stat-card"
              hoverable
              onClick={() => setFilterStatus(item.key as any)}
              style={{
                flex: 1,
                borderColor: filterStatus === item.key ? item.color : '#e2e8f0',
                background: filterStatus === item.key ? `${item.color}0a` : '#fff',
                boxShadow: filterStatus === item.key ? `0 0 0 1px ${item.color}33` : 'none',
                cursor: 'pointer'
              }}
              styles={{ body: { padding: '14px 16px', display: 'flex', flexDirection: 'column' } }}
            >
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.isBlink && filterStatus === item.key && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, animation: 'blink 1.5s infinite' }} />
                )}
                {item.title}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{item.count}</div>
            </Card>
          </Col>
        ))}
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
            style={{ borderRadius: 8, height: 38 }}
          />
        </div>
        <div className="filter-chip-row">
          <div className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>
            Tất cả
          </div>
          <div className={`filter-chip ${filterStatus === 'live' ? 'active' : ''}`} onClick={() => setFilterStatus('live')}>
            <span style={{ color: filterStatus === 'live' ? '#059669' : '#10b981', fontSize: 14 }}>●</span> Live
          </div>
          <div className={`filter-chip ${filterStatus === 'upcoming' ? 'active' : ''}`} onClick={() => setFilterStatus('upcoming')}>
            <CalendarOutlined /> Sắp tới
          </div>
          <div className={`filter-chip ${filterStatus === 'done' ? 'active' : ''}`} onClick={() => setFilterStatus('done')}>
            Đã xong
          </div>
          <div className={`filter-chip ${filterStatus === 'no_show' ? 'active' : ''}`} onClick={() => setFilterStatus('no_show')}>
            Không ai tham gia
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
          columns={[
            {
              title: 'Tên cuộc họp',
              key: 'info',
              render: (_: any, record: MeetingListItem) => (
                <Space direction="vertical" size={2}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Typography.Text strong style={{ fontSize: 15, color: 'var(--color-body, #1e293b)' }}>{record.title}</Typography.Text>
                    {isHostForMeeting(record, user) && (
                      <Tag color="blue" style={{ border: 0, borderRadius: 12, margin: 0, fontWeight: 500 }}>Host</Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', margin: '2px 0' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-secondary, #64748b)' }}>
                      <span>Mã:</span>
                      <Typography.Text code copyable={{ text: record.meetingCode, tooltips: ['Sao chép mã', 'Đã sao chép'] }} style={{ fontSize: 12, padding: '1px 5px', margin: 0 }}>
                        {record.meetingCode}
                      </Typography.Text>
                    </span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-secondary, #64748b)' }}>
                      <span>Mật khẩu:</span>
                      <Typography.Text code copyable={{ text: record.passcode, tooltips: ['Sao chép mật khẩu', 'Đã sao chép'] }} style={{ fontSize: 12, padding: '1px 5px', margin: 0 }}>
                        {record.passcode}
                      </Typography.Text>
                    </span>
                  </div>
                  <Typography.Text style={{ fontSize: 12, color: 'var(--color-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CalendarOutlined style={{ color: 'var(--color-muted, #94a3b8)' }} />
                    <span>
                      {dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}
                      {record.startedAt && ` → ${dayjs(record.startedAt).format('HH:mm')}`}
                      {record.endedAt && (
                        <span style={{ marginLeft: 6, color: '#f43f5e', fontWeight: 500 }}>
                          (Kết thúc: {dayjs(record.endedAt).format('HH:mm')})
                        </span>
                      )}
                    </span>
                  </Typography.Text>
                </Space>
              ),
            },
            {
              title: 'Trạng thái',
              key: 'status',
              width: 180,
              align: 'center',
              render: (_: any, record: MeetingListItem) => {
                const s = getMeetingStatus(record);
                return (
                  <Space direction="vertical" size={2} align="center" style={{ width: '100%' }}>
                    {getStatusBadge(s)}
                    {(record.activeParticipantCount ?? 0) > 0 && (
                      <Typography.Text style={{ fontSize: 12, color: '#059669', fontWeight: 500, marginTop: 4 }}>
                        ● {record.activeParticipantCount} người đang họp
                      </Typography.Text>
                    )}
                  </Space>
                );
              },
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 180,
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
                      style={{ borderRadius: 6, fontWeight: 500 }}
                    >
                      Chi tiết <CaretRightOutlined />
                    </Button>
                    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                      <Button 
                        icon={<MoreOutlined />} 
                        style={{ 
                          color: '#64748b', 
                          borderRadius: 6, 
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
