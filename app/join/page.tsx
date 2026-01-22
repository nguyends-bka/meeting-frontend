'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiService } from '@/services/api';
import MainLayout from '@/components/Sidebar';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Space,
  Typography,
  Alert,
} from 'antd';
import { RightCircleOutlined } from '@ant-design/icons';

export default function JoinPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const handleJoin = async (values: { meetingIdOrCode: string; passcode: string }) => {
    const { meetingIdOrCode, passcode } = values;
    setSubmitting(true);

    const isGuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        meetingIdOrCode
      );

    const result = isGuid
      ? await apiService.joinMeeting(meetingIdOrCode, passcode)
      : await apiService.joinMeetingByCode(meetingIdOrCode.toUpperCase(), passcode);

    setSubmitting(false);

    if (result.error) {
      message.error(result.error);
      return;
    }

    if (result.data) {
      message.success('Tham gia cuộc họp thành công');
      router.push(`/meeting/${result.data.meetingId}`);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <Card
          title={
            <Space>
              <RightCircleOutlined />
              <Typography.Title level={4} style={{ margin: 0 }}>
                Tham gia cuộc họp
              </Typography.Title>
            </Space>
          }
        >
          <Alert
            message="Hướng dẫn"
            description="Nhập Meeting ID (UUID) hoặc Meeting Code (6 ký tự) cùng với Passcode để tham gia cuộc họp."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleJoin}
            autoComplete="off"
          >
            <Form.Item
              label="Meeting ID hoặc Code"
              name="meetingIdOrCode"
              rules={[
                { required: true, message: 'Vui lòng nhập Meeting ID hoặc Code' },
                {
                  pattern: /^[0-9a-fA-F-]{8,}$|^[A-Z0-9]{6}$/,
                  message: 'Định dạng không hợp lệ',
                },
              ]}
            >
              <Input
                placeholder="Nhập Meeting ID (UUID) hoặc Code (6 ký tự)"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Passcode"
              name="passcode"
              rules={[
                { required: true, message: 'Vui lòng nhập passcode' },
                { min: 4, message: 'Passcode phải có ít nhất 4 ký tự' },
              ]}
            >
              <Input.Password
                placeholder="Nhập passcode"
                size="large"
                maxLength={10}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={<RightCircleOutlined />}
                loading={submitting}
                block
              >
                Tham gia cuộc họp
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
}
