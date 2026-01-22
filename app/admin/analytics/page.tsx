'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import MainLayout from '@/components/MainLayout';
import { Card, Empty, Typography, Space } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const { isAuthenticated, loading, isAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAuthenticated, loading, isAdmin, router]);

  if (loading) return <div style={{ padding: 24 }}>Đang tải...</div>;
  if (!isAuthenticated || !isAdmin) return null;

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card
          title={
            <Space>
              <BarChartOutlined />
              <Typography.Title level={4} style={{ margin: 0 }}>
                Thống kê & Phân tích
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
