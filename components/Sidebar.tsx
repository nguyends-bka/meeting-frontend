'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Typography, Avatar, Space, Tag, Button, ConfigProvider } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  VideoCameraOutlined,
  PlusOutlined,
  HistoryOutlined,
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
  CalendarOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ApartmentOutlined, // Thêm icon cho Cơ cấu tổ chức
} from '@ant-design/icons';
import { useAuth } from '@/lib/auth';

const { Sider } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

interface SidebarProps {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed: externalCollapsed, onCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const avatarSrc = user?.faceTemplate ? `data:image/jpeg;base64,${user.faceTemplate}` : undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [sidebarTheme, setSidebarTheme] = useState<'light' | 'dark'>('dark');
  
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const setCollapsed = (value: boolean) => {
    if (onCollapse) {
      onCollapse(value);
    } else {
      setInternalCollapsed(value);
    }
  };

  useEffect(() => {
    const readTheme = (): 'light' | 'dark' => {
      const fromStorage = (localStorage.getItem('current_theme') || '').toLowerCase();
      if (fromStorage === 'light' || fromStorage === 'dark') return fromStorage;
      const fromAttr = (document.documentElement.getAttribute('data-theme') || '').toLowerCase();
      if (fromAttr === 'light' || fromAttr === 'dark') return fromAttr;
      return 'light';
    };

    const syncTheme = () => setSidebarTheme(readTheme());
    syncTheme();

    window.addEventListener('storage', syncTheme);
    window.addEventListener('theme-changed', syncTheme as EventListener);
    return () => {
      window.removeEventListener('storage', syncTheme);
      window.removeEventListener('theme-changed', syncTheme as EventListener);
    };
  }, []);

  const isDark = sidebarTheme === 'dark';

  // UI Component cho Tag "Sắp ra mắt" phù hợp với nền tối
  const ComingSoonTag = () => (
    <Tag
      bordered={false}
      color={isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.08)'}
      style={{
        borderRadius: '10px',
        fontSize: '11px',
        margin: 0,
        color: isDark ? '#e2e8f0' : '#334155',
      }}
    >
      Sắp ra mắt
    </Tag>
  );

  // Menu items cho User thường
  const userMenuItems: MenuItem[] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Trang chủ',
    },
    {
      key: '/meetings',
      icon: <VideoCameraOutlined />,
      label: 'Cuộc họp của tôi',
    },
    {
      key: '/join',
      icon: <PlusOutlined />,
      label: 'Tham gia cuộc họp',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: 'Lịch sử tham gia',
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>Lịch cuộc họp</span>
          {!collapsed && <ComingSoonTag />}
        </Space>
      ),
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>Báo cáo</span>
          {!collapsed && <ComingSoonTag />}
        </Space>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Thông tin cá nhân',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt',
    },
  ];

  // Menu items cho Admin
  const adminMenuItems: MenuItem[] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: 'Trang chủ',
    },
    {
      key: '/meetings',
      icon: <VideoCameraOutlined />,
      label: 'Tất cả cuộc họp',
    },
    {
      key: '/join',
      icon: <PlusOutlined />,
      label: 'Tham gia cuộc họp',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: 'Lịch sử tham gia',
    },
    {
      type: 'divider',
    },
    {
      key: 'admin-group',
      label: 'Quản trị',
      type: 'group',
      children: [
        {
          key: '/admin/organization',
          icon: <ApartmentOutlined />, // Icon phù hợp cho sơ đồ tổ chức
          label: 'Quản lý Cơ cấu tổ chức',
        },
        {
          key: '/admin',
          icon: <TeamOutlined />,
          label: 'Quản lý Users',
        },
        {
          key: '/admin/meetings',
          icon: <VideoCameraOutlined />,
          label: 'Quản lý Meetings',
        },
        {
          key: '/admin/analytics',
          icon: <BarChartOutlined />,
          label: (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Thống kê & Phân tích</span>
              {!collapsed && <ComingSoonTag />}
            </Space>
          ),
        },
        {
          key: '/admin/logs',
          icon: <FileTextOutlined />,
          label: (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Nhật ký hệ thống</span>
              {!collapsed && <ComingSoonTag />}
            </Space>
          ),
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>Lịch cuộc họp</span>
          {!collapsed && <ComingSoonTag />}
        </Space>
      ),
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>Báo cáo</span>
          {!collapsed && <ComingSoonTag />}
        </Space>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Thông tin cá nhân',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Cài đặt',
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === '/logout') {
      logout();
      return;
    }
    
    // Xử lý các route đặc biệt
    if (key === '/join') {
      router.push('/?action=join');
      return;
    }

    router.push(key);
  };

  // Xác định selected key dựa trên pathname
  const getSelectedKeys = () => {
    if (pathname === '/') return ['/'];
    if (pathname.startsWith('/admin')) {
      if (pathname === '/admin/organization') return ['/admin/organization'];
      if (pathname === '/admin/meetings') return ['/admin/meetings'];
      if (pathname === '/admin/analytics') return ['/admin/analytics'];
      if (pathname === '/admin/logs') return ['/admin/logs'];
      return ['/admin'];
    }
    if (pathname.startsWith('/meeting')) return ['/meetings'];
    if (pathname.startsWith('/history')) return ['/history'];
    if (pathname === '/settings') return ['/settings'];
    if (pathname === '/profile') return ['/profile'];
    if (pathname === '/join') return ['/join'];
    if (pathname === '/calendar') return ['/calendar'];
    if (pathname === '/reports') return ['/reports'];
    return [pathname];
  };

  return (
    <Sider
      className="app-sidebar"
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      width={250}
      collapsedWidth={80}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: isDark ? '#0E131F' : '#ffffff',
        boxShadow: isDark ? '4px 0 16px rgba(0, 0, 0, 0.15)' : '2px 0 12px rgba(15, 23, 42, 0.08)',
      }}
      theme={isDark ? 'dark' : 'light'}
    >
      <div
        className="sidebar-header"
        style={{
          padding: collapsed ? '16px 8px' : '16px',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Avatar
              size={collapsed ? 32 : 40}
              src={avatarSrc}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#3b82f6' }}
            />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong ellipsis style={{ display: 'block', fontSize: 14, color: isDark ? '#ffffff' : '#0f172a' }}>
                  {user?.fullName}
                </Text>
                {isAdmin && (
                  <Tag color="red" style={{ marginTop: 4, border: 'none' }}>
                    Admin
                  </Tag>
                )}
              </div>
            )}
          </Space>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Bọc ConfigProvider để chỉnh Style Menu giống ảnh */}
        <ConfigProvider
          theme={{
            components: {
              Menu: {
                darkItemBg: 'transparent',
                darkSubMenuItemBg: 'transparent',
                darkItemSelectedBg: '#3b82f6',
                darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
                darkItemColor: '#94a3b8',
                darkItemSelectedColor: '#ffffff',
                itemBg: 'transparent',
                itemHoverBg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                itemColor: isDark ? '#94a3b8' : '#334155',
                itemSelectedBg: '#3b82f6',
                itemSelectedColor: '#ffffff',
                itemBorderRadius: 8, // Bo góc tạo khối
                itemMarginInline: 12, // Khoảng cách 2 lề tạo hiệu ứng lơ lửng
              },
            },
          }}
        >
          <Menu
            theme={isDark ? 'dark' : 'light'}
            mode="inline"
            selectedKeys={getSelectedKeys()}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ borderRight: 0, backgroundColor: 'transparent' }}
          />
        </ConfigProvider>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .app-sidebar .ant-menu .ant-menu-item.ant-menu-item-selected,
          .app-sidebar .ant-menu-dark .ant-menu-item.ant-menu-item-selected,
          .app-sidebar .ant-menu-light .ant-menu-item.ant-menu-item-selected {
            background: ${isDark ? 'rgba(59, 130, 246, 0.22)' : '#4f7ff0'} !important;
            border: 1px solid ${isDark ? 'rgba(96, 165, 250, 0.7)' : '#4f7ff0'} !important;
            color: #ffffff !important;
            font-weight: 600;
            border-radius: 8px !important;
            box-shadow: ${isDark ? '0 0 0 1px rgba(59, 130, 246, 0.15) inset' : 'none'};
          }
          .app-sidebar .ant-menu .ant-menu-item.ant-menu-item-selected:hover,
          .app-sidebar .ant-menu-dark .ant-menu-item.ant-menu-item-selected:hover,
          .app-sidebar .ant-menu-light .ant-menu-item.ant-menu-item-selected:hover {
            background: ${isDark ? 'rgba(59, 130, 246, 0.30)' : '#4f7ff0'} !important;
            color: #ffffff !important;
          }
          .app-sidebar .ant-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
            color: ${isDark ? '#93c5fd' : '#4f7ff0'} !important;
            font-weight: 600;
          }
          .app-sidebar .ant-menu .ant-menu-item.ant-menu-item-selected .ant-menu-item-icon,
          .app-sidebar .ant-menu .ant-menu-item.ant-menu-item-selected .anticon {
            color: #ffffff !important;
          }
          `,
        }}
      />

      <div
        className="sidebar-footer"
        style={{
          padding: '16px',
          borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e5e7eb',
          backgroundColor: 'transparent',
          flexShrink: 0,
        }}
      >
        <Button
          type="text"
          danger
          icon={<LogoutOutlined />}
          onClick={logout}
          block
          style={{ textAlign: 'left', borderRadius: 8 }}
        >
          {!collapsed && 'Đăng xuất'}
        </Button>
      </div>
    </Sider>
  );
}