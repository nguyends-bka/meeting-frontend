'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Layout, Badge, Popover, List, Typography, Button, Modal, Grid } from 'antd';
import { BellOutlined, FolderOpenOutlined, ExclamationCircleOutlined, InfoCircleOutlined, ReloadOutlined, PlusOutlined, LoginOutlined } from '@ant-design/icons';
import { meetingApi } from '@/services/api';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { useHeaderActions } from '@/contexts/HeaderActionsContext';
import { useAuth } from '@/lib/auth';

const { Header } = Layout;
const { Text } = Typography;

// Mặc định BẬT — chỉ tắt khi đặt tường minh NEXT_PUBLIC_ENABLE_MEETING_NOTIFICATIONS=false.
// (Trước đây yêu cầu ='true' nên bản build production thiếu biến env sẽ tắt mất
// phần tự tải/poll/SSE, trong khi nút bấm tay không bị chặn → "phải ấn mới hiện".)
const ENABLE_NOTIFICATIONS = process.env.NEXT_PUBLIC_ENABLE_MEETING_NOTIFICATIONS !== 'false';

type HomeNotificationItem = {
  id: string;
  meetingId: string;
  title: string;
  desc: string;
  time: string;
  kind: 'info' | 'success' | 'warn';
  openedAt?: string | null;
};

type NotificationItemWithEmpty = HomeNotificationItem | { id: 'empty'; title: string; desc: string; kind: 'info' };

export default function AppHeader() {
  const router = useRouter();
  const { actions } = useHeaderActions();
  const { isAuthenticated } = useAuth();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [notifications, setNotifications] = useState<HomeNotificationItem[]>([]);
  const [openedNotification, setOpenedNotification] = useState<HomeNotificationItem | null>(null);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const handleJoin = useCallback(() => {
    if (actions.onOpenJoin) {
      actions.onOpenJoin();
    } else {
      router.push('/?action=join');
    }
  }, [actions, router]);

  const handleCreate = useCallback(() => {
    if (actions.onOpenCreate) {
      actions.onOpenCreate();
    } else {
      router.push('/?action=create');
    }
  }, [actions, router]);

  const loadNotifications = async (): Promise<boolean> => {
    setLoadingNotifications(true);
    const res = await meetingApi.getMyNotifications();
    if (res.error || !Array.isArray(res.data)) {
      // Lỗi tạm thời (mạng chập chờn, token chưa sẵn sàng ngay sau reload...):
      // GIỮ NGUYÊN danh sách đang có để badge không bị nhấp về 0.
      setLoadingNotifications(false);
      return false;
    }
    const mapped: HomeNotificationItem[] = res.data.map((n) => {
      // Map notification types to user-friendly titles and styles
      let title = '';
      let kind: 'info' | 'success' | 'warn' = 'info';
      
      switch (n.type) {
        case 'cohost_granted':
          title = 'Bạn được cấp quyền chủ trì';
          kind = 'success';
          break;
        case 'invite_added':
          title = 'Bạn được thêm vào cuộc họp';
          kind = 'info';
          break;
        case 'cohost_removed':
          title = 'Quyền chủ trì của bạn bị gỡ bỏ';
          kind = 'warn';
          break;
        case 'removed_from_meeting':
          title = 'Bạn bị loại khỏi cuộc họp';
          kind = 'warn';
          break;
        case 'meeting_started':
          title = 'Cuộc họp bắt đầu';
          kind = 'info';
          break;
        case 'meeting_ended':
          title = 'Cuộc họp kết thúc';
          kind = 'info';
          break;
        default:
          title = 'Thông báo mới';
          kind = 'info';
      }
      
      return {
        id: n.id,
        meetingId: n.meetingId,
        title,
        desc: n.message || `Từ: ${n.actorUsername || 'Hệ thống'}`,
        time: dayjs(n.createdAt).format('DD/MM/YYYY HH:mm:ss'),
        kind,
        openedAt: n.openedAt ?? null,
      };
    });
    const next = mapped.slice(0, 10);
    // Chỉ cập nhật khi dữ liệu THỰC SỰ thay đổi (có thông báo mới, hoặc đổi
    // trạng thái đã đọc). Nếu giống hệt thì bỏ qua để không render lại vô ích.
    setNotifications((prev) => {
      const changed =
        prev.length !== next.length ||
        next.some((n, i) => n.id !== prev[i]?.id || n.openedAt !== prev[i]?.openedAt);
      return changed ? next : prev;
    });
    setLoadingNotifications(false);
    return true;
  };

  useEffect(() => {
    if (!ENABLE_NOTIFICATIONS) return;

    let cancelled = false;
    const retryTimers: number[] = [];

    // Load ngay khi vào trang, và thử lại vài lần nếu chưa thành công
    // (token có thể chưa sẵn sàng ngay sau khi reload) để badge luôn hiển thị.
    const loadWithRetry = async (attempt = 0) => {
      if (cancelled) return;
      const ok = await loadNotifications();
      if (!ok && attempt < 3 && !cancelled) {
        const t = window.setTimeout(() => void loadWithRetry(attempt + 1), 1200);
        retryTimers.push(t);
      }
    };
    void loadWithRetry();

    // ── Real-time qua SSE (Server-Sent Events) ─────────────────
    // Server đẩy sự kiện "notification" ngay khi có thông báo mới → chuông cập
    // nhật tức thời, không cần chờ poll. EventSource tự động reconnect khi rớt mạng.
    let eventSource: EventSource | null = null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      try {
        eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
        eventSource.addEventListener('notification', () => {
          void loadNotifications();
        });
      } catch {
        eventSource = null;
      }
    }

    // Poll dự phòng, thưa (60s) — chỉ là lưới an toàn khi SSE bị gián đoạn.
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 60000);

    // Làm mới ngay khi người dùng quay lại tab (không phải chờ hết chu kỳ)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      retryTimers.forEach((t) => window.clearTimeout(t));
      window.clearInterval(interval);
      eventSource?.close();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

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
        renderItem={(n: NotificationItemWithEmpty) => {
          if (n.id === 'empty') {
            return (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
                <BellOutlined style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                <div>{n.title}</div>
              </div>
            );
          }
          // After type guard, n is now typed as HomeNotificationItem
          const notif = n as HomeNotificationItem;
          const icon =
            notif.kind === 'success' ? (
              <FolderOpenOutlined style={{ color: '#16a34a', fontSize: 20 }} />
            ) : notif.kind === 'warn' ? (
              <ExclamationCircleOutlined style={{ color: '#dc2626', fontSize: 20 }} />
            ) : (
              <InfoCircleOutlined style={{ color: '#3b82f6', fontSize: 20 }} />
            );
          return (
            <div
              onClick={() => openNotificationDetail(notif)}
              style={{
                display: 'flex',
                gap: 14,
                padding: '14px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f1f5f9',
                background: notif.openedAt ? 'transparent' : '#f0f9ff',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ display: 'block', fontSize: 14, color: '#1e293b' }}>
                  {notif.title}
                </Text>
                <Text style={{ fontSize: 13, display: 'block', marginTop: 4, color: '#475569' }}>
                  {notif.desc}
                </Text>
                {notif.time ? (
                  <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block', fontWeight: 500 }}>
                    {notif.time}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
          <Button
            icon={<LoginOutlined />}
            onClick={handleJoin}
            style={{
              borderRadius: 8,
              fontWeight: 500,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {!isMobile && 'Tham gia'}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            style={{
              borderRadius: 8,
              fontWeight: 600,
              height: 36,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {!isMobile && 'Tạo cuộc họp'}
          </Button>
          <Popover 
            content={content} 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Thông báo mới</span>
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ReloadOutlined />}
                  loading={loadingNotifications}
                  onClick={() => void loadNotifications()}
                  title="Làm mới thông báo"
                />
              </div>
            } 
            trigger="click"
            placement="bottomRight"
            onOpenChange={(visible) => {
              // Tự làm mới ngay khi mở dropdown để không cần bấm nút làm mới
              if (visible) void loadNotifications();
            }}
          >
            <Badge count={unreadCount} style={{ backgroundColor: '#ef4444' }} offset={[-4, 4]}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: unreadCount > 0 ? '#dbeafe' : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }} className={`header-bell-icon${unreadCount > 0 ? ' has-unread' : ''}`}>
                <BellOutlined style={{ fontSize: 18, color: unreadCount > 0 ? '#2563eb' : '#475569' }} />
              </div>
            </Badge>
          </Popover>
        </div>
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
                  const id = openedNotification.meetingId;
                  setOpenedNotification(null);
                  router.push(`/meetings/${id}`);
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
