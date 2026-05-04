import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, DatePicker, Button, App } from 'antd';
import dayjs from 'dayjs';
import { meetingApi } from '@/services/api';
import type { MeetingListItem } from '@/dtos/meeting.dto';

interface EditMeetingModalProps {
  meeting: MeetingListItem | null;
  onClose: () => void;
  onSuccess: (updated: MeetingListItem) => void;
}

export function EditMeetingModal({ meeting, onClose, onSuccess }: EditMeetingModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (meeting) {
      form.setFieldsValue({
        title: meeting.title,
        startAt: dayjs(meeting.createdAt),
        estimatedEndAt: meeting.startedAt ? dayjs(meeting.startedAt) : null,
      });
    } else {
      form.resetFields();
    }
  }, [meeting, form]);

  const handleSubmit = async () => {
    if (!meeting) return;
    const values = await form.validateFields();
    const title = String(values.title || '').trim();
    const startAt = values.startAt?.valueOf?.();
    const estimatedEndAt = values.estimatedEndAt?.valueOf?.() ?? null;

    if (!title) {
      message.error('Vui lòng nhập tiêu đề cuộc họp');
      return;
    }
    if (!startAt || Number.isNaN(startAt)) {
      message.error('Vui lòng chọn thời gian bắt đầu');
      return;
    }
    if (estimatedEndAt != null && estimatedEndAt <= startAt) {
      message.error('Thời gian kết thúc dự kiến phải sau thời gian bắt đầu');
      return;
    }

    setUpdating(true);
    const res = await meetingApi.updateMeeting(meeting.id, {
      title,
      startAt,
      estimatedEndAt,
    });
    setUpdating(false);

    if (res.error || !res.data) {
      message.error(res.error || 'Không thể cập nhật cuộc họp');
      return;
    }

    message.success('Cập nhật cuộc họp thành công');
    onSuccess(res.data as MeetingListItem);
    onClose();
  };

  return (
    <Modal
      title="Sửa thông tin cuộc họp"
      open={!!meeting}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={updating}>Lưu thay đổi</Button>
      ]}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item label="Tiêu đề" name="title" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
          <Input placeholder="Nhập tiêu đề cuộc họp..." />
        </Form.Item>
        <Form.Item label="Thời gian bắt đầu" name="startAt" rules={[{ required: true, message: 'Chọn thời gian bắt đầu' }]}>
          <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="Thời gian kết thúc dự kiến (không bắt buộc)" name="estimatedEndAt">
          <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
