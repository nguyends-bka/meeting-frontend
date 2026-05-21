import React from 'react';
import { Modal, Result, Descriptions, Space, Button, Input, Form, DatePicker, Divider, Checkbox, Typography } from 'antd';
import { VideoCameraOutlined, CopyOutlined, RightCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

interface CreateMeetingModalProps {
  open: boolean;
  creating: boolean;
  createdMeeting: {
    id: string;
    code: string;
    passcode: string;
  } | null;
  form: any;
  estimatedDuration: string;
  onCancel: () => void;
  onSubmit: () => void;
  onCopy: (text: string, msg?: string) => void;
  buildLink: (id: string) => string;
  onJoinCreated: (id: string) => void;
}

export default function CreateMeetingModal({
  open,
  creating,
  createdMeeting,
  form,
  estimatedDuration,
  onCancel,
  onSubmit,
  onCopy,
  buildLink,
  onJoinCreated,
}: CreateMeetingModalProps) {
  return (
    <Modal
      title={!createdMeeting ? 'Lên lịch cuộc họp mới' : null}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      width={720}
      centered
    >
      {createdMeeting ? (
        <Result
          status="info"
          title="Thông tin cuộc họp"
          subTitle="Phòng họp đã sẵn sàng. Hãy chia sẻ thông tin dưới đây cho người tham gia."
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
                      value={buildLink(createdMeeting.id)}
                      readOnly
                      style={{ background: '#fff' }}
                    />
                    <Button
                      type="primary"
                      icon={<CopyOutlined />}
                      onClick={() => void onCopy(buildLink(createdMeeting.id), 'Đã copy link')}
                    />
                  </Space.Compact>
                </Descriptions.Item>
              </Descriptions>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
                <Button size="large" onClick={onCancel}>
                  Đóng
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<RightCircleOutlined />}
                  onClick={() => onJoinCreated(createdMeeting.id)}
                >
                  Tham gia phòng ngay
                </Button>
              </div>
            </div>
          }
        />
      ) : (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            hostName: '', // values are set via hook or initially empty
            scheduleRange: [dayjs(), dayjs().add(1, 'hour')],
            allowJoinBeforeHost: false,
            muteOnJoin: true,
            recordOnServer: false,
          }}
          onFinish={onSubmit}
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
            <Text strong>{estimatedDuration}</Text>
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
            <Button size="large" onClick={onCancel}>
              Hủy
            </Button>
            <Button type="primary" size="large" htmlType="submit" loading={creating} icon={<CalendarOutlined />}>
              Lên lịch
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
