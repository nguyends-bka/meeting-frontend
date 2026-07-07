import React from 'react';
import { Modal, Space, Button, Input, Form, DatePicker, Divider, Checkbox, Typography, Radio, Tooltip } from 'antd';
import { VideoCameraOutlined, CopyOutlined, RightCircleOutlined, CalendarOutlined, CheckCircleFilled, KeyOutlined, LinkOutlined, NumberOutlined } from '@ant-design/icons';
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
        <div className="cmr-success">
          {/* Header thành công */}
          <div className="cmr-success-head">
            <span className="cmr-success-icon"><CheckCircleFilled /></span>
            <Typography.Title level={4} className="cmr-success-title">Tạo cuộc họp thành công</Typography.Title>
            <Text className="cmr-success-sub">Phòng họp đã sẵn sàng. Chia sẻ thông tin dưới đây cho người tham gia.</Text>
          </div>

          {/* Mã phòng + Passcode (2 khối) */}
          <div className="cmr-info-grid">
            <div className="cmr-info-card">
              <div className="cmr-info-label"><NumberOutlined /> Mã phòng</div>
              <div className="cmr-info-value-row">
                <span className="cmr-info-value cmr-accent">{createdMeeting.code}</span>
                <Tooltip title="Sao chép mã">
                  <Button type="text" size="small" icon={<CopyOutlined />} className="cmr-copy-btn"
                    onClick={() => void onCopy(createdMeeting.code, 'Đã copy mã phòng')} />
                </Tooltip>
              </div>
            </div>
            <div className="cmr-info-card">
              <div className="cmr-info-label"><KeyOutlined /> Passcode</div>
              <div className="cmr-info-value-row">
                <span className="cmr-info-value">{createdMeeting.passcode}</span>
                <Tooltip title="Sao chép passcode">
                  <Button type="text" size="small" icon={<CopyOutlined />} className="cmr-copy-btn"
                    onClick={() => void onCopy(createdMeeting.passcode, 'Đã copy passcode')} />
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Link chia sẻ */}
          <div className="cmr-link-block">
            <div className="cmr-info-label"><LinkOutlined /> Link chia sẻ</div>
            <Space.Compact style={{ width: '100%', marginTop: 6 }}>
              <Input value={buildLink(createdMeeting.id)} readOnly className="cmr-link-input" />
              <Button type="primary" icon={<CopyOutlined />}
                onClick={() => void onCopy(buildLink(createdMeeting.id), 'Đã copy link')}>
                Sao chép
              </Button>
            </Space.Compact>
          </div>

          {/* Nút hành động */}
          <div className="cmr-actions">
            <Button size="large" onClick={onCancel}>Đóng</Button>
            <Button type="primary" size="large" icon={<RightCircleOutlined />}
              onClick={() => onJoinCreated(createdMeeting.id)}>
              Tham gia phòng ngay
            </Button>
          </div>
        </div>
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
            customRoom: '',
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
              onCalendarChange={(dates, dateStrings, info) => {
                if (info.range === 'start' && dates && dates[0]) {
                  const start = dates[0];
                  const end = start.add(1, 'hour');
                  form.setFieldsValue({
                    scheduleRange: [start, end],
                  });
                }
              }}
            />
          </Form.Item>
          <div style={{ marginTop: -4, marginBottom: 16 }}>
            <Text type="secondary">Thời lượng dự kiến: </Text>
            <Text strong>{estimatedDuration}</Text>
          </div>

          <Form.Item label={<Text strong>Địa điểm / Phòng họp</Text>}>
            <Form.Item name="selectedRoom" noStyle rules={[{ required: true, message: 'Vui lòng chọn địa điểm' }]}>
              <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: 4 }}>
                <Radio value="Phòng Hội Nghị Trực Tuyến">Phòng Hội Nghị Trực Tuyến</Radio>
                <Radio value="Khác">Khác</Radio>
              </Radio.Group>
            </Form.Item>
            
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.selectedRoom !== currentValues.selectedRoom}
            >
              {({ getFieldValue }) => {
                const selected = getFieldValue('selectedRoom');
                if (selected === 'Khác') {
                  return (
                    <Form.Item 
                      name="customRoom" 
                      rules={[{ required: true, message: 'Vui lòng nhập tên phòng họp khác' }]}
                      style={{ marginTop: 8, marginBottom: 0 }}
                    >
                      <Input size="large" placeholder="Nhập tên phòng họp khác" />
                    </Form.Item>
                  );
                }
                return null;
              }}
            </Form.Item>
          </Form.Item>

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
