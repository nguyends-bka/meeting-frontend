import React from 'react';
import { Modal, Form, Input, Button, Typography } from 'antd';
import { RightCircleOutlined, VideoCameraOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface JoinMeetingModalProps {
  open: boolean;
  form: any;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function JoinMeetingModal({
  open,
  form,
  onCancel,
  onSubmit,
}: JoinMeetingModalProps) {
  return (
    <Modal
      title={null}
      open={open}
      onCancel={onCancel}
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
        form={form}
        layout="vertical"
        onFinish={onSubmit}
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
          <Input.Password
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
  );
}
