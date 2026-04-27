'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Badge, Popover, List, Typography, Button, Modal } from 'antd';
import { BellOutlined, FolderOpenOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/api';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

const { Header } = Layout;
const { Text } = Typography;

const ENABLE_NOTIFICATIONS = process.env.NEXT_PUBLIC_ENABLE_MEETING_NOTIFICATIONS === 'true';

type HomeNotificationItem = {
  id: string;
  meetingId: string;
  title: string;
  desc: string;
  time: string;
  kind: 'info' | 'success' | 'warn';
  openedAt?: string | null;
};

export default function AppHeader() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<HomeNotificationItem[]>([]);
  const [openedNotification, setOpenedNotification] = useState<HomeNotificationItem | null>(null);

  const loadNotifications = async () => {
    const res = await meetingApi.getMyNotifications();
    if (res.error || !Array.isArray(res.data)) {
      setNotifications([]);
      return;
    }
    const mapped: HomeNotificationItem[] = res.data.map((n) => ({
      id: n.id,
      meetingId: n.meetingId,
      title: n.type === 'cohost_granted' ? 'Bạn được cấp quyền chủ trì' : 'Bạn được thêm vào cuộc họp',
      desc: n.message,
      time: dayjs(n.createdAt).format('DD/MM/YYYY HH:mm:ss'),
      kind: n.type === 'cohost_granted' ? 'success' : 'info',
      openedAt: n.openedAt ?? null,
    }));
    setNotifications(mapped.slice(0, 10));
  };

  useEffect(() => {
    if (ENABLE_NOTIFICATIONS) {
      loadNotifications();
    }
  }, []);

  const openNotificationDetail = useCallback(
    async (item: HomeNotificationItem) => {
      if (!item.openedAt) {
        await meetingApi.openNotification(item.id);
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, openedAt: n.openedAt ?? new Date().toISOString() } : n)),
      );
      setOpenedNotification({
        ...item,
        openedAt: item.openedAt ?? new Date().toISOString(),
      });
    },
    [],
  );

  const unreadCount = notifications.filter(n => !n.openedAt).length;

  const content = (
    <div style={{ width: 340, maxHeight: 450, overflowY: 'auto' }}>
      <List
        itemLayout="horizontal"
        dataSource={notifications.length > 0 ? notifications : [{
          id: 'empty',
          title: 'Chưa có thông báo nào',
          desc: 'Khi có hoạt động mới, thông báo sẽ hiển thị tại đây.',
          kind: 'info' as const
        }]}
        renderItem={(n: any) => {
          if (n.id === 'empty') {
            return (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
                <BellOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                <div>{n.title}</div>
              </div>
            );
          }
          const icon =
            n.kind === 'success' ? (
              <FolderOpenOutlined style={{ color: '#16a34a', fontSize: 20 }} />
            ) : n.kind === 'warn' ? (
              <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 20 }} />
            ) : (
              <InfoCircleOutlined style={{ color: '#3b82f6', fontSize: 20 }} />
            );
          return (
            <div
              onClick={() => openNotificationDetail(n)}
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f5f9',
                background: n.openedAt ? 'transparent' : '#f0f9ff',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ display: 'block', fontSize: 14, color: '#1e293b' }}>
                  {n.title}
                </Text>
                <Text style={{ fontSize: 13, display: 'block', marginTop: 4, color: '#475569' }}>
                  {n.desc}
                </Text>
                {n.time ? (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block', fontWeight: 500 }}>
                    {n.time}
                  </Text>
                ) : null}
              </div>
            </div>
          );
        }}
      />
    </div>
  );

  return (
    <>
      <Header style={{ 
        background: '#ffffff', 
        padding: '0 24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,21,41,.08)',
        zIndex: 10,
        height: 64,
        lineHeight: '64px'
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#1e3a8a', letterSpacing: '-0.01em' }}>
          Hệ Thống Họp Trực Tuyến
        </div>
        <Popover content={content} title={<span style={{ fontWeight: 700, fontSize: 16 }}>Thông báo mới</span>} trigger="click" placement="bottomRight">
          <Badge count={unreadCount} style={{ backgroundColor: '#ef4444' }} offset={[-4, 4]}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }} className="header-bell-icon">
              <BellOutlined style={{ fontSize: 18, color: '#475569' }} />
            </div>
          </Badge>
        </Popover>
      </Header>

      <Modal
        title="Chi tiết thông báo"
        open={Boolean(openedNotification)}
        onCancel={() => setOpenedNotification(null)}
        footer={null}
        destroyOnHidden
      >
        {openedNotification && (
          <div>
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              {openedNotification.title}
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 10 }}>
              {openedNotification.desc}
            </Typography.Paragraph>
            <Typography.Text type="secondary" style={{ display: 'block' }}>
              Thời gian nhận: {openedNotification.time}
            </Typography.Text>
            {openedNotification.meetingId ? (
              <div style={{ marginTop: 16 }}>
                <Button type="primary" onClick={() => {
                  setOpenedNotification(null);
                  router.push('/meetings');
                }}>
                  Mở cuộc họp liên quan
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <style dangerouslySetInnerHTML={{
        __html: `
          .header-bell-icon:hover {
            background: #e2e8f0 !important;
          }
        `
      }} />
    </>
  );
}
