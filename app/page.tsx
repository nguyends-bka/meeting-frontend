'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/MainLayout';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Descriptions,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  RightCircleOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  TeamOutlined,
  CalendarOutlined,
} from '@ant-design/icons';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, loading, isAdmin } = useAuth();
  const { message } = App.useApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<{
    id: string;
    code: string;
    passcode: string;
  } | null>(null);
  const [stats, setStats] = useState<{
    totalMeetings: number;
    activeMeetings: number;
  } | null>(null);

  const [createForm] = Form.useForm();
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
    const result = await apiService.getMeetings();
    if (result.data) {
      const meetings = result.data as any[];
      setStats({
        totalMeetings: meetings.length,
        activeMeetings: meetings.length, // TODO: Tính active meetings
      });
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

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        {/* Welcome Section */}
        <Card style={{ marginBottom: 24 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Chào mừng, {user?.username}! 👋
            </Typography.Title>
            <Space>
              <Tag icon={<TeamOutlined />} color="blue">
                {user?.username}
              </Tag>
              {isAdmin && (
                <Tag color="red">Admin</Tag>
              )}
            </Space>
          </Space>
        </Card>

        {/* Statistics */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Tổng cuộc họp"
                  value={stats.totalMeetings}
                  prefix={<VideoCameraOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Cuộc họp đang diễn ra"
                  value={stats.activeMeetings}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Quick Actions */}
        <Card
          title="Thao tác nhanh"
          style={{ marginBottom: 24 }}
        >
          <Space wrap size="large">
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => setCreateOpen(true)}
            >
              Tạo cuộc họp mới
            </Button>
            <Button
              size="large"
              icon={<RightCircleOutlined />}
              onClick={() => setJoinOpen(true)}
            >
              Tham gia cuộc họp
            </Button>
            <Button
              size="large"
              onClick={() => router.push('/meetings')}
            >
              Xem tất cả cuộc họp
            </Button>
            <Button
              size="large"
              onClick={() => router.push('/history')}
            >
              Lịch sử tham gia
            </Button>
          </Space>
        </Card>

        {/* Recent Meetings Preview */}
        <Card title="Cuộc họp gần đây">
          <Button onClick={() => router.push('/meetings')}>
            Xem tất cả cuộc họp →
          </Button>
        </Card>
      </div>

      {/* Create Meeting Modal */}
      <Modal
        title="Tạo cuộc họp mới"
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreatedMeeting(null);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        width={600}
      >
        {createdMeeting ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Typography.Text strong style={{ fontSize: 16 }}>
              Tạo cuộc họp thành công! ✅
            </Typography.Text>
            <Typography.Text type="secondary">
              Lưu thông tin bên dưới để chia sẻ hoặc tham gia sau.
            </Typography.Text>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Mã cuộc họp">
                <Space>
                  <Typography.Text code style={{ fontSize: 16 }}>
                    {createdMeeting.code}
                  </Typography.Text>
                  <Tooltip title="Copy mã">
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => void copyText(createdMeeting.code, 'Đã copy mã cuộc họp')}
                    />
                  </Tooltip>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Passcode">
                <Space>
                  <Typography.Text code style={{ fontSize: 16 }}>
                    {createdMeeting.passcode}
                  </Typography.Text>
                  <Tooltip title="Copy passcode">
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => void copyText(createdMeeting.passcode, 'Đã copy passcode')}
                    />
                  </Tooltip>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Link chia sẻ">
                <Space style={{ width: '100%' }} wrap>
                  <Input
                    value={buildMeetingLink(createdMeeting.id)}
                    readOnly
                    style={{ flex: 1, maxWidth: 400 }}
                  />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => void copyText(buildMeetingLink(createdMeeting.id), 'Đã copy link')}
                  >
                    Copy
                  </Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
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
                icon={<RightCircleOutlined />}
                onClick={() => {
                  setCreateOpen(false);
                  setCreatedMeeting(null);
                  createForm.resetFields();
                  router.push(`/meeting/${createdMeeting.id}`);
                }}
              >
                Tham gia ngay
              </Button>
            </Space>
          </Space>
        ) : (
          <Form
            form={createForm}
            layout="vertical"
            initialValues={{ hostName: user?.username || '' }}
            onFinish={() => void onCreateMeeting()}
          >
            <Form.Item
              label="Tiêu đề cuộc họp"
              name="title"
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề cuộc họp' }]}
            >
              <Input placeholder="Nhập tiêu đề cuộc họp" />
            </Form.Item>

            <Form.Item label="Tên Host (tùy chọn)" name="hostName">
              <Input placeholder={`Mặc định: ${user?.username || 'Host'}`} />
            </Form.Item>

            <Space>
              <Button type="primary" htmlType="submit" loading={creating}>
                Tạo cuộc họp
              </Button>
              <Button
                onClick={() => {
                  setCreateOpen(false);
                  createForm.resetFields();
                }}
              >
                Hủy
              </Button>
            </Space>
          </Form>
        )}
      </Modal>

      {/* Join Meeting Modal */}
      <Modal
        title="Tham gia cuộc họp"
        open={joinOpen}
        onCancel={() => {
          setJoinOpen(false);
          joinForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
      >
        <Form form={joinForm} layout="vertical" onFinish={() => void onJoinMeeting()}>
          <Form.Item
            label="Meeting ID hoặc Code"
            name="meetingIdOrCode"
            rules={[{ required: true, message: 'Vui lòng nhập Meeting ID hoặc Code' }]}
          >
            <Input placeholder="Nhập Meeting ID (UUID) hoặc Code (6 ký tự)" />
          </Form.Item>

          <Form.Item
            label="Passcode"
            name="passcode"
            rules={[{ required: true, message: 'Vui lòng nhập passcode' }]}
          >
            <Input placeholder="Nhập passcode (6 chữ số)" maxLength={6} />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit">
              Tham gia
            </Button>
            <Button
              onClick={() => {
                setJoinOpen(false);
                joinForm.resetFields();
              }}
            >
              Hủy
            </Button>
          </Space>
        </Form>
      </Modal>
    </MainLayout>
  );
}
