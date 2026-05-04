import React, { useEffect, useState } from 'react';
import { Modal, Tabs, List, Button, Space, Typography, Tag, Input, Popconfirm, App } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { meetingApi } from '@/services/api';
import type { MeetingListItem, PollResponse, PollManagerItem } from '@/dtos/meeting.dto';

interface PollListModalProps {
  meeting: MeetingListItem | null;
  onClose: () => void;
  user: any;
  openCreateForm: () => void;
  openEditForm: (poll: PollResponse) => void;
}

export function PollListModal({ meeting, onClose, user, openCreateForm, openEditForm }: PollListModalProps) {
  const { message } = App.useApp();
  const [polls, setPolls] = useState<PollResponse[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [managers, setManagers] = useState<PollManagerItem[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [manageTab, setManageTab] = useState<'waiting' | 'published' | 'managers'>('waiting');
  const [addingManager, setAddingManager] = useState(false);
  const [managerUsername, setManagerUsername] = useState('');

  useEffect(() => {
    if (meeting) {
      loadPolls();
      if (meeting.canManagePoll) loadManagers();
    } else {
      setPolls([]);
      setManagers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting]);

  const loadPolls = async () => {
    if (!meeting) return;
    setLoading(true);
    const res = await meetingApi.listPolls(meeting.id);
    setLoading(false);
    if (res.data) setPolls(res.data);
    else if (res.error) message.error(res.error);
  };

  const loadManagers = async () => {
    if (!meeting) return;
    setManagersLoading(true);
    const res = await meetingApi.listPollManagers(meeting.id);
    setManagersLoading(false);
    if (res.data) setManagers(res.data);
  };

  const submitAddManager = async () => {
    if (!meeting || !managerUsername.trim()) return;
    setAddingManager(true);
    const res = await meetingApi.addPollManager(meeting.id, { username: managerUsername.trim() });
    setAddingManager(false);
    if (res.error) {
      message.error(res.error);
      return;
    }
    setManagerUsername('');
    await loadManagers();
  };

  const removeManager = async (username: string) => {
    if (!meeting) return;
    const res = await meetingApi.removePollManager(meeting.id, username);
    if (res.error) {
      message.error(res.error);
      return;
    }
    await loadManagers();
  };

  const closePublishedPoll = async (pollId: string) => {
    if (!meeting) return;
    const res = await meetingApi.closePoll(meeting.id, pollId, { closedBy: user?.id ?? '', at: Date.now() });
    if (res.error) {
      message.error(res.error);
      return;
    }
    await loadPolls();
  };

  const deleteDraftPoll = async (pollId: string) => {
    if (!meeting) return;
    const res = await meetingApi.deleteDraftPoll(meeting.id, pollId);
    if (res.error) {
      message.error(res.error);
      return;
    }
    await loadPolls();
  };

  const pollOptionCounts = (poll: PollResponse): number[] => {
    const counts = poll.options.map(() => 0);
    for (const vote of poll.votes ?? []) {
      for (const idx of vote.optionIndices ?? []) {
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
      }
    }
    return counts;
  };

  const renderPollList = (status: 'draft' | 'open') => {
    const list = polls.filter(p => p.status === status);
    return (
      <List
        loading={loading}
        dataSource={list}
        renderItem={poll => {
          const isClosed = poll.endAt && Date.now() >= poll.endAt;
          const counts = pollOptionCounts(poll);
          const totalVotes = counts.reduce((a, b) => a + b, 0);

          return (
            <List.Item
              actions={
                status === 'draft' ? [
                  <Button key="edit" type="link" onClick={() => { onClose(); openEditForm(poll); }}>Sửa</Button>,
                  <Popconfirm key="del" title="Xóa bản nháp này?" onConfirm={() => deleteDraftPoll(poll.pollId)}>
                    <Button type="link" danger>Xóa</Button>
                  </Popconfirm>
                ] : [
                  !isClosed ? (
                    <Popconfirm key="close" title="Kết thúc biểu quyết?" onConfirm={() => closePublishedPoll(poll.pollId)}>
                      <Button type="link" danger>Đóng biểu quyết</Button>
                    </Popconfirm>
                  ) : <span key="ended" style={{ color: '#94a3b8' }}>Đã kết thúc</span>
                ]
              }
            >
              <List.Item.Meta
                title={<Space>{poll.title} {status === 'open' && isClosed && <Tag>Đã đóng</Tag>}</Space>}
                description={
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>Chế độ: {poll.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'}</div>
                    {status === 'open' && (
                      <div style={{ marginTop: 8 }}>
                        {poll.options.map((opt, i) => {
                          const c = counts[i];
                          const pct = totalVotes > 0 ? Math.round((c / totalVotes) * 100) : 0;
                          return (
                            <div key={i} style={{ marginBottom: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span>{opt}</span>
                                <span>{c} lượt ({pct}%)</span>
                              </div>
                              <div style={{ background: '#f1f5f9', height: 6, borderRadius: 3, marginTop: 2 }}>
                                <div style={{ background: '#2563eb', height: '100%', width: `${pct}%`, borderRadius: 3 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Space>
                }
              />
            </List.Item>
          );
        }}
      />
    );
  };

  return (
    <Modal
      title="Quản lý biểu quyết"
      open={!!meeting}
      onCancel={onClose}
      footer={[
        <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => { onClose(); openCreateForm(); }}>
          Tạo biểu quyết
        </Button>
      ]}
      width={700}
    >
      <Tabs
        activeKey={manageTab}
        onChange={k => setManageTab(k as any)}
        items={[
          { key: 'waiting', label: `Chờ duyệt (${polls.filter(p => p.status === 'draft').length})`, children: renderPollList('draft') },
          { key: 'published', label: `Đang diễn ra (${polls.filter(p => p.status === 'open').length})`, children: renderPollList('open') },
          ...(meeting?.canManagePoll ? [{
            key: 'managers',
            label: 'Ban kiểm phiếu',
            children: (
              <div>
                <Space style={{ marginBottom: 16 }}>
                  <Input placeholder="Username..." value={managerUsername} onChange={e => setManagerUsername(e.target.value)} onPressEnter={submitAddManager} />
                  <Button type="primary" onClick={submitAddManager} loading={addingManager}>Thêm</Button>
                </Space>
                <List
                  loading={managersLoading}
                  size="small"
                  dataSource={managers}
                  renderItem={mgr => (
                    <List.Item
                      actions={[
                        <Popconfirm key="del" title="Xóa người này?" onConfirm={() => removeManager(mgr.username)}>
                          <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta avatar={<UserOutlined />} title={mgr.fullName || mgr.username} description={`@${mgr.username}`} />
                    </List.Item>
                  )}
                />
              </div>
            )
          }] : [])
        ]}
      />
    </Modal>
  );
}
