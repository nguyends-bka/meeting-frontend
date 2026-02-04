'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Typography, Avatar, Space, Tag, Button } from 'antd';
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
        <Space>
          <span>Lịch cuộc họp</span>
          <Tag color="default">Sắp ra mắt</Tag>
        </Space>
      ),
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: (
        <Space>
          <span>Báo cáo</span>
          <Tag color="default">Sắp ra mắt</Tag>
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

  // Menu items cho Admin (thêm các mục quản trị)
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
            <Space>
              <span>Thống kê & Phân tích</span>
              <Tag color="default">Sắp ra mắt</Tag>
            </Space>
          ),
        },
        {
          key: '/admin/logs',
          icon: <FileTextOutlined />,
          label: (
            <Space>
              <span>Nhật ký hệ thống</span>
              <Tag color="default">Sắp ra mắt</Tag>
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
        <Space>
          <span>Lịch cuộc họp</span>
          <Tag color="default">Sắp ra mắt</Tag>
        </Space>
      ),
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: (
        <Space>
          <span>Báo cáo</span>
          <Tag color="default">Sắp ra mắt</Tag>
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
      // Mở modal join meeting (sẽ xử lý trong page)
      router.push('/?action=join');
      return;
    }

    router.push(key);
  };

  // Xác định selected key dựa trên pathname
  const getSelectedKeys = () => {
    if (pathname === '/') return ['/'];
    if (pathname.startsWith('/admin')) {
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
      }}
      theme="light"
    >
      <div
        className="sidebar-header"
        style={{
          padding: collapsed ? '16px 8px' : '16px',
          borderBottom: '1px solid #f0f0f0',
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space>
            <Avatar
              size={collapsed ? 32 : 40}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#1890ff' }}
            />
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong ellipsis style={{ display: 'block', fontSize: 14 }}>
                  {user?.username}
                </Text>
                {isAdmin && (
                  <Tag color="red" style={{ marginTop: 4 }}>
                    Admin
                  </Tag>
                )}
              </div>
            )}
          </Space>
        </Space>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </div>

      <div
        className="sidebar-footer"
        style={{
          padding: '16px',
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fff',
          flexShrink: 0,
        }}
      >
        <Button
          type="text"
          danger
          icon={<LogoutOutlined />}
          onClick={logout}
          block
          style={{ textAlign: 'left' }}
        >
          {!collapsed && 'Đăng xuất'}
        </Button>
      </div>
    </Sider>
  );
}
