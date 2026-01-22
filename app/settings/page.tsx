'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { Card, Empty, Typography, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <SettingOutlined />
              <Typography.Title level={4} style={{ margin: 0 }}>
                Cài đặt
              </Typography.Title>
            </Space>
          }
        >
          <Empty
            description="Tính năng đang được phát triển"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
