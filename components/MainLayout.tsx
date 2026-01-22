'use client';

import React, { useState } from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';

const { Content } = Layout;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />
      <Layout 
        style={{ 
          marginLeft: collapsed ? 80 : 250, 
          transition: 'margin-left 0.2s',
          minHeight: '100vh',
        }}
      >
        <Content
          style={{
            margin: 0,
            padding: 0,
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
