import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Radio, InputNumber, Button, Space, App } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/api';
import type { MeetingListItem } from '@/dtos/meeting.dto';

interface PollFormModalProps {
  meeting: MeetingListItem | null;
  pollId: string | null;
  initialValues?: any;
  onClose: () => void;
  user: any;
  onSuccess: () => void;
}

export function PollFormModal({ meeting, pollId, initialValues, onClose, user, onSuccess }: PollFormModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (meeting) {
      if (pollId && initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.resetFields();
        form.setFieldsValue({ selectionMode: 'single', durationKind: 'none', durationMinutes: 5, options: ['', ''] });
      }
    }
  }, [meeting, pollId, initialValues, form]);

  const handleSubmit = async () => {
    if (!meeting) return;
    try {
      const values = await form.validateFields();
      const title = String(values.title || '').trim();
      const options = (values.options as string[]).map(x => String(x || '').trim()).filter(Boolean);
      
      if (options.length < 2) {
        message.error('Cần ít nhất 2 lựa chọn');
        return;
      }

      setSaving(true);
      const createdAt = Date.now();
      const durationMinutes = Math.max(1, Math.min(10080, Number(values.durationMinutes) || 5));
      const endAt = values.durationKind === 'timed' ? createdAt + durationMinutes * 60 * 1000 : null;

      const payload = {
        title,
        options,
        createdBy: user?.id ?? '',
        createdByName: user?.fullName?.trim() || user?.username || 'Host',
        createdAt,
        selectionMode: values.selectionMode,
        endAt,
        status: 'draft' as const,
      };

      const res = pollId 
        ? await meetingApi.updateDraftPoll(meeting.id, pollId, { ...payload, pollId })
        : await meetingApi.createPoll(meeting.id, payload);

      setSaving(false);
      
      if (res.error) {
        message.error(res.error);
        return;
      }
      message.success(pollId ? 'Đã cập nhật biểu quyết' : 'Đã lưu biểu quyết nháp');
      onSuccess();
      onClose();
    } catch (e) {
      // Validate failed
    }
  };

  return (
    <Modal
      title={pollId ? "Sửa biểu quyết nháp" : "Tạo biểu quyết nháp"}
      open={!!meeting}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="submit" type="primary" onClick={handleSubmit} loading={saving}>Lưu nháp</Button>
      ]}
    >
      <Form form={form} layout="vertical" className="mt-4">
        <Form.Item label="Câu hỏi biểu quyết" name="title" rules={[{ required: true, message: 'Nhập câu hỏi' }]}>
          <Input.TextArea placeholder="Nhập nội dung câu hỏi..." autoSize={{ minRows: 2, maxRows: 4 }} />
        </Form.Item>
        <Form.Item label="Chế độ chọn" name="selectionMode">
          <Radio.Group>
            <Radio value="single">Một lựa chọn</Radio>
            <Radio value="multiple">Nhiều lựa chọn</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="Thời lượng" name="durationKind">
          <Radio.Group>
            <Radio value="none">Thủ công</Radio>
            <Radio value="timed">Tự động kết thúc</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.durationKind !== cur.durationKind}>
          {() => form.getFieldValue('durationKind') === 'timed' ? (
            <Form.Item label="Số phút" name="durationMinutes" rules={[{ required: true, message: 'Nhập số phút' }]}>
              <InputNumber min={1} max={10080} style={{ width: '100%' }} addonAfter="phút" />
            </Form.Item>
          ) : null}
        </Form.Item>
        
        <Form.List name="options">
          {(fields, { add, remove }) => (
            <>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Các lựa chọn</div>
              {fields.map((field, idx) => (
                <Form.Item key={field.key} style={{ marginBottom: 12 }}>
                  <Space style={{ display: 'flex' }} align="baseline">
                    <Form.Item {...field} noStyle rules={[{ required: true, message: 'Nhập nội dung' }]}>
                      <Input placeholder={`Lựa chọn ${idx + 1}`} style={{ width: 380 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(field.name)} style={{ color: '#ff4d4f' }} />
                  </Space>
                </Form.Item>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>Thêm lựa chọn</Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
