'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminApi, apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import dayjs from 'dayjs';
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Space,
  Tag,
  Table,
  Typography,
  Descriptions,
  Result,
  Grid,
} from 'antd';
import {
  PlusOutlined,
  RightCircleOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

type HomeMeetingRow = {
  id: string;
  title: string;
  hostName: string;
  meetingCode: string;
  createdAt: string;
  activeParticipantCount?: number;
  startedAt?: string | null;
  endedAt?: string | null;
};

/** Thời lượng = kết thúc − bắt đầu (chỉ hiển thị, không có nút gợi ý). */
function formatDurationFromScheduleRange(
  range: [dayjs.Dayjs, dayjs.Dayjs] | undefined | null,
): string {
  if (!range?.[0] || !range?.[1]) return '—';
  const minutes = Math.max(0, range[1].diff(range[0], 'minute'));
  if (minutes === 0) return '0 phút';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

export default function HomePage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isNarrow = !screens.lg;

  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingHome, setLoadingHome] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<{
    id: string;
    code: string;
    passcode: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    totalMeetings: number;
    activeMeetings: number;
    todayMeetings: number;
  } | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<HomeMeetingRow[]>([]);
  const [detailMeeting, setDetailMeeting] = useState<HomeMeetingRow | null>(null);

  const [createForm] = Form.useForm();
  const scheduleRangeWatch = Form.useWatch('scheduleRange', createForm);
  const estimatedDurationLabel = useMemo(
    () => formatDurationFromScheduleRange(scheduleRangeWatch as [dayjs.Dayjs, dayjs.Dayjs] | undefined),
    [scheduleRangeWatch],
  );
  const [joinForm] = Form.useForm();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void loadStats();
    }
  }, [isAuthenticated]);

  const loadStats = async () => {
    setLoadingHome(true);
    try {
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}`;

      if (isAdmin) {
        const res = await adminApi.getAllMeetings();
        const meetings = (res.data ?? []) as any[];
        const rows: HomeMeetingRow[] = meetings.map((m) => ({
          id: m.id,
          title: m.title,
          hostName: m.hostName,
          meetingCode: m.meetingCode,
          createdAt: m.createdAt,
          activeParticipantCount: m.activeParticipantCount,
          startedAt: m.startedAt,
          endedAt: m.endedAt,
        }));
        rows.sort((a, b) => {
          const aEnded = Boolean(a.endedAt);
          const bEnded = Boolean(b.endedAt);
          const aLive = !aEnded && (a.activeParticipantCount ?? 0) > 0;
          const bLive = !bEnded && (b.activeParticipantCount ?? 0) > 0;
          if (aLive !== bLive) return aLive ? -1 : 1;
          if (aEnded !== bEnded) return aEnded ? 1 : -1;
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        });
        setRecentMeetings(rows.slice(0, 5));

        const active = rows.filter((r) => (r.activeParticipantCount ?? 0) > 0).length;
        const todayCount = rows.filter((r) => {
          const d = new Date(r.createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
            2,
            '0',
          )}`;
          return key === todayKey;
        }).length;
        setStats({ totalMeetings: rows.length, activeMeetings: active, todayMeetings: todayCount });
        return;
      }

      const result = await apiService.getMeetings();
      const meetings = (result.data ?? []) as any[];
      const rows: HomeMeetingRow[] = meetings.map((m) => ({
        id: m.id,
        title: m.title,
        hostName: m.hostName,
        meetingCode: m.meetingCode,
        createdAt: m.createdAt,
        startedAt: m.startedAt,
        endedAt: m.endedAt,
        activeParticipantCount: m.activeParticipantCount,
      }));
      rows.sort((a, b) => {
        const aEnded = Boolean(a.endedAt);
        const bEnded = Boolean(b.endedAt);
        const aLive = !aEnded && (a.activeParticipantCount ?? 0) > 0;
        const bLive = !bEnded && (b.activeParticipantCount ?? 0) > 0;
        if (aLive !== bLive) return aLive ? -1 : 1;
        if (aEnded !== bEnded) return aEnded ? 1 : -1;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      });
      setRecentMeetings(rows.slice(0, 5));

      const todayCount = rows.filter((r) => {
        const d = new Date(r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
          2,
          '0',
        )}`;
        return key === todayKey;
      }).length;
      setStats({
        totalMeetings: rows.length,
        activeMeetings: 0,
        todayMeetings: todayCount,
      });
    } finally {
      setLoadingHome(false);
    }
  };

  const onCreateMeeting = async () => {
    const values = await createForm.validateFields();
    const title = String(values.title || '').trim();
    const finalHostName = String(values.hostName || '').trim() || user?.username || 'Host';

    setCreating(true);
    const result = await apiService.createMeeting(title, finalHostName);
    setCreating(false);

    if (result.error) {
      message.error(result.error);
      return;
    }
    if (result.data) {
      message.success('Tạo cuộc họp thành công');
      setCreatedMeeting({
        id: result.data.meetingId,
        code: result.data.meetingCode,
        passcode: result.data.passcode,
      });
      await loadStats();
      // Không tự động tham gia, chỉ hiển thị thông tin
    }
  };

  const buildMeetingLink = (meetingId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/meeting/${meetingId}`;
  };

  const copyText = async (text: string, successMsg = 'Đã copy') => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successMsg);
    } catch {
      message.error('Không thể copy. Vui lòng thử lại.');
    }
  };

  const onJoinMeeting = async () => {
    const values = await joinForm.validateFields();
    const meetingIdOrCode = String(values.meetingIdOrCode || '').trim();
    const passcode = String(values.passcode || '').trim();

    const isGuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        meetingIdOrCode
      );

    const result = isGuid
      ? await apiService.joinMeeting(meetingIdOrCode, passcode)
      : await apiService.joinMeetingByCode(meetingIdOrCode.toUpperCase(), passcode);

    if (result.error) {
      message.error(result.error);
      return;
    }
    if (result.data) {
      setJoinOpen(false);
      joinForm.resetFields();
      router.push(`/meeting/${result.data.meetingId}`);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isNarrow ? 16 : 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 260 }}>
            <Title level={3} style={{ margin: 0 }}>
              Chào mừng trở lại, {user?.fullName}
            </Title>
            <Text type="secondary">
              Hôm nay bạn có {stats?.activeMeetings ?? 0} cuộc họp đang diễn ra. Chúc một ngày làm việc hiệu quả!
            </Text>
          </div>

          <Space wrap>
            <Button onClick={() => setJoinOpen(true)} icon={<RightCircleOutlined />}>
              Nhập mã tham gia
            </Button>
            <Button type="primary" onClick={() => setCreateOpen(true)} icon={<PlusOutlined />}>
              Tạo cuộc họp mới
            </Button>
          </Space>
        </div>

        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#e6f4ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1677ff',
                    fontSize: 18,
                  }}
                >
                  <VideoCameraOutlined />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">Tổng cuộc họp đã tạo</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: '28px' }}>{stats.totalMeetings}</div>
                </div>
              </div>
            </Card>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#eafff2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#22c55e',
                    fontSize: 18,
                  }}
                >
                  <span style={{ fontWeight: 800 }}>👥</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">Đang diễn ra</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, lineHeight: '28px' }}>{stats.activeMeetings}</div>
                    {stats.activeMeetings > 0 && <Tag color="green">Live</Tag>}
                  </div>
                </div>
              </div>
            </Card>
            <Card bordered={false} style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                    fontSize: 18,
                  }}
                >
                  <CalendarOutlined />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">Sắp diễn ra hôm nay</Text>
                  <div style={{ fontSize: 24, fontWeight: 700, lineHeight: '28px' }}>{stats.todayMeetings}</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card
          bordered={false}
          style={{ borderRadius: 12 }}
          title={<span style={{ fontWeight: 700 }}>Lịch trình &amp; Gần đây</span>}
          extra={
            <Button type="link" onClick={() => router.push('/meetings')} style={{ padding: 0 }}>
              Xem tất cả →
            </Button>
          }
        >
          <Table<HomeMeetingRow>
            rowKey="id"
            loading={loadingHome}
            dataSource={recentMeetings}
            pagination={false}
            tableLayout="fixed"
            scroll={{ x: isNarrow ? 780 : undefined }}
            columns={[
              {
                title: 'Thông tin cuộc họp',
                key: 'info',
                render: (_v, r) => (
                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontWeight: 700 }}>{r.title}</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Host: {r.hostName}
                    </Text>
                  </div>
                ),
              },
              {
                title: 'Trạng thái / Thời gian',
                key: 'status',
                width: 210,
                render: (_v, r) => {
                  const isEnded = Boolean(r.endedAt);
                  const isLive = !isEnded && (r.activeParticipantCount ?? 0) > 0;
                  const when = new Date(r.createdAt);
                  const time = when.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                  const date = when.toLocaleDateString('vi-VN');
                  const timeDateLine = (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <Text strong>{time}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {date}
                      </Text>
                    </div>
                  );
                  if (!isLive) {
                    return timeDateLine;
                  }
                  return (
                    <div>
                      <Tag color="green">Đang diễn ra</Tag>
                      <div style={{ marginTop: 6 }}>{timeDateLine}</div>
                    </div>
                  );
                },
              },
              {
                title: 'Mã tham gia',
                dataIndex: 'meetingCode',
                key: 'meetingCode',
                width: 140,
                render: (v: string) => (
                  <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                    {v}
                  </span>
                ),
              },
              {
                title: 'Thao tác',
                key: 'actions',
                width: 130,
                render: (_v, r) => {
                  const isEnded = Boolean(r.endedAt);
                  const isLive = !isEnded && (r.activeParticipantCount ?? 0) > 0;
                  const actionLabel = isLive ? 'Tham gia' : isEnded ? 'Xem lịch sử' : 'Chi tiết';
                  return (
                    <Button
                      type={isLive ? 'primary' : 'default'}
                      style={{ width: 112, justifyContent: 'center' }}
                      onClick={() => {
                        if (isLive) router.push(`/meeting/${r.id}`);
                        else if (isEnded) router.push(`/history/${r.id}`);
                        else setDetailMeeting(r);
                      }}
                    >
                      {actionLabel}
                    </Button>
                  );
                },
              },
            ]}
            locale={{
              emptyText: <div style={{ padding: 16 }}><Text type="secondary">Chưa có dữ liệu.</Text></div>,
            }}
          />
        </Card>
      </div>

      <Modal
        open={Boolean(detailMeeting)}
        onCancel={() => setDetailMeeting(null)}
        footer={null}
        centered
        destroyOnHidden
        width={560}
      >
        {detailMeeting && (
          <div style={{ padding: '4px 4px 0 4px' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {detailMeeting.title}
            </Typography.Title>
            <Typography.Text type="secondary">
              Sắp diễn ra • {dayjs(detailMeeting.createdAt).format('DD/MM/YYYY, HH:mm')}
            </Typography.Text>

            <Card
              style={{ marginTop: 14, borderRadius: 10, background: '#fafcff' }}
              bodyStyle={{ padding: 14 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  rowGap: 14,
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <Typography.Text type="secondary">Mã tham gia:</Typography.Text>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    justifySelf: 'start',
                    background: '#fff',
                    border: '1px solid #d9e2f0',
                    borderRadius: 6,
                    padding: '4px 8px',
                  }}
                >
                  <Typography.Text strong>{detailMeeting.meetingCode}</Typography.Text>
                  <CopyOutlined
                    style={{ color: '#8c8c8c', cursor: 'pointer' }}
                    onClick={() => void copyText(detailMeeting.meetingCode)}
                  />
                </div>

                <Typography.Text type="secondary">Host</Typography.Text>
                <Space>
                  <Avatar size={24} icon={<UserOutlined />} />
                  <Typography.Text strong>{detailMeeting.hostName}</Typography.Text>
                </Space>
              </div>

              <div style={{ borderTop: '1px solid #edf1f7', paddingTop: 12 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  Link tham gia trực tiếp:
                </Typography.Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Input readOnly value={buildMeetingLink(detailMeeting.id)} />
                  <Button onClick={() => void copyText(buildMeetingLink(detailMeeting.id))}>Copy Link</Button>
                </Space.Compact>
              </div>
            </Card>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button onClick={() => setDetailMeeting(null)}>Đóng</Button>
              <Button
                type="primary"
                onClick={() => {
                  router.push(`/meeting/${detailMeeting.id}`);
                }}
              >
                Tham gia ngay
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Meeting Modal - Nâng cấp Success State */}
      <Modal
        title={!createdMeeting ? 'Lên lịch cuộc họp mới' : null}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreatedMeeting(null);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        width={720}
        centered
      >
        {createdMeeting ? (
          <Result
            status="success"
            title="Tạo cuộc họp thành công!"
            subTitle="Phòng họp của bạn đã sẵn sàng. Hãy chia sẻ thông tin dưới đây cho người tham gia."
            style={{ padding: '24px 0 0 0' }}
            extra={
              <div style={{ textAlign: 'left', background: '#f5f5f5', padding: '20px', borderRadius: '8px', marginTop: 24 }}>
                <Descriptions column={1} size="small" labelStyle={{ fontWeight: 600, width: '100px' }}>
                  <Descriptions.Item label="Mã phòng">
                    <Space>
                      <Text copyable={{ text: createdMeeting.code }} style={{ fontSize: 16, color: '#1890ff', fontWeight: 600 }}>
                        {createdMeeting.code}
                      </Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Passcode">
                    <Space>
                      <Text copyable={{ text: createdMeeting.passcode }} style={{ fontSize: 16, fontWeight: 600 }}>
                        {createdMeeting.passcode}
                      </Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Link chia sẻ">
                    <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                      <Input
                        value={buildMeetingLink(createdMeeting.id)}
                        readOnly
                        style={{ background: '#fff' }}
                      />
                      <Button
                        type="primary"
                        icon={<CopyOutlined />}
                        onClick={() => void copyText(buildMeetingLink(createdMeeting.id), 'Đã copy link')}
                      />
                    </Space.Compact>
                  </Descriptions.Item>
                </Descriptions>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                  <Button
                    size="large"
                    onClick={() => {
                      setCreateOpen(false);
                      setCreatedMeeting(null);
                      createForm.resetFields();
                    }}
                  >
                    Đóng
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<RightCircleOutlined />}
                    onClick={() => {
                      setCreateOpen(false);
                      setCreatedMeeting(null);
                      createForm.resetFields();
                      router.push(`/meeting/${createdMeeting.id}`);
                    }}
                  >
                    Tham gia phòng ngay
                  </Button>
                </div>
              </div>
            }
          />
        ) : (
          <Form
            form={createForm}
            layout="vertical"
            initialValues={{
              hostName: user?.username || '',
              scheduleRange: [dayjs(), dayjs().add(1, 'hour')],
              allowJoinBeforeHost: false,
              muteOnJoin: true,
              recordOnServer: false,
            }}
            onFinish={() => void onCreateMeeting()}
            style={{ marginTop: 8 }}
          >
            <Form.Item
              label={<Text strong>Tiêu đề cuộc họp</Text>}
              name="title"
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề cuộc họp' }]}
            >
              <Input
                size="large"
                placeholder="Nhập tiêu đề cuộc họp"
                prefix={<VideoCameraOutlined style={{ color: '#bfbfbf' }} />}
              />
            </Form.Item>

            <Form.Item label={<Text strong>Thời gian cuộc họp dự kiến</Text>} name="scheduleRange">
              <DatePicker.RangePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
                allowClear={false}
              />
            </Form.Item>
            <div style={{ marginTop: -4, marginBottom: 8 }}>
              <Text type="secondary">Thời lượng dự kiến: </Text>
              <Text strong>{estimatedDurationLabel}</Text>
            </div>

            <Divider style={{ margin: '12px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Tuỳ chọn khác
            </Text>
            <Form.Item name="allowJoinBeforeHost" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Cho phép người tham gia vào trước Host</Checkbox>
            </Form.Item>
            <Form.Item name="muteOnJoin" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Tắt micro của người tham gia khi vào phòng</Checkbox>
            </Form.Item>
            <Form.Item name="recordOnServer" valuePropName="checked" style={{ marginBottom: 0 }}>
              <Checkbox>Tự động ghi hình cuộc họp trên máy chủ</Checkbox>
            </Form.Item>

            {/* giữ hostName để không đổi API, nhưng ẩn đi */}
            <Form.Item name="hostName" hidden>
              <Input />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: 32 }}>
              <Button
                size="large"
                onClick={() => {
                  setCreateOpen(false);
                  createForm.resetFields();
                }}
              >
                Hủy
              </Button>
              <Button type="primary" size="large" htmlType="submit" loading={creating} icon={<CalendarOutlined />}>
                Lên lịch
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* Join Meeting Modal - UI tinh chỉnh mượt mà hơn */}
      <Modal
        title={null}
        open={joinOpen}
        onCancel={() => {
          setJoinOpen(false);
          joinForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        centered
        width={450}
      >
        <div style={{ textAlign: 'center', marginBottom: 24, marginTop: 12 }}>
          <div style={{ background: '#f0f5ff', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
             <RightCircleOutlined style={{ fontSize: 32, color: '#2f54eb' }} />
          </div>
          <Title level={4} style={{ margin: 0 }}>Tham gia cuộc họp</Title>
          <Text type="secondary">Nhập thông tin phòng họp được chia sẻ với bạn</Text>
        </div>

        <Form
          form={joinForm}
          layout="vertical"
          onFinish={() => void onJoinMeeting()}
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="meetingIdOrCode"
            rules={[{ required: true, message: 'Vui lòng nhập Meeting ID hoặc Code' }]}
          >
            <Input
              placeholder="Nhập Mã phòng (Code) hoặc Link ID"
              prefix={<VideoCameraOutlined style={{ color: '#bfbfbf' }}/>}
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item
            name="passcode"
            rules={[{ required: true, message: 'Vui lòng nhập passcode' }]}
          >
            <Input
              placeholder="Nhập Passcode (6 chữ số)"
              maxLength={6}
              autoComplete="new-password"
            />
          </Form.Item>

          <Button type="primary" htmlType="submit" block size="large" style={{ marginTop: 8 }}>
            Tham gia ngay
          </Button>
        </Form>
      </Modal>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .dark-theme .ant-card {
            background: rgba(15, 23, 42, 0.65);
            border: 1px solid rgba(148, 163, 184, 0.16);
          }
          `,
        }}
      />
    </MainLayout>
  );
}