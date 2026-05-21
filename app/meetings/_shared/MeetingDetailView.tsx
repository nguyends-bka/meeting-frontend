import React, { useMemo } from 'react';
import { Card, Space, Typography, Tag, Button, Input, Select, Table, Popconfirm } from 'antd';
import { 
  ArrowLeftOutlined, CopyOutlined, LinkOutlined, PlayCircleOutlined,
  CalendarOutlined, FileWordOutlined, FileTextOutlined, HistoryOutlined,
  HourglassOutlined, CheckCircleOutlined, DeleteOutlined, VideoCameraOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MeetingListItem, MeetingInvitee, MeetingCoHostItem, MeetingRecordingDto } from '@/dtos/meeting.dto';
import { 
  getMeetingStatus, isHostForMeeting, canManageMeetingInvitees, canEditMeeting, 
  buildMeetingLink, formatRecordingDuration, participantInitials 
} from './helpers';

interface MeetingDetailViewProps {
  detailMeeting: MeetingListItem;
  setDetailMeeting: (m: MeetingListItem | null) => void;
  user: any;
  isAdmin: boolean;
  router: any;
  message: any;
  
  // Handlers for quick actions
  openDocumentsModal: (m: MeetingListItem) => void;
  openReportModal: (m: MeetingListItem) => void;
  openPollListModal: (m: MeetingListItem) => void;
  openHistoryModal: (m: MeetingListItem) => void;
  openEditMeetingModal: (m: MeetingListItem) => void;
  handleDeleteMeeting: (id: string) => void;
  
  // Recordings
  meetingRecordings: MeetingRecordingDto[];
  meetingRecordingsLoading: boolean;
  openRecordingPlayback: (meetingId: string, r: MeetingRecordingDto) => void;
  onDeleteMeetingRecording: (r: MeetingRecordingDto) => void;
  recordingDeletingId: string | null;

  // Invitees & Co-hosts
  meetingInvitees: MeetingInvitee[];
  meetingCoHosts: MeetingCoHostItem[];
  meetingInviteesLoading: boolean;
  inviteUsernameInput: string;
  setInviteUsernameInput: (val: string) => void;
  submitAddInvitee: () => void;
  addingInvitee: boolean;
  removeInviteeRow: (username: string) => void;
  removingInviteeUsername: string | null;
  promoteInviteeToCoHost: (username: string) => void;
  promotingInviteeUsername: string | null;
  demoteCoHostToInvitee: (username: string) => void;
  demotingCoHostUsername: string | null;
  removeCoHostRow: (userId: string) => void;
  removingCoHostUserId: string | null;
}

export function MeetingDetailView(props: MeetingDetailViewProps) {
  const { detailMeeting: m, user, isAdmin, router, message } = props;
  const isHost = isHostForMeeting(m, user);
  const status = getMeetingStatus(m);
  
  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success('Đã sao chép');
    } catch {
      message.error('Không sao chép được');
    }
  };

  const getStatusPill = () => {
    if (status === 'live') return <span className="status-pill status-pill-live">● Đang diễn ra</span>;
    if (status === 'upcoming') return <span className="status-pill status-pill-upcoming">Sắp diễn ra</span>;
    return <span className="status-pill status-pill-done">Đã kết thúc</span>;
  };

  // -- Bảng Users (Invitees & Co-hosts) --
  const combinedUsers = useMemo(() => {
    const arr: any[] = [];
    if (m.hostIdentity) {
      arr.push({ type: 'host', key: m.hostIdentity, username: m.hostIdentity, fullName: m.hostName, roleTitle: 'Host', isHost: true });
    }
    props.meetingCoHosts.forEach(co => {
      arr.push({ type: 'co-host', key: co.hostUserId, username: co.username, fullName: co.fullName, roleTitle: 'Co-Host', isCoHost: true, userId: co.hostUserId });
    });
    props.meetingInvitees.forEach(inv => {
      arr.push({ type: 'invitee', key: inv.username, username: inv.username, fullName: inv.fullName, roleTitle: 'Người tham dự', isInvitee: true });
    });
    return arr;
  }, [m, props.meetingCoHosts, props.meetingInvitees]);

  const canManageInvitees = canManageMeetingInvitees(m, user, isAdmin);

  return (
    <div className="page-detail">
      <button className="detail-back" onClick={() => props.setDetailMeeting(null)}>
        <ArrowLeftOutlined /> Quay lại danh sách
      </button>

      <div className="detail-header detail-header-modern">
        <div className="detail-top">
          <div>
            <div className="detail-title">{m.title}</div>
            <div className="detail-meta-line">
              <span>Tạo lúc: {dayjs(m.createdAt).format('DD/MM/YYYY HH:mm')}</span>
              <span className="dot-sep">•</span>
              <span>{m.participantCount} lượt tham gia</span>
            </div>
          </div>
          {getStatusPill()}
        </div>

        <div className="detail-modern-grid">
          <div className="time-range-card">
            <div>
              <div className="section-mini-title">Bắt đầu</div>
              <div className="section-mini-value">{dayjs(m.createdAt).format('HH:mm')}</div>
              <div className="section-mini-sub">{dayjs(m.createdAt).format('DD/MM/YYYY')}</div>
            </div>
            <ArrowLeftOutlined className="range-arrow" rotate={180} />
            <div>
              <div className="section-mini-title">Kết thúc (dự kiến)</div>
              {m.startedAt ? (
                <>
                  <div className="section-mini-value">{dayjs(m.startedAt).format('HH:mm')}</div>
                  <div className="section-mini-sub">{dayjs(m.startedAt).format('DD/MM/YYYY')}</div>
                </>
              ) : (
                <div className="section-mini-value" style={{ color: '#94a3b8' }}>--:--</div>
              )}
            </div>
          </div>
          
          <div className="host-modern-card">
            <div className="section-mini-title">Chủ tọa / Host</div>
            <div className="host-row">
              <div className="host-avatar-mini">{participantInitials(m.hostName, m.hostIdentity)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="host-name-main" title={m.hostName}>{m.hostName}</div>
                <div className="host-role-sub">@{m.hostIdentity}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="join-info-wrap">
          <h3 className="join-info-title">Thông tin tham gia</h3>
          <div className="detail-modern-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 0 }}>
            <div className="access-card">
              <div className="ac-label">Link cuộc họp</div>
              <div className="ac-val-row">
                <div className="ac-val" style={{ color: '#2563eb' }}>{buildMeetingLink(m.id)}</div>
                <Button 
                  size="small" 
                  type="text" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyText(buildMeetingLink(m.id))}
                  style={{ color: '#2563eb', fontSize: 12, fontWeight: 500 }}
                >
                  Sao chép
                </Button>
              </div>
            </div>
            <div className="access-card">
              <div className="ac-label">Mã phòng (ID)</div>
              <div className="ac-val-row">
                <div className="ac-val">{m.meetingCode}</div>
                <Button 
                  size="small" 
                  type="text" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyText(m.meetingCode)}
                  style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}
                >
                  Sao chép
                </Button>
              </div>
            </div>
            <div className="access-card">
              <div className="ac-label">Mật khẩu (Passcode)</div>
              <div className="ac-val-row">
                <div className="ac-val">{m.passcode}</div>
                <Button 
                  size="small" 
                  type="text" 
                  icon={<CopyOutlined />} 
                  onClick={() => copyText(m.passcode)}
                  style={{ color: '#64748b', fontSize: 12, fontWeight: 500 }}
                >
                  Sao chép
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- QUICK ACTIONS --- */}
      <h3 className="section-title-sm">Tính năng & Tiện ích</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="qa-card" onClick={() => props.openDocumentsModal(m)}>
          <div className="qa-icon" style={{ color: '#2563eb', background: '#eff6ff' }}><FileWordOutlined /></div>
          <div className="qa-name">Tài liệu</div>
          <div className="qa-desc">Xem & tải file</div>
        </div>
        <div className="qa-card" onClick={() => props.openReportModal(m)}>
          <div className="qa-icon" style={{ color: '#d97706', background: '#fffbeb' }}><FileTextOutlined /></div>
          <div className="qa-name">Biên bản</div>
          <div className="qa-desc">Xuất biên bản họp</div>
        </div>
        {(m.canManagePoll || isHost) && (
          <div className="qa-card" onClick={() => props.openPollListModal(m)}>
            <div className="qa-icon" style={{ color: '#059669', background: '#ecfdf5' }}><CheckCircleOutlined /></div>
            <div className="qa-name">Biểu quyết</div>
            <div className="qa-desc">Quản lý biểu quyết</div>
          </div>
        )}
        <div className="qa-card" onClick={() => props.openHistoryModal(m)}>
          <div className="qa-icon" style={{ color: '#7c3aed', background: '#f5f3ff' }}><HistoryOutlined /></div>
          <div className="qa-name">Lịch sử</div>
          <div className="qa-desc">Log ra/vào</div>
        </div>
      </div>

      {/* --- RECORDINGS --- */}
      {(isHost || props.meetingRecordings.length > 0) && (
        <>
          <h3 className="section-title-sm">Bản ghi hình (Recordings)</h3>
          <Card className="participants-card" styles={{ body: { padding: 0 } }} style={{ marginBottom: 24 }}>
            <Table
              dataSource={props.meetingRecordings}
              loading={props.meetingRecordingsLoading}
              rowKey="id"
              pagination={false}
              columns={[
                { title: 'Bản ghi', render: (_: any, r: MeetingRecordingDto) => (
                    <Space>
                      <VideoCameraOutlined style={{ color: '#2563eb' }} />
                      <Typography.Text>Bản ghi {dayjs(r.startedAtUtc).format('DD/MM/YYYY HH:mm:ss')}</Typography.Text>
                    </Space>
                  )},
                { title: 'Thời lượng', width: 150, render: (_: any, r: MeetingRecordingDto) => formatRecordingDuration(r) },
                { title: 'Thao tác', width: 100, align: 'right', render: (_: any, r: MeetingRecordingDto) => (
                    <Space size={4}>
                      <Button size="small" type="text" icon={<PlayCircleOutlined />} style={{ color: '#2563eb' }} onClick={() => props.openRecordingPlayback(m.id, r)} />
                      {isHost && (
                        <Popconfirm title="Xóa bản ghi này?" onConfirm={() => props.onDeleteMeetingRecording(r)}>
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} loading={props.recordingDeletingId === r.id} />
                        </Popconfirm>
                      )}
                    </Space>
                  )},
              ]}
            />
          </Card>
        </>
      )}

      {/* --- DANH SÁCH THAM DỰ --- */}
      <h3 className="section-title-sm">Danh sách được mời tham dự</h3>
      <Card className="participants-card" styles={{ body: { padding: 0 } }} style={{ marginBottom: 24 }}>
        <Table
          dataSource={combinedUsers}
          loading={props.meetingInviteesLoading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'Tên người dùng', dataIndex: 'fullName', render: (val: string, r: any) => (
              <Space>
                <div className={`p-avatar ${r.type === 'host' ? 'av-amber' : 'av-blue'}`}>
                  {participantInitials(val, r.username)}
                </div>
                <div>
                  <div className="p-name">{val || r.username}</div>
                  <div className="p-role">@{r.username}</div>
                </div>
              </Space>
            )},
            { title: 'Vai trò', width: 140, render: (_: any, r: any) => (
              <span className={`p-status-badge ${r.type === 'host' ? 'psb-host' : 'psb-invited'}`}>{r.roleTitle}</span>
            )},
            ...(canManageInvitees ? [{
              title: 'Cấp quyền', width: 140, render: (_: any, r: any) => {
                if (r.type === 'host') return null;
                return (
                  <Select
                    size="small"
                    value={r.type}
                    style={{ width: '100%' }}
                    onChange={(val) => val === 'co-host' ? props.promoteInviteeToCoHost(r.username) : props.demoteCoHostToInvitee(r.username)}
                    disabled={props.promotingInviteeUsername === r.username || props.demotingCoHostUsername === r.username}
                  >
                    <Select.Option value="invitee">Người tham dự</Select.Option>
                    <Select.Option value="co-host">Co-Host</Select.Option>
                  </Select>
                );
              }
            }, {
              title: 'Thao tác', width: 80, align: 'right' as const, render: (_: any, r: any) => {
                if (r.type === 'host') return null;
                return (
                  <Popconfirm title={`Xóa ${r.username}?`} onConfirm={() => r.type === 'co-host' ? props.removeCoHostRow(r.userId) : props.removeInviteeRow(r.username)}>
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} 
                      loading={props.removingInviteeUsername === r.username || props.removingCoHostUserId === r.userId} />
                  </Popconfirm>
                );
              }
            }] : [])
          ]}
        />
        {canManageInvitees && (
          <div className="p-invite-bar">
            <Typography.Text style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>Mời thêm:</Typography.Text>
            <Input 
              placeholder="Nhập username..." 
              value={props.inviteUsernameInput}
              onChange={e => props.setInviteUsernameInput(e.target.value)}
              onPressEnter={props.submitAddInvitee}
              style={{ width: 200 }}
            />
            <Button type="primary" onClick={props.submitAddInvitee} loading={props.addingInvitee}>Thêm</Button>
          </div>
        )}
      </Card>

      <div className="bottom-btns" style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
        <Button 
          type="primary" 
          size="large" 
          onClick={() => router.push(`/meeting/${m.id}`)}
          style={{ flex: 1, height: 40, borderRadius: 8, fontSize: 14, fontWeight: 600, minWidth: 150 }}
        >
          Vào phòng họp ngay
        </Button>
        {canEditMeeting(m, user, isAdmin) && (
          <Button 
            size="large" 
            onClick={() => props.openEditMeetingModal(m)}
            style={{ height: 40, borderRadius: 8, fontSize: 14, fontWeight: 500 }}
          >
            Sửa thông tin
          </Button>
        )}
        {(isHost || isAdmin) && (
          <Popconfirm title="Xác nhận xóa cuộc họp?" description="Mọi dữ liệu sẽ bị xóa." onConfirm={() => props.handleDeleteMeeting(m.id)}>
            <Button 
              danger 
              size="large" 
              style={{ height: 40, borderRadius: 8, fontSize: 14, fontWeight: 500 }}
            >
              Xóa cuộc họp
            </Button>
          </Popconfirm>
        )}
      </div>
    </div>
  );
}
