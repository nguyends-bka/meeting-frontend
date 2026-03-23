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
  Descriptions,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Divider,
  Radio,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
} from 'antd';
import {
  CopyOutlined,
  HistoryOutlined,
  RightCircleOutlined,
  ReloadOutlined,
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
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
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

  const normalizedUserId = user?.id?.trim().toLowerCase() ?? '';
  const normalizedUsername = user?.username?.trim().toLowerCase() ?? '';
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

  const columns = useMemo(
    () => [
      {
        title: 'STT',
        key: 'stt',
        width: 80,
        align: 'center' as const,
        render: (_: unknown, __: Meeting, index: number) =>
          (tablePage - 1) * tablePageSize + index + 1,
      },
      {
        title: 'Tên cuộc họp',
        dataIndex: 'title',
        key: 'title',
        render: (t: string) => <Typography.Text strong>{t}</Typography.Text>,
      },
      {
        title: 'Ngày tạo',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
      },
      {
        title: 'Thao tác',
        key: 'actions',
        width: 150,
        render: (_: unknown, record: Meeting) => (
          <Button
            type="primary"
            icon={<RightCircleOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/meeting/${record.id}`);
            }}
          >
            Tham gia
          </Button>
        ),
      },
    ],
    [normalizedUserId, normalizedUsername, pollForm, router, tablePage, tablePageSize, user?.role]
  );

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <Typography.Text strong>
                {isAdmin ? 'Tất cả cuộc họp' : 'Cuộc họp của tôi'}
              </Typography.Text>
              <Tag color="geekblue">{meetings.length}</Tag>
            </Space>
          }
          extra={
            <Button icon={<ReloadOutlined />} onClick={() => void loadMeetings()} loading={loadingMeetings}>
              Tải lại
            </Button>
          }
        >
          <Table<Meeting>
            rowKey="id"
            loading={loadingMeetings}
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
            }}
            onRow={(record) => ({
              onClick: () => {
                const isExpanded = expandedRowKeys.includes(record.id);
                if (isExpanded) {
                  setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.id));
                } else {
                  setExpandedRowKeys([...expandedRowKeys, record.id]);
                }
              },
              style: { cursor: 'pointer' },
            })}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
              showExpandColumn: false, // Ẩn icon expand mặc định
              expandedRowRender: (record) => {
                const link = buildMeetingLink(record.id);
                return (
                  <Card size="small">
                    <Space style={{ marginBottom: 12 }} wrap>
                      <Button
                        icon={<HistoryOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/history/${record.id}`);
                        }}
                      >
                        Xem lịch sử
                      </Button>
                      <Button
                        type="primary"
                        icon={<RightCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/meeting/${record.id}`);
                        }}
                      >
                        Tham gia
                      </Button>
                      {canManagePollForMeeting(record) && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPollModalMeeting(record);
                            pollForm.setFieldsValue({
                              title: '',
                              selectionMode: 'single',
                              durationKind: 'none',
                              durationMinutes: 5,
                              options: ['', ''],
                            });
                          }}
                        >
                          Tạo biểu quyết trước
                        </Button>
                      )}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          void openPollListModal(record);
                        }}
                      >
                        Quản lý biểu quyết
                      </Button>
                    </Space>

                    <Descriptions size="small" column={1} bordered>
                      <Descriptions.Item label="Mã cuộc họp / Passcode">
                        <Space wrap>
                          <Space size={6}>
                            <Typography.Text>Mã:</Typography.Text>
                            <Typography.Text code>{record.meetingCode}</Typography.Text>
                            <Tooltip title="Copy mã">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyText(record.meetingCode, 'Đã copy mã cuộc họp');
                                }}
                              />
                            </Tooltip>
                          </Space>

                          <Space size={6}>
                            <Typography.Text>Passcode:</Typography.Text>
                            <Typography.Text code>{record.passcode}</Typography.Text>
                            <Tooltip title="Copy passcode">
                              <Button
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void copyText(record.passcode, 'Đã copy passcode');
                                }}
                              />
                            </Tooltip>
                          </Space>
                        </Space>
                      </Descriptions.Item>

                      <Descriptions.Item label="Host">
                        <Typography.Text>{record.hostName}</Typography.Text>
                      </Descriptions.Item>

                      <Descriptions.Item label="Link chia sẻ">
                        <Space style={{ width: '100%' }} wrap>
                          <input
                            value={link}
                            readOnly
                            style={{
                              flex: 1,
                              padding: '8px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              maxWidth: 520,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            icon={<CopyOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              void copyText(link, 'Đã copy link');
                            }}
                          >
                            Copy link
                          </Button>
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                );
              },
            }}
          />
        </Card>
      </div>

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
        title={viewPollMeeting ? `Quản lý biểu quyết - ${viewPollMeeting.title}` : 'Quản lý biểu quyết'}
        open={Boolean(viewPollMeeting)}
        onCancel={() => {
          setViewPollMeeting(null);
          setViewPolls([]);
          setManageTab('waiting');
          setManagerUsername('');
          setManagers([]);
        }}
        footer={null}
        destroyOnHidden
        width={720}
      >
        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            <Button
              type={manageTab === 'waiting' ? 'primary' : 'default'}
              onClick={() => setManageTab('waiting')}
            >
              Biểu quyết đang chờ
            </Button>
            <Button
              type={manageTab === 'published' ? 'primary' : 'default'}
              onClick={() => setManageTab('published')}
            >
              Biểu quyết đã công bố
            </Button>
            {viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && (
              <Button
                type={manageTab === 'managers' ? 'primary' : 'default'}
                onClick={() => setManageTab('managers')}
              >
                Người quản lý
              </Button>
            )}
          </Space>
        </div>

        {manageTab === 'waiting' && (
          <List
            loading={viewPollsLoading}
            dataSource={viewPolls.filter((p) => p.status === 'draft')}
            locale={{ emptyText: 'Chưa có biểu quyết chờ công bố' }}
            renderItem={(p) => {
              const counts = pollOptionCounts(p);
              return <List.Item>
                <List.Item.Meta
                  title={p.title}
                  description={
                    <div>
                      <div>{`${p.createdByName} · ${p.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'} · Chờ công bố`}</div>
                      <div style={{ marginTop: 6 }}>
                        {p.options.map((opt, idx) => {
                          return (
                            <Tag key={idx} style={{ marginBottom: 4 }}>
                              {opt} ({counts[idx]})
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  }
                />
                {viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && (
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
                      <Button danger size="small">Xóa</Button>
                    </Popconfirm>
                  </Space>
                )}
              </List.Item>;
            }}
          />
        )}

        {manageTab === 'published' && (
          <List
            loading={viewPollsLoading}
            dataSource={viewPolls.filter((p) => p.status !== 'draft')}
            locale={{ emptyText: 'Chưa có biểu quyết đã công bố' }}
            renderItem={(p) => {
              const counts = pollOptionCounts(p);
              return <List.Item>
                <List.Item.Meta
                  title={p.title}
                  description={
                    <div>
                      <div>{`${p.createdByName} · ${p.selectionMode === 'multiple' ? 'Nhiều lựa chọn' : 'Một lựa chọn'} · ${p.status === 'open' ? 'Đang mở' : 'Đã đóng'}`}</div>
                      <div style={{ marginTop: 6 }}>
                        {p.options.map((opt, idx) => {
                          return (
                            <Tag key={idx} style={{ marginBottom: 4 }}>
                              {opt} ({counts[idx]})
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  }
                />
                {viewPollMeeting && canManagePollForMeeting(viewPollMeeting) && p.status === 'open' && (
                  <Popconfirm
                    title="Kết thúc biểu quyết này?"
                    okText="Kết thúc"
                    cancelText="Hủy"
                    onConfirm={() => void closePublishedPoll(p.pollId)}
                  >
                    <Button danger size="small">Kết thúc biểu quyết</Button>
                  </Popconfirm>
                )}
              </List.Item>;
            }}
          />
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
