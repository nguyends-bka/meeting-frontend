'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, App, Button, Card, InputNumber, Space, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { adminApi } from '@/services/admin/adminApi';
import type { FaceThresholdSettings } from '@/dtos/admin.dto';

export default function FaceThresholdCard() {
  const { message } = App.useApp();
  const [settings, setSettings] = useState<FaceThresholdSettings | null>(null);
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await adminApi.getFaceThreshold();
    if (res.data && typeof res.data.threshold === 'number') {
      setSettings(res.data);
      setValue(res.data.threshold);
    } else {
      setLoadError(res.error || 'Không tải được ngưỡng nhận diện khuôn mặt.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (value === null) return;
    setSaving(true);
    const res = await adminApi.updateFaceThreshold(value);
    setSaving(false);
    if (res.data && typeof res.data.threshold === 'number') {
      setSettings(res.data);
      setValue(res.data.threshold);
      message.success(`Đã lưu ngưỡng ${res.data.threshold.toFixed(2)}`);
    } else {
      message.error(res.error || 'Không lưu được ngưỡng.');
    }
  };

  return (
    <Card
      loading={loading}
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>Nhận diện khuôn mặt</span>
        </Space>
      }
    >
      {loadError ? (
        <Alert
          type="error"
          showIcon
          message={loadError}
          action={<Button size="small" onClick={() => void load()}>Thử lại</Button>}
        />
      ) : settings && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Điểm khuôn mặt từ ngưỡng này trở lên sẽ đăng nhập được. Áp dụng cho toàn hệ thống từ lần đăng nhập tiếp theo.
          </Typography.Text>
          <Space wrap>
            <InputNumber
              aria-label="Ngưỡng nhận diện khuôn mặt"
              min={settings.minThreshold}
              max={settings.maxThreshold}
              step={0.01}
              precision={2}
              value={value}
              onChange={setValue}
            />
            <Button
              type="primary"
              onClick={() => void handleSave()}
              loading={saving}
              disabled={value === null || value === settings.threshold}
            >
              Lưu ngưỡng
            </Button>
            <Button onClick={() => setValue(settings.defaultThreshold)}>
              Về mặc định {settings.defaultThreshold.toFixed(2)}
            </Button>
          </Space>
          <Typography.Text type="secondary">
            Ngưỡng thấp dễ nhận nhầm người khác, ngưỡng cao dễ từ chối đúng người. Cho phép từ{' '}
            {settings.minThreshold.toFixed(2)} đến {settings.maxThreshold.toFixed(2)}.
          </Typography.Text>
        </Space>
      )}
    </Card>
  );
}
