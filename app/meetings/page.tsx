'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService, meetingApi } from '@/services/api';
import type { PollResponse, PollManagerItem } from '@/dtos/meeting.dto';
import MainLayout from '@/components/MainLayout';
import dayjs from 'dayjs';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Radio,
  Progress,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  Popconfirm,
  Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  CopyOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CalendarOutlined,
  UserOutlined,
  MoreOutlined,
  CaretRightOutlined,
  FormOutlined,
  SettingOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';

type Meeting = {
  id: string;
  title: string;
  hostName: string;
  hostIdentity: string;
  canManagePoll: boolean;
  meetingCode: string;
  passcode: string;
  createdAt: string;
};

export default function MeetingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [pollModalMeeting, setPollModalMeeting] = useState<Meeting | null>(null);
  const [savingPoll, setSavingPoll] = useState(false);
  const [editingDraftPollId, setEditingDraftPollId] = useState<string | null>(null);
  const [pollForm] = Form.useForm();
  const [viewPollMeeting, setViewPollMeeting] = useState<Meeting | null>(null);
  const [viewPolls, setViewPolls] = useState<PollResponse[]>([]);
  const [viewPollsLoading, setViewPollsLoading] = useState(false);
  const [manageTab, setManageTab] = useState<'waiting' | 'published' | 'managers'>('waiting');
  const [managerUsername, setManagerUsername] = useState('');
  const [managers, setManagers] = useState<PollManagerItem[]>([]);
  const [managerLoading, setManagerLoading] = useState(false);
  const [addingManager, setAddingManager] = useState(false);

  const canManagePollForMeeting = (m: Meeting): boolean => {
    return Boolean(m.canManagePoll);
  };

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadMeetings();
    }
  }, [isAuthenticated]);

  const loadMeetings = async () => {
    setLoadingMeetings(true);
    const result = await apiService.getMeetings();
    if (result.data) setMeetings(result.data as Meeting[]);
    if (result.error) message.error(result.error);
    setLoadingMeetings(false);
  };

  const copyText = async (text: string, successMsg = 'Đã copy') => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successMsg);
    } catch {
      message.error('Không thể copy. Vui lòng thử lại.');
    }
  };

  const buildMeetingLink = (meetingId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/meeting/${meetingId}`;
  };

  const submitPollForMeeting = async () => {
    if (!pollModalMeeting) return;
    const values = await pollForm.validateFields();
    const title = String(values.title || '').trim();
    const options = (values.options as string[]).map((x) => String(x || '').trim()).filter(Boolean);
    const selectionMode = values.selectionMode === 'multiple' ? 'multiple' : 'single';
    const durationKind = values.durationKind === 'timed' ? 'timed' : 'none';
    const durationMinutes = Math.max(1, Math.min(10080, Number(values.durationMinutes) || 5));
    const createdAt = Date.now();
    const endAt = durationKind === 'timed' ? createdAt + durationMinutes * 60 * 1000 : null;

    setSavingPoll(true);
    const result = editingDraftPollId
      ? await meetingApi.updateDraftPoll(pollModalMeeting.id, editingDraftPollId, {
          pollId: editingDraftPollId,
          title,
          options,
          createdBy: user?.id ?? '',
          createdByName: user?.fullName?.trim() || user?.username || 'Host',
          createdAt,
          selectionMode,
          endAt,
          status: 'draft',
        })
      : await meetingApi.createPoll(pollModalMeeting.id, {
          title,
          options,
          createdBy: user?.id ?? '',
          createdByName: user?.fullName?.trim() || user?.username || 'Host',
          createdAt,
          selectionMode,
          endAt,
          status: 'draft',
        });
    setSavingPoll(false);

    if (result.error) {
      message.error(result.error);
      return;
    }
    message.success(editingDraftPollId ? 'Đã cập nhật biểu quyết nháp' : 'Đã lưu biểu quyết nháp');
    setPollModalMeeting(null);
    setEditingDraftPollId(null);
    pollForm.resetFields();
    if (viewPollMeeting) {
      const pollsRes = await meetingApi.listPolls(viewPollMeeting.id);
      if (pollsRes.data) setViewPolls(pollsRes.data);
    }
  };

  const openPollListModal = async (meeting: Meeting) => {
    setViewPollMeeting(meeting);
    setManageTab('waiting');
    setViewPollsLoading(true);
    const pollsRes = await meetingApi.listPolls(meeting.id);
    setViewPollsLoading(false);
    if (pollsRes.error || !pollsRes.data) {
      message.error(pollsRes.error || 'Không tải được danh sách biểu quyết');
      return;
    }
    setViewPolls(pollsRes.data);

    if (canManagePollForMeeting(meeting)) {
      setManagerLoading(true);
      const mgrRes = await meetingApi.listPollManagers(meeting.id);
      setManagerLoading(false);
      if (mgrRes.data) setManagers(mgrRes.data);
      else setManagers([]);
    } else {
      setManagers([]);
    }
  };

  const submitAddManager = async () => {
    if (!viewPollMeeting) return;
    const username = managerUsername.trim();
    if (!username) return;
    setAddingManager(true);
    const res = await meetingApi.addPollManager(viewPollMeeting.id, { username });
    setAddingManager(false);
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã thêm quản lý biểu quyết');
    setManagerUsername('');
    const mgrRes = await meetingApi.listPollManagers(viewPollMeeting.id);
    if (mgrRes.data) setManagers(mgrRes.data);
  };

  const removeManager = async (username: string) => {
    if (!viewPollMeeting) return;
    const res = await meetingApi.removePollManager(viewPollMeeting.id, username);
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã xóa quản lý biểu quyết');
    const mgrRes = await meetingApi.listPollManagers(viewPollMeeting.id);
    if (mgrRes.data) setManagers(mgrRes.data);
  };

  const closePublishedPoll = async (pollId: string) => {
    if (!viewPollMeeting) return;
    const res = await meetingApi.closePoll(viewPollMeeting.id, pollId, {
      closedBy: user?.id ?? '',
      at: Date.now(),
    });
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã kết thúc biểu quyết');
    const pollsRes = await meetingApi.listPolls(viewPollMeeting.id);
    if (pollsRes.data) setViewPolls(pollsRes.data);
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

  const editDraftPoll = (poll: PollResponse) => {
    if (!viewPollMeeting) return;
    setPollModalMeeting(viewPollMeeting);
    setEditingDraftPollId(poll.pollId);
    pollForm.setFieldsValue({
      title: poll.title,
      selectionMode: poll.selectionMode,
      durationKind: poll.endAt ? 'timed' : 'none',
      durationMinutes: poll.endAt ? Math.max(1, Math.ceil((poll.endAt - Date.now()) / 60000)) : 5,
      options: poll.options?.length ? poll.options : ['', ''],
    });
  };

  const deleteDraftPoll = async (pollId: string) => {
    if (!viewPollMeeting) return;
    const res = await meetingApi.deleteDraftPoll(viewPollMeeting.id, pollId);
    if (res.error) {
      message.error(res.error);
      return;
    }
    message.success('Đã xóa biểu quyết chờ');
    const pollsRes = await meetingApi.listPolls(viewPollMeeting.id);
    if (pollsRes.data) setViewPolls(pollsRes.data);
  };

  const getDropdownMenuItems = (record: Meeting): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      {
        key: 'history',
        icon: <HistoryOutlined />,
        label: 'Lịch sử cuộc họp',
        onClick: () => router.push(`/history/${record.id}`),
      },
    ];

    items.push({
      key: 'manage_poll',
      icon: <SettingOutlined />,
      label: 'Quản lý biểu quyết',
      onClick: () => void openPollListModal(record),
    });

    return items;
  };

  const columns = useMemo(
    () => [
      {
        title: 'STT',
        key: 'stt',
        width: 60,
        align: 'center' as const,
        render: (_: unknown, __: Meeting, index: number) => (
          <Typography.Text type="secondary">
            {(tablePage - 1) * tablePageSize + index + 1}
          </Typography.Text>
        ),
      },
      {
        title: 'THÔNG TIN CUỘC HỌP',
        key: 'info',
        width: 480,
        render: (_: unknown, record: Meeting) => (
          <Space align="start" size="middle">
            <div style={{
              fontSize: '20px',
              color: '#1677ff',
              padding: '8px 12px',
              border: '1px solid #e6f4ff',
              borderRadius: '8px'
            }}>
              <CalendarOutlined />
            </div>
            <Space direction="vertical" size={0}>
              <Typography.Text strong style={{ fontSize: '15px' }}>{record.title}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                {dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}
              </Typography.Text>
              <Space style={{ marginTop: 4 }}>
                <UserOutlined style={{ color: '#8c8c8c' }} />
                <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                  Host: {record.hostName}
                </Typography.Text>
              </Space>
            </Space>
          </Space>
        ),
      },
      {
        title: 'TRUY CẬP',
        key: 'access',
        width: 450,
        align: 'left' as const,
        render: (_: unknown, record: Meeting) => (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '44px 1fr',
              rowGap: 8,
              columnGap: 8,
              width: 'fit-content',
              maxWidth: '100%',
              minWidth: 0,
              alignItems: 'center',
            }}
          >
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
              Mã:
            </Typography.Text>
            <div
              style={{
                display: 'inline-grid',
                gridTemplateColumns: '110px 12px 44px 8px 110px',
                alignItems: 'center',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  gridColumn: 1,
                  background: '#f5f5f5',
                  padding: '4px 12px',
                  borderRadius: 4,
                  width: 110,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <Typography.Text strong style={{ flex: 1, minWidth: 0 }} ellipsis>
                  {record.meetingCode}
                </Typography.Text>
                <CopyOutlined
                  style={{ color: '#8c8c8c', cursor: 'pointer', flex: '0 0 auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyText(record.meetingCode);
                  }}
                />
              </div>

              <Typography.Text type="secondary" style={{ gridColumn: 3, whiteSpace: 'nowrap', width: 44 }}>
                Pass:
              </Typography.Text>

              <div
                style={{
                  gridColumn: 5,
                  background: '#f5f5f5',
                  padding: '4px 12px',
                  borderRadius: 4,
                  width: 110,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <Typography.Text strong style={{ flex: 1, minWidth: 0 }}>
                  {record.passcode}
                </Typography.Text>
                <CopyOutlined
                  style={{ color: '#8c8c8c', cursor: 'pointer', flex: '0 0 auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyText(record.passcode);
                  }}
                />
              </div>
            </div>

            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
              Link:
            </Typography.Text>
            <div
              style={{
                background: '#f5f5f5',
                padding: '4px 12px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                width: 110 + 12 + 44 + 8 + 110,
              }}
            >
              <Typography.Text
                style={{ color: '#1677ff', flex: 1, minWidth: 0 }}
                ellipsis={{ tooltip: buildMeetingLink(record.id) }}
              >
                {buildMeetingLink(record.id)}
              </Typography.Text>
              <CopyOutlined
                style={{ color: '#8c8c8c', cursor: 'pointer', flex: '0 0 auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  void copyText(buildMeetingLink(record.id));
                }}
              />
            </div>
          </div>
        ),
      },
      {
        title: 'THAO TÁC',
        key: 'actions',
        width: 160,
        render: (_: unknown, record: Meeting) => (
          <Space>
            <Button
              type="primary"
              icon={<CaretRightOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/meeting/${record.id}`);
              }}
              style={{ fontWeight: 500 }}
            >
              Tham gia
            </Button>
            <Dropdown menu={{ items: getDropdownMenuItems(record) }} trigger={['click']}>
              <Button icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
            </Dropdown>
          </Space>
        ),
      },
    ],
    [router, tablePage, tablePageSize, pollForm]
  );

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24, width: '100%', margin: 0 }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Space align="start" size="middle">
            <div style={{
              background: '#1677ff',
              color: 'white',
              padding: '10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              <VideoCameraOutlined />
            </div>
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {isAdmin ? 'Quản lý tất cả cuộc họp' : 'Quản lý cuộc họp'}
              </Typography.Title>
              <Typography.Text type="secondary">
                Tổng cộng <Typography.Text strong style={{ color: '#1677ff' }}>{meetings.length}</Typography.Text> cuộc họp đã tạo
              </Typography.Text>
            </div>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadMeetings()} loading={loadingMeetings}>
            Làm mới dữ liệu
          </Button>
        </div>

        {/* Table Section */}
        <Card bodyStyle={{ padding: 0 }} bordered={false} style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)' }}>
          <Table<Meeting>
            rowKey="id"
            loading={loadingMeetings}
            tableLayout="fixed"
            columns={columns as any}
            dataSource={meetings}
            pagination={{
              current: tablePage,
              pageSize: tablePageSize,
              total: meetings.length,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onChange: (p, ps) => {
                setTablePage(p);
                setTablePageSize(ps);
              },
              showTotal: (total, range) => `Hiển thị ${range[0]}-${range[1]} trong số ${total} cuộc họp`,
              style: { padding: '16px 24px', margin: 0, borderTop: '1px solid #f0f0f0' }
            }}
          />
        </Card>
      </div>

      {/* --- CÁC MODALS GIỮ NGUYÊN HOÀN TOÀN NHƯ CŨ --- */}
      <Modal
        title={
          pollModalMeeting
            ? `${editingDraftPollId ? 'Sửa biểu quyết chờ' : 'Tạo biểu quyết trước'} - ${pollModalMeeting.title}`
            : (editingDraftPollId ? 'Sửa biểu quyết chờ' : 'Tạo biểu quyết trước')
        }
        open={Boolean(pollModalMeeting)}
        onCancel={() => {
          setPollModalMeeting(null);
          setEditingDraftPollId(null);
          pollForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form
          form={pollForm}
          layout="vertical"
          initialValues={{
            title: '',
            selectionMode: 'single',
            durationKind: 'none',
            durationMinutes: 5,
            options: ['', ''],
          }}
        >
          <Form.Item
            label="Nội dung"
            name="title"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung biểu quyết' }]}
          >
            <Input maxLength={500} placeholder="Ví dụ: Thông qua kế hoạch Q2?" />
          </Form.Item>

          <Form.Item label="Kiểu phiếu" name="selectionMode">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="single">Một lựa chọn</Radio>
                <Radio value="multiple">Nhiều lựa chọn</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Thời hạn" name="durationKind">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="none">Không giới hạn thời gian</Radio>
                <Radio value="timed">Có thời hạn (phút)</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) =>
              getFieldValue('durationKind') === 'timed' ? (
                <Form.Item
                  label="Số phút"
                  name="durationMinutes"
                  rules={[{ required: true, message: 'Nhập số phút' }]}
                >
                  <InputNumber min={1} max={10080} style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.List
            name="options"
            rules={[
              {
                validator: async (_, value) => {
                  const valid = Array.isArray(value)
                    ? value.map((x) => String(x || '').trim()).filter(Boolean)
                    : [];
                  if (valid.length < 2) throw new Error('Cần tối thiểu 2 lựa chọn');
                  if (valid.length > 8) throw new Error('Tối đa 8 lựa chọn');
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <Typography.Text strong>Lựa chọn</Typography.Text>
                {fields.map((field) => (
                  <Form.Item
                    key={field.key}
                    name={field.name}
                    style={{ marginTop: 8, marginBottom: 8 }}
                    rules={[{ required: true, whitespace: true, message: 'Không để trống' }]}
                  >
                    <Input
                      placeholder={`Phương án ${field.name + 1}`}
                      addonAfter={
                        fields.length > 2 ? (
                          <Button type="link" danger size="small" onClick={() => remove(field.name)}>
                            Xóa
                          </Button>
                        ) : undefined
                      }
                    />
                  </Form.Item>
                ))}
                <Form.ErrorList errors={errors} />
                <Button
                  type="link"
                  onClick={() => {
                    if (fields.length < 8) add('');
                  }}
                >
                  + Thêm phương án
                </Button>
              </>
            )}
          </Form.List>

          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button onClick={() => { setPollModalMeeting(null); setEditingDraftPollId(null); pollForm.resetFields(); }}>
              Hủy
            </Button>
            <Button type="primary" loading={savingPoll} onClick={() => void submitPollForMeeting()}>
              {editingDraftPollId ? 'Lưu chỉnh sửa' : 'Lưu nháp'}
            </Button>
          </Space>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Quản lý biểu quyết
              </Typography.Title>
              <Typography.Text type="secondary" style={{ display: 'block' }}>
                Xem và quản lý các cuộc khảo sát ý kiến
              </Typography.Text>
            </div>
            <Space>
              {viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && (
                <Button
                  type="primary"
                  icon={<FormOutlined />}
                  onClick={() => {
                    setPollModalMeeting(viewPollMeeting);
                    setEditingDraftPollId(null);
                    pollForm.setFieldsValue({
                      title: '',
                      selectionMode: 'single',
                      durationKind: 'none',
                      durationMinutes: 5,
                      options: ['', ''],
                    });
                  }}
                >
                  Tạo biểu quyết
                </Button>
              )}
              <Button
                type="text"
                icon={<SettingOutlined />}
                onClick={() => setManageTab('managers')}
                disabled={!viewPollMeeting || !canManagePollForMeeting(viewPollMeeting)}
              />
            </Space>
          </div>
        }
        open={Boolean(viewPollMeeting)}
        onCancel={() => {
          setViewPollMeeting(null);
          setViewPolls([]);
          setManageTab('waiting');
          setManagerUsername('');
          setManagers([]);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setViewPollMeeting(null)}>Đóng</Button>
          </div>
        }
        destroyOnHidden
        width={720}
        styles={{ body: { background: '#f5f7fb' } }}
      >
        <div style={{ marginBottom: 14 }}>
          <Segmented
            block
            value={manageTab}
            onChange={(v) => setManageTab(v as any)}
            options={[
              { label: 'Đang chờ', value: 'waiting' },
              { label: 'Đã công bố', value: 'published' },
              {
                label: 'Người quản lý',
                value: 'managers',
                disabled: !viewPollMeeting || !canManagePollForMeeting(viewPollMeeting),
              },
            ]}
          />
        </div>

        {manageTab === 'waiting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflow: 'auto', paddingRight: 6 }}>
            {viewPollsLoading ? (
              <Card loading bordered={false} style={{ borderRadius: 14 }} />
            ) : viewPolls.filter((p) => p.status === 'draft').length === 0 ? (
              <Card bordered={false} style={{ borderRadius: 14 }}>
                <Typography.Text type="secondary">Chưa có biểu quyết chờ công bố</Typography.Text>
              </Card>
            ) : (
              viewPolls
                .filter((p) => p.status === 'draft')
                .map((p) => {
                  const counts = pollOptionCounts(p);
                  const totalSelections = counts.reduce((a, b) => a + b, 0);
                  const canManage = Boolean(viewPollMeeting && canManagePollForMeeting(viewPollMeeting));

                  return (
                    <Card
                      key={p.pollId}
                      bordered={false}
                      style={{ borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                      styles={{ body: { padding: 16 } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <Space size={8} wrap>
                            <Tag color="default" style={{ borderRadius: 999 }}>
                              ĐANG CHỜ
                            </Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              · {p.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'}
                            </Typography.Text>
                          </Space>
                          <Typography.Text strong style={{ display: 'block', marginTop: 6, fontSize: 14 }}>
                            {p.title}
                          </Typography.Text>
                        </div>
                        {canManage && (
                          <Space>
                            <Button size="small" onClick={() => editDraftPoll(p)}>
                              Sửa
                            </Button>
                            <Popconfirm
                              title="Xóa biểu quyết chờ này?"
                              okText="Xóa"
                              cancelText="Hủy"
                              onConfirm={() => void deleteDraftPoll(p.pollId)}
                            >
                              <Button danger size="small">
                                Xóa
                              </Button>
                            </Popconfirm>
                          </Space>
                        )}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {p.options.map((opt, idx) => {
                          const pct = totalSelections > 0 ? Math.round((counts[idx] / totalSelections) * 100) : 0;
                          return (
                            <div key={idx}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <Typography.Text style={{ fontSize: 13 }}>{opt}</Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                  {pct}% ({counts[idx]})
                                </Typography.Text>
                              </div>
                              <Progress percent={pct} showInfo={false} strokeColor="#3b82f6" trailColor="#eaf0ff" />
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Tạo bởi {p.createdByName}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {p.endAt ? `Hết hạn: ${dayjs(p.endAt).format('DD/MM/YYYY HH:mm')}` : 'Hết hạn: Không giới hạn'}
                        </Typography.Text>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        )}

        {manageTab === 'published' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh', overflow: 'auto', paddingRight: 6 }}>
            {viewPollsLoading ? (
              <Card loading bordered={false} style={{ borderRadius: 14 }} />
            ) : viewPolls.filter((p) => p.status !== 'draft').length === 0 ? (
              <Card bordered={false} style={{ borderRadius: 14 }}>
                <Typography.Text type="secondary">Chưa có biểu quyết đã công bố</Typography.Text>
              </Card>
            ) : (
              viewPolls
                .filter((p) => p.status !== 'draft')
                .map((p) => {
                  const counts = pollOptionCounts(p);
                  const totalSelections = counts.reduce((a, b) => a + b, 0);
                  const canManage = Boolean(viewPollMeeting && canManagePollForMeeting(viewPollMeeting));
                  const isOpen = p.status === 'open';

                  return (
                    <Card
                      key={p.pollId}
                      bordered={false}
                      style={{ borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                      styles={{ body: { padding: 16 } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <Space size={8} wrap>
                            <Tag color={isOpen ? 'success' : 'default'} style={{ borderRadius: 999 }}>
                              {isOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}
                            </Tag>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              · {p.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'}
                            </Typography.Text>
                          </Space>
                          <Typography.Text strong style={{ display: 'block', marginTop: 6, fontSize: 14 }}>
                            {p.title}
                          </Typography.Text>
                        </div>
                        {canManage && isOpen && (
                          <Popconfirm
                            title="Kết thúc biểu quyết này?"
                            okText="Kết thúc"
                            cancelText="Hủy"
                            onConfirm={() => void closePublishedPoll(p.pollId)}
                          >
                            <Button danger size="small">
                              Kết thúc
                            </Button>
                          </Popconfirm>
                        )}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {p.options.map((opt, idx) => {
                          const pct = totalSelections > 0 ? Math.round((counts[idx] / totalSelections) * 100) : 0;
                          return (
                            <div key={idx}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <Typography.Text style={{ fontSize: 13 }}>{opt}</Typography.Text>
                                <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                  {pct}% ({counts[idx]})
                                </Typography.Text>
                              </div>
                              <Progress percent={pct} showInfo={false} strokeColor="#3b82f6" trailColor="#eaf0ff" />
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Tạo bởi {p.createdByName}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {p.endAt ? `Hết hạn: ${dayjs(p.endAt).format('DD/MM/YYYY HH:mm')}` : 'Hết hạn: Không giới hạn'}
                        </Typography.Text>
                      </div>
                    </Card>
                  );
                })
            )}
          </div>
        )}

        {manageTab === 'managers' && viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && (
          <Card size="small" title="Người quản lý">
            <Space style={{ width: '100%' }} wrap>
              <Input
                placeholder="Nhập username cần cấp quyền"
                value={managerUsername}
                onChange={(e) => setManagerUsername(e.target.value)}
                style={{ minWidth: 260 }}
              />
              <Button type="primary" loading={addingManager} onClick={() => void submitAddManager()}>
                Thêm quản lý
              </Button>
            </Space>
            <Table<PollManagerItem>
              loading={managerLoading}
              style={{ marginTop: 12 }}
              rowKey={(r) => r.username.toLowerCase()}
              dataSource={managers}
              pagination={false}
              locale={{ emptyText: 'Chưa có quản lý biểu quyết' }}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 70,
                  align: 'center',
                  render: (_v, _r, index) => index + 1,
                },
                {
                  title: 'Username',
                  dataIndex: 'username',
                  key: 'username',
                },
                {
                  title: 'Họ và tên',
                  dataIndex: 'fullName',
                  key: 'fullName',
                },
                {
                  title: 'Thêm bởi',
                  key: 'addedBy',
                  render: (_v, r) => `${r.addedBy} (${r.addedByFullName})`,
                },
                {
                  title: 'Thời gian thêm',
                  dataIndex: 'addedAt',
                  key: 'addedAt',
                  render: (v: number) => dayjs(v).format('DD/MM/YYYY HH:mm:ss'),
                },
                {
                  title: 'Xóa',
                  key: 'delete',
                  width: 90,
                  align: 'center',
                  render: (_v, r) => (
                    <Popconfirm
                      title={`Xóa quyền quản lý của ${r.username}?`}
                      okText="Xóa"
                      cancelText="Hủy"
                      onConfirm={() => void removeManager(r.username)}
                    >
                      <Button danger size="small">Xóa</Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </Modal>
    </MainLayout>
  );
}