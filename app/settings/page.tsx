'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import {
  Card,
  Typography,
  Space,
  Switch,
  Button,
  Divider,
  Form,
  Select,
  App,
  Row,
  Col,
} from 'antd';
import {
  SettingOutlined,
  BellOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

type SettingsData = {
  // Thông báo
  emailNotifications: boolean;
  meetingReminders: boolean;
  joinNotifications: boolean;
  
  // Giao diện
  theme: 'light' | 'dark' | 'auto';
  language: 'vi' | 'en';
};

const DEFAULT_SETTINGS: SettingsData = {
  emailNotifications: true,
  meetingReminders: true,
  joinNotifications: true,
  theme: 'light',
  language: 'vi',
};

const STORAGE_KEY = 'meeting_app_settings';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();

  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSettings();
    }
  }, [isAuthenticated]);

  const loadSettings = () => {
    setLoadingSettings(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed };
        setSettings(mergedSettings);
        form.setFieldsValue(mergedSettings);
        // Áp dụng theme khi load
        applyTheme(mergedSettings.theme);
      } else {
        setSettings(DEFAULT_SETTINGS);
        form.setFieldsValue(DEFAULT_SETTINGS);
        // Áp dụng theme mặc định
        applyTheme(DEFAULT_SETTINGS.theme);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setSettings(DEFAULT_SETTINGS);
      form.setFieldsValue(DEFAULT_SETTINGS);
      applyTheme(DEFAULT_SETTINGS.theme);
    }
    setLoadingSettings(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      // Lưu vào localStorage
      const settingsToSave = {
        ...DEFAULT_SETTINGS,
        ...values,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
      setSettings(settingsToSave);
      
      // Áp dụng theme nếu thay đổi
      if (values.theme !== settings.theme) {
        applyTheme(values.theme);
      }
      
      messageApi.success('Đã lưu cài đặt thành công');
    } catch (error) {
      console.error('Error saving settings:', error);
      messageApi.error('Có lỗi xảy ra khi lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
    // Áp dụng theme mặc định
    applyTheme(DEFAULT_SETTINGS.theme);
    messageApi.success('Đã khôi phục cài đặt mặc định');
  };

  const applyTheme = (theme: string) => {
    const html = document.documentElement;
    const body = document.body;
    if (!html) return;
    html.classList.remove('light-theme', 'dark-theme', 'auto-theme');
    if (body) body.classList.remove('light-theme', 'dark-theme', 'auto-theme');
    // Xác định theme thực tế (nếu là auto thì dùng system preference)
    let actualTheme = theme;
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      actualTheme = prefersDark ? 'dark' : 'light';
    }
    if (body) {
      if (actualTheme === 'dark') {
        html.classList.add('dark-theme');
        html.setAttribute('data-theme', 'dark');
        body.classList.add('dark-theme');
        body.style.backgroundColor = '#141414';
        body.style.color = '#fff';
      } else {
        html.classList.add('light-theme');
        html.setAttribute('data-theme', 'light');
        body.classList.add('light-theme');
        body.style.backgroundColor = '#f5f5f5';
        body.style.color = '#000';
      }
    } else {
      if (actualTheme === 'dark') {
        html.classList.add('dark-theme');
        html.setAttribute('data-theme', 'dark');
      } else {
        html.classList.add('light-theme');
        html.setAttribute('data-theme', 'light');
      }
    }
    localStorage.setItem('current_theme', actualTheme);
  };


  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card
            title={
              <Space>
                <SettingOutlined />
                <Typography.Title level={4} style={{ margin: 0 }}>
                  Cài đặt
                </Typography.Title>
              </Space>
            }
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadSettings}
                  loading={loadingSettings}
                >
                  Tải lại
                </Button>
                <Button onClick={handleReset}>
                  Khôi phục mặc định
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                >
                  Lưu cài đặt
                </Button>
              </Space>
            }
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={DEFAULT_SETTINGS}
            >
              {/* Thông báo */}
              <Card
                type="inner"
                title={
                  <Space>
                    <BellOutlined />
                    <span>Thông báo</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      name="emailNotifications"
                      valuePropName="checked"
                      label="Thông báo qua email"
                    >
                      <Switch
                        checkedChildren="Bật"
                        unCheckedChildren="Tắt"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      name="meetingReminders"
                      valuePropName="checked"
                      label="Nhắc nhở cuộc họp"
                    >
                      <Switch
                        checkedChildren="Bật"
                        unCheckedChildren="Tắt"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <Form.Item
                      name="joinNotifications"
                      valuePropName="checked"
                      label="Thông báo khi có người tham gia"
                    >
                      <Switch
                        checkedChildren="Bật"
                        unCheckedChildren="Tắt"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              {/* Giao diện */}
              <Card
                type="inner"
                title={
                  <Space>
                    <SettingOutlined />
                    <span>Giao diện</span>
                  </Space>
                }
              >
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="theme"
                      label="Giao diện"
                    >
                      <Select
                        onChange={(value) => {
                          // Áp dụng theme ngay khi thay đổi (không cần save)
                          applyTheme(value);
                        }}
                      >
                        <Select.Option value="light">Sáng</Select.Option>
                        <Select.Option value="dark">Tối</Select.Option>
                        <Select.Option value="auto">Tự động</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="language"
                      label="Ngôn ngữ"
                    >
                      <Select>
                        <Select.Option value="vi">Tiếng Việt</Select.Option>
                        <Select.Option value="en">English</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Form>
          </Card>
        </Space>
      </div>
    </MainLayout>
  );
}
