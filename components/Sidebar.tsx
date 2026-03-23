'use client';

import React, { useState } from 'react';
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
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const setCollapsed = (value: boolean) => {
    if (onCollapse) {
      onCollapse(value);
    } else {
      setInternalCollapsed(value);
    }
  };

  // UI Component cho Tag "Sắp ra mắt" phù hợp với nền tối
  const ComingSoonTag = () => (
    <Tag bordered={false} color="rgba(255, 255, 255, 0.2)" style={{ borderRadius: '10px', fontSize: '11px', margin: 0, color: '#e2e8f0' }}>
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
          label: (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>Quản lý Cơ cấu tổ chức</span>
              {!collapsed && <ComingSoonTag />}
            </Space>
          ),
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
        backgroundColor: '#0E131F', // Màu nền Dark Navy giống hình
        boxShadow: '4px 0 16px rgba(0, 0, 0, 0.15)',
      }}
      theme="dark" // Đổi sang theme dark
    >
      <div
        className="sidebar-header"
        style={{
          padding: collapsed ? '16px 8px' : '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)', // Viền mờ cho dark theme
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Avatar
              size={collapsed ? 32 : 40}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#3b82f6' }} // Đổi màu avatar sang xanh sáng
            />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong ellipsis style={{ display: 'block', fontSize: 14, color: '#ffffff' }}> {/* Chữ màu trắng */}
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
                darkSubMenuItemBg: 'transparent', // Thay cho darkItemSubBg để fix lỗi TypeScript
                darkItemSelectedBg: '#3b82f6', // Nền xanh dương khi click
                darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
                darkItemColor: '#94a3b8', // Màu xám nhạt cho item bình thường
                darkItemSelectedColor: '#ffffff',
                itemBorderRadius: 8, // Bo góc tạo khối
                itemMarginInline: 12, // Khoảng cách 2 lề tạo hiệu ứng lơ lửng
              },
            },
          }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={getSelectedKeys()}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ borderRight: 0, backgroundColor: 'transparent' }}
          />
        </ConfigProvider>
      </div>

      <div
        className="sidebar-footer"
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)', // Viền mờ
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