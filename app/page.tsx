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
  Descriptions,
  Tooltip,
  Result,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  RightCircleOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  CalendarOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

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
    // 401 đã được apiClient xử lý (đăng xuất + redirect /login)
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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        
        {/* Welcome Section - Nâng cấp giao diện Hero Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
            padding: '40px 32px',
            borderRadius: '16px',
            marginBottom: '32px',
            boxShadow: '0 10px 30px -10px rgba(24,144,255,0.4)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}
        >
          <Avatar
            size={72}
            icon={<UserOutlined />}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)' }}
          />
          <div>
            <Title level={2} style={{ color: '#fff', margin: 0, fontWeight: 600 }}>
              Chào mừng trở lại, {user?.fullName} 👋
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px' }}>
              Sẵn sàng để bắt đầu hoặc tham gia các cuộc họp hôm nay chưa?
            </Text>
          </div>
        </div>

        {/* Statistics - Nâng cấp giao diện hiển thị nổi bật hơn */}
        {stats && (
          <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={12}>
              <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="home-stat-icon home-stat-icon--primary" style={{ padding: '16px', background: '#e6f7ff', borderRadius: '12px' }}>
                    <VideoCameraOutlined style={{ fontSize: '28px', color: '#1890ff' }} />
                  </div>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: '15px' }}>Tổng số cuộc họp</Text>}
                    value={stats.totalMeetings}
                    valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#262626' }}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="home-stat-icon home-stat-icon--success" style={{ padding: '16px', background: '#f6ffed', borderRadius: '12px' }}>
                    <CalendarOutlined style={{ fontSize: '28px', color: '#52c41a' }} />
                  </div>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: '15px' }}>Đang diễn ra</Text>}
                    value={stats.activeMeetings}
                    valueStyle={{ fontSize: '32px', fontWeight: 600, color: '#52c41a' }}
                  />
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* Quick Actions - Chuyển thành dạng Grid Card hiện đại */}
        <Title level={4} style={{ marginBottom: 20 }}>Bảng điều khiển</Title>
        <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
          <Col xs={12} sm={12} md={6}>
            <Card
              hoverable
              onClick={() => setCreateOpen(true)}
              style={{ borderRadius: '12px', textAlign: 'center', height: '100%', border: '1px solid #91d5ff' }}
              bodyStyle={{ padding: '32px 16px' }}
            >
              <div className="home-action-icon home-action-icon--create" style={{ background: '#1890ff', color: '#fff', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                <PlusOutlined />
              </div>
              <Title level={5} style={{ margin: 0 }}>Tạo cuộc họp</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Tạo phòng họp mới</Text>
            </Card>
          </Col>

          <Col xs={12} sm={12} md={6}>
            <Card
              hoverable
              onClick={() => setJoinOpen(true)}
              style={{ borderRadius: '12px', textAlign: 'center', height: '100%' }}
              bodyStyle={{ padding: '32px 16px' }}
            >
              <div className="home-action-icon home-action-icon--join" style={{ background: '#52c41a', color: '#fff', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                <RightCircleOutlined />
              </div>
              <Title level={5} style={{ margin: 0 }}>Tham gia</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Nhập mã phòng</Text>
            </Card>
          </Col>

          <Col xs={12} sm={12} md={6}>
            <Card
              hoverable
              onClick={() => router.push('/meetings')}
              style={{ borderRadius: '12px', textAlign: 'center', height: '100%' }}
              bodyStyle={{ padding: '32px 16px' }}
            >
              <div className="home-action-icon home-action-icon--list" style={{ background: '#722ed1', color: '#fff', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                <UnorderedListOutlined />
              </div>
              <Title level={5} style={{ margin: 0 }}>Tất cả cuộc họp</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Quản lý phòng họp</Text>
            </Card>
          </Col>

          <Col xs={12} sm={12} md={6}>
            <Card
              hoverable
              onClick={() => router.push('/history')}
              style={{ borderRadius: '12px', textAlign: 'center', height: '100%' }}
              bodyStyle={{ padding: '32px 16px' }}
            >
              <div className="home-action-icon home-action-icon--history" style={{ background: '#fa8c16', color: '#fff', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>
                <HistoryOutlined />
              </div>
              <Title level={5} style={{ margin: 0 }}>Lịch sử</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Xem lại lịch sử</Text>
            </Card>
          </Col>
        </Row>

        {/* Recent Meetings Preview */}
        <Card 
          title="Cuộc họp gần đây" 
          bordered={false}
          style={{ borderRadius: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
          extra={
            <Button type="link" onClick={() => router.push('/meetings')} style={{ padding: 0 }}>
              Xem tất cả →
            </Button>
          }
        >
           <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Text type="secondary">Bạn có thể xem danh sách chi tiết trong phần Tất cả cuộc họp.</Text>
           </div>
        </Card>
      </div>

      {/* Create Meeting Modal - Nâng cấp Success State */}
      <Modal
        title={!createdMeeting ? "Tạo cuộc họp mới" : null}
        open={createOpen}
        onCancel={() => {
          setCreateOpen(false);
          setCreatedMeeting(null);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        width={550}
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
            initialValues={{ hostName: user?.username || '' }}
            onFinish={() => void onCreateMeeting()}
            style={{ marginTop: 24 }}
          >
            <Form.Item
              label={<Text strong>Tiêu đề cuộc họp</Text>}
              name="title"
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề cuộc họp' }]}
            >
              <Input size="large" placeholder="Nhập tiêu đề cuộc họp (VD: Họp dự án Sprint 1)" prefix={<VideoCameraOutlined style={{ color: '#bfbfbf' }}/>} />
            </Form.Item>

            <Form.Item 
              label={<Text strong>Tên Host hiển thị</Text>} 
              name="hostName" 
              tooltip="Tên này sẽ hiển thị với những người tham gia khác"
            >
              <Input size="large" placeholder={`Mặc định: ${user?.username || 'Host'}`} prefix={<UserOutlined style={{ color: '#bfbfbf' }}/>} />
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
              <Button type="primary" size="large" htmlType="submit" loading={creating}>
                Tạo cuộc họp
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
          .dark-theme .home-stat-icon {
            border: 1px solid rgba(148, 163, 184, 0.35);
          }
          .dark-theme .home-stat-icon--primary {
            background: rgba(59, 130, 246, 0.24) !important;
          }
          .dark-theme .home-stat-icon--success {
            background: rgba(34, 197, 94, 0.24) !important;
          }
          .dark-theme .home-stat-icon .anticon {
            color: #e2e8f0 !important;
            opacity: 1 !important;
          }
          .dark-theme .home-action-icon {
            border: 1px solid rgba(148, 163, 184, 0.3);
          }
          .dark-theme .home-action-icon .anticon {
            color: #ffffff !important;
            opacity: 1 !important;
          }
          `,
        }}
      />
    </MainLayout>
  );
}